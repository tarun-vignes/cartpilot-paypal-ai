import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api } from './api';
import { ProductArt } from './ProductArt';
import {
  categories,
  features,
  money,
  type CartInput,
  type Config,
  type Feature,
  type OrderView,
  type Product,
  type Quote,
  type Recommendation,
  type ShoppingRequest,
} from './shared';

const prompts = [
  'A practical gift for a computer science student under $60. Nothing fragile, and I would like it to arrive quickly.',
  'A portable USB-C accessory under $35. Something useful for everyday study.',
  'A reusable bottle under $20, preferably with fast delivery.',
];
const message = (error: unknown) =>
  error instanceof Error
    ? error.message
    : 'Something went wrong. Please retry.';
const savedCart = (): CartInput['items'] => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem('cartpilot-cart') || '[]');
    return Array.isArray(parsed) ? parsed.slice(0, 8) : [];
  } catch {
    return [];
  }
};

export default function App() {
  const [config, setConfig] = useState<Config | null>(null),
    [configError, setConfigError] = useState('');
  const [prompt, setPrompt] = useState(prompts[0]),
    [budget, setBudget] = useState(''),
    [category, setCategory] = useState('all'),
    [delivery, setDelivery] = useState('any'),
    [excluded, setExcluded] = useState<Feature[]>([]);
  const [recommendation, setRecommendation] = useState<Recommendation | null>(
      null,
    ),
    [analyzing, setAnalyzing] = useState(false),
    [analysisError, setAnalysisError] = useState('');
  const [items, setItems] = useState<CartInput['items']>(savedCart),
    [quote, setQuote] = useState<Quote | null>(null),
    [quoteError, setQuoteError] = useState('');
  const [consent, setConsent] = useState(false),
    [checkoutBusy, setCheckoutBusy] = useState(false),
    [checkoutError, setCheckoutError] = useState('');
  const [order, setOrder] = useState<OrderView | null>(null),
    [resultLoading, setResultLoading] = useState(false);
  const attempt = useRef(sessionStorage.getItem('cartpilot-attempt') || '');
  const resultsRef = useRef<HTMLElement>(null);
  const params = new URLSearchParams(window.location.search);
  const returnedAttempt = params.get('attempt');
  const returned = window.location.pathname.startsWith('/checkout/');
  const cancelReturn = window.location.pathname === '/checkout/cancel';

  async function loadConfig() {
    setConfigError('');
    try {
      setConfig(await api<Config>('/api/config'));
    } catch (error) {
      setConfigError(message(error));
    }
  }
  useEffect(() => {
    void loadConfig();
  }, []);
  useEffect(() => {
    sessionStorage.setItem('cartpilot-cart', JSON.stringify(items));
    setConsent(false);
    setQuote(null);
    setQuoteError('');
    if (!items.length) return;
    const controller = new AbortController();
    api<Quote>('/api/cart/quote', { items }, controller.signal)
      .then(setQuote)
      .catch((error) => {
        if (!controller.signal.aborted) setQuoteError(message(error));
      });
    return () => controller.abort();
  }, [items]);
  useEffect(() => {
    if (!returned || !config) return;
    if (!returnedAttempt) {
      setCheckoutError('No sandbox order was identified. Return to your cart.');
      return;
    }
    attempt.current = returnedAttempt;
    sessionStorage.setItem('cartpilot-attempt', returnedAttempt);
    setResultLoading(true);
    const path = `/api/orders/${encodeURIComponent(returnedAttempt)}`;
    api<OrderView>(
      cancelReturn ? `${path}/cancel` : path,
      cancelReturn ? {} : undefined,
    )
      .then(acceptOrder)
      .catch((error) => setCheckoutError(message(error)))
      .finally(() => setResultLoading(false));
    // PayerID and token are not trusted for approval and are not kept in the URL.
    window.history.replaceState(
      {},
      '',
      `${window.location.pathname}?attempt=${encodeURIComponent(returnedAttempt)}`,
    );
  }, [config, returned, returnedAttempt, cancelReturn]);

  function acceptOrder(result: OrderView) {
    setOrder(result);
    if (result.state === 'completed' || result.state === 'canceled') {
      attempt.current = '';
      sessionStorage.removeItem('cartpilot-attempt');
    }
  }
  async function analyze(mode: 'auto' | 'demo' = 'auto') {
    setAnalyzing(true);
    setAnalysisError('');
    setRecommendation(null);
    try {
      const max = budget === '' ? null : Math.round(Number(budget) * 100);
      if (max !== null && (!Number.isFinite(max) || max < 0 || max > 1000000))
        throw new Error('Enter an item budget between $0 and $10,000.');
      const input: ShoppingRequest = {
        prompt,
        mode,
        controls: {
          maxPriceCents: max,
          category: category as ShoppingRequest['controls']['category'],
          delivery: delivery as 'any' | 'fast',
          excludedFeatures: excluded,
        },
      };
      setRecommendation(await api<Recommendation>('/api/recommend', input));
      setTimeout(
        () =>
          resultsRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
          }),
        50,
      );
    } catch (error) {
      setAnalysisError(message(error));
    } finally {
      setAnalyzing(false);
    }
  }
  function editCart(next: CartInput['items']) {
    if (checkoutBusy) return;
    setItems(next);
    setCheckoutError('');
    attempt.current = '';
    sessionStorage.removeItem('cartpilot-attempt');
  }
  function add(product: Product) {
    const existing = items.find((item) => item.productId === product.id);
    editCart(
      existing
        ? items.map((item) =>
            item.productId === product.id
              ? { ...item, quantity: Math.min(5, item.quantity + 1) }
              : item,
          )
        : [...items, { productId: product.id, quantity: 1 }],
    );
  }
  async function checkout() {
    if (!consent || !quote || !config?.paypalAvailable) return;
    setCheckoutBusy(true);
    setCheckoutError('');
    if (!attempt.current) attempt.current = crypto.randomUUID();
    sessionStorage.setItem('cartpilot-attempt', attempt.current);
    try {
      const response = await api<OrderView & { approvalUrl: string }>(
        '/api/orders',
        { attempt: attempt.current, cart: { items } },
      );
      if (response.state === 'completed') {
        window.location.assign(
          `/checkout/return?attempt=${encodeURIComponent(attempt.current)}`,
        );
        return;
      }
      const url = new URL(response.approvalUrl);
      if (
        url.protocol !== 'https:' ||
        url.hostname !== 'www.sandbox.paypal.com'
      )
        throw new Error('An unexpected approval URL was blocked.');
      window.location.assign(url.toString());
    } catch (error) {
      setCheckoutError(message(error));
      setCheckoutBusy(false);
    }
  }
  async function capture() {
    if (!returnedAttempt) return;
    setCheckoutBusy(true);
    setCheckoutError('');
    try {
      acceptOrder(
        await api<OrderView>(
          `/api/orders/${encodeURIComponent(returnedAttempt)}/capture`,
          { approved: true },
        ),
      );
    } catch (error) {
      setCheckoutError(message(error));
    } finally {
      setCheckoutBusy(false);
    }
  }
  async function verify() {
    setResultLoading(true);
    setCheckoutError('');
    try {
      acceptOrder(
        await api<OrderView>(
          `/api/orders/${encodeURIComponent(returnedAttempt || attempt.current)}`,
        ),
      );
    } catch (error) {
      setCheckoutError(message(error));
    } finally {
      setResultLoading(false);
    }
  }
  const cartQuote = returned ? order?.quote : quote;
  const selectedCount = items.reduce(
    (sum, item) => sum + (Number.isInteger(item.quantity) ? item.quantity : 0),
    0,
  );
  const steps = returned ? 3 : recommendation ? 2 : 1;

  return (
    <>
      <div className="sandbox-strip">
        <span className="status-dot" /> A thoughtful shopping demo.{' '}
        <strong>PayPal sandbox only — no real money.</strong>
      </div>
      <header className="site-header">
        <a href="/" className="brand" aria-label="CartPilot home">
          <span className="brand-mark">↗</span>CartPilot
          <span className="brand-period">.</span>
        </a>
        <nav aria-label="Main">
          <a href="#how">How it works</a>
          <a href="#catalog">The demo shelf</a>
          <a className="cart-link" href="#cart">
            Your cart <span>{selectedCount}</span>
          </a>
        </nav>
      </header>
      <main>
        <div className="journey" aria-label="Shopping journey">
          {[
            'Tell us what matters',
            'Consider the options',
            'You approve checkout',
          ].map((label, index) => (
            <div key={label} className={steps === index + 1 ? 'current' : ''}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              {label}
              {index < 2 && <b>→</b>}
            </div>
          ))}
        </div>
        {configError && (
          <div className="notice error" role="alert">
            Could not connect to the application. {configError}{' '}
            <button onClick={() => void loadConfig()}>Retry connection</button>
          </div>
        )}
        {!config && !configError && (
          <div className="notice" role="status">
            Loading the catalog and checking service availability…
          </div>
        )}
        {returned ? (
          <section className="return-panel">
            <span className="eyebrow">YOUR SANDBOX CHECKOUT</span>
            <h1>
              {order?.state === 'completed'
                ? 'All checked. Sandbox complete.'
                : order?.state === 'canceled'
                  ? 'Checkout canceled. Your call.'
                  : 'Back from PayPal. Let’s verify.'}
            </h1>
            {resultLoading && (
              <p role="status">Verifying the order with PayPal sandbox…</p>
            )}
            {order?.state === 'approved' && (
              <>
                <p>
                  PayPal reports this order approved. Review the frozen order
                  total below, then explicitly complete the sandbox capture.
                </p>
                <button
                  className="primary"
                  disabled={checkoutBusy}
                  onClick={() => void capture()}
                >
                  {checkoutBusy
                    ? 'Confirming sandbox capture…'
                    : `Complete sandbox purchase · ${money(order.quote.totalCents)}`}
                </button>
              </>
            )}
            {order?.state === 'awaiting_approval' && (
              <p>
                PayPal has not reported approval. No capture was initiated here.
                Return to the cart to review your checkout.
              </p>
            )}
            {order?.state === 'canceled' && (
              <p>
                This application will not capture the canceled order. Your saved
                cart is still available.
              </p>
            )}
            {order?.state === 'completed' && (
              <div className="notice success">
                <strong>PayPal sandbox capture confirmed.</strong>
                <p>
                  {money(order.quote.totalCents)} USD · Order {order.id}
                  <br />
                  Capture {order.captureId}
                </p>
                <p>
                  This is a sandbox transaction. No real money was charged and
                  no product will ship.
                </p>
              </div>
            )}
            {checkoutError && (
              <div className="notice error" role="alert">
                {checkoutError}
              </div>
            )}
            <div className="return-actions">
              {returnedAttempt && (
                <button
                  disabled={resultLoading || checkoutBusy}
                  onClick={() => void verify()}
                >
                  Verify this order again
                </button>
              )}
              <a className="text-link" href="/">
                Return to shopping →
              </a>
            </div>
          </section>
        ) : (
          <>
            <section className="hero">
              <div className="hero-copy">
                <span className="eyebrow">LESS SCROLLING. MORE CERTAINTY.</span>
                <h1>
                  Good finds.
                  <br />
                  Clear reasons.
                  <br />
                  <em>Your call.</em>
                </h1>
                <p>
                  Tell us who it’s for, what matters, and what you want to
                  spend. We’ll narrow the shelf. You make the decision.
                </p>
                <div className="hero-note">
                  <span>✳</span> Intent → considered shortlist → your approval
                </div>
              </div>
              <div className="request-panel">
                <div className="panel-title">
                  <span className="eyebrow">01 / THE BRIEF</span>
                  <span className="pill">
                    {config?.aiAvailable ? 'Gemini ready' : 'Demo logic'}
                  </span>
                </div>
                <h2>What are you looking for?</h2>
                <form
                  onSubmit={(event: FormEvent) => {
                    event.preventDefault();
                    void analyze();
                  }}
                >
                  <label htmlFor="request">Your shopping request</label>
                  <textarea
                    id="request"
                    value={prompt}
                    maxLength={1500}
                    minLength={5}
                    onChange={(event) => setPrompt(event.target.value)}
                    required
                    rows={4}
                    placeholder="A practical gift for a student under $60…"
                  />
                  <div className="examples">
                    <span>Try a starting point</span>
                    {[
                      'Student gift ↗',
                      'USB-C essentials ↗',
                      'A tighter budget ↗',
                    ].map((label, index) => (
                      <button
                        key={label}
                        type="button"
                        disabled={analyzing}
                        onClick={() => setPrompt(prompts[index])}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <details className="preferences">
                    <summary>
                      Fine-tune your preferences <span>＋</span>
                    </summary>
                    <div className="preference-grid">
                      <label>
                        Maximum item price (USD)
                        <input
                          type="number"
                          min="0"
                          max="10000"
                          step="0.01"
                          value={budget}
                          onChange={(event) => setBudget(event.target.value)}
                          placeholder="From your request"
                        />
                      </label>
                      <label>
                        Category
                        <select
                          value={category}
                          onChange={(event) => setCategory(event.target.value)}
                        >
                          {categories.map((category) => (
                            <option key={category} value={category}>
                              {category === 'all' ? 'Any category' : category}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        Delivery preference
                        <select
                          value={delivery}
                          onChange={(event) => setDelivery(event.target.value)}
                        >
                          <option value="any">Use my request</option>
                          <option value="fast">Fast · ≤2 business days</option>
                        </select>
                      </label>
                      <label>
                        Exclude a feature
                        <select
                          value={excluded[0] || ''}
                          onChange={(event) =>
                            setExcluded(
                              event.target.value
                                ? [event.target.value as Feature]
                                : [],
                            )
                          }
                        >
                          <option value="">No extra exclusion</option>
                          {features.map((feature) => (
                            <option key={feature}>{feature}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <p className="small">
                      Budget applies to one item before shipping. Delivery
                      values are fictional catalog estimates, not dates or
                      shipping promises.
                    </p>
                  </details>
                  <button
                    className="primary analyze"
                    disabled={!config || analyzing}
                    type="submit"
                  >
                    {analyzing ? (
                      <>
                        <span className="spinner" />
                        Understanding your request…
                      </>
                    ) : (
                      <>
                        Find my fit <span>↗</span>
                      </>
                    )}
                  </button>
                  <p className="privacy-note">
                    Only your request and catalog facts go to AI. Please leave
                    out personal or payment details.
                  </p>
                </form>
                {config && !config.aiAvailable && (
                  <p className="service-note">
                    Demo recommendation logic is active. No AI is used until a
                    Gemini key is configured.
                  </p>
                )}
                {analysisError && (
                  <div className="notice error" role="alert">
                    {analysisError}
                    <button
                      onClick={() => void analyze('demo')}
                      disabled={analyzing}
                    >
                      Use demo recommendation logic
                    </button>
                  </div>
                )}
                {analyzing && (
                  <p role="status" className="small">
                    Parsing intent → checking catalog constraints → preparing
                    comparisons. Checkout is never started by AI.
                  </p>
                )}
              </div>
            </section>
            {recommendation && (
              <section
                className="recommendations"
                ref={resultsRef}
                aria-label="Recommendations"
              >
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">
                      02 / CONSIDERED, NOT JUST SORTED
                    </span>
                    <h2>
                      {recommendation.noMatch
                        ? 'Nothing checks every box.'
                        : 'A shortlist with reasons.'}
                    </h2>
                  </div>
                  <span className="pill">
                    {recommendation.mode === 'gemini'
                      ? `AI · ${recommendation.model}`
                      : 'Demo recommendation logic'}
                  </span>
                </div>
                <p className="small">{recommendation.notice}</p>
                <div className="constraints" aria-label="Parsed constraints">
                  <span>
                    Item budget{' '}
                    <b>
                      {recommendation.constraints.maxPriceCents === null
                        ? 'Not specified'
                        : money(recommendation.constraints.maxPriceCents)}
                    </b>
                  </span>
                  <span>
                    Category <b>{recommendation.constraints.category}</b>
                  </span>
                  <span>
                    Delivery{' '}
                    <b>
                      {recommendation.constraints.delivery === 'fast'
                        ? '≤2 business days'
                        : 'Any listed estimate'}
                    </b>
                  </span>
                  {recommendation.constraints.requiredFeatures.map((value) => (
                    <span key={`r${value}`}>
                      Needs <b>{value}</b>
                    </span>
                  ))}
                  {recommendation.constraints.excludedFeatures.map((value) => (
                    <span key={`e${value}`}>
                      Avoid <b>{value}</b>
                    </span>
                  ))}
                </div>
                <p className="small">
                  Inferred priorities:{' '}
                  {recommendation.constraints.priorities.join(' · ') ||
                    'None specified'}
                  . Please check these before choosing.
                </p>
                {recommendation.noMatch && (
                  <div className="notice warning" role="status">
                    No catalog product satisfies every parsed constraint. These
                    are the closest options; their mismatches remain visible.
                    Adjust your request or budget to try again.
                  </div>
                )}
                <div className="product-grid">
                  {recommendation.picks.map((match, index) => (
                    <article className="product-card" key={match.product.id}>
                      <div className="art-wrap">
                        <ProductArt product={match.product} />
                        <span className="art-label">
                          {index === 0
                            ? match.fits
                              ? 'First pick'
                              : 'Closest option'
                            : 'An alternative'}
                        </span>
                      </div>
                      <div className="product-body">
                        <span className="eyebrow">
                          {match.product.category} / DEMO CATALOG
                        </span>
                        <div className="product-title">
                          <h3>{match.product.name}</h3>
                          <strong>{money(match.product.priceCents)}</strong>
                        </div>
                        <p>{match.product.description}</p>
                        <ul className="attributes">
                          {match.product.attributes.map((value) => (
                            <li key={value}>{value}</li>
                          ))}
                        </ul>
                        <div className="reason">
                          <h4>Why consider it</h4>
                          {match.matches.map((value) => (
                            <p key={value}>✓ {value}</p>
                          ))}
                        </div>
                        <div className="tradeoff">
                          <h4>
                            {match.mismatches.length
                              ? 'The tradeoff'
                              : 'Before you choose'}
                          </h4>
                          {(match.mismatches.length
                            ? match.mismatches
                            : [
                                `Demo delivery estimate: ${match.product.deliveryDays} business days. Shipping may add to the item price; review the cart total.`,
                              ]
                          ).map((value) => (
                            <p key={value}>{value}</p>
                          ))}
                        </div>
                        <button
                          className={index === 0 ? 'primary' : 'secondary'}
                          disabled={!match.product.available || checkoutBusy}
                          onClick={() => add(match.product)}
                        >
                          {match.product.available
                            ? `Add to cart · ${money(match.product.priceCents)}`
                            : 'Unavailable in catalog'}{' '}
                          <span>＋</span>
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            )}
          </>
        )}

        <div className="bottom-grid">
          <section id="how" className="how-panel">
            <span className="eyebrow">HOW CARTPILOT DECIDES</span>
            <h2>
              A recommendation.
              <br />
              Not a purchasing permission.
            </h2>
            <div className="explain-step">
              <span>01</span>
              <div>
                <h3>Understand the brief</h3>
                <p>
                  Gemini converts your request into constraints and ranks IDs
                  from this catalog. If unavailable, local demo logic is clearly
                  labeled.
                </p>
              </div>
            </div>
            <div className="explain-step">
              <span>02</span>
              <div>
                <h3>Keep the facts grounded</h3>
                <p>
                  Product details come from the demo catalog. The server checks
                  budget, availability, exclusions, and delivery preferences,
                  and surfaces mismatches.
                </p>
              </div>
            </div>
            <div className="explain-step">
              <span>03</span>
              <div>
                <h3>Leave the final say to you</h3>
                <p>
                  You choose items, review the total, and open PayPal sandbox.
                  Only after PayPal approval and your final confirmation can the
                  server capture an order.
                </p>
              </div>
            </div>
          </section>
          <aside id="cart" className="cart-panel" aria-label="Your cart">
            <div className="panel-title">
              <span className="eyebrow">03 / YOUR DECISION</span>
              <span className="pill">SANDBOX</span>
            </div>
            <h2>
              {returned
                ? 'Your reviewed order'
                : 'A cart you’re in control of.'}
            </h2>
            {!cartQuote && !items.length && !returned && (
              <div className="empty-cart">
                <span>＋</span>
                <h3>Room for a good find.</h3>
                <p>
                  Add an item from your shortlist or the demo shelf. Nothing is
                  purchased automatically.
                </p>
              </div>
            )}
            {!cartQuote && items.length > 0 && !returned && !quoteError && (
              <p role="status">Checking your cart against server prices…</p>
            )}
            {quoteError && (
              <div className="notice error" role="alert">
                {quoteError}
                <button onClick={() => editCart([])}>Clear invalid cart</button>
              </div>
            )}
            {cartQuote && (
              <>
                <div className="cart-items">
                  {cartQuote.items.map(({ product, quantity, lineCents }) => (
                    <div className="cart-item" key={product.id}>
                      <div className="cart-thumb">
                        <ProductArt product={product} />
                      </div>
                      <div>
                        <strong>{product.name}</strong>
                        <p>{money(product.priceCents)} each</p>
                        {!returned && (
                          <div className="quantity">
                            <button
                              disabled={checkoutBusy || quantity <= 1}
                              aria-label={`Decrease ${product.name}`}
                              onClick={() =>
                                editCart(
                                  items.map((item) =>
                                    item.productId === product.id
                                      ? { ...item, quantity: item.quantity - 1 }
                                      : item,
                                  ),
                                )
                              }
                            >
                              −
                            </button>
                            <span>{quantity}</span>
                            <button
                              disabled={checkoutBusy || quantity >= 5}
                              aria-label={`Increase ${product.name}`}
                              onClick={() =>
                                editCart(
                                  items.map((item) =>
                                    item.productId === product.id
                                      ? { ...item, quantity: item.quantity + 1 }
                                      : item,
                                  ),
                                )
                              }
                            >
                              ＋
                            </button>
                            <button
                              className="remove"
                              disabled={checkoutBusy}
                              aria-label={`Remove ${product.name}`}
                              onClick={() =>
                                editCart(
                                  items.filter(
                                    (item) => item.productId !== product.id,
                                  ),
                                )
                              }
                            >
                              Remove
                            </button>
                          </div>
                        )}
                        {returned && <p>Quantity {quantity}</p>}
                      </div>
                      <strong>{money(lineCents)}</strong>
                    </div>
                  ))}
                </div>
                <dl className="totals">
                  <div>
                    <dt>Item subtotal</dt>
                    <dd>{money(cartQuote.subtotalCents)}</dd>
                  </div>
                  <div>
                    <dt>Demo shipping</dt>
                    <dd>
                      {cartQuote.shippingCents
                        ? money(cartQuote.shippingCents)
                        : 'Free'}
                    </dd>
                  </div>
                  <div>
                    <dt>Tax · not modeled</dt>
                    <dd>{money(cartQuote.taxCents)}</dd>
                  </div>
                  <div className="grand-total">
                    <dt>
                      Total <small>USD</small>
                    </dt>
                    <dd>{money(cartQuote.totalCents)}</dd>
                  </div>
                </dl>
                <p className="small">
                  Demo policy: $4.95 shipping below $50; free at $50+. Tax is
                  not modeled. No physical goods ship.
                </p>
              </>
            )}
            {!returned && (
              <>
                {checkoutError && (
                  <div className="notice error" role="alert">
                    {checkoutError}
                  </div>
                )}
                <label className="consent">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                    disabled={!quote || checkoutBusy}
                  />
                  <span>
                    I reviewed the total and want to open{' '}
                    <strong>PayPal sandbox</strong>. This is not a real
                    purchase.
                  </span>
                </label>
                <button
                  className="checkout-button"
                  disabled={
                    !quote ||
                    !consent ||
                    !config?.paypalAvailable ||
                    checkoutBusy
                  }
                  onClick={() => void checkout()}
                >
                  {checkoutBusy
                    ? 'Opening PayPal sandbox…'
                    : 'Continue to PayPal sandbox'}{' '}
                  <span>↗</span>
                </button>
                {!config?.paypalAvailable && (
                  <p className="service-note" role="status">
                    Checkout unavailable: add PayPal sandbox credentials on the
                    server. Catalog exploration still works. No simulated
                    payment success is shown.
                  </p>
                )}
                <p className="privacy-note">
                  PayPal handles sandbox account approval. CartPilot never
                  collects card details.
                </p>
              </>
            )}
          </aside>
        </div>
        {config && !returned && (
          <section id="catalog" className="catalog-section">
            <div className="section-heading">
              <div>
                <span className="eyebrow">SMALL SHELF. CLEAR FACTS.</span>
                <h2>Meet the demo catalog.</h2>
              </div>
              <span className="small">
                {config.catalog.length} original fictional products · USD
              </span>
            </div>
            <p className="small">
              Illustrative products, prices, and delivery estimates made for
              this prototype. No real retailer inventory, ratings, discounts, or
              availability claims.
            </p>
            <div className="catalog-grid">
              {config.catalog.map((product) => (
                <article key={product.id}>
                  <ProductArt product={product} />
                  <div className="catalog-description">
                    <h3>{product.name}</h3>
                    <p>
                      {money(product.priceCents)} · {product.deliveryDays}{' '}
                      business days (demo)
                    </p>
                    <button
                      disabled={!product.available || checkoutBusy}
                      onClick={() => add(product)}
                    >
                      {product.available ? 'Add to cart ＋' : 'Unavailable'}
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </main>
      <footer>
        <a className="brand" href="/">
          CartPilot.
        </a>
        <p>
          Considered shopping. Explicit approval.
          <br />A local prototype for the PayPal AI Hackathon · sandbox
          transactions only.
        </p>
        <span>
          No real purchases.
          <br />
          No products will ship.
        </span>
      </footer>
    </>
  );
}
