import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cli } from './cli.mjs';

const live = { skip: process.env.NET !== '1' && 'live network case (set NET=1)' };

test('TSV: header row, ISO dates, summary only on stderr', live, () => {
  const r = cli(['coffee', 'US', 'today 3-m']);
  assert.equal(r.status, 0, r.stderr);
  const [header, ...rows] = r.stdout.trimEnd().split('\n');
  assert.equal(header, 'date\tvalue\tpartial');
  assert.ok(rows.length > 10);
  for (const row of rows) assert.match(row, /^\d{4}-\d{2}-\d{2}\t\d+\t[01]$/);
  assert.match(r.stderr, /^gtrends: coffee \(US, today 3-m\), avg interest [\d.]+\n$/);
});

test('hourly ranges keep the time of day', live, () => {
  const r = cli(['coffee', 'US', 'now 7-d']);
  assert.equal(r.status, 0, r.stderr);
  const rows = r.stdout.trimEnd().split('\n').slice(1);
  assert.ok(rows.every((row) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z\t/.test(row)));
});
