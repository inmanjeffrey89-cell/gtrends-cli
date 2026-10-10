// Google Trends interest-over-time via the unofficial trends API, with the NID-cookie 429 dance.

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
const VALID_TIMES = new Set(['now 1-H', 'now 4-H', 'now 1-d', 'now 7-d', 'today 1-m', 'today 3-m', 'today 12-m', 'today 5-y', 'all']);

export class TrendsError extends Error {
  constructor(errorType, message, { retryable = false } = {}) {
    super(message);
    this.errorType = errorType;
    this.retryable = retryable;
  }
}

export class TrendsSession {
  constructor() { this.cookie = null; }
}

// Trends' own ranges, or a custom "YYYY-MM-DD YYYY-MM-DD" window.
export function isValidTime(time) {
  return VALID_TIMES.has(time) || /^\d{4}-\d{2}-\d{2} \d{4}-\d{2}-\d{2}$/.test(time);
}

function stripPrefix(text) {
  try { return JSON.parse(text.replace(/^\)\]\}'[^\n]*\n?/, '')); }
  catch { throw new TrendsError('BAD_RESPONSE', 'Trends answered with something other than data (a consent or captcha page?)', { retryable: true }); }
}

async function call(url, { fetchImpl, session, allowCookieRetry = false }) {
  const headers = { 'user-agent': UA, accept: 'application/json' };
  if (session.cookie) headers.cookie = session.cookie;
  let res, body;
  try {
    res = await fetchImpl(url, { headers });
    body = await res.text();
  } catch (e) {
    throw new TrendsError('NETWORK', `request failed: ${e.message}`, { retryable: true });
  }
  if (res.status === 429 || res.status === 403) {
    const setCookie = res.headers.get('set-cookie');
    const nid = setCookie && /NID=[^;]+/.exec(setCookie)?.[0];
    if (nid && allowCookieRetry) {
      session.cookie = nid;
      return call(url, { fetchImpl, session, allowCookieRetry: false });
    }
    throw new TrendsError('BLOCKED', `HTTP ${res.status} from Trends`, { retryable: true });
  }
  if (res.status === 400) throw new TrendsError('INVALID_REQUEST', 'Trends rejected the request (bad keyword, geo, or time range)');
  if (!res.ok) throw new TrendsError('NETWORK', `HTTP ${res.status} from Trends`, { retryable: res.status >= 500 || res.status === 408 });
  return stripPrefix(body);
}

export async function fetchTrend(keyword, { geo = '', time = 'today 12-m', category = 0, property = '', fetchImpl = fetch, session } = {}) {
  if (!isValidTime(time)) throw new TrendsError('INVALID_INPUT', `unsupported time range "${time}" (use ${[...VALID_TIMES].join(', ')}, or "YYYY-MM-DD YYYY-MM-DD")`);
  const req = { comparisonItem: [{ keyword, geo, time }], category, property };
  const exploreUrl = 'https://trends.google.com/trends/api/explore?hl=en-US&tz=0&req=' + encodeURIComponent(JSON.stringify(req));
  const explore = await call(exploreUrl, { fetchImpl, session, allowCookieRetry: true });
  const widget = (explore.widgets || []).find((w) => w.id === 'TIMESERIES');
  if (!widget?.token) throw new TrendsError('NO_DATA', `No timeseries available for "${keyword}"`);
  const dataUrl = 'https://trends.google.com/trends/api/widgetdata/multiline?hl=en-US&tz=0&req=' + encodeURIComponent(JSON.stringify(widget.request)) + '&token=' + widget.token;
  const data = await call(dataUrl, { fetchImpl, session, allowCookieRetry: true });
  const timeline = data?.default?.timelineData || [];
  const points = timeline
    .filter((p) => p.hasData?.[0] && Array.isArray(p.value) && Number.isFinite(Number(p.time)))
    .map((p) => ({ time: Number(p.time), date: p.formattedTime, value: p.value[0], isPartial: !!p.isPartial }));
  // A single point in a multi-bucket range is Google's degenerate answer for junk keywords — not billable data.
  if (points.length <= 1) throw new TrendsError('NO_DATA', `Google Trends has no data for "${keyword}" in that range`);
  const averageValue = Math.round((points.reduce((a, p) => a + p.value, 0) / points.length) * 10) / 10;
  return { keyword, geo: geo || 'worldwide', timeRange: time, points, averageValue };
}
