// The CLI contract shared by every beacondata CLI — yt-transcript, keyword-ideas, play-reviews,
// gtrends, app-store-reviews. This file is byte-identical in each repo.
//
//   stdout  result data only: the tool's plain format by default, one JSON envelope with --json
//   stderr  diagnostics only (errors, warnings, summaries), never data
//   exit    0  complete
//           1  usage error or invalid input (including input the source itself rejects)
//           2  the upstream source failed; if some results arrived first, stdout still holds
//              them and the --json envelope says "complete": false
//           3  the source answered but had no data for this input
//
// --json envelope (stdout): { tool, version, input, complete, count, results, meta? }
// --json error (stderr, exactly one line): { tool, version, exitCode, error: { type, message, retryable } }
// --json --help (stdout, one line): { tool, version, usage }
// `--` ends option parsing, for inputs that start with a dash.
import { createRequire } from 'node:module';

const { version: VERSION } = createRequire(import.meta.url)('../package.json');

export const EXIT = Object.freeze({ OK: 0, USAGE: 1, UPSTREAM: 2, NO_DATA: 3 });

const USAGE_TYPES = new Set(['USAGE', 'INVALID_INPUT', 'INVALID_REQUEST']);
const NO_DATA_TYPES = new Set(['NO_DATA', 'NO_CAPTIONS', 'EMPTY_TRANSCRIPT', 'NOT_FOUND', 'RESTRICTED']);

export function exitCodeFor(errorType) {
  if (USAGE_TYPES.has(errorType)) return EXIT.USAGE;
  if (NO_DATA_TYPES.has(errorType)) return EXIT.NO_DATA;
  return EXIT.UPSTREAM;
}

export class CliError extends Error {
  constructor(errorType, message, { retryable = false } = {}) { super(message); this.errorType = errorType; this.retryable = retryable; }
}

// Options are --long words or a single -x letter; anything else (a video id like -abcdefghij,
// a negative number) is a positional. `--` makes everything after it positional.
export function parseArgs(argv, flags = [], maxPositional = Infinity) {
  const known = new Set(['--json', '--help', ...flags]);
  const positional = [];
  const set = new Set();
  let optionsDone = false;
  for (const a of argv) {
    if (!optionsDone && a === '--') { optionsDone = true; continue; }
    const f = a === '-h' ? '--help' : a;
    if (!optionsDone && known.has(f)) set.add(f);
    else if (!optionsDone && (/^--[a-z]/i.test(a) || /^-[a-z]$/i.test(a))) throw new CliError('USAGE', `unknown option ${a}`);
    else positional.push(a);
  }
  if (positional.length > maxPositional) {
    throw new CliError('USAGE', `unexpected argument "${positional[maxPositional]}" (expected at most ${maxPositional}; quote inputs that contain spaces)`);
  }
  return { positional, has: (flag) => set.has(flag) };
}

export function formatError(tool, e, json, exitCode = exitCodeFor(e.errorType || 'INTERNAL')) {
  const type = e.errorType || 'INTERNAL';
  const line = json
    ? JSON.stringify({ tool, version: VERSION, exitCode, error: { type, message: e.message, retryable: !!e.retryable } })
    : `${tool}: ${type}: ${e.message}${e.retryable ? ' (retryable)' : ''}`;
  return { exitCode, line };
}

// main(args) returns { input, results, human(), meta?, note?, error?, emptyMessage? } or throws.
// `error` alongside non-empty results means a partial run: data is printed, then exit 2.
export async function run({ tool, usage, flags = [], positionals = Infinity, main }) {
  const argv = process.argv.slice(2);
  let json = argv.includes('--json');
  // A reader that stops early (`| head`, a closed log pipe) is normal, not a crash: keep the
  // exit code we meant to return.
  process.stdout.on('error', (e) => { if (e.code === 'EPIPE') process.exit(process.exitCode ?? EXIT.OK); throw e; });
  process.stderr.on('error', (e) => { if (e.code !== 'EPIPE') throw e; });
  const fail = (e, { partial = false } = {}) => {
    const { exitCode, line } = formatError(tool, e, json, partial ? EXIT.UPSTREAM : undefined);
    process.stderr.write(line + '\n');
    if (exitCode === EXIT.USAGE && !json && e.errorType === 'USAGE') process.stderr.write(`\n${usage}\n`);
    if (!e.errorType && !json && process.env.DEBUG) process.stderr.write(`${e.stack}\n`);
    process.exitCode = exitCode;
  };
  try {
    const args = parseArgs(argv, flags, positionals);
    json = args.has('--json');
    if (args.has('--help')) {
      process.stdout.write(json ? JSON.stringify({ tool, version: VERSION, usage }) + '\n' : usage + '\n');
      return;
    }
    const r = await main(args);
    if (!r.results.length) return fail(r.error || new CliError('NO_DATA', r.emptyMessage || 'the source returned no results'));
    // One write per stream, and exitCode instead of process.exit(), so piped output is never truncated.
    process.stdout.write(json
      ? JSON.stringify({ tool, version: VERSION, input: r.input, complete: !r.error, count: r.results.length, results: r.results, ...(r.meta ? { meta: r.meta } : {}) }) + '\n'
      : r.human());
    if (r.note && !json) process.stderr.write(`${tool}: ${r.note}\n`);
    if (r.error) fail(r.error, { partial: true });
  } catch (e) {
    fail(e);
  }
}
