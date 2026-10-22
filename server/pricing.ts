import { cartSchema, type Quote } from '../src/shared';
import { productById } from './catalog';
import { AppError } from './errors';
export const decimal = (cents: number) =>
  `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
export function quoteCart(input: unknown): Quote {
  const { items } = cartSchema.parse(input);
  if (new Set(items.map((i) => i.productId)).size !== items.length)
    throw new AppError(400, 'DUPLICATE_ITEM', 'Use one quantity per product.');
  const lines = items.map((item) => {
    const product = productById(item.productId);
    if (!product || !product.available)
      throw new AppError(
        400,
        'PRODUCT_UNAVAILABLE',
        'One of the selected products is not available in the catalog.',
      );
    return {
      product,
      quantity: item.quantity,
      lineCents: product.priceCents * item.quantity,
    };
  });
  const subtotalCents = lines.reduce((sum, item) => sum + item.lineCents, 0);
  // Explicit demo policy: $4.95 shipping below $50; no tax modeled.
  const shippingCents = subtotalCents >= 5000 ? 0 : 495;
  return {
    items: lines,
    subtotalCents,
    shippingCents,
    taxCents: 0,
    totalCents: subtotalCents + shippingCents,
    currency: 'USD',
  };
}
