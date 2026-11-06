#!/usr/bin/env node
/*
 * Login POST replay runner — validates that a login endpoint you own (or are
 * authorized to test) correctly rate-limits, locks out, or challenges
 * automated credential-stuffing-style traffic.
 *
 * AUTHORIZED USE ONLY. Point --url only at a system you own or have explicit
 * written permission to test. This refuses to run without --i-am-authorized.
 *
 * Usage:
 *   node stuffing-test.js --url http://localhost:8787/api/login \
 *        --creds creds.sample.txt --concurrency 5 --delay 50 --i-am-authorized
 *
 * Options:
 *   --url <endpoint>        POST target (required)
 *   --creds <file>          "username:password" per line (default: creds.sample.txt)
 *   --concurrency <n>       parallel in-flight requests (default: 5)
 *   --delay <ms>            delay between launches per worker (default: 0)
 *   --form                  send application/x-www-form-urlencoded instead of JSON
 *   --i-am-authorized       required acknowledgement that you own/may test the target
 *
 * Output: per-attempt status plus a summary counting OK / rejected / rate-limited
 * / challenged / errored — so you can confirm your protection kicks in.
 */
'use strict';
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const a = { concurrency: 5, delay: 0, creds: 'creds.sample.txt', form: false, authorized: false };
  for (let i = 2; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--url') a.url = argv[++i];
    else if (k === '--creds') a.creds = argv[++i];
    else if (k === '--concurrency') a.concurrency = parseInt(argv[++i], 10);
    else if (k === '--delay') a.delay = parseInt(argv[++i], 10);
    else if (k === '--form') a.form = true;
    else if (k === '--i-am-authorized') a.authorized = true;
    else if (k === '--help' || k === '-h') a.help = true;
  }
  return a;
}

const args = parseArgs(process.argv);

if (args.help || !args.url) {
  console.log('Usage: node stuffing-test.js --url <endpoint> [--creds file] ' +
    '[--concurrency n] [--delay ms] [--form] --i-am-authorized');
  process.exit(args.url ? 0 : 1);
}

if (!args.authorized) {
  console.error('\nRefusing to run without --i-am-authorized.');
  console.error('Only point this at a login endpoint you own or are explicitly');
  console.error('authorized to test. Re-run with --i-am-authorized to confirm.\n');
  process.exit(2);
}

const credPath = path.resolve(args.creds);
let lines;
try {
  lines = fs.readFileSync(credPath, 'utf8').split('\n')
    .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'));
} catch (e) {
  console.error('Could not read creds file: ' + credPath + ' (' + e.message + ')');
  process.exit(1);
}

const creds = lines.map((l) => {
  const idx = l.indexOf(':');
  return idx === -1
    ? { username: l, password: '' }
    : { username: l.slice(0, idx), password: l.slice(idx + 1) };
});

const tally = { ok: 0, rejected: 0, limited: 0, challenged: 0, error: 0 };

function classify(status, text) {
  if (/px-captcha|_pxCaptcha|Press\s*&?\s*Hold|access to this page has been denied/i.test(text)) {
    return { key: 'challenged', label: 'CHALLENGED' };
  }
  if (status === 429) return { key: 'limited', label: 'RATE-LIMITED' };
  if (status >= 200 && status < 300) return { key: 'ok', label: 'OK' };
  return { key: 'rejected', label: 'REJECTED' };
}

function buildBody(c) {
  if (args.form) {
    return {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username: c.username, password: c.password }).toString()
    };
  }
  return {
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: c.username, password: c.password })
  };
}

async function attempt(c, n) {
  const { headers, body } = buildBody(c);
  const started = Date.now();
  try {
    const res = await fetch(args.url, { method: 'POST', headers, body });
    const text = await res.text();
    const v = classify(res.status, text);
    tally[v.key]++;
    const ms = Date.now() - started;
    console.log(
      String(n).padStart(4) + '  ' + res.status + '  ' + v.label.padEnd(12) +
      '  ' + ms + 'ms  ' + c.username);
  } catch (e) {
    tally.error++;
    console.log(String(n).padStart(4) + '  ---  ' + 'ERROR'.padEnd(12) + '        ' +
      c.username + '  (' + e.message + ')');
  }
}

async function worker(queue) {
  let item;
  while ((item = queue.shift())) {
    await attempt(item.c, item.n);
    if (args.delay) await new Promise((r) => setTimeout(r, args.delay));
  }
}

(async () => {
  console.log('Target : ' + args.url);
  console.log('Creds  : ' + creds.length + ' from ' + path.basename(credPath));
  console.log('Workers: ' + args.concurrency + '   Delay: ' + args.delay + 'ms   ' +
    'Format: ' + (args.form ? 'form' : 'json'));
  console.log('-'.repeat(60));

  const queue = creds.map((c, i) => ({ c, n: i + 1 }));
  const started = Date.now();
  await Promise.all(
    Array.from({ length: Math.max(1, args.concurrency) }, () => worker(queue)));
  const secs = ((Date.now() - started) / 1000).toFixed(1);

  console.log('-'.repeat(60));
  console.log('Done in ' + secs + 's — ' +
    'ok=' + tally.ok + '  rejected=' + tally.rejected +
    '  rate-limited=' + tally.limited + '  challenged=' + tally.challenged +
    '  error=' + tally.error);
  if (tally.challenged > 0) {
    console.log('\nBot protection challenged ' + tally.challenged +
      ' request(s) — the enforcer is active on this endpoint.');
  } else if (tally.limited > 0) {
    console.log('\nNo bot-protection challenge seen, but the endpoint rate-limited ' +
      tally.limited + ' request(s).');
  } else {
    console.log('\nNo challenge or rate-limit seen. If this is a protected domain, ' +
      'the enforcer may not cover this path — re-check the Worker route.');
  }
})();
