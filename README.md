# gtrends

**Google Trends** interest-over-time for any keyword, from the command line. Clean TSV or JSON, no API key.

```bash
npx gtrends-cli "bitcoin" US "today 3-m"
# date        value  partial
# 2026-07-10  76     0
# 2026-07-11  66     0
# ...          (hourly ranges like "now 7-d" print 2026-10-03T01:00Z)

npx gtrends-cli "silver price" --json | jq '.meta.averageValue'
```

Args: `<keyword>` `[geo]` `[time-range]` (`now 1-H`, `now 4-H`, `now 1-d`, `now 7-d`, `today 1-m`, `today 3-m`, `today 12-m`, `today 5-y`, `all`, or a custom `"YYYY-MM-DD YYYY-MM-DD"`) `[--json]`. Stdout is TSV with a header row; the one-line summary goes to stderr.

## How it works

Hits Google Trends' internal endpoints and handles the session handshake (the first 429 carries the cookie you need) that makes most quick scripts return empty. MIT.

## Output contract

Identical across every tool in this family, so they chain cleanly from shell scripts and AI agents:

- **stdout** is data only: the plain format above, or one JSON envelope with `--json`
- **stderr** is diagnostics only: errors, warnings, summaries
- **exit codes**

| code | meaning |
|---|---|
| `0` | complete |
| `1` | usage error or invalid input |
| `2` | the upstream source failed. If some results arrived first they're still on stdout, and the envelope says `"complete": false` |
| `3` | the source answered, but had no data for this input |

With `--json`, success is one line on stdout:

```json
{"tool":"gtrends","version":"2.0.1","input":{...},"complete":true,"count":42,"results":[...]}
```

and a failure is one line on stderr:

```json
{"tool":"gtrends","version":"2.0.1","exitCode":2,"error":{"type":"BLOCKED","message":"HTTP 429","retryable":true}}
```

Branch on the exit code; log `error.type`: `USAGE`, `INVALID_INPUT` and `INVALID_REQUEST` (the source rejected the input) exit `1`; `NETWORK`, `BLOCKED` and `BAD_RESPONSE` (a captcha or consent page instead of data) exit `2` with `retryable` set; `NOT_FOUND` and `NO_DATA` exit `3`.

`--json --help` prints `{"tool","version","usage"}`. `--` ends option parsing, for inputs that start with a dash. Extra arguments are an error rather than silently dropped, so quote inputs that contain spaces.

## Many keywords, as JSON, on a schedule?

I run a hosted version on Apify: any number of keywords, structured JSON, pay only for keywords that return data:

**→ [Google Trends Scraper](https://apify.com/beacondata/google-trends-scraper)**

Pair it with [Keyword Research & Autocomplete](https://apify.com/beacondata/keyword-research-scraper): find ideas there, validate demand here.

## The family

Five no-key data CLIs, one output contract:
[yt-transcript-cli](https://github.com/inmanjeffrey89-cell/yt-transcript-cli) ·
[keyword-ideas-cli](https://github.com/inmanjeffrey89-cell/keyword-ideas-cli) ·
[gtrends-cli](https://github.com/inmanjeffrey89-cell/gtrends-cli) ·
[play-reviews-cli](https://github.com/inmanjeffrey89-cell/play-reviews-cli) ·
[app-store-reviews-cli](https://github.com/inmanjeffrey89-cell/app-store-reviews-cli)

## Changelog

**2.0.0** — shared output contract across the family: data on stdout, diagnostics on stderr, exit codes `0/1/2/3`, and a `--json` envelope. Breaking: "no data" now exits `3` (was `2`), and network failures are reported instead of being swallowed. Stdout is now pure TSV with a header row and ISO dates; the summary line moved to stderr; custom `"YYYY-MM-DD YYYY-MM-DD"` ranges work, and an unsupported range is an error instead of silently becoming 12 months. Thanks to u/Tariq9977 on r/SideProject for the suggestion.

## License

MIT
