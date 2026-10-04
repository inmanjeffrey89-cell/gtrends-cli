#!/usr/bin/env node
// gtrends — Google Trends interest-over-time from the command line. No API key.
import { fetchTrend, TrendsSession } from './src/trends.js';
const kw = process.argv[2];
const geo = process.argv[3] || '';
const time = process.argv[4] || 'today 12-m';
if (!kw) { console.error('Usage: node trends.mjs "<keyword>" [geo] [time-range]'); process.exit(1); }
try {
  const t = await fetchTrend(kw, { geo, time, session: new TrendsSession() });
  console.log(`# ${t.keyword} (${t.geo}, ${t.timeRange}) — avg interest ${t.averageValue}`);
  for (const p of t.points) console.log(`${p.date}\t${p.value}${p.isPartial ? '  (partial)' : ''}`);
} catch (e) { console.error(`${e.errorType || 'ERROR'}: ${e.message}`); process.exit(2); }
