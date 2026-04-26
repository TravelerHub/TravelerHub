const API_BASE = import.meta.env.VITE_API_URL || 'https://travelhub-api.fozhan.dev';

let _cachedRates = null;
let _cacheBase = null;
let _cacheTime = 0;
const TTL = 6 * 60 * 60 * 1000; // 6 hours

export async function getExchangeRates(base = 'USD') {
  const now = Date.now();
  if (_cachedRates && _cacheBase === base && now - _cacheTime < TTL) {
    return _cachedRates;
  }
  const res = await fetch(`${API_BASE}/api/currency/rates?base=${base}`);
  if (!res.ok) throw new Error('Failed to fetch exchange rates');
  const data = await res.json();
  _cachedRates = data.rates;
  _cacheBase = base;
  _cacheTime = now;
  return data.rates;
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
