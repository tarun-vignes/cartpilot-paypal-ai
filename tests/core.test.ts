import { describe, it, expect, vi } from 'vitest';
import {
  demoParse,
  validateModelOutput,
  rankCatalog,
  recommend,
} from '../server/ai';
import { quoteCart } from '../server/pricing';
import {
  orderPayload,
  paypalOrderSchema,
  SandboxPayPal,
  verifiedCapture,
} from '../server/paypal';
import { settingsFromEnv } from '../server/config';
import { requestSchema } from '../src/shared';
import { catalog } from '../server/catalog';

const config = settingsFromEnv({});
const request = (prompt: string) =>
  requestSchema.parse({
    prompt,
    controls: {
      maxPriceCents: null,
      category: 'all',
      delivery: 'any',
      excludedFeatures: [],
    },
  });
const quote = quoteCart({ items: [{ productId: 'keys-01', quantity: 1 }] });

describe('intent and factual grounding', () => {
  it('parses a budget, fragility, and delivery without claiming AI', async () => {
    const response = await recommend(
      request(
        'A practical student gift under $60. Nothing fragile, arrive quickly.',
      ),
      config,
    );
    expect(response.mode).toBe('demo');
    expect(response.constraints.maxPriceCents).toBe(6000);
    expect(response.constraints.requiredFeatures).toContain('non-fragile');
    expect(response.constraints.delivery).toBe('fast');
    expect(response.picks[0].product.id).toBe('keys-01');
    expect(response.picks[0].fits).toBe(true);
  });
  it('rejects invented product IDs, duplicates, and malformed AI output', () => {
    const parsed = demoParse('A student gift under $60');
    expect(() =>
      validateModelOutput({ ...parsed, rankedProductIds: ['imaginary'] }),
    ).toThrow('validated');
    expect(() =>
      validateModelOutput({
        ...parsed,
        rankedProductIds: ['keys-01', 'keys-01'],
      }),
    ).toThrow('validated');
    expect(() =>
      validateModelOutput({
        ...parsed,
        constraints: { ...parsed.constraints, maxPriceCents: 20.5 },
      }),
    ).toThrow('validated');
    expect(() => validateModelOutput({ ...parsed, price: 'fake' })).toThrow(
      'validated',
    );
  });
  it('shows no match instead of pretending a budget works', () => {
    const req = request('A reusable bottle under $20, fast delivery');
    const result = rankCatalog(demoParse(req.prompt), req, 'demo', null);
    expect(result.noMatch).toBe(true);
    expect(result.picks.every((p) => !p.fits)).toBe(true);
    expect(
      result.picks.some((p) => p.mismatches.some((m) => m.includes('budget'))),
    ).toBe(true);
  });
  it('applies the stricter explicit budget and feature exclusion', () => {
    const req = request('Wireless keyboard under $60');
    req.controls.maxPriceCents = 3000;
    req.controls.excludedFeatures = ['wireless'];
    const result = rankCatalog(demoParse(req.prompt), req, 'demo', null);
    expect(result.constraints.maxPriceCents).toBe(3000);
    expect(result.noMatch).toBe(true);
    expect(result.picks.every((p) => !p.fits)).toBe(true);
  });
  it('marks unsupported requests and unavailable inventory as mismatches', () => {
    const req = request('A waterproof laptop under $100');
    expect(rankCatalog(demoParse(req.prompt), req, 'demo', null).noMatch).toBe(
      true,
    );
    expect(catalog.find((p) => p.id === 'mouse-08')?.available).toBe(false);
  });
  it('uses schema-validated Gemini output but generates all product facts locally', async () => {
    const output = demoParse('Student gift under $60');
    const transport = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [
            { content: { parts: [{ text: JSON.stringify(output) }] } },
          ],
        }),
        { status: 200 },
      ),
    );
    const result = await recommend(
      request('Student gift under $60'),
      { ...config, geminiKey: 'test-key' },
      transport,
    );
    expect(result.mode).toBe('gemini');
    expect(result.picks[0].product).toEqual(catalog[0]);
    const body = JSON.parse(String(transport.mock.calls[0][1]?.body));
    expect(body.generationConfig.responseJsonSchema).toBeDefined();
  });
  it('does not silently fall back after a provider failure or malformed response', async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{}', { status: 429 }));
    await expect(
      recommend(
        request('Student gift please'),
        { ...config, geminiKey: 'test' },
        transport,
      ),
    ).rejects.toThrow('Gemini is unavailable');
    transport.mockResolvedValue(
      new Response(
        JSON.stringify({
          candidates: [{ content: { parts: [{ text: 'not json' }] } }],
        }),
      ),
    );
    await expect(
      recommend(
        request('Student gift please'),
        { ...config, geminiKey: 'test' },
        transport,
      ),
    ).rejects.toThrow('invalid');
  });
  it('explicit demo mode never contacts Gemini', async () => {
    const transport = vi.fn<typeof fetch>();
    const req = request('Gift under $60');
    req.mode = 'demo';
    expect(
      (await recommend(req, { ...config, geminiKey: 'test' }, transport)).mode,
    ).toBe('demo');
    expect(transport).not.toHaveBeenCalled();
  });
});

