# AuthTAP

The sign-in step between a Delta Kinetics product and its client. One account
for CoreTAP, NexusTAP, SignalTAP, ShiftTAP, LearnTAP and AtlasTAP.

AuthTAP is **not a site of its own**. Nobody signs in here directly, there is no
account page, and a visit that no product started is sent to
`https://deltakinetics.io` (`AUTHTAP_STRAY_URL`). The identity API behind it is
dk-backend (Sanctum tokens, Passport OIDC); AuthTAP never stores a password.

Live at `https://authtap.deltakinetics.io`, Docker on the DK VPS
(`/var/www/authtap`). GitHub `Matty-1337/authTap`, branch `main`.

## How a product uses it

**Handoff** (CoreTAP, NexusTAP, SignalTAP, ShiftTAP)

1. The product's start route redirects to
   `/api/sso/incoming?client=<slug>&return_to=<product>/auth/authtap/callback&state=<nonce>`.
2. `/sso/incoming` (same-site hop, so `at_session` is readable) writes the hop to
   the `at_continue` cookie. One signed-in account goes straight to
   `/api/sso/complete`; two or more get `/continue` (the picker); none gets `/login`.
3. Completion mints a product token through dk-backend `POST /api/sso/handoff`
   and returns a 90-second signed code (`AUTHTAP_SSO_SECRET`, HS256) to the
   callback with the original `state`. The product verifies the code and seals
   its own session.

`return_to` must be the product's callback on an allowed origin
(`CORETAP_RETURN_ORIGINS`, `NEXUSTAP_RETURN_ORIGINS`, `SIGNALTAP_RETURN_ORIGINS`,
`SHIFTTAP_RETURN_ORIGINS`, plus `*.deltakinetics.io`, `core-tap.com` and localhost).

**OIDC bridge** (LearnTAP, AtlasTAP, anything on dk-backend's Passport clients)

1. The product runs Authorization Code + PKCE against dk-backend `/oauth/authorize`.
2. dk-backend bounces a signed-out browser to `/sso/authorize?return=<authorize URL>`.
   The return must be `/oauth/authorize` on dk-backend's origin (`DK_BACKEND_URL`,
   www or bare).
3. Same account rules as above. The hop ends on `/sso/authorize/bridge`, which
   posts the active account's token (top-level form, never a URL) to dk-backend
   `/sso/session/bridge`; dk-backend sets its web session and resumes the
   authorize, and the product receives its code.

## Other flows

- Sign-up and the 6-digit email verification happen inside a hop and return to
  it; the verify form carries the hop in its fields so a 30-minute cookie expiry
  does not lose the product.
- "Use another account" adds an account to `at_session` (up to five); Cancel
  returns to the product's login with `error=sso_denied`.
- Product sign-out: the product revokes its token; AuthTAP's next handoff sees a
  stale token, drops that account and asks for the password again.
- Front-channel logout chain: `/api/sso/leave` walks each product's
  `frontchannel-logout` route, then leaves AuthTAP.

## Environment

| Name | Purpose |
|---|---|
| `DK_BACKEND_URL` | dk-backend origin (default `https://deltakinetics.io` in production) |
| `AUTHTAP_SESSION_SECRET` | signs `at_session` / `at_continue` (32+ chars) |
| `AUTHTAP_SSO_SECRET` | signs handoff codes; shared with every handoff product |
| `AUTHTAP_PUBLIC_URL` | public origin override behind a proxy |
| `AUTHTAP_STRAY_URL` | where a direct visit goes (default `https://deltakinetics.io`) |
| `*_RETURN_ORIGINS` | extra allowed callback origins per product |
| `AUTHTAP_FRONTCHANNEL_CLIENTS` | narrow the logout chain locally |
| `DK_LOGIN_PRODUCT` | product slug used for AuthTAP's own dk-backend login (default `coretap`) |
| Turnstile keys | bot check on the password step |

Secrets live in Infisical; see the `infisical-secrets` skill.

## Run and test

```bash
npm install
npm run dev        # http://localhost:3000 (tests assume http://localhost:3004)
npm test           # vitest
npx tsc --noEmit
npx eslint src tests
```

Deploy: merge to `main`, then on the VPS
`cd /var/www/authtap && git pull --ff-only && docker compose build authtap && docker compose up -d authtap`.
