import { z } from 'zod';

export const categories = [
  'all',
  'tech',
  'everyday',
  'desk',
  'travel',
] as const;
export const features = [
  'non-fragile',
  'portable',
  'usb-c',
  'wireless',
  'reusable',
  'quiet',
  'water-resistant',
  'ergonomic',
] as const;
export type Feature = (typeof features)[number];
export type Category = (typeof categories)[number];
export type Product = {
  id: string;
  name: string;
  description: string;
  category: Exclude<Category, 'all'>;
  priceCents: number;
  attributes: string[];
  features: Feature[];
  deliveryDays: number;
  available: boolean;
  art:
    | 'keyboard'
    | 'charger'
    | 'bag'
    | 'bottle'
    | 'stand'
    | 'notebook'
    | 'mug'
    | 'mouse';
  color: string;
};
export const constraintsSchema = z
  .object({
    category: z.enum(categories),
    maxPriceCents: z.number().int().min(0).max(1000000).nullable(),
    requiredFeatures: z.array(z.enum(features)).max(8),
    excludedFeatures: z.array(z.enum(features)).max(8),
    delivery: z.enum(['any', 'fast']),
    priorities: z.array(z.string().trim().min(1).max(100)).max(5),
    unhandled: z.array(z.string().trim().min(1).max(160)).max(5),
  })
  .strict();
export type Constraints = z.infer<typeof constraintsSchema>;
export const requestSchema = z
  .object({
    prompt: z.string().trim().min(5).max(1500),
    mode: z.enum(['auto', 'demo']).default('auto'),
    controls: z
      .object({
        maxPriceCents: z.number().int().min(0).max(1000000).nullable(),
        category: z.enum(categories),
        delivery: z.enum(['any', 'fast']),
        excludedFeatures: z.array(z.enum(features)).max(8),
      })
      .strict(),
  })
  .strict();
export type ShoppingRequest = z.infer<typeof requestSchema>;
export const modelSchema = z
  .object({
    constraints: constraintsSchema,
    rankedProductIds: z.array(z.string().min(1).max(60)).min(1).max(8),
  })
  .strict();
export type ModelOutput = z.infer<typeof modelSchema>;
export type ProductMatch = {
  product: Product;
  matches: string[];
  mismatches: string[];
  fits: boolean;
};
export type Recommendation = {
  mode: 'gemini' | 'demo';
  model: string | null;
  constraints: Constraints;
  picks: ProductMatch[];
  noMatch: boolean;
  notice: string;
};
export const cartSchema = z
  .object({
    items: z
      .array(
        z
          .object({
            productId: z.string().min(1).max(60),
            quantity: z.number().int().min(1).max(5),
          })
          .strict(),
      )
      .min(1)
      .max(8),
  })
  .strict();
export type CartInput = z.infer<typeof cartSchema>;
export type Quote = {
  items: { product: Product; quantity: number; lineCents: number }[];
  subtotalCents: number;
  shippingCents: number;
  taxCents: number;
  totalCents: number;
  currency: 'USD';
};
export type Config = {
  aiAvailable: boolean;
  aiModel: string | null;
  paypalAvailable: boolean;
  sandbox: true;
  catalog: Product[];
};
export type CheckoutState =
  | 'awaiting_approval'
  | 'approved'
  | 'completed'
  | 'canceled';
export type OrderView = {
  id: string;
  state: CheckoutState;
  quote: Quote;
  captureId?: string;
};
export const money = (cents: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    cents / 100,
  );
