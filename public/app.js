const REFRESH_MS = 30000;
const state = {
  snapshot: null,
  chart: null,
  selectedSymbol: 'AAPL'
};

const formatPrice = (value, currency) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'N/A';
  }

  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: value >= 1000 ? 0 : 2
  }).format(value);
};

const formatPercent = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return 'N/A';
  }
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
};

function renderCards(containerId, items = []) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';

  items.forEach((item) => {
    const card = document.createElement('article');
    card.className = 'card';

    const changeClass = item.marketChange.percent >= 0 ? 'change-positive' : 'change-negative';

    card.innerHTML = `
      <h3>${item.name}</h3>
      <p class="muted">${item.symbol} · ${item.exchange}</p>
      <ul class="price-list">
        <li><span>USD</span><strong>${formatPrice(item.price.usd, 'USD')}</strong></li>
        <li><span>EUR</span><strong>${formatPrice(item.price.eur, 'EUR')}</strong></li>
        <li><span>PKR</span><strong>${formatPrice(item.price.pkr, 'PKR')}</strong></li>
      </ul>
      <p class="${changeClass}">${formatPercent(item.marketChange.percent)}</p>
    `;

    container.appendChild(card);
  });
}

function renderConversionRates(conversionRates) {
  const container = document.getElementById('conversion-grid');
  const cards = [
    { label: '1 USD in EUR', value: conversionRates.usdToEur },
    { label: '1 USD in PKR', value: conversionRates.usdToPkr },
    {
      label: '1 EUR in USD',
      value: conversionRates.usdToEur ? 1 / conversionRates.usdToEur : null
    }
  ];

  container.innerHTML = cards
    .map(
      (card) => `
      <article class="card">
        <h3>${card.label}</h3>
        <p>${card.value ? card.value.toFixed(4) : 'N/A'}</p>
      </article>
    `
    )
    .join('');
}

function flattenAssets(snapshotData) {
  return Object.values(snapshotData).flat();
}

function populateAssetSelector(allAssets) {
  const selector = document.getElementById('asset-selector');
  const options = allAssets
    .map((asset) => `<option value="${asset.symbol}">${asset.name} (${asset.symbol})</option>`)
    .join('');

  selector.innerHTML = options;
  selector.value = state.selectedSymbol;

  selector.onchange = async (event) => {
    state.selectedSymbol = event.target.value;
    await loadChart(state.selectedSymbol);
  };
}

async function loadChart(symbol) {
  const response = await fetch(`/api/market/history/${encodeURIComponent(symbol)}?range=1d&interval=5m`);
  const payload = await response.json();

  const labels = payload.points.map((point) => new Date(point.time).toLocaleTimeString());
  const prices = payload.points.map((point) => point.value);

  const context = document.getElementById('market-chart').getContext('2d');

  if (state.chart) {
    state.chart.destroy();
  }

  state.chart = new Chart(context, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: `${symbol} price trend`,
          data: prices,
          borderColor: '#38bdf8',
          backgroundColor: 'rgba(56, 189, 248, 0.2)',
          borderWidth: 2,
          tension: 0.25,
          fill: true,
          pointRadius: 0
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          labels: { color: '#cbd5e1' }
        }
      },
      scales: {
        x: {
          ticks: { color: '#94a3b8', maxTicksLimit: 8 },
          grid: { color: 'rgba(148, 163, 184, 0.1)' }
        },
        y: {
          ticks: { color: '#94a3b8' },
          grid: { color: 'rgba(148, 163, 184, 0.1)' }
        }
      }
    }
  });
}

async function refreshData() {
  const response = await fetch('/api/market/snapshot');
  const payload = await response.json();

  state.snapshot = payload;

  renderConversionRates(payload.conversionRates || {});
  renderCards('stocks', payload.data.stocks || []);
  renderCards('metals', payload.data.metals || []);
  renderCards('crypto', payload.data.crypto || []);
  renderCards('forex', payload.data.forex || []);

  const allAssets = flattenAssets(payload.data);
  if (!allAssets.some((asset) => asset.symbol === state.selectedSymbol)) {
    state.selectedSymbol = allAssets[0]?.symbol;
  }

  if (allAssets.length) {
    populateAssetSelector(allAssets);
    await loadChart(state.selectedSymbol);
  }

  document.getElementById('last-updated').textContent = `Last updated: ${new Date(payload.generatedAt).toLocaleString()}`;
}

async function bootstrap() {
  try {
    await refreshData();
    setInterval(refreshData, REFRESH_MS);
  } catch (error) {
    console.error('Failed to initialize dashboard:', error);
  }
}

bootstrap();
