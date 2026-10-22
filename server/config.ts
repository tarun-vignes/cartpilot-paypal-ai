import { z } from 'zod';
export type Settings = {
  origin: string;
  port: number;
  aiProvider: 'gemini' | 'demo';
  geminiKey: string;
  geminiModel: string;
  paypalId: string;
  paypalSecret: string;
};
export function settingsFromEnv(env: NodeJS.ProcessEnv): Settings {
  if (env.PAYPAL_ENV && env.PAYPAL_ENV !== 'sandbox')
    throw new Error('Only PAYPAL_ENV=sandbox is supported.');
  const origin = env.APP_ORIGIN || 'http://localhost:3000';
  const url = new URL(origin);
  if (
    url.origin !== origin ||
    url.username ||
    url.password ||
    (url.protocol !== 'https:' &&
      !['localhost', '127.0.0.1'].includes(url.hostname))
  )
    throw new Error(
      'APP_ORIGIN must be an HTTPS origin or local HTTP origin, with no trailing slash.',
    );
  return {
    origin,
    port: z.coerce
      .number()
      .int()
      .min(1024)
      .max(65535)
      .parse(env.PORT || 3000),
    aiProvider: z.enum(['gemini', 'demo']).parse(env.AI_PROVIDER || 'gemini'),
    geminiKey: env.GEMINI_API_KEY || '',
    geminiModel: z
      .string()
      .regex(/^[a-zA-Z0-9.-]+$/)
      .parse(env.GEMINI_MODEL || 'gemini-3.1-flash-lite'),
    paypalId: env.PAYPAL_CLIENT_ID || '',
    paypalSecret: env.PAYPAL_CLIENT_SECRET || '',
  };
}
