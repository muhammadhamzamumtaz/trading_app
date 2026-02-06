const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const YAHOO_QUOTE_URL = 'https://query1.finance.yahoo.com/v7/finance/quote';
const YAHOO_CHART_URL = 'https://query1.finance.yahoo.com/v8/finance/chart';

const MARKET_CONFIG = {
  stocks: [
    { symbol: 'AAPL', name: 'Apple' },
    { symbol: 'MSFT', name: 'Microsoft' },
    { symbol: 'GOOGL', name: 'Alphabet' },
    { symbol: 'TSLA', name: 'Tesla' },
    { symbol: 'NVDA', name: 'NVIDIA' },
    { symbol: 'AMZN', name: 'Amazon' }
  ],
  metals: [
    { symbol: 'GC=F', name: 'Gold Futures' },
    { symbol: 'SI=F', name: 'Silver Futures' }
  ],
  crypto: [
    { symbol: 'BTC-USD', name: 'Bitcoin' },
    { symbol: 'ETH-USD', name: 'Ethereum' },
    { symbol: 'SOL-USD', name: 'Solana' },
    { symbol: 'BNB-USD', name: 'BNB' }
  ],
  forex: [
    { symbol: 'EURUSD=X', name: 'EUR / USD' },
    { symbol: 'USDPKR=X', name: 'USD / PKR' },
    { symbol: 'EURPKR=X', name: 'EUR / PKR' },
    { symbol: 'GBPUSD=X', name: 'GBP / USD' }
  ]
};

const buildAssetLookup = () => {
  const map = new Map();
  Object.entries(MARKET_CONFIG).forEach(([category, assets]) => {
    assets.forEach((asset) => {
      map.set(asset.symbol, { ...asset, category });
    });
  });
  return map;
};

const ASSET_LOOKUP = buildAssetLookup();

async function fetchQuotes(symbols) {
  const symbolsParam = symbols.join(',');
  const { data } = await axios.get(YAHOO_QUOTE_URL, {
    params: { symbols: symbolsParam },
    timeout: 10000
  });

  return data?.quoteResponse?.result || [];
}

function getConversionRates(quotes) {
  const eurUsdQuote = quotes.find((q) => q.symbol === 'EURUSD=X');
  const usdPkrQuote = quotes.find((q) => q.symbol === 'USDPKR=X');

  const eurUsd = eurUsdQuote?.regularMarketPrice;
  const usdPkr = usdPkrQuote?.regularMarketPrice;

  return {
    usdToEur: eurUsd ? 1 / eurUsd : null,
    usdToPkr: usdPkr || null
  };
}

function normalizeQuote(quote, conversionRates) {
  const metadata = ASSET_LOOKUP.get(quote.symbol) || {
    symbol: quote.symbol,
    name: quote.shortName || quote.longName || quote.symbol,
    category: 'uncategorized'
  };

  const usdPrice = quote.regularMarketPrice;
  const eurPrice = conversionRates.usdToEur && usdPrice ? usdPrice * conversionRates.usdToEur : null;
  const pkrPrice = conversionRates.usdToPkr && usdPrice ? usdPrice * conversionRates.usdToPkr : null;

  return {
    ...metadata,
    currency: quote.currency || 'USD',
    exchange: quote.fullExchangeName || quote.exchange || 'N/A',
    price: {
      usd: usdPrice,
      eur: eurPrice,
      pkr: pkrPrice
    },
    marketChange: {
      absolute: quote.regularMarketChange,
      percent: quote.regularMarketChangePercent
    },
    marketState: quote.marketState || 'UNKNOWN',
    asOf: quote.regularMarketTime ? new Date(quote.regularMarketTime * 1000).toISOString() : new Date().toISOString()
  };
}

async function fetchHistory(symbol, range = '1d', interval = '5m') {
  const { data } = await axios.get(`${YAHOO_CHART_URL}/${encodeURIComponent(symbol)}`, {
    params: { interval, range },
    timeout: 10000
  });

  const chartResult = data?.chart?.result?.[0];
  if (!chartResult) {
    return [];
  }

  const timestamps = chartResult.timestamp || [];
  const closes = chartResult.indicators?.quote?.[0]?.close || [];

  return timestamps
    .map((ts, index) => {
      const close = closes[index];
      if (close === null || close === undefined) {
        return null;
      }
      return {
        time: new Date(ts * 1000).toISOString(),
        value: Number(close)
      };
    })
    .filter(Boolean);
}

app.get('/api/market/config', (req, res) => {
  res.json(MARKET_CONFIG);
});

app.get('/api/market/snapshot', async (req, res) => {
  try {
    const symbols = [...ASSET_LOOKUP.keys()];
    const quotes = await fetchQuotes(symbols);
    const conversionRates = getConversionRates(quotes);

    const normalized = quotes.map((quote) => normalizeQuote(quote, conversionRates));

    const grouped = normalized.reduce((acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    }, {});

    res.json({
      generatedAt: new Date().toISOString(),
      conversionRates,
      data: grouped
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to fetch market snapshot',
      details: error.message
    });
  }
});

app.get('/api/market/history/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    const { range = '1d', interval = '5m' } = req.query;

    const history = await fetchHistory(symbol, range, interval);
    res.json({
      symbol,
      range,
      interval,
      points: history
    });
  } catch (error) {
    res.status(500).json({
      error: `Failed to fetch history for ${req.params.symbol}`,
      details: error.message
    });
  }
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/index.html'));
});

app.listen(PORT, () => {
  console.log(`Trading app listening on http://localhost:${PORT}`);
});
