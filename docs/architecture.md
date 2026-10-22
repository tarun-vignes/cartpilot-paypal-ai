# Architecture

```mermaid
sequenceDiagram
    participant S as Shopper / React
    participant A as Express server
    participant G as Gemini
    participant P as PayPal sandbox
    S->>A: Shopping request + optional controls
    A->>G: Request + compact fictional catalog + JSON schema
    G-->>A: Structured constraints + ranked catalog IDs
    A->>A: Validate IDs; calculate fits and mismatches from catalog
    A-->>S: Parsed constraints + grounded shortlist + mode label
    S->>A: Explicit item IDs and quantities
    A-->>S: Server-priced itemized quote in USD cents
    S->>A: User reviews total, consents, starts checkout
    A->>P: OAuth + create order with trusted totals and request ID
    P-->>A: Sandbox order ID + approval link
    A-->>S: Validated sandbox approval URL
    S->>P: Shopper explicitly approves on PayPal sandbox
    P-->>S: Return to CartPilot
    S->>A: Verify session-owned order
    A->>P: GET order; verify ID, status, currency and amount
    A-->>S: Approved order + frozen total
    S->>A: Explicit complete-sandbox-purchase action
    A->>P: Verify again; capture with stable server request ID
    A->>P: GET complete order after capture
    A->>A: Verify order and completed capture amount/status
    A-->>S: Confirmed sandbox result, or safe unconfirmed error
```

## Modules

`src/shared.ts` defines the public types and Zod input/model schemas. `server/catalog.ts` is the trusted source of product facts. `server/ai.ts` provides Gemini and explicit demo modes and deterministic fact-based reasoning. `server/pricing.ts` owns cent arithmetic. `server/paypal.ts` owns hardcoded sandbox transport and provider-response validation. `server/orders.ts` owns session-bound state and idempotency. `server/app.ts` validates HTTP intent, JSON bodies, session ownership, and safe errors. `src/App.tsx` owns the interaction flow and never authorizes payment through AI.

## State and retry behavior

- The browser stores only cart IDs/quantities and an attempt UUID in sessionStorage. They are untrusted and revalidated.
- The server stores frozen quotes, owner session IDs, order IDs, expiration, and separate random provider request IDs. Raw PayPal payer records are not stored.
- Create retries for the same session/attempt use the same provider key; changing the cart under a reused attempt is rejected. Provider create keys are independent of client IDs so another session cannot reuse them.
- Capture checks remote approval first. Concurrent capture requests share one promise and all retries use the same provider capture key. An already-completed remote order is verified rather than recaptured.
- Cancellation blocks later local capture. A status refresh cannot overwrite a cancellation that occurred while its remote GET was in flight.
- Payment failure never becomes a synthetic success. An ambiguous response prompts same-order verification. A completed label requires actual provider completion data in the live path.
- Sessions and orders expire after one hour. Restart loses them. This prototype requires one process and manual sandbox reconciliation after an ambiguous restart.

## Trust boundaries

User text is data, not instructions to the payment service. Gemini has no tools, credentials, checkout endpoint, or authority to buy. It can only return a bounded structured interpretation and catalog ranking. Unsupported or misinterpreted requests remain possible, so the shopper reviews parsed constraints and options.

Browser-submitted prices, additional fields, fractional/negative/excessive quantities and unknown/unavailable products are rejected. Output is rendered through React text escaping, with no raw model HTML. PayPal approval URLs are restricted to its sandbox host. Provider responses are parsed and sanitized; secrets, tokens, payer details and raw API error bodies are never returned or logged.

The API requires same-origin browser intent for mutations, uses HttpOnly/SameSite cookies, bounded JSON, timeouts and session-level mutation limits. This is not a production commerce platform: persistent audit trails, webhooks, distributed locks, fraud controls, real inventory, shipping, tax computation and deployment hardening are deliberately absent.
