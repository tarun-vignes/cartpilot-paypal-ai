import 'dotenv/config';
import { settingsFromEnv } from '../server/config';
import { recommend } from '../server/ai';
import { requestSchema } from '../src/shared';
const config = settingsFromEnv(process.env);
if (!config.geminiKey || config.aiProvider === 'demo')
  throw new Error(
    'Real Gemini credentials must be configured for this opt-in smoke check.',
  );
const result = await recommend(
  requestSchema.parse({
    prompt:
      'A practical gift for a computer science student under $60. Nothing fragile, and please prioritize fast delivery.',
    controls: {
      category: 'all',
      delivery: 'any',
      maxPriceCents: null,
      excludedFeatures: [],
    },
  }),
  config,
);
console.log(
  JSON.stringify(
    {
      mode: result.mode,
      model: result.model,
      constraints: result.constraints,
      productIds: result.picks.map((p) => p.product.id),
      noMatch: result.noMatch,
    },
    null,
    2,
  ),
);
