# Login protection test kit

A small, self-contained kit for validating that a login endpoint **you own or
are explicitly authorized to test** correctly rejects, rate-limits, or
challenges automated POST / credential-stuffing-style traffic — e.g. confirming
the Human Security enforcer in front of your site fires on login abuse.

> **Authorized use only.** Point these tools only at systems you own or have
> written permission to test. The replay runner refuses to run without an
> explicit `--i-am-authorized` flag. Running credential-stuffing traffic against
> systems you don't control is illegal.

## Contents
- `login.html` — a standard login form that sends a JSON POST and prints the raw
  response (status, headers, body), highlighting when a request is *challenged*
  instead of logged in.
- `server.js` — a zero-dependency local mock login API (Node 18+) so you can
  exercise the page and runner end to end before touching a real domain.
- `stuffing-test.js` — a POST replay runner that reads a credentials file and
  reports ok / rejected / rate-limited / challenged counts.
- `creds.sample.txt` — dummy test credentials (not real accounts).

## Quick start (fully local)
```bash
cd login-test-kit
node server.js                       # terminal 1: mock API on :8787
```
Open `login.html` in a browser (or serve it: `python3 -m http.server 8080`).
Sign in with `test@example.com` / `correct-horse` for a 200, anything else for a
401. Submit >10 times in a minute to see the local 429 rate limit.

Then run the replay:
```bash
node stuffing-test.js --url http://localhost:8787/api/login \
  --creds creds.sample.txt --concurrency 5 --i-am-authorized
```
You should see the first few attempts return 401/200 and later ones 429.

## Testing your real protection
Point the runner at a login path on a domain you own to confirm the enforcer
challenges automated logins:
```bash
node stuffing-test.js --url https://YOUR-DOMAIN/your/login/path \
  --creds creds.sample.txt --concurrency 10 --delay 50 --i-am-authorized
```
A `challenged` count above zero (403 + `px-captcha` / "Press & Hold" body) means
bot protection is active on that path. `--form` switches the body to
`application/x-www-form-urlencoded` if your endpoint expects form posts.

## Notes
- `server.js` does **no real authentication** and stores nothing; it's a
  stand-in backend for local testing only.
- GitHub Pages can't run `server.js` (no server-side code). It's for your local
  machine or any Node host you control.
