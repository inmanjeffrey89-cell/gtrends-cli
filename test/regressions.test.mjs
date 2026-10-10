import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cli } from './cli.mjs';

const live = { skip: process.env.NET !== '1' && 'live network case (set NET=1)' };

test('an unsupported time range is rejected, never silently swapped for 12 months', () => {
  for (const bad of ['today 3m', 'today 2-y', 'garbage']) {
    const r = cli(['coffee', 'US', bad, '--json'], { preload: 'fetch-fail' });
    assert.equal(r.status, 1, `${bad}: ${r.stderr}`);
    assert.equal(JSON.parse(r.stderr).error.type, 'INVALID_INPUT');
  }
});

test('an unquoted range (coffee US today 3-m) is a usage error, not 12 months of data', () => {
  const r = cli(['coffee', 'US', 'today', '3-m'], { preload: 'fetch-fail' });
  assert.equal(r.status, 1, r.stderr);
  assert.match(r.stderr, /unexpected argument "3-m"/);
});

test('a consent/captcha page is an upstream failure (exit 2, retryable), not INTERNAL', () => {
  const r = cli(['coffee', '--json'], { preload: 'trends-html' });
  assert.equal(r.status, 2, r.stderr);
  const e = JSON.parse(r.stderr).error;
  assert.equal(e.type, 'BAD_RESPONSE');
  assert.equal(e.retryable, true);
});

test('custom date ranges work and are honored', live, () => {
  const r = cli(['coffee', 'US', '2025-01-01 2025-03-31', '--json']);
  assert.equal(r.status, 0, r.stderr);
  const env = JSON.parse(r.stdout);
  assert.equal(env.input.timeRange, '2025-01-01 2025-03-31');
  const first = new Date(env.results[0].time * 1000).toISOString().slice(0, 7);
  const last = new Date(env.results.at(-1).time * 1000).toISOString().slice(0, 7);
  assert.equal(first, '2025-01');
  assert.equal(last, '2025-03');
});

test('lowercase geo codes work', live, () => {
  const r = cli(['coffee', 'us', 'today 1-m', '--json']);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).input.geo, 'US');
});
