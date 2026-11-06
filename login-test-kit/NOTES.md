# Reference notes — Human Security setup & login test kit

Personal reference for the bot-protection setup on this site and the login
test harness in this folder. Kept here so it's easy to find later.

---

## Human Security (PerimeterX) enforcer on Cloudflare

**App ID:** `PXp3WdBpXY`
**Cloudflare Worker:** `milad-cloudflare-enforcer` (module mode: `active_blocking`)
**Zone:** `miladsohrabi.com`

### Key fix (Nov 2026): the Worker route
The challenge wasn't firing on the apex domain because the Worker route didn't
cover it. The route pattern must be:

```
*miladsohrabi.com/*
```

Note: **no dot** after the `*`. In Cloudflare, `*.miladsohrabi.com/*` matches
subdomains only (`www.`, `pages.`) and **not** the bare `miladsohrabi.com`.
The `*miladsohrabi.com/*` form covers the apex and every subdomain.

### How to confirm it's working
- `https://miladsohrabi.com/p3WdBpXY/init.js` should return JavaScript
  (200, `application/javascript`), not a 404. A 404 means the Worker isn't on
  that path.
- A normal page load should set a `_pxhd` cookie.
- A bot-like client (e.g. a scripted request / odd user agent) should get a
  `403` with a `px-captcha` / "Press & Hold" body — that's the challenge.

### Follow-ups worth doing
- Move `px_auth_token` and `px_cookie_secret` out of the Worker source and into
  **Worker secrets** (Settings → Variables and Secrets), read from `env`. If the
  current values were ever shared, rotate them in the Human Security console.
- Optional: serve the sensor tag first-party from `/p3WdBpXY/init.js` instead of
  `//client.px-cloud.net/PXp3WdBpXY/main.min.js`.

---

## Login test kit (this folder)

A self-contained kit for validating that a login endpoint **I own or am
authorized to test** correctly rejects, rate-limits, or challenges automated
POST / credential-stuffing-style traffic. See `README.md` for full usage.

- `login.html` — login form that POSTs to a configurable endpoint and prints the
  raw response, flagging when a request is *challenged* vs logged in. Linked from
  the site nav as **Login**.
- `server.js` — zero-dependency local mock login API (Node 18+) for end-to-end
  local testing. Does no real auth; stores nothing. GitHub Pages can't run it.
- `stuffing-test.js` — POST replay runner; refuses to run without
  `--i-am-authorized`. Reports ok / rejected / rate-limited / challenged counts.
- `creds.sample.txt` — dummy test credentials (not real accounts).

### Fastest local check
```bash
cd login-test-kit
node server.js            # mock API on http://localhost:8787
```
```bash
node stuffing-test.js --url http://localhost:8787/api/login \
  --creds creds.sample.txt --concurrency 5 --i-am-authorized
```
First attempt returns 200, the rest 401, and once past 10 attempts/min the
endpoint returns 429. Point `--url` at a real login path I control to confirm
the Human Security challenge fires there.

> Authorized use only — only point these tools at systems I own or have written
> permission to test.
