# gtrends

**Google Trends** interest-over-time for any keyword, from the command line — clean output, no API key.

```bash
node trends.mjs "bitcoin" US "today 3-m"
node trends.mjs "silver price"
```

Args: `<keyword>` `[geo]` `[time-range]` (e.g. `today 12-m`, `today 5-y`, `now 7-d`).

## How it works

Hits Google Trends' internal endpoints and handles the session handshake that makes most quick scripts return empty. MIT.

## Many keywords, as JSON, on a schedule?

I run a hosted version on Apify — any number of keywords, structured JSON, pay only for keywords that return data:

**→ [Google Trends Scraper](https://apify.com/beacondata/google-trends-scraper)**

Pair it with [Keyword Research & Autocomplete](https://apify.com/beacondata/keyword-research-scraper): find ideas there, validate demand here.

## License
MIT.
