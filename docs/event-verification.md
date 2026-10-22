# Event check — October 22, 2026

Reviewed the [official overview](https://paypalaihackathon.devpost.com/) and [rules](https://paypalaihackathon.devpost.com/rules) before implementation.

- Deadline: November 12, 2026 at noon Pacific (3 p.m. Eastern).
- Build a working application meaningfully using PayPal's sandbox developer platform and AI. Sponsor AI tools are optional.
- Provide public open-source code with a recognizable license and all required source/setup instructions. MIT is used here.
- Provide a runnable functional demo or complete local instructions; public hosting is optional.
- Supply an English description and a publicly visible YouTube video under three minutes showing actual functionality.
- Entrants must satisfy age-of-majority, geographic and conflict-of-interest eligibility rules. CartPilot does not establish entrant eligibility.

CartPilot uses Orders v2 and Gemini. Its local preview is functional, but missing PayPal credentials mean full sandbox checkout still requires personal verification. Source publication was subsequently authorized at https://github.com/tarun-vignes/cartpilot-paypal-ai. No Devpost submission was performed. Review current rules and required access arrangements before entering; do not publish private credentials in source code.

Technical references inspected: [Orders v2](https://developer.paypal.com/api/orders/v2), [OAuth](https://developer.paypal.com/api/rest/authentication/), [sandbox endpoints](https://developer.paypal.com/api/rest/requests/), [idempotency](https://developer.paypal.com/api/rest/reference/idempotency/), [Gemini structured outputs](https://ai.google.dev/gemini-api/docs/structured-output), [generateContent](https://ai.google.dev/api/generate-content).
