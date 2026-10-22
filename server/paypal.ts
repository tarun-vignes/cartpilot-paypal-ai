import { z } from 'zod';
import { decimal } from './pricing';
import type { Quote } from '../src/shared';
import type { Settings } from './config';
import { AppError } from './errors';

// Deliberately not configurable: this application cannot target PayPal live endpoints.
const BASE = 'https://api-m.sandbox.paypal.com';
const amountSchema = z.object({
  currency_code: z.literal('USD'),
  value: z.string().regex(/^\d+\.\d{2}$/),
});
const captureSchema = z.object({
  id: z.string().min(1).max(100),
  status: z.string(),
  amount: amountSchema,
});
export const paypalOrderSchema = z.object({
  id: z.string().regex(/^[A-Z0-9]{5,40}$/),
  status: z.string(),
  purchase_units: z
    .array(
      z.object({
        reference_id: z.string().optional(),
        amount: amountSchema,
        payments: z.object({ captures: z.array(captureSchema) }).optional(),
      }),
    )
    .length(1),
  links: z
    .array(z.object({ href: z.string().url(), rel: z.string() }))
    .optional(),
});
export type PayPalOrder = z.infer<typeof paypalOrderSchema>;
export type PayPalPort = {
  create(
    quote: Quote,
    requestId: string,
    attempt: string,
  ): Promise<{ id: string; approvalUrl: string }>;
  get(id: string): Promise<PayPalOrder>;
  capture(id: string, requestId: string): Promise<PayPalOrder>;
};

export function orderPayload(quote: Quote, origin: string, attempt: string) {
  return {
    intent: 'CAPTURE',
    purchase_units: [
      {
        reference_id: 'cartpilot',
        description: 'CartPilot fictional catalog — SANDBOX ONLY',
        amount: {
          currency_code: 'USD',
          value: decimal(quote.totalCents),
          breakdown: {
            item_total: {
              currency_code: 'USD',
              value: decimal(quote.subtotalCents),
            },
            shipping: {
              currency_code: 'USD',
              value: decimal(quote.shippingCents),
            },
            tax_total: { currency_code: 'USD', value: '0.00' },
          },
        },
        items: quote.items.map(({ product, quantity }) => ({
          name: product.name,
          sku: product.id,
          quantity: String(quantity),
          category: 'PHYSICAL_GOODS',
          unit_amount: {
            currency_code: 'USD',
            value: decimal(product.priceCents),
          },
        })),
      },
    ],
    payment_source: {
      paypal: {
        experience_context: {
          brand_name: 'CartPilot Sandbox',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'PAY_NOW',
          return_url: `${origin}/checkout/return?attempt=${attempt}`,
          cancel_url: `${origin}/checkout/cancel?attempt=${attempt}`,
        },
      },
    },
  };
}

export function verifyAmount(order: PayPalOrder, quote: Quote) {
  if (
    order.purchase_units.length !== 1 ||
    order.purchase_units[0].amount.currency_code !== 'USD' ||
    order.purchase_units[0].amount.value !== decimal(quote.totalCents)
  )
    throw new AppError(
      409,
      'AMOUNT_MISMATCH',
      'PayPal order amount or currency does not match your reviewed cart. No success has been reported.',
    );
}
export function verifiedCapture(order: PayPalOrder, quote: Quote): string {
  verifyAmount(order, quote);
  const captures = order.purchase_units[0].payments?.captures;
  if (
    order.status !== 'COMPLETED' ||
    captures?.length !== 1 ||
    captures[0].status !== 'COMPLETED' ||
    captures[0].amount.currency_code !== 'USD' ||
    captures[0].amount.value !== decimal(quote.totalCents)
  )
    throw new AppError(
      409,
      'CAPTURE_UNCONFIRMED',
      'Sandbox capture is not confirmed. Do not create another order; retry verification for this order.',
    );
  return captures[0].id;
}

