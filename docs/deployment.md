# Deploy CartPilot on Render

This repository includes `render.yaml` for a **free Node web service**, retaining the actual server-side application. It does not deploy a static mockup. No Render service or live URL has been verified yet.

**[Deploy CartPilot on Render](https://render.com/deploy?repo=https%3A%2F%2Fgithub.com%2Ftarun-vignes%2Fcartpilot-paypal-ai)**

1. Open the link and sign in to your Render account. Review the Blueprint and confirm its Free web service.
2. Render installs dependencies, builds the frontend, and runs `npm start`. `/healthz` is the readiness endpoint. The service listens on the provided `PORT` and all interfaces.
3. Use the actual URL Render assigns. `RENDER_EXTERNAL_URL` configures the application origin automatically, including secure session cookies and PayPal return/cancel links. If using a custom domain, set `APP_ORIGIN` to its HTTPS origin.
4. In Render's private **Environment** settings, add `GEMINI_API_KEY` to enable real AI. The key in your local machine's environment is not automatically transferred to Render. Without a hosted key, the site clearly uses demo recommendation logic.
5. Add **sandbox-only** `PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` there when available, then redeploy. Without them, checkout remains unavailable. Never paste secrets into the public repository.
6. Verify `/healthz`, request analysis, cart totals, and sandbox checkout on the actual hosted URL. Complete PayPal approval/capture with a sandbox buyer before claiming end-to-end payment success.

The Blueprint waits for passing GitHub checks before automatic redeploys. Only one instance is supported because sessions/orders are in memory. Free services can sleep after inactivity; sleeping/restarts lose that state. Do not interrupt an active sandbox checkout or blindly retry a new payment after an ambiguous restart. See [Render free-service limits](https://render.com/docs/free).

To let the assistant provision and inspect the deployment, install/connect the [Render integration](https://chatgpt.com/plugins) to the account that should own this service. Until that account access is available, the prepared Blueprint can be launched directly through the link above.

References: [Render Node deployment](https://render.com/docs/deploy-node-express-app), [Blueprint specification](https://render.com/docs/blueprint-spec), [Render default environment](https://render.com/docs/environment-variables).
