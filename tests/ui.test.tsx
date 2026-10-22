// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../src/App';
import { api } from '../src/api';
import { catalog } from '../server/catalog';
import { quoteCart } from '../server/pricing';
import { demoParse, rankCatalog } from '../server/ai';
import { requestSchema, type Config, type OrderView } from '../src/shared';

vi.mock('../src/api', () => ({ api: vi.fn() }));
const config: Config = {
  aiAvailable: false,
  aiModel: null,
  paypalAvailable: false,
  sandbox: true,
  catalog,
};
const request = requestSchema.parse({
  prompt: 'A student gift under $60',
  controls: {
    category: 'all',
    delivery: 'any',
    maxPriceCents: null,
    excludedFeatures: [],
  },
});
const recommendation = rankCatalog(
  demoParse(request.prompt),
  request,
  'demo',
  null,
);
const quote = quoteCart({ items: [{ productId: 'keys-01', quantity: 1 }] });

beforeEach(() => {
  sessionStorage.clear();
  window.history.replaceState({}, '', '/');
  Element.prototype.scrollIntoView = vi.fn();
  vi.mocked(api).mockReset();
  vi.mocked(api).mockImplementation(async (path, body) => {
    if (path === '/api/config') return config;
    if (path === '/api/recommend') return recommendation;
    if (path === '/api/cart/quote') return quoteCart(body);
    throw new Error('Unexpected test API call');
  });
});
afterEach(cleanup);
async function analyze() {
  const button = await screen.findByRole('button', { name: /Find my fit/ });
  await waitFor(() => expect(button).toBeEnabled());
  fireEvent.click(button);
}
describe('shopping interface', () => {
  it('shows welcome and honest unavailable service states', async () => {
    render(<App />);
    expect(
      await screen.findByText(
        'Demo recommendation logic is active. No AI is used until a Gemini key is configured.',
      ),
    ).toBeVisible();
    expect(screen.getByRole('heading', { name: /Good finds/ })).toBeVisible();
    expect(
      screen.getByRole('button', { name: /Continue to PayPal sandbox/ }),
    ).toBeDisabled();
    expect(screen.getByText(/Checkout unavailable:/)).toBeVisible();
  });
  it('displays constraints and adds a server-priced cart without starting checkout', async () => {
    render(<App />);
    await analyze();
    expect(
      await screen.findByRole('heading', { name: 'A shortlist with reasons.' }),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole('button', { name: /Add to cart · \$39.00/ }),
    );
    expect(await screen.findByText('$43.95')).toBeVisible();
    expect(
      screen.getByRole('button', { name: /Continue to PayPal sandbox/ }),
    ).toBeDisabled();
    expect(
      vi.mocked(api).mock.calls.some(([path]) => path === '/api/orders'),
    ).toBe(false);
  });
  it('shows truthful no-match results', async () => {
    vi.mocked(api).mockImplementation(async (path) =>
      path === '/api/config' ? config : { ...recommendation, noMatch: true },
    );
    render(<App />);
    await analyze();
    expect(
      await screen.findByRole('heading', { name: 'Nothing checks every box.' }),
    ).toBeVisible();
    expect(screen.getByText(/No catalog product satisfies/)).toBeVisible();
  });
  it('requires an explicit fallback choice after AI failure', async () => {
    vi.mocked(api).mockImplementation(async (path, body) => {
      if (path === '/api/config')
        return { ...config, aiAvailable: true, aiModel: 'fixture' };
      if ((body as { mode: string })?.mode === 'demo') return recommendation;
      throw new Error('Gemini is unavailable.');
    });
    render(<App />);
    await analyze();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Gemini is unavailable',
    );
    expect(
      screen.queryByRole('heading', { name: 'A shortlist with reasons.' }),
    ).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole('button', { name: 'Use demo recommendation logic' }),
    );
    expect(
      await screen.findByRole('heading', { name: 'A shortlist with reasons.' }),
    ).toBeVisible();
  });
  it.each(['completed', 'canceled', 'approved'] as const)(
    'shows %s checkout only from server state',
    async (state) => {
      window.history.replaceState({}, '', '/checkout/return?attempt=123');
      const order: OrderView = {
        id: 'ORDER123',
        state,
        quote,
        ...(state === 'completed' ? { captureId: 'CAPTURE123' } : {}),
      };
      vi.mocked(api).mockImplementation(async (path) =>
        path === '/api/config' ? config : order,
      );
      render(<App />);
      if (state === 'completed')
        expect(
          await screen.findByText('PayPal sandbox capture confirmed.'),
        ).toBeVisible();
      else if (state === 'canceled')
        expect(
          await screen.findByRole('heading', {
            name: 'Checkout canceled. Your call.',
          }),
        ).toBeVisible();
      else {
        expect(
          await screen.findByRole('button', {
            name: /Complete sandbox purchase/,
          }),
        ).toBeVisible();
        expect(
          vi.mocked(api).mock.calls.some(([path]) => path.endsWith('/capture')),
        ).toBe(false);
      }
    },
  );
  it('does not display success when capture fails', async () => {
    window.history.replaceState({}, '', '/checkout/return?attempt=123');
    vi.mocked(api).mockImplementation(async (path) => {
      if (path === '/api/config') return config;
      if (path.endsWith('/capture'))
        throw new Error('Capture could not be confirmed.');
      return { id: 'ORDER123', state: 'approved', quote };
    });
    render(<App />);
    fireEvent.click(
      await screen.findByRole('button', { name: /Complete sandbox purchase/ }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Capture could not be confirmed',
    );
    expect(
      screen.queryByText('PayPal sandbox capture confirmed.'),
    ).not.toBeInTheDocument();
  });
  it('clears a canceled pending attempt so a new reviewed checkout can start', async () => {
    sessionStorage.setItem('cartpilot-attempt', 'canceled-attempt');
    window.history.replaceState(
      {},
      '',
      '/checkout/cancel?attempt=canceled-attempt',
    );
    vi.mocked(api).mockImplementation(async (path) =>
      path === '/api/config'
        ? config
        : { id: 'ORDER123', state: 'canceled', quote },
    );
    render(<App />);
    expect(
      await screen.findByRole('heading', {
        name: 'Checkout canceled. Your call.',
      }),
    ).toBeVisible();
    expect(sessionStorage.getItem('cartpilot-attempt')).toBeNull();
  });
});
