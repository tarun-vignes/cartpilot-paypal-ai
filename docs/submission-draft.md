# CartPilot — editable submission draft

## Name and tagline

**CartPilot**

From shopping intent to a considered shortlist and an explicitly approved PayPal sandbox checkout.

## Inspiration

[Add your actual motivation and the audience or problem you personally want to address. Do not claim interviews or user testing unless you performed them.]

## What it does

CartPilot takes a shopper's plain-language request, extracts visible constraints, compares a small fictional product catalog, and explains fit and tradeoffs. It supports cart review with server-calculated USD totals and a PayPal sandbox approval-and-capture flow controlled by explicit shopper actions.

The AI returns constraints and product IDs; trusted catalog facts and deterministic server checks supply product details, prices, matches and mismatches. No-match results are explicit. Without an AI key, the app clearly identifies demo recommendation logic. Without PayPal credentials, checkout is unavailable; it does not simulate a successful payment.

## How it is built

React, TypeScript and Vite provide the interface. Express provides a small same-origin API. Zod validates requests and model output. Gemini's structured generateContent response supplies intent extraction and ranking. PayPal OAuth and Orders v2 create, retrieve and capture sandbox orders. Server-generated idempotency keys and a session-bound in-memory store govern retries. Source code, original fictional catalog content and inline SVG illustrations use MIT licensing.

## Current verification and remaining work

Real Gemini structured inference was smoke-tested with the available environment key. Automated tests mock AI and PayPal. Desktop/mobile browser checks exercise the preview shopping flow. **Real PayPal sandbox order approval and capture have not yet been tested: credentials are missing.** Replace this statement only after you personally complete that flow and retain truthful evidence. See `docs/verification.md` for exact check results.

## Challenges and lessons

[Add your own experience. Potential implementation topics to describe accurately: keeping model suggestions separate from payment authority, rejecting manipulated prices, matching model IDs to a trusted catalog, and reconciling ambiguous capture responses. Do not present these as personal lessons unless they reflect your experience.]

## Developer product-feedback worksheet

Complete after personally using each tool. Leave untested areas marked untested.

| Tool/service                                  | What I actually used                  | Onboarding experience | What worked well    | What needs improvement | Would I build with it again, and why? |
| --------------------------------------------- | ------------------------------------- | --------------------- | ------------------- | ---------------------- | ------------------------------------- |
| PayPal Developer Dashboard / sandbox accounts | [Complete after setup]                | [Your experience]     | [Observed behavior] | [Specific friction]    | [Your assessment]                     |
| PayPal OAuth + Orders v2                      | [Actual order/approval/capture tests] | [Your experience]     | [Observed behavior] | [Specific friction]    | [Your assessment]                     |
| Gemini API / structured output                | [Your own requests and model used]    | [Your experience]     | [Observed behavior] | [Specific friction]    | [Your assessment]                     |
| Other tools, if applicable                    | [Actual usage only]                   | [Your experience]     | [Observed behavior] | [Specific friction]    | [Your assessment]                     |

The request asks for product-feedback material; verify the current submission form's exact questions. No personal feedback is invented here.

## Built with

TypeScript, React, Node.js, Express, Vite, Zod, Google Gemini, PayPal Orders API, Vitest, Testing Library, Playwright.

## Links and disclosures

- Public repository: https://github.com/tarun-vignes/cartpilot-paypal-ai
- Functional demo: complete README run instructions; [optional actual hosted URL after deployment].
- Public YouTube video under three minutes: [Record and upload yourself after verifying genuine sandbox checkout.]
- Screenshots: actual locally generated images in `artifacts/screenshots/`; label the service mode shown accurately.
- Built with Codex assistance. No personal user-testing, impact, production payment, deployment or adoption claims are made.

## Manual pre-submission checklist

- [ ] Verify eligibility and current official rules.
- [ ] Personally verify real AI and PayPal sandbox approval, cancellation and capture.
- [x] Publish the source repository with its root MIT license; secret scan passed.
- [ ] Supply complete judge run/access instructions safely; never publish private keys in Git.
- [ ] Fill in personal motivation, experience and tool feedback.
- [ ] Add a truthful <3-minute publicly visible YouTube video and actual links.
- [ ] Submit personally by November 12, 2026, noon Pacific / 3 p.m. Eastern.
