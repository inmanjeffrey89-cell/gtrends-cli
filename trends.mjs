#!/usr/bin/env node
// gtrends — Google Trends interest-over-time from the command line. No API key.
import { run, CliError } from './src/cli.js';
import { fetchTrend, TrendsSession } from './src/trends.js';

const usage = `Usage: gtrends "<keyword>" [geo] [time-range] [--json]

  geo         two-letter country code, e.g. US, GB (default: worldwide)
  time-range  now 1-H | now 4-H | now 1-d | now 7-d | today 1-m | today 3-m | today 12-m | today 5-y |
              all | "YYYY-MM-DD YYYY-MM-DD" (default: today 12-m; quote it, it contains a space)
  --json      print one JSON envelope instead of TSV

Output: TSV with a header row: date (ISO; with time of day for hourly ranges), value (0-100),
partial (1 = period still in progress).
A one-line summary goes to stderr.

Exit: 0 ok · 1 bad input · 2 Trends request failed · 3 Trends has no data for this keyword`;

run({
  tool: 'gtrends',
  usage,
  positionals: 3,
  async main(args) {
    const [rawKeyword, rawGeo = '', time = 'today 12-m'] = args.positional;
    const keyword = rawKeyword?.trim();
    const geo = rawGeo.trim().toUpperCase();
    if (!keyword) throw new CliError('USAGE', 'missing "<keyword>"');
    const t = await fetchTrend(keyword, { geo, time, session: new TrendsSession() });
    // ISO dates sort and parse; hourly ranges (e.g. "now 7-d") keep the time of day.
    const daily = t.points.every((p) => p.time % 86400 === 0);
    const iso = (p) => (daily ? new Date(p.time * 1000).toISOString().slice(0, 10) : new Date(p.time * 1000).toISOString().slice(0, 16) + 'Z');
    return {
      input: { keyword, geo: t.geo, timeRange: t.timeRange },
      results: t.points,
      meta: { averageValue: t.averageValue },
      note: `${t.keyword} (${t.geo}, ${t.timeRange}), avg interest ${t.averageValue}`,
      human: () => 'date\tvalue\tpartial\n' + t.points.map((p) => `${iso(p)}\t${p.value}\t${p.isPartial ? 1 : 0}`).join('\n') + '\n',
    };
  },
});
