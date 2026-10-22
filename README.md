# CartPilot

**Good finds. Clear reasons. Your call.**

CartPilot is a shopping assistant for people who can describe what they need but do not want to compare an endless product list. It turns a plain-language request into visible shopping constraints, a considered shortlist, and an itemized cart. The shopper controls every step toward **PayPal sandbox** approval and capture.

**Source repository: https://github.com/tarun-vignes/cartpilot-paypal-ai**

Run this prototype locally; no hosted application has been deployed. No real money or real products are involved.

**Ready to host:** [Deploy CartPilot on Render](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Ftarun-vignes%2Fcartpilot-paypal-ai). The repository includes a free Node-service Blueprint; see [deployment steps](docs/deployment.md). A Render account connection or manual confirmation is still required, so this link is a deployment launcher, not an already-live app.

## Run locally

Requires **Node.js 22.12+** and npm. In PowerShell, from this project folder:

```powershell
npm.cmd ci
Copy-Item .env.example .env
npm.cmd run dev
```

Open **http://localhost:3000**. `npm.cmd` avoids PowerShell's script execution-policy issue. On macOS/Linux use `npm` and `cp .env.example .env`.

No credentials are needed to explore the fictional catalog, use **demo recommendation logic**, compare options, or calculate carts. This fallback is explicitly labeled and does **not** satisfy the event's real-AI/PayPal integration requirements by itself. Checkout remains disabled without PayPal sandbox credentials. No local simulation is shown as a successful payment.

For the built application:

```powershell
npm.cmd run build
npm.cmd start
```

`npm start` serves the compiled frontend and the TypeScript API in one Node process. This is a server application; GitHub Pages cannot run its private AI and payment endpoints.

## Product journey

1. Enter a request or choose a sample. Optionally set an item budget, category, fast-delivery preference, or excluded feature.
2. Gemini extracts structured constraints and ranks catalog IDs. The server validates its output, checks the catalog, and supplies factual reasons and mismatches. Local fallback is clearly labeled; provider failures require an explicit choice before using fallback.
3. Compare three options. If none fits every parsed constraint, the app says so. Unsupported requirements are marked as unverifiable rather than presented as satisfied.
4. Add items, remove them, or change quantities (1–5 per product). The server recomputes prices and the itemized total from trusted catalog IDs. Quantity is never chosen by AI.
5. Review the total, check the consent box, and explicitly continue to PayPal sandbox. The browser goes to a validated sandbox approval URL.
6. Approve or cancel on PayPal using a **sandbox personal buyer account**. After returning, CartPilot verifies the order through PayPal; URL query parameters do not establish approval.
7. For an approved order, explicitly click **Complete sandbox purchase**. The server retrieves the order, verifies its status and amount, captures it with a stable idempotency key, then checks the complete order and completed capture before displaying success. No capture occurs automatically on page load or AI recommendation.

## Configure real AI

The current provider is **Google Gemini**, called server-side using `models.generateContent` with JSON Schema output. Default model: `gemini-3.1-flash-lite`, verified as available to the existing environment during development. Set these server variables in `.env` or your process environment:

```dotenv
AI_PROVIDER=gemini
GEMINI_API_KEY=your_key_from_google_ai_studio
GEMINI_MODEL=gemini-3.1-flash-lite
```

