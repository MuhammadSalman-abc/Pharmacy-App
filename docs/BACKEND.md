# Backend operations and API guide

## Simple Windows startup (configured workspace)

This workspace now uses a dedicated local MongoDB on port **27018**, leaving the existing standalone MongoDB service on 27017 unchanged. Its data lives in `.local/pharmacy-db` and logs in `.local/logs/mongodb.log`. The actual `.env` is configured for this local replica set; the example 27017 instructions below remain a manual alternative.

Run `npm run pharmacy`, or double-click `start-pharmacy.bat`, to start/check the database and launch the backend and frontend. Keep the application terminal open while working. The database runs in the background and writes logs to a file instead of flooding the terminal. This is a development launcher, not a Windows service or packaged installer.

For the first frontend connection, use Settings with `http://127.0.0.1:5000/api`. Run `npm run token:copy` in another terminal and paste into Local API token, then Connect & verify. The token command copies the value locally without printing it. The frontend remembers this connection across browser restarts on the same browser profile/site until Disconnect, cleared site data or a token change.

## Run locally

Requires Node.js 22+ and a local MongoDB Community Server binary with replica-set support. The API itself never downloads or connects to cloud services.

```powershell
npm ci
```

Create a dedicated local database directory, then start your installed mongod (use its full path if it is not on PATH):

```powershell
New-Item -ItemType Directory -Force .local/db
mongod --dbpath .local/db --replSet pharmacy-rs --bind_ip 127.0.0.1 --port 27017
```

In another terminal initialize the replica set once:

```powershell
npm run db:init
```

Configure the existing `.env` manually using `.env.example` as a reference; do not overwrite existing secrets. Set MONGODB_URI to the local replica-set URI and API_TOKEN to a private 32+ character random string. To generate a token:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
npm run dev:api
```

Production compilation: `npm run build`, then `npm run start:api`. API listens only on 127.0.0.1:5000 by default. Health endpoint requires the same token as other routes. A standalone mongod cannot support stock transactions; startup explicitly rejects it.

This manual development database command is loopback-only but unauthenticated. Before distributing a desktop installer, provision MongoDB authentication and Windows-protected credentials as specified in the architecture. Packaged MongoDB lifecycle, backup/restore and installer are desktop-stage work, not implemented by this backend.

## Request conventions

Every request uses `Authorization: Bearer <API_TOKEN>`. When a browser sends Origin, it must equal UI_ORIGIN exactly. JSON body limit is 128 KiB. All prices are integer paisa: Rs 25.50 is 2550. Do not send floating-point rupees. Sale quantity counts sellable units, not mg/ml.

Create medicine, POST /api/medicines:

```json
{
  "name": "Panadol",
  "barcode": "123456789",
  "form": "Tablet",
  "strength": 500,
  "strengthUnit": "mg",
  "quantity": 100,
  "minimumStock": 10,
  "totalPurchasePaisa": 150000,
  "retailPricePaisa": 2000,
  "wholesalePricePaisa": 1750
}
```

POST /api/sales uses a fresh UUID requestId for each checkout. Reuse it when retrying that same checkout. Reusing it for a different cart returns 409.

```json
{
  "requestId": "84aa5d95-c730-4f1a-81df-96d3dd2f4bd6",
  "priceMode": "retail",
  "items": [{ "medicineId": "REPLACE_WITH_24_HEX_ID", "quantity": 7 }]
}
```

Wholesale checkout uses the stored wholesale price, including zero when explicitly configured. It does not silently replace it with a retail price. Prices are selected by the server, and name/strength/price snapshots are saved on the invoice.

| Route | Payload / response |
|---|---|
| GET /api/health | `{data:{ready}}`; 503 if disconnected |
| GET /api/medicines?search=pan&page=1&limit=25 | Prefix name or exact barcode; active records |
| POST /api/medicines | Fields above; creates opening movement atomically |
| PATCH /api/medicines/:id | Partial descriptive/pricing fields, minimumStock, archived; quantity edits rejected |
| POST /api/medicines/:id/restock | `{quantity:25,totalPurchasePaisa:25000,note:"delivery"}` |
| POST /api/medicines/:id/adjustments | `{delta:-2,note:"physical count correction"}` |
| GET /api/stock/low?page=1&limit=25 | Active quantity <= minimumStock; meta.total is badge count |
| POST /api/sales | Checkout above; 201 new, 200 replay |
| GET /api/sales?page=1&limit=25&from=YYYY-MM-DD&to=YYYY-MM-DD | Saved invoices newest first; optional inclusive Pakistan-time date range, net totals and per-day totals exclude voided invoices |
| GET /api/sales/:id | Invoice with immutable snapshots |
| DELETE /api/sales/:id | Mark invoice voided, restore its sold quantities and exclude its amount from net totals; the original invoice remains in history |

List responses contain `{data:[],meta:{page,limit,total}}`. Errors contain `{error:{code,message,fields?,requestId}}`. Unknown fields are rejected. Blank barcodes are omitted so multiple medicines without barcodes are allowed. Restocking updates the latest per-unit purchase cost using integer half-up rounding, not a historical weighted cost.

## Checks

`npm run build` checks TypeScript. `npm test` starts an isolated real MongoDB single-node replica set and verifies validation, search, stock changes, low-stock alerts, idempotency, concurrent checkout, rollback and reconnect persistence. Test tooling downloads a MongoDB binary on first run; cached runs can execute without that download. Tests never use the configured application database.

To use an already installed MongoDB binary without downloading one, set `MONGOMS_SYSTEM_BINARY` to its full path and `MONGOMS_SYSTEM_BINARY_VERSION_CHECK=false` before `npm test`. For example:

```powershell
$env:MONGOMS_SYSTEM_BINARY='C:\Program Files\MongoDB\Server\8.2\bin\mongod.exe'
$env:MONGOMS_SYSTEM_BINARY_VERSION_CHECK='false'
npm test
```

Structured request logs go to stdout for the desktop supervisor to capture. No request bodies, authorization tokens, MongoDB URIs or raw database errors are logged. Persistent rotation, full process-restart tests, Windows installer and disconnected-network acceptance remain desktop integration gates.
