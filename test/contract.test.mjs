// Contract tests, identical across the beacondata CLIs: stdout = data only, stderr = diagnostics
// only, exit 0/1/2/3, one --json envelope shape. Offline by default (fetch is stubbed);
// NET=1 also runs the live cases against the real source.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { cli, BIN, stubUrl } from './cli.mjs';

const CASES = {
  "tool": "gtrends",
  "bin": "trends.mjs",
  "offline": [
    "coffee"
  ],
  "invalid": [
    [
      "   "
    ]
  ],
  "ok": [
    "coffee"
  ],
  "noData": [
    "zqxjvkwq pzzqxvbn qqwzx"
  ],
  "tooMany": [
    "US",
    "today 3-m",
    "extra"
  ]
};

const { version } = createRequire(import.meta.url)('../package.json');
const NET = process.env.NET === '1';
const live = { skip: !NET && 'live network case (set NET=1)' };


test('--help prints usage on stdout, exit 0', () => {
  const r = cli(['--help']);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /^Usage: /);
  assert.equal(r.stderr, '');
});

test('missing input: exit 1, stdout empty', () => {
  const r = cli([]);
  assert.equal(r.status, 1);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /USAGE/);
});

test('unknown option: exit 1, stdout empty', () => {
  const r = cli([...CASES.offline, '--nope']);
  assert.equal(r.status, 1);
  assert.equal(r.stdout, '');
});

for (const args of CASES.invalid) {
  test(`invalid input ${JSON.stringify(args)}: exit 1, stdout empty`, () => {
    const r = cli(args, { preload: 'fetch-fail' });
    assert.equal(r.status, 1, r.stderr);
    assert.equal(r.stdout, '');
    assert.match(r.stderr, /INVALID_INPUT|USAGE/);
  });
}

test('upstream failure: exit 2, stdout empty, typed error on stderr', () => {
  const r = cli(CASES.offline, { preload: 'fetch-fail' });
  assert.equal(r.status, 2, r.stderr);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, new RegExp(`^${CASES.tool}: NETWORK: `));
});

test('upstream failure with --json: one parseable error object on stderr', () => {
  const r = cli([...CASES.offline, '--json'], { preload: 'fetch-fail' });
  assert.equal(r.status, 2, r.stderr);
  assert.equal(r.stdout, '');
  const e = JSON.parse(r.stderr);
  assert.deepEqual(e, { tool: CASES.tool, version, exitCode: 2, error: { type: 'NETWORK', message: e.error.message, retryable: true } });
});

test('live: --json prints exactly one envelope, nothing on stderr', live, () => {
  const r = cli([...CASES.ok, '--json']);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(r.stderr, '');
  const env = JSON.parse(r.stdout);
  assert.deepEqual(Object.keys(env).filter((k) => k !== 'meta'), ['tool', 'version', 'input', 'complete', 'count', 'results']);
  assert.equal(env.tool, CASES.tool);
  assert.equal(env.version, version);
  assert.equal(env.complete, true);
  assert.ok(env.count > 0);
  assert.equal(env.count, env.results.length);
});

test('live: plain mode prints data on stdout, exit 0', live, () => {
  const r = cli(CASES.ok);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.trim().length > 0);
});

test('live: source has no data: exit 3, stdout empty', live, () => {
  const r = cli(CASES.noData);
  assert.equal(r.status, 3, r.stderr);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /NO_DATA|NO_CAPTIONS|NOT_FOUND|RESTRICTED|EMPTY_TRANSCRIPT/);
});

test('--json --help: one JSON line on stdout with the usage', () => {
  const r = cli(['--json', '--help']);
  assert.equal(r.status, 0);
  const j = JSON.parse(r.stdout);
  assert.equal(j.tool, CASES.tool);
  assert.match(j.usage, /^Usage: /);
});

test('too many arguments is a usage error, not silently dropped', () => {
  const r = cli([...CASES.offline, ...CASES.tooMany], { preload: 'fetch-fail' });
  assert.equal(r.status, 1, r.stderr);
  assert.equal(r.stdout, '');
  assert.match(r.stderr, /unexpected argument/);
});

test('-- ends option parsing', () => {
  const r = cli(['--json', '--', ...CASES.offline], { preload: 'fetch-fail' });
  assert.equal(r.status, 2, r.stderr);
  assert.equal(JSON.parse(r.stderr).error.type, 'NETWORK');
});

test('a closed stderr pipe keeps the real exit code', () => {
  const pre = stubUrl('fetch-fail');
  const args = CASES.offline.map((a) => `'${a}'`).join(' ');
  const r = spawnSync('/bin/bash', ['-c', `"${process.execPath}" --import "${pre}" "${BIN}" ${args} --json 2>&1 >/dev/null | true; echo "\${PIPESTATUS[0]}"`], { encoding: 'utf8', timeout: 60_000 });
  assert.equal(r.stdout.trim(), '2');
});

test('DEBUG in the environment never breaks the one-line --json error', () => {
  const r = spawnSync(process.execPath, ['--import', stubUrl('fetch-fail'), BIN, ...CASES.offline, '--json'], { encoding: 'utf8', timeout: 60_000, env: { ...process.env, DEBUG: 'express:*' } });
  assert.equal(r.status, 2);
  assert.equal(r.stderr.trim().split('\n').length, 1);
  JSON.parse(r.stderr);
});
