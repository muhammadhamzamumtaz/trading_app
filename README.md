# Global Trading Dashboard

A scalable real-time trading app that tracks:

- Stocks
- Gold and silver
- Crypto coins
- Forex pairs and currency conversion (USD, EUR, PKR)

## Tech Stack

- **Backend:** Node.js + Express
- **Frontend:** Vanilla JavaScript + Chart.js
- **Data Source:** Yahoo Finance public endpoints (open and free to access)

## Features

- Real-time market snapshot with auto-refresh every 30 seconds
- Prices shown in **USD, EUR, and PKR**
- Dedicated sections for stocks, metals, crypto, and forex
- Modern interactive line chart for selected asset
- Scalable API design with separate snapshot and history routes

## API Endpoints

- `GET /api/market/config` - Market symbol configuration
- `GET /api/market/snapshot` - Current market prices with conversion
- `GET /api/market/history/:symbol?range=1d&interval=5m` - Historical trend data

## Run Locally

```bash
npm install
npm start
```

Then open `http://localhost:3000`.