describe('money and sandbox boundary', () => {
  it('calculates totals as integer cents including the shipping boundary', () => {
    expect(quote.subtotalCents).toBe(3900);
    expect(quote.shippingCents).toBe(495);
    expect(quote.totalCents).toBe(4395);
    expect(
      quoteCart({ items: [{ productId: 'power-02', quantity: 2 }] }).totalCents,
    ).toBe(5800);
    expect(Number.isInteger(quote.totalCents)).toBe(true);
  });
  it('rejects quantities, unknown products, duplicate products and manipulated prices', () => {
    for (const quantity of [0, -1, 1.5, 6, '1'])
      expect(() =>
        quoteCart({ items: [{ productId: 'keys-01', quantity }] }),
      ).toThrow();
    expect(() =>
      quoteCart({ items: [{ productId: 'fake', quantity: 1 }] }),
    ).toThrow();
    expect(() =>
      quoteCart({ items: [{ productId: 'mouse-08', quantity: 1 }] }),
    ).toThrow();
    expect(() =>
      quoteCart({
        items: [{ productId: 'keys-01', quantity: 1, priceCents: 1 }],
      }),
    ).toThrow();
    expect(() =>
      quoteCart({
        items: [
          { productId: 'keys-01', quantity: 1 },
          { productId: 'keys-01', quantity: 1 },
        ],
      }),
    ).toThrow();
  });
  it('constructs an itemized PayPal payload from server prices', () => {
    const payload = orderPayload(quote, config.origin, 'attempt');
    expect(payload.intent).toBe('CAPTURE');
    expect(payload.purchase_units[0].amount.value).toBe('43.95');
    expect(payload.purchase_units[0].items[0].unit_amount.value).toBe('39.00');
    expect(payload.purchase_units[0].amount.breakdown.shipping.value).toBe(
      '4.95',
    );
    expect(
      payload.payment_source.paypal.experience_context.return_url,
    ).toContain('/checkout/return');
  });
  it('rejects live mode and untrusted app origins', () => {
    expect(() => settingsFromEnv({ PAYPAL_ENV: 'live' })).toThrow('sandbox');
    expect(() =>
      settingsFromEnv({ APP_ORIGIN: 'http://public.example' }),
    ).toThrow('HTTPS');
  });
  it('rejects pending, wrong-amount and wrong-currency captures', () => {
    const raw = {
      id: 'ORDER123',
      status: 'COMPLETED',
      purchase_units: [
        {
          amount: { currency_code: 'USD', value: '43.95' },
          payments: {
            captures: [
              {
                id: 'CAPTURE123',
                status: 'COMPLETED',
                amount: { currency_code: 'USD', value: '43.95' },
              },
            ],
          },
        },
      ],
    };
    expect(verifiedCapture(paypalOrderSchema.parse(raw), quote)).toBe(
      'CAPTURE123',
    );
    expect(() =>
      verifiedCapture(
        paypalOrderSchema.parse({ ...raw, status: 'PENDING' }),
        quote,
      ),
    ).toThrow();
    expect(() =>
      verifiedCapture(
        {
          ...raw,
          purchase_units: [{ amount: { currency_code: 'USD', value: '0.01' } }],
        },
        quote,
      ),
    ).toThrow();
    expect(() =>
      paypalOrderSchema.parse({
        ...raw,
        purchase_units: [{ amount: { currency_code: 'EUR', value: '43.95' } }],
      }),
    ).toThrow();
  });
  it('uses only sandbox endpoints and validates approval links', async () => {
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: 'mock-token', expires_in: 3600 }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 'ORDER123',
            status: 'CREATED',
            purchase_units: [
              { amount: { currency_code: 'USD', value: '43.95' } },
            ],
            links: [
              {
                rel: 'payer-action',
                href: 'https://www.paypal.com/checkoutnow',
              },
            ],
          }),
        ),
      );
    const paypal = new SandboxPayPal(
      { ...config, paypalId: 'fake-id', paypalSecret: 'fake-secret' },
      transport,
    );
    await expect(paypal.create(quote, 'request', 'attempt')).rejects.toThrow(
      'approval link',
    );
    expect(
      transport.mock.calls.every(([url]) =>
        String(url).startsWith('https://api-m.sandbox.paypal.com/'),
      ),
    ).toBe(true);
    expect(
      (transport.mock.calls[1][1]?.headers as Record<string, string>)[
        'PayPal-Request-Id'
      ],
    ).toBe('request');
  });
  it('retrieves the full order after a capture response omits its original amount', async () => {
    const completed = {
      id: 'ORDER123',
      status: 'COMPLETED',
      purchase_units: [
        {
          amount: { currency_code: 'USD', value: '43.95' },
          payments: {
            captures: [
              {
                id: 'CAPTURE123',
                status: 'COMPLETED',
                amount: { currency_code: 'USD', value: '43.95' },
              },
            ],
          },
        },
      ],
    };
    const transport = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: 'fixture-token', expires_in: 3600 }),
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ...completed,
            purchase_units: [
              { payments: completed.purchase_units[0].payments },
            ],
          }),
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify(completed)));
    const paypal = new SandboxPayPal(
      { ...config, paypalId: 'fixture-id', paypalSecret: 'fixture-secret' },
      transport,
    );
    const result = await paypal.capture('ORDER123', 'capture-request');
    expect(verifiedCapture(result, quote)).toBe('CAPTURE123');
    expect(transport.mock.calls[2][1]?.method).toBe('GET');
  });
});