Create/manage your key in [Google AI Studio](https://aistudio.google.com/apikey). Never put it in a `VITE_` variable. `.env` files are ignored, while `.env.example` contains blank placeholders. `dotenv` preserves an already inherited environment key. Set `AI_PROVIDER=demo` to deliberately disable remote inference.

Gemini receives one shopper request and compact catalog facts, not payment credentials, session data, carts, buyer addresses, or payment responses. The model returns constraints and ranked IDs, **not free-form product claims**. Zod rejects unknown IDs, duplicates, malformed values, or additional fields. Product cards, availability, prices, attribute statements, fit explanations and mismatch checks are assembled on the server. Model interpretation can still be wrong: the inferred constraints remain visible for shopper review.

Timeouts, refused requests, invalid output and provider errors appear visibly. CartPilot never silently calls deterministic logic and labels it AI. To run a small opt-in real inference check (may use provider quota):

```powershell
node --import tsx scripts/check-ai.ts
```

**Observed:** a real inference with the inherited Gemini key succeeded and returned schema-valid constraints and catalog IDs. No key was copied into this project. Automated tests mock all external calls and require no keys.

## Configure PayPal sandbox

Integration: **PayPal REST OAuth 2.0 + Orders v2**, using the supported redirect approval flow. No browser payment SDK is needed. The server handles token exchange, order creation, order retrieval, and capture; the browser receives only the approval link and sanitized local order data. See [Orders v2](https://developer.paypal.com/api/orders/v2), [authentication](https://developer.paypal.com/api/rest/authentication/), and [idempotency](https://developer.paypal.com/api/rest/reference/idempotency/).

1. Sign in to [PayPal Developer Dashboard](https://developer.paypal.com/dashboard/).
2. Under **Apps & Credentials**, select **Sandbox**, create/select a REST app tied to a sandbox business account, and obtain its sandbox client ID and secret. Do not select Live.
3. Under sandbox testing accounts, create/select a separate **personal buyer** account. Use that account only on PayPal's sandbox approval page. Do not enter real card details.
4. Set server configuration, keeping real values out of screenshots, Git and shared documentation:

```dotenv
PAYPAL_ENV=sandbox
PAYPAL_CLIENT_ID=your_sandbox_app_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_app_client_secret
APP_ORIGIN=http://localhost:3000
PORT=3000
```

5. Restart the server. Use exactly the configured origin in the browser; `localhost` and `127.0.0.1` are different origins. `APP_ORIGIN` has no trailing slash and controls the return/cancel URLs. Future hosted use requires an HTTPS origin and server-side environment variables.
6. Create a recommendation, add an item, review the total and consent, approve with the sandbox buyer, and complete capture after returning. Verify the capture ID in your sandbox dashboard.
7. Test cancel, double-click/retry behavior, and a declined or interrupted sandbox flow. If a request is ambiguous, **retry/verify that same order** before considering a replacement. Check the sandbox dashboard if the local process was restarted.

Only `https://api-m.sandbox.paypal.com` is compiled into the payment service. `PAYPAL_ENV=live` is rejected. Only an HTTPS `www.sandbox.paypal.com` approval link is accepted. The client secret and OAuth access token never leave the server or appear in its logs/responses.

**Not yet verified end to end:** no PayPal credentials were available, so no real sandbox order, approval, or capture was performed. Payment code is tested with mocked provider responses. Add credentials and personally complete the above flow before presenting a successful sandbox payment in a submission or video.

## Catalog, money and matching policy

`server/catalog.ts` defines **eight original fictional products**. Prices, descriptions, availability, delivery estimates and SVG illustrations are original demo content under the project's MIT license. There is no external product feed, scraping, real retailer inventory, rating, discount or fulfillment claim. The unavailable mouse intentionally exercises an availability limitation. Two-business-day delivery is a demonstration estimate, not a promised arrival date.

All internal amounts are **integer USD cents**. Decimal strings are produced only at the PayPal boundary. The server accepts catalog IDs and quantities only; manipulated client prices and extra fields are rejected. Shipping is an explicit demo policy: **$4.95 below $50 item subtotal; free at $50+**. Tax is not modeled and is displayed as $0.00. No address or actual fulfillment is collected. PayPal `NO_SHIPPING` is intentional for this fictional-goods sandbox exercise, not a production physical-goods checkout template.

The budget is a **maximum item price**, not a cart-spend limit. The final total may include shipping or multiple items and is always shown before approval. Structured budgets can only tighten the parsed budget; an explicit category overrides the inferred category. Required/excluded features and fast delivery are checked against the catalog. The deterministic parser supports only a limited vocabulary and flags some unsupported requests; neither it nor the AI guarantees perfect understanding of every possible request.

## Architecture and boundaries

- React + TypeScript frontend, Vite build; one Express + TypeScript server.
- `POST /api/recommend`: schema-validated intent, real Gemini or clearly labeled demo logic.
- `POST /api/cart/quote`: trusted catalog lookup and integer-cent totals.
- `POST /api/orders`: shopper-initiated, session-bound sandbox order creation.
- `GET /api/orders/:attempt`: retrieve/verify a session-owned order.
- `POST /api/orders/:attempt/capture`: explicit final approval plus server verification, then capture.
- `POST /api/orders/:attempt/cancel`: stop local capture of a canceled checkout.

Random HttpOnly/SameSite session cookies bind orders to their shopper. Mutations require JSON, a custom intent header, and the configured origin when the browser sends one. There is no cross-origin API allowance. Bodies are capped at 16 KB and mutations at 30/minute per session. Prompt length is capped at 1,500 characters; cart products and quantities are bounded. External requests have timeouts and safe public errors.

Create/capture idempotency keys are generated **on the server**, separately from the client attempt ID and per session-owned order. Duplicate in-flight operations share a promise; capture retries retain the same key. The server verifies both order and completed-capture currency/amount and refuses to claim success for pending, missing, wrong-order or mismatched responses. A lost capture response can be reconciled by retrieving the same order.

This is a **single-process hackathon prototype**. Sessions/orders live in memory for one hour and are lost on restart. Do not deploy multiple replicas or claim durable payment reconciliation, fulfillment, webhooks, tax compliance, inventory reservations, fraud controls, or production readiness. After a restart during an ambiguous payment, inspect PayPal sandbox history; do not start a new purchase blindly. Session-level limits are not a production abuse-control system. No profiles, card storage, payment-credential collection or unnecessary buyer information are implemented.

Full data flow: [docs/architecture.md](docs/architecture.md).

## Checks and verification

```powershell
npm.cmd run format:check
npm.cmd run typecheck
npm.cmd test
npm.cmd run build
```

The test suite covers schema/ID validation, budget/exclusion/no-match behavior, grounding, AI failures, integer pricing, quantity/price tampering, PayPal payloads, approval requirements, cross-session isolation, stable idempotency, cancellation, failed/ambiguous capture recovery, and UI states. All external AI and PayPal calls are mocked.

For an optional real-browser check, start `npm run dev` with **AI_PROVIDER=demo**, then:

```powershell
node --import tsx scripts/browser-check.ts
```

The script uses an already installed Chrome/Edge/Chromium; set `BROWSER_EXECUTABLE` if automatic detection cannot find it. It does not install a browser or make a payment. It checks desktop/mobile flow, cart changes, unavailable checkout, no-match and explicit API-error fallback. Actual screenshots are generated under ignored `artifacts/screenshots/`. See [docs/verification.md](docs/verification.md) for measured results and test limits.

## Hackathon and handoff

The [official event](https://paypalaihackathon.devpost.com/) and [rules](https://paypalaihackathon.devpost.com/rules) were checked on October 22, 2026. Deadline: **November 12, 2026, noon Pacific / 3 p.m. Eastern**. Required: meaningful PayPal sandbox + AI use, public open-source source code, runnable instructions or a functional hosted demo, and a publicly visible YouTube video under three minutes. MIT is the chosen open-source license. Verify your own age/residency eligibility and current rules. Sponsor tools are optional; this project does not claim a sponsor-specific prize integration.

The source is published in [tarun-vignes/cartpilot-paypal-ai](https://github.com/tarun-vignes/cartpilot-paypal-ai). The initial repository commit is preserved. No application deployment, Devpost submission, organizer message or video upload was performed.

For future source updates, from this dedicated folder:

```powershell
git status
git add .
git commit -m "Update CartPilot"
git push origin main
```

Inspect and reconcile remote changes before pushing; do not force-push. `.env` files, `node_modules`, build output and generated screenshots are ignored.

A hosted demo is optional under the current rules; complete run instructions suffice. To host later, use a Node server platform with one instance, `npm ci && npm run build` as build command, `npm start` as start command, runtime environment variables, and an HTTPS `APP_ORIGIN` matching the actual URL. No deployed URL is claimed. Hosting secrets must be configured in the platform's private environment, not built into the browser.

Before Devpost: configure and test real sandbox checkout, complete your personal tool-feedback notes, record an honest <3-minute demo with real functioning AI and sandbox approval/capture, upload it publicly to YouTube yourself, and add the actual repository/video/demo links. Draft materials: [submission](docs/submission-draft.md), [demo script](docs/demo-script.md), [event check](docs/event-verification.md). Personal motivations, user impact and tool feedback are editable placeholders, not invented claims.
