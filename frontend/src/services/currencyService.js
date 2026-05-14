const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

// In-memory cache for the current page session.
let _cachedRates = null;
let _cacheBase = null;
let _cacheTime = 0;
const FRESH_TTL = 6 * 60 * 60 * 1000;       // 6 h — fresh enough to skip network
const STALE_OK_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days — still usable offline

// localStorage layer — survives reloads, makes the app render expense
// conversions without a network round-trip even if the in-memory cache
// has been cleared by a refresh.
const LS_KEY_PREFIX = 'travelerhub_fx_rates';

function _readPersisted(base) {
  try {
    const raw = localStorage.getItem(`${LS_KEY_PREFIX}:${base}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.rates || !parsed.cachedAt) return null;
    return parsed; // { rates, cachedAt }
  } catch {
    return null;
  }
}

function _writePersisted(base, rates) {
  try {
    localStorage.setItem(
      `${LS_KEY_PREFIX}:${base}`,
      JSON.stringify({ rates, cachedAt: new Date().toISOString() }),
    );
  } catch {
    // quota exceeded — non-fatal, in-memory cache still serves this session
  }
}

export async function getExchangeRates(base = 'USD') {
  const now = Date.now();
  if (_cachedRates && _cacheBase === base && now - _cacheTime < FRESH_TTL) {
    return _cachedRates;
  }

  // Try the network first when the in-memory cache is stale, but fall
  // back to the persisted copy on failure / offline so expense
  // conversions still show.
  try {
    const res = await fetch(`${API_BASE}/api/currency/rates?base=${base}`);
    if (!res.ok) throw new Error('Failed to fetch exchange rates');
    const data = await res.json();
    _cachedRates = data.rates;
    _cacheBase = base;
    _cacheTime = now;
    _writePersisted(base, data.rates);
    return data.rates;
  } catch (err) {
    const persisted = _readPersisted(base);
    if (persisted) {
      const ageMs = now - new Date(persisted.cachedAt).getTime();
      if (ageMs < STALE_OK_TTL) {
        _cachedRates = persisted.rates;
        _cacheBase = base;
        _cacheTime = new Date(persisted.cachedAt).getTime();
        return persisted.rates;
      }
    }
    throw err;
  }
}

export function convertAmount(amount, fromCurrency, toCurrency, rates) {
  if (!rates || fromCurrency === toCurrency) return amount;
  // rates are relative to base (USD). Convert: amount → USD → target
  const toUSD = fromCurrency === 'USD' ? 1 : (1 / (rates[fromCurrency] || 1));
  const toTarget = rates[toCurrency] || 1;
  return amount * toUSD * toTarget;
}

export const CURRENCY_SYMBOLS = {
  USD: '$', EUR: '€', GBP: '£', JPY: '¥', CAD: 'CA$', AUD: 'A$',
  CHF: 'Fr', CNY: '¥', KRW: '₩', MXN: 'MX$', INR: '₹', BRL: 'R$',
  SEK: 'kr', NOK: 'kr', DKK: 'kr', SGD: 'S$', HKD: 'HK$', THB: '฿',
};
