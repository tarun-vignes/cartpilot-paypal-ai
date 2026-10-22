import express, { type ErrorRequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  requestSchema,
  type Recommendation,
  type ShoppingRequest,
} from '../src/shared';
import { catalog } from './catalog';
import { recommend } from './ai';
import type { Settings } from './config';
import { AppError } from './errors';
import { SandboxPayPal, type PayPalPort } from './paypal';
import { Orders } from './orders';
import { quoteCart } from './pricing';

type Services = {
  paypal?: PayPalPort;
  ai?: (request: ShoppingRequest) => Promise<Recommendation>;
};
export function createApp(config: Settings, services: Services = {}) {
  const app = express();
  app.disable('x-powered-by');
  const orders = new Orders(services.paypal || new SandboxPayPal(config));
  const sessions = new Map<
    string,
    { expires: number; window: number; count: number }
  >();
  app.use((_req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      'X-Frame-Options': 'DENY',
    });
    next();
  });
  app.get('/healthz', (_req, res) => {
    res.set('Cache-Control', 'no-store');
    res.json({ status: 'ok', sandbox: true });
  });
  app.use('/api', express.json({ limit: '16kb' }));
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (
      req.method !== 'GET' &&
      (req.get('X-CartPilot') !== '1' ||
        !req.is('application/json') ||
        (req.get('Origin') && req.get('Origin') !== config.origin))
    )
      return next(
        new AppError(
          403,
          'ORIGIN',
          'This action must be initiated from the CartPilot application.',
        ),
      );
    for (const [id, value] of sessions)
      if (value.expires < Date.now()) sessions.delete(id);
    const cookie = req.headers.cookie
      ?.split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('cartpilot_session='))
      ?.slice('cartpilot_session='.length);
    let id = cookie && sessions.has(cookie) ? cookie : undefined;
    if (!id) {
      if (sessions.size >= 1000)
        return next(
          new AppError(
            503,
            'CAPACITY',
            'Demo session capacity reached. Try later.',
          ),
        );
      id = randomUUID();
      sessions.set(id, {
        expires: Date.now() + 3600000,
        window: Date.now(),
        count: 0,
      });
      res.cookie('cartpilot_session', id, {
        httpOnly: true,
        sameSite: 'lax',
        secure: config.origin.startsWith('https:'),
        maxAge: 3600000,
        path: '/',
      });
    }
    const session = sessions.get(id)!;
    if (Date.now() - session.window > 60000) {
      session.window = Date.now();
      session.count = 0;
    }
    if (req.method !== 'GET' && ++session.count > 30)
      return next(
        new AppError(
          429,
          'RATE_LIMIT',
          'Too many requests. Wait a minute and try again.',
        ),
      );
    res.locals.owner = id;
    next();
  });
  const available = !!(config.paypalId && config.paypalSecret);
  app.get('/api/config', (_req, res) => {
    res.json({
      aiAvailable: config.aiProvider === 'gemini' && !!config.geminiKey,
      aiModel:
        config.aiProvider === 'gemini' && config.geminiKey
          ? config.geminiModel
          : null,
      paypalAvailable: available,
      sandbox: true,
      catalog,
    });
  });
  app.post('/api/recommend', async (req, res) => {
    const input = requestSchema.parse(req.body);
    res.json(
      await (services.ai ? services.ai(input) : recommend(input, config)),
    );
  });
  app.post('/api/cart/quote', (req, res) => res.json(quoteCart(req.body)));
  const createSchema = z
    .object({ attempt: z.string().uuid(), cart: z.unknown() })
    .strict();
  app.post('/api/orders', async (req, res) => {
    const input = createSchema.parse(req.body);
    if (!available)
      throw new AppError(
        503,
        'PAYPAL_UNAVAILABLE',
        'PayPal sandbox checkout is unavailable. Configure server sandbox credentials. No payment was attempted.',
      );
    res.json(await orders.create(res.locals.owner, input.attempt, input.cart));
  });
  const attempt = (value: unknown) => z.string().uuid().parse(value);
  app.get('/api/orders/:attempt', async (req, res) =>
    res.json(
      await orders.refresh(res.locals.owner, attempt(req.params.attempt)),
    ),
  );
  app.post('/api/orders/:attempt/capture', async (req, res) => {
    z.object({ approved: z.literal(true) })
      .strict()
      .parse(req.body);
    res.json(
      await orders.capture(res.locals.owner, attempt(req.params.attempt)),
    );
  });
  app.post('/api/orders/:attempt/cancel', (req, res) => {
    z.object({}).strict().parse(req.body);
    res.json(orders.cancel(res.locals.owner, attempt(req.params.attempt)));
  });
  app.use('/api', (_req, _res, next) =>
    next(new AppError(404, 'NOT_FOUND', 'API route not found.')),
  );
  const errors: ErrorRequestHandler = (error, _req, res, _next) => {
    if (error instanceof z.ZodError)
      return void res.status(400).json({
        code: 'INVALID_REQUEST',
        error:
          'Invalid request. Check product IDs, quantities, and the required fields. Client prices are not accepted.',
      });
    if (error instanceof AppError)
      return void res
        .status(error.status)
        .json({ code: error.code, error: error.message });
    if (error?.type === 'entity.too.large')
      return void res
        .status(413)
        .json({ code: 'TOO_LARGE', error: 'The request is too large.' });
    if (error instanceof SyntaxError)
      return void res
        .status(400)
        .json({ code: 'INVALID_JSON', error: 'Send a valid JSON request.' });
    res.status(500).json({
      code: 'SERVER_ERROR',
      error:
        'The request could not be completed. Please retry. No payment success has been confirmed.',
    });
  };
  app.use(errors);
  return app;
}
