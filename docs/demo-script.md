# Truthful demo plan — target 2 minutes 45 seconds

**Do not record or describe an end-to-end success until you have configured real AI and personally completed a genuine PayPal sandbox approval/capture.** Current screenshots intentionally show demo recommendation logic and unavailable PayPal. They are not proof of a real checkout. Do not use mocked test results as live payment footage.

## Before recording

- Add sandbox business-app credentials and confirm `APP_ORIGIN`.
- Confirm Gemini is configured and the interface identifies it correctly.
- Open the app, choose the sample request, and complete a rehearsal with a separate sandbox personal buyer.
- Confirm the capture in the sandbox dashboard. Rehearse cancellation once as well.
- Hide secrets, sandbox account passwords, developer tools with authorization headers, personal information, and unrelated browser tabs. Do not show real payment details.

## Suggested walkthrough

**0:00–0:20 — The question.** “CartPilot helps a shopper move from a vague request to a considered recommendation. AI narrows the choices; the shopper controls checkout.” Show the sandbox-only notice.

**0:20–0:50 — Make intent visible.** Submit: “A practical gift for a computer science student under $60. Nothing fragile, and I would like it to arrive quickly.” Show the actual AI mode, extracted budget, non-fragile feature and delivery preference. Explain that the catalog is fictional demo content.

**0:50–1:15 — Compare.** Show the recommended product and an alternative, their catalog attributes and stated tradeoffs. Briefly demonstrate the tighter-budget sample that returns no exact match. Switch back to the first request.

**1:15–1:40 — Review.** Add one keyboard. Show $39.00 item subtotal + $4.95 demo shipping + $0.00 unmodeled tax = $43.95 USD. The total comes from server-side catalog prices. Check consent and explicitly open PayPal sandbox.

**1:40–2:20 — Genuine approval and capture.** Use the sandbox personal buyer to approve. On return, show the server-verified approved state and frozen total. Explicitly complete the sandbox purchase. Show the actual completed status and capture reference, only if it genuinely succeeds. No goods ship and no real money moves.

**2:20–2:45 — Explain the boundary.** “The server rejects price tampering, validates model IDs, checks PayPal amounts and statuses, and reuses payment request IDs on retry. This prototype uses an in-memory order store and needs persistent reconciliation before production.” End with the actual public source-code link once you have created it.

Upload the finished video to YouTube yourself and make it publicly visible. Keep the final cut **under three minutes**. Use no unlicensed music or third-party media. Add your actual video URL to Devpost; no URL is fabricated here.
