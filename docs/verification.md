# Verification — October 22, 2026

Environment: Windows, Node.js 22.19.0, npm 10.9.3. Dependencies installed locally with npm and pinned in `package-lock.json`.

| Check                                         | Actual outcome                                                                                                                                   |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run format:check`                        | Passed after formatting corrections                                                                                                              |
| `npm run typecheck`                           | Passed                                                                                                                                           |
| `npm test`                                    | **36 tests passed**: 15 intent/pricing/provider tests, 12 HTTP/order tests, 9 UI tests                                                           |
| `npm run build`                               | Passed; Vite produced the frontend HTML/CSS/JS and TypeScript passed                                                                             |
| `npm audit --omit=dev`                        | **0 known runtime dependency vulnerabilities** at check time; this does not cover development-only dependencies                                  |
| `node --import tsx scripts/security-check.ts` | Passed on source/build files; no configured secret values or obvious key material found                                                          |
| Development server                            | Started successfully on localhost:3000 in explicit demo mode                                                                                     |
| Production server                             | Started successfully on localhost:3001 in explicit demo mode                                                                                     |
| Production HTTP smoke check                   | Root, compiled JavaScript, compiled CSS, and `/api/config` returned **200**; config reported eight products, sandbox enabled, PayPal unavailable |
| Chrome desktop/mobile browser check           | Passed against the production build, with no browser runtime errors or horizontal overflow at 390 px                                             |
| Real Gemini inference smoke check             | **Passed** using the inherited server-side environment key, without copying or displaying the key                                                |
| Real PayPal sandbox order/approval/capture    | **Not tested: sandbox credentials were unavailable**                                                                                             |

## Real AI observation

`scripts/check-ai.ts` contacted Gemini `gemini-3.1-flash-lite` with the sample student-gift request. The response passed the application schema and catalog-ID checks. It extracted a 6,000-cent item budget, the non-fragile requirement, and fast delivery; the shortlisted IDs were `keys-01`, `power-02`, and `sip-04`, with no exact-fit failure. This confirms one real provider request, not accuracy across arbitrary prompts. Automated tests separately mock provider failures and malformed output.

## Browser and visual inspection

Used the installed Chrome through Playwright Core. Verified initial welcome and honest demo labels; request submission; recommendation and visible constraints; add-to-cart; $43.95 one-keyboard total; $78.00 two-keyboard total; quantity reduction; disabled checkout without PayPal configuration; a no-match request; a mocked API-unavailable response; and explicitly chosen demo fallback. Inspected actual desktop and mobile screenshots and adjusted mobile headline wrapping.

Screenshots generated locally under ignored `artifacts/screenshots/`:

- `01-welcome.png` — 1440×960 desktop welcome, demo mode.
- `02-shortlist.png` — actual preview shortlist; not a live-payment screenshot.
- `03-mobile.png` — 390×844 responsive preview.

## Payment test boundaries

The 12 HTTP/order tests use mocked PayPal responses. They cover same-session ownership, separate server idempotency keys across sessions, duplicate creation, stable capture retry keys, approval checks, cancellation, wrong amounts, unconfirmed failure, recovery when a previously ambiguous capture is remotely complete, and safe HTTP validation. Provider tests also cover rejecting non-sandbox approval URLs and retrieving a complete order when a capture representation omits the original amount.

The UI tests show approved/canceled/completed states only from explicitly mocked server fixtures. These are automated state tests, **not evidence of an actual PayPal transaction**. No real or sandbox payment was attempted, no buyer credentials were collected, and no captured payment or deployed link is claimed.

The initial handoff was local only. The entrant subsequently authorized source publication to https://github.com/tarun-vignes/cartpilot-paypal-ai, preserving the initial remote commit. No application deployment, Devpost submission, or uploaded video has been performed. The existing ShotSense working tree was checked and remained clean. Personal motivations, product feedback and impact claims remain editable placeholders.

## Remaining verification

Add sandbox app credentials, personally complete approval/capture with a separate sandbox buyer, confirm the capture in the PayPal sandbox dashboard, and rehearse cancellation/failure recovery before recording an end-to-end video. Keep this prototype to one process; in-memory payment state is not durable across restarts.

## Render deployment preparation

The entrant subsequently requested deployment. Added `render.yaml` for a free single-instance Node web service, a credential-free `/healthz` route, automatic `RENDER_EXTERNAL_URL` origin configuration, explicit all-interface port binding, and a dynamic Vite import so production startup does not load the development server.

Revalidation: **39 tests passed** (the original 36 plus two hosting-origin tests and a health-route test). Formatting, TypeScript, the production build, and secret scanning passed. Local production smoke checks returned HTTP 200 for `/`, `/healthz`, and `/api/config` using the Render-style origin fallback.

Render account access is not connected in this session. The Blueprint and deployment launcher are prepared; no Render service or live URL has been verified. The local Gemini environment key does not automatically transfer to a hosting account. PayPal credentials remain unavailable.
