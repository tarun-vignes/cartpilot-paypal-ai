import { randomUUID } from 'node:crypto';
import supertest from 'supertest';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import { createApp } from '../server/app';
import { settingsFromEnv } from '../server/config';
import type { PayPalOrder, PayPalPort } from '../server/paypal';

const config = {
  ...settingsFromEnv({}),
  paypalId: 'fixture-id',
  paypalSecret: 'fixture-secret',
};
const cart = { items: [{ productId: 'keys-01', quantity: 1 }] };
const headers = { 'X-CartPilot': '1', Origin: config.origin };
const remote = (status = 'APPROVED', value = '43.95'): PayPalOrder => ({
  id: 'ORDER123',
  status,
  purchase_units: [
    {
      amount: { currency_code: 'USD', value },
      ...(status === 'COMPLETED'
        ? {
            payments: {
              captures: [
                {
                  id: 'CAPTURE123',
                  status: 'COMPLETED',
                  amount: { currency_code: 'USD', value },
                },
              ],
            },
          }
        : {}),
    },
  ],
});

describe('server checkout state and security', () => {
  it('serves a public health check without credentials or sessions', async () => {
    const response = await supertest(createApp(settingsFromEnv({}))).get(
      '/healthz',
    );
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok', sandbox: true });
    expect(response.headers['set-cookie']).toBeUndefined();
  });
  let port: PayPalPort;
  beforeEach(() => {
    port = {
      create: vi.fn().mockResolvedValue({
        id: 'ORDER123',
        approvalUrl:
          'https://www.sandbox.paypal.com/checkoutnow?token=ORDER123',
      }),
      get: vi.fn().mockResolvedValue(remote()),
      capture: vi.fn().mockResolvedValue(remote('COMPLETED')),
    };
  });
  it('provides safe configuration without secrets', async () => {
    const response = await supertest(createApp(config, { paypal: port })).get(
      '/api/config',
    );
    expect(response.status).toBe(200);
    expect(response.body.paypalAvailable).toBe(true);
    expect(JSON.stringify(response.body)).not.toContain('fixture-secret');
    expect(JSON.stringify(response.body)).not.toContain('fixture-id');
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
  });
  it('reports missing credentials without simulating payment', async () => {
    const response = await supertest(
      createApp(
        { ...config, paypalId: '', paypalSecret: '' },
        { paypal: port },
      ),
    )
      .post('/api/orders')
      .set(headers)
      .send({ attempt: randomUUID(), cart });
    expect(response.status).toBe(503);
    expect(response.body.code).toBe('PAYPAL_UNAVAILABLE');
    expect(port.create).not.toHaveBeenCalled();
  });
  it('requires application-origin intent and rejects tampered cart prices', async () => {
    const app = createApp(config, { paypal: port });
    expect(
      (
        await supertest(app)
          .post('/api/orders')
          .send({ attempt: randomUUID(), cart })
      ).status,
    ).toBe(403);
    expect(
      (
        await supertest(app)
          .post('/api/orders')
          .set({ ...headers, Origin: 'https://evil.example' })
          .send({ attempt: randomUUID(), cart })
      ).status,
    ).toBe(403);
    expect(
      (
        await supertest(app)
          .post('/api/cart/quote')
          .set(headers)
          .send({
            items: [{ productId: 'keys-01', quantity: 1, priceCents: 1 }],
          })
      ).status,
    ).toBe(400);
    expect(port.create).not.toHaveBeenCalled();
  });
  it('captures only an approved session-owned order and handles repeated capture once', async () => {
    const agent = supertest.agent(createApp(config, { paypal: port })),
      attempt = randomUUID();
    expect(
      (await agent.post('/api/orders').set(headers).send({ attempt, cart }))
        .status,
    ).toBe(200);
    expect(port.capture).not.toHaveBeenCalled();
    const result = await agent
      .post(`/api/orders/${attempt}/capture`)
      .set(headers)
      .send({ approved: true });
    expect(result.status).toBe(200);
    expect(result.body.state).toBe('completed');
    expect(result.body.captureId).toBe('CAPTURE123');
    expect(
      (
        await agent
          .post(`/api/orders/${attempt}/capture`)
          .set(headers)
          .send({ approved: true })
      ).body.state,
    ).toBe('completed');
    expect(port.capture).toHaveBeenCalledTimes(1);
  });
  it('does not allow session mixing or unapproved capture', async () => {
    const app = createApp(config, { paypal: port }),
      agent = supertest.agent(app),
      attempt = randomUUID();
    await agent.post('/api/orders').set(headers).send({ attempt, cart });
    expect((await supertest(app).get(`/api/orders/${attempt}`)).status).toBe(
      404,
    );
    vi.mocked(port.get).mockResolvedValue(remote('CREATED'));
    expect(
      (
        await agent
          .post(`/api/orders/${attempt}/capture`)
          .set(headers)
          .send({ approved: true })
      ).status,
    ).toBe(409);
    expect(port.capture).not.toHaveBeenCalled();
  });
  it('keeps cancellation separate from successful payment', async () => {
    const agent = supertest.agent(createApp(config, { paypal: port })),
      attempt = randomUUID();
    await agent.post('/api/orders').set(headers).send({ attempt, cart });
    const canceled = await agent
      .post(`/api/orders/${attempt}/cancel`)
      .set(headers)
      .send({});
    expect(canceled.body.state).toBe('canceled');
    expect(canceled.body.captureId).toBeUndefined();
    expect(
      (
        await agent
          .post(`/api/orders/${attempt}/capture`)
          .set(headers)
          .send({ approved: true })
      ).status,
    ).toBe(409);
    expect(port.capture).not.toHaveBeenCalled();
  });
  it('deduplicates order creation and rejects changing a reused cart', async () => {
    const agent = supertest.agent(createApp(config, { paypal: port })),
      attempt = randomUUID();
    await agent.get('/api/config');
    const results = await Promise.all([
      agent.post('/api/orders').set(headers).send({ attempt, cart }),
      agent.post('/api/orders').set(headers).send({ attempt, cart }),
    ]);
    expect(results.map((result) => result.status)).toEqual([200, 200]);
    expect(port.create).toHaveBeenCalledTimes(1);
    const result = await agent
      .post('/api/orders')
      .set(headers)
      .send({
        attempt,
        cart: { items: [{ productId: 'power-02', quantity: 1 }] },
      });
    expect(result.status).toBe(409);
  });
  it('leaves failed captures unconfirmed and recovers a completed timeout safely', async () => {
    const agent = supertest.agent(createApp(config, { paypal: port })),
      attempt = randomUUID();
    await agent.post('/api/orders').set(headers).send({ attempt, cart });
    vi.mocked(port.capture).mockRejectedValue(
      new Error('not a public provider detail'),
    );
    const failed = await agent
      .post(`/api/orders/${attempt}/capture`)
      .set(headers)
      .send({ approved: true });
    expect(failed.status).toBe(500);
    expect(JSON.stringify(failed.body)).not.toContain('provider detail');
    expect(failed.body.state).not.toBe('completed');
    vi.mocked(port.get).mockResolvedValue(remote('COMPLETED'));
    const recovered = await agent
      .post(`/api/orders/${attempt}/capture`)
      .set(headers)
      .send({ approved: true });
    expect(recovered.body.state).toBe('completed');
    expect(port.capture).toHaveBeenCalledTimes(1);
  });
  it('rejects a remote amount mismatch before capture', async () => {
    const agent = supertest.agent(createApp(config, { paypal: port })),
      attempt = randomUUID();
    await agent.post('/api/orders').set(headers).send({ attempt, cart });
    vi.mocked(port.get).mockResolvedValue(remote('APPROVED', '0.01'));
    const response = await agent
      .post(`/api/orders/${attempt}/capture`)
      .set(headers)
      .send({ approved: true });
    expect(response.status).toBe(409);
    expect(port.capture).not.toHaveBeenCalled();
  });
  it('returns safe errors for malformed JSON and oversized requests', async () => {
    const app = createApp(config, { paypal: port });
    expect(
      (
        await supertest(app)
          .post('/api/recommend')
          .set(headers)
          .set('Content-Type', 'application/json')
          .send('{bad')
      ).status,
    ).toBe(400);
    expect(
      (
        await supertest(app)
          .post('/api/recommend')
          .set(headers)
          .send({ prompt: 'x'.repeat(18000) })
      ).status,
    ).toBe(413);
  });
  it('uses different provider idempotency keys for different sessions, even with the same client attempt', async () => {
    const app = createApp(config, { paypal: port }),
      attempt = randomUUID();
    await supertest
      .agent(app)
      .post('/api/orders')
      .set(headers)
      .send({ attempt, cart });
    await supertest
      .agent(app)
      .post('/api/orders')
      .set(headers)
      .send({ attempt, cart });
    const calls = vi.mocked(port.create).mock.calls;
    expect(calls[0][1]).not.toBe(calls[1][1]);
    expect(calls[0][1]).not.toBe(attempt);
    expect(calls[0][2]).toBe(attempt);
  });
  it('retains the same capture request ID after an ambiguous failure', async () => {
    const agent = supertest.agent(createApp(config, { paypal: port })),
      attempt = randomUUID();
    await agent.post('/api/orders').set(headers).send({ attempt, cart });
    vi.mocked(port.capture)
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce(remote('COMPLETED'));
    await agent
      .post(`/api/orders/${attempt}/capture`)
      .set(headers)
      .send({ approved: true });
    const retry = await agent
      .post(`/api/orders/${attempt}/capture`)
      .set(headers)
      .send({ approved: true });
    expect(retry.body.state).toBe('completed');
    const calls = vi.mocked(port.capture).mock.calls;
    expect(calls[0][1]).toBe(calls[1][1]);
  });
});
