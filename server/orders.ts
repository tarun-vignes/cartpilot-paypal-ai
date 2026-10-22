import { createHash, randomUUID } from 'node:crypto';
import type { OrderView, Quote } from '../src/shared';
import { AppError } from './errors';
import { type PayPalPort, verifiedCapture, verifyAmount } from './paypal';
import { quoteCart } from './pricing';

type Order = {
  owner: string;
  attempt: string;
  fingerprint: string;
  quote: Quote;
  expires: number;
  state: OrderView['state'];
  createRequestId: string;
  captureRequestId: string;
  id?: string;
  approvalUrl?: string;
  captureId?: string;
  creating?: Promise<void>;
  capturing?: Promise<OrderView>;
};
export class Orders {
  private records = new Map<string, Order>();
  constructor(private paypal: PayPalPort) {}
  private key(owner: string, attempt: string) {
    return `${owner}:${attempt}`;
  }
  private find(owner: string, attempt: string) {
    const order = this.records.get(this.key(owner, attempt));
    if (
      !order ||
      order.owner !== owner ||
      order.expires < Date.now() ||
      !order.id
    )
      throw new AppError(
        404,
        'ORDER_NOT_FOUND',
        'This sandbox order is unavailable or expired. Return to your cart. Server restarts clear demo orders.',
      );
    return order;
  }
  private view(order: Order): OrderView {
    return {
      id: order.id!,
      state: order.state,
      quote: order.quote,
      ...(order.captureId ? { captureId: order.captureId } : {}),
    };
  }
  async create(owner: string, attempt: string, input: unknown) {
    const quote = quoteCart(input);
    const fingerprint = createHash('sha256')
      .update(JSON.stringify(quote))
      .digest('hex');
    const key = this.key(owner, attempt);
    for (const [k, value] of this.records)
      if (value.expires < Date.now() && !value.creating && !value.capturing)
        this.records.delete(k);
    let order = this.records.get(key);
    if (order && order.fingerprint !== fingerprint)
      throw new AppError(
        409,
        'CART_CHANGED',
        'This request already belongs to a different cart. Start a new checkout after reviewing the changes.',
      );
    if (order?.state === 'canceled')
      throw new AppError(
        409,
        'ORDER_CANCELED',
        'This checkout was canceled. Review your cart and start a new checkout.',
      );
    if (!order) {
      if (this.records.size >= 500)
        throw new AppError(
          503,
          'CAPACITY',
          'Demo order capacity reached. Try later.',
        );
      order = {
        owner,
        attempt,
        fingerprint,
        quote,
        expires: Date.now() + 60 * 60 * 1000,
        state: 'awaiting_approval',
        createRequestId: randomUUID(),
        captureRequestId: randomUUID(),
      };
      this.records.set(key, order);
    }
    const record = order;
    if (!record.id && !record.creating)
      record.creating = this.paypal
        .create(quote, record.createRequestId, attempt)
        .then((result) => {
          record.id = result.id;
          record.approvalUrl = result.approvalUrl;
        })
        .finally(() => {
          record.creating = undefined;
        });
    if (record.creating) await record.creating;
    return { ...this.view(record), approvalUrl: record.approvalUrl! };
  }
  async refresh(owner: string, attempt: string) {
    const order = this.find(owner, attempt);
    if (order.state === 'canceled' || order.state === 'completed')
      return this.view(order);
    if (order.capturing) return order.capturing;
    const remote = await this.paypal.get(order.id!);
    // A cancellation can occur while a status GET is in flight.
    const currentState = this.find(owner, attempt).state;
    if (currentState === 'canceled' || currentState === 'completed')
      return this.view(order);
    if (remote.id !== order.id)
      throw new AppError(
        409,
        'ORDER_MISMATCH',
        'Sandbox order verification failed.',
      );
    verifyAmount(remote, order.quote);
    if (remote.status === 'COMPLETED') {
      order.captureId = verifiedCapture(remote, order.quote);
      order.state = 'completed';
    } else
      order.state =
        remote.status === 'APPROVED' ? 'approved' : 'awaiting_approval';
    return this.view(order);
  }
  async capture(owner: string, attempt: string) {
    const order = this.find(owner, attempt);
    if (order.state === 'completed') return this.view(order);
    if (order.state === 'canceled')
      throw new AppError(
        409,
        'ORDER_CANCELED',
        'Canceled sandbox orders cannot be captured.',
      );
    if (order.capturing) return order.capturing;
    order.capturing = (async () => {
      const remote = await this.paypal.get(order.id!);
      if (remote.id !== order.id)
        throw new AppError(
          409,
          'ORDER_MISMATCH',
          'Sandbox order verification failed.',
        );
      verifyAmount(remote, order.quote);
      if (remote.status === 'COMPLETED') {
        order.captureId = verifiedCapture(remote, order.quote);
        order.state = 'completed';
        return this.view(order);
      }
      if (remote.status !== 'APPROVED')
        throw new AppError(
          409,
          'APPROVAL_REQUIRED',
          'Approve this sandbox order on PayPal before completing checkout.',
        );
      const result = await this.paypal.capture(
        order.id!,
        order.captureRequestId,
      );
      if (result.id !== order.id)
        throw new AppError(
          409,
          'ORDER_MISMATCH',
          'Sandbox capture verification failed.',
        );
      order.captureId = verifiedCapture(result, order.quote);
      order.state = 'completed';
      return this.view(order);
    })().finally(() => {
      order.capturing = undefined;
    });
    return order.capturing;
  }
  cancel(owner: string, attempt: string) {
    const order = this.find(owner, attempt);
    if (order.capturing)
      throw new AppError(
        409,
        'CAPTURE_PENDING',
        'Capture verification is in progress. Wait and verify this order.',
      );
    if (order.state !== 'completed') order.state = 'canceled';
    return this.view(order);
  }
}