export class SandboxPayPal implements PayPalPort {
  private token = '';
  private tokenExpires = 0;
  constructor(
    private config: Settings,
    private transport: typeof fetch = fetch,
  ) {}
  private async accessToken() {
    if (!this.config.paypalId || !this.config.paypalSecret)
      throw new AppError(
        503,
        'PAYPAL_UNAVAILABLE',
        'PayPal sandbox checkout is unavailable. Add sandbox credentials on the server. No payment was attempted.',
      );
    if (this.token && Date.now() < this.tokenExpires) return this.token;
    try {
      const response = await this.transport(`${BASE}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${this.config.paypalId}:${this.config.paypalSecret}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw new Error('Unavailable');
      const payload = z
        .object({
          access_token: z.string().min(1),
          expires_in: z.number().positive(),
        })
        .parse(await response.json());
      this.token = payload.access_token;
      this.tokenExpires =
        Date.now() + Math.max(0, payload.expires_in - 60) * 1000;
      return this.token;
    } catch {
      throw new AppError(
        503,
        'PAYPAL_AUTH',
        'PayPal sandbox authentication failed. Check sandbox credentials on the server.',
      );
    }
  }
  private async call(
    path: string,
    method: 'GET' | 'POST',
    body?: unknown,
    requestId?: string,
  ) {
    const token = await this.accessToken();
    try {
      const response = await this.transport(`${BASE}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
          ...(requestId ? { 'PayPal-Request-Id': requestId } : {}),
        },
        ...(method === 'POST' ? { body: JSON.stringify(body ?? {}) } : {}),
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error('Provider failure');
      return await response.json();
    } catch {
      throw new AppError(
        502,
        'PAYPAL_NETWORK',
        'PayPal sandbox could not confirm this request. Retry the same order; do not create a replacement payment.',
      );
    }
  }
  async create(quote: Quote, requestId: string, attempt: string) {
    const raw = await this.call(
      '/v2/checkout/orders',
      'POST',
      orderPayload(quote, this.config.origin, attempt),
      requestId,
    );
    const order = paypalOrderSchema.safeParse(raw);
    if (!order.success)
      throw new AppError(
        502,
        'PAYPAL_RESPONSE',
        'PayPal returned an unexpected sandbox order.',
      );
    verifyAmount(order.data, quote);
    const link = order.data.links?.find(
      (link) => link.rel === 'payer-action' || link.rel === 'approve',
    );
    const url = link ? new URL(link.href) : null;
    if (
      !url ||
      url.protocol !== 'https:' ||
      url.hostname !== 'www.sandbox.paypal.com' ||
      url.username ||
      url.password
    )
      throw new AppError(
        502,
        'PAYPAL_LINK',
        'PayPal sandbox approval link was unavailable.',
      );
    return { id: order.data.id, approvalUrl: url.toString() };
  }
  async get(id: string) {
    return this.parse(
      await this.call(`/v2/checkout/orders/${encodeURIComponent(id)}`, 'GET'),
    );
  }
  async capture(id: string, requestId: string) {
    const raw = await this.call(
      `/v2/checkout/orders/${encodeURIComponent(id)}/capture`,
      'POST',
      {},
      requestId,
    );
    const envelope = z
      .object({
        id: z.literal(id),
        status: z.string(),
        purchase_units: z
          .array(
            z.object({
              payments: z.object({ captures: z.array(captureSchema) }),
            }),
          )
          .length(1),
      })
      .safeParse(raw);
    if (!envelope.success)
      throw new AppError(
        502,
        'PAYPAL_RESPONSE',
        'Sandbox capture response was unexpected. Retry verification for this order.',
      );
    // Capture representations may omit the original order amount. Retrieve the full
    // order, then verify both the original amount and the completed capture.
    return this.get(id);
  }
  private parse(raw: unknown) {
    const result = paypalOrderSchema.safeParse(raw);
    if (!result.success)
      throw new AppError(
        502,
        'PAYPAL_RESPONSE',
        'PayPal sandbox returned an unexpected order response.',
      );
    return result.data;
  }
}
