import { expect, it } from 'vitest';
import { settingsFromEnv } from '../server/config';

it('uses the actual Render service URL for origin checks and PayPal callbacks', () => {
  expect(
    settingsFromEnv({
      RENDER_EXTERNAL_URL: 'https://assigned-name.onrender.com',
      PORT: '10000',
    }),
  ).toMatchObject({
    origin: 'https://assigned-name.onrender.com',
    port: 10000,
  });
});
it('preserves an explicit HTTPS custom origin over the Render hostname', () => {
  expect(
    settingsFromEnv({
      APP_ORIGIN: 'https://shop.example.com',
      RENDER_EXTERNAL_URL: 'https://assigned-name.onrender.com',
    }).origin,
  ).toBe('https://shop.example.com');
});
