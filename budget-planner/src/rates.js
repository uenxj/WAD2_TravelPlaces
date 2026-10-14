// Currency rates via Frankfurter (free, no API key, ECB reference rates).
// Docs: https://frankfurter.dev
//
// Strategy: cache each pair for 1 hour; if the API is down, serve the last
// known rate (marked stale) so the app keeps working during a demo.

const BASE = 'https://api.frankfurter.dev/v1';
const TTL_MS = 60 * 60 * 1000;

function createRateService({ fetchImpl = fetch, now = () => Date.now(), ttlMs = TTL_MS } = {}) {
  const cache = new Map(); // "SGD>JPY" -> { rate, date, fetchedAt }

  async function getRate(from, to) {
    from = from.toUpperCase();
    to = to.toUpperCase();
    if (from === to) return { from, to, rate: 1, date: null, stale: false, source: 'identity' };

    const key = `${from}>${to}`;
    const hit = cache.get(key);
    if (hit && now() - hit.fetchedAt < ttlMs) {
      return { from, to, rate: hit.rate, date: hit.date, stale: false, source: 'cache' };
    }

    try {
      const res = await fetchImpl(`${BASE}/latest?base=${from}&symbols=${to}`);
      if (!res.ok) throw new Error(`rate API responded ${res.status}`);
      const data = await res.json();
      const rate = data?.rates?.[to];
      if (typeof rate !== 'number') throw new Error('rate missing in response');
      cache.set(key, { rate, date: data.date, fetchedAt: now() });
      return { from, to, rate, date: data.date, stale: false, source: 'live' };
    } catch (err) {
      if (hit) {
        return { from, to, rate: hit.rate, date: hit.date, stale: true, source: 'stale-cache' };
      }
      const e = new Error(`Could not get exchange rate ${from} to ${to}: ${err.message}`);
      e.status = 502;
      throw e;
    }
  }

  return { getRate };
}

module.exports = { createRateService };
