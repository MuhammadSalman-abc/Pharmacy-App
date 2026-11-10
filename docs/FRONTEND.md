# Frontend — Next.js pharmacy workspace

## Start

```powershell
npm ci
npm run dev:web
```

Open http://127.0.0.1:3000. Start the MongoDB replica set and backend using [BACKEND.md](BACKEND.md), then open Settings & connection in the sidebar. Enter `http://127.0.0.1:5000/api` and the private API_TOKEN configured in the backend `.env`. Set backend UI_ORIGIN to `http://127.0.0.1:3000`.

## Frontend module layout

- `apps/web/app/page.tsx` composes the workspace shell and feature screens.
- `apps/web/hooks/use-pharmacy-workspace.ts` owns workspace state, data loading, and pharmacy actions.
- `apps/web/components/workspace/` contains screen-level modules, shared tables/dialogs, and navigation.
- `apps/web/components/medicines/` contains medicine search, form, delete, and low-stock PDF modules.
- `apps/web/components/demands/` contains demand-list export modules.
- `apps/web/lib/` contains API contracts, connection persistence, and offline IndexedDB storage.

Screens receive data and callbacks through props; the workspace hook owns writes and cross-screen state.

The verified connection is remembered in localStorage for this browser profile and site on this laptop, never in a NEXT_PUBLIC environment variable or source bundle. Refreshing, closing a tab, or restarting the browser restores it automatically. Existing sessionStorage connections migrate on the next load. Disconnect removes both stored copies. Clearing site data, using private browsing/a different browser, or changing the backend token requires reconnecting. This is the development connection workflow; Electron preload/main will manage the connection in the packaged desktop release. No backend secrets are copied into frontend build configuration.

## Included screens

- Overview: prominent customer medicine search with live name/barcode results, available units, retail prices and Add to sale actions; active medicine count, low-stock count, completed invoice count, current basket units, low-stock shortlist and recent invoices. The search requires the local API connection and shows explicit connection guidance when disconnected.
- Medicines: server-side paginated name-prefix/exact-barcode search, available quantity, prices and status, edit dialog and restock dialog.
- Delete: each full medicine row has a visible Delete button with a confirmation dialog showing its available units. Confirmation archives the record and removes it from active inventory/search/low-stock totals and the current basket; saved invoices and movement history remain. Delete actions are blocked during an active or uncertain checkout.
- Add medicine: medicine form, strength, opening quantity, purchase cost preview, unit prices and threshold. Rupees are converted to integer paisa before API submission.
- Point of sale: add several medicines to one basket by clicking their cards or scanning barcodes, adjust each line's quantity, choose retail/wholesale mode, then checkout once for one combined invoice. All line quantities are checked against stock and deducted together. Stock and alert counts refresh after writes and every five seconds while visible.
- Kam Stock: active medicines at or below their minimum, including zero stock, with direct restock.
- Kam Stock PDF: Download PDF exports all matching active low-stock medicines across pagination, ordered by quantity, with name/strength, barcode, available units, alert limit, retail price and status. Reports include generation time and page numbers; empty stock-alert lists produce an explicit no-low-stock report. Generation is local and authenticated; no inventory is modified.
- Sales history: paginated invoices, inclusive date filters, Pakistan-time daily net totals, and invoice viewing/printing. Deleting a completed sale marks it as deleted, restores its sold units with stock movement audit records, and removes it from net sales calculations while retaining the invoice in history.
- Settings: local connection verification, actionable connection errors and disconnect.

Checkout retains the same request ID after an uncertain network response and locks basket edits until the request can be retried. A confirmed validation/stock error releases the basket for correction. The backend remains the source of truth for quantities and final prices. Counts never use fabricated sample data; disconnected screens show connection guidance.

## Production frontend

The exported frontend includes a PWA manifest, home-screen icon, service worker, and a phone-only mode at `/?local=1`. This mode stores medicines, stock, invoices, movements and backup files in IndexedDB and needs no API. Build it with `npm run build:web`, host `apps/web/out` on HTTPS, and install from the Android browser menu. After installation, launching from the home-screen icon opens local mode and works offline; only app-shell delivery and future updates use hosting. Back up and restore the phone database in Workspace settings.

```powershell
npm run build
npm run start:web
```

`build` checks the backend and builds the frontend. `npm run validate` is an alias for both builds; database integration tests remain `npm test`. Next.js generates static assets in apps/web/out. The local production server binds to 127.0.0.1:3000. No Google fonts, CDNs or remote images are required at runtime.

## Isolated UI QA

`scripts/preview-api.ts` starts a disposable MongoDB replica set on a temporary directory and serves fixture medicines on port 5001. It never reads the application's .env database URL. It requires a cached MongoDB test binary or MONGOMS_SYSTEM_BINARY set to an installed binary. Use `npx tsx scripts/preview-api.ts` and the explicitly disposable token in that script for local QA only. Do not use this server for actual medicine records; its data is discarded when stopped.

Electron wrapper, Windows installer, automatic process lifecycle and backup/restore UI remain subsequent work. Batch/expiry tracking, pack conversion and sale returns are not supported by the current backend and are not represented as working controls.

## Verified behavior

The production static build was exercised in a browser against the disposable real MongoDB API: created a medicine with 12 units, scanned its barcode, sold 3 units for Rs 60, verified quantity 9 and its inclusion in Kam Stock, then received 25 units and verified its removal from Kam Stock. No browser warnings/errors were recorded during this flow. The screenshot `frontend-preview.png` shows fixture data from this isolated QA session, not actual pharmacy records. Physical barcode hardware and printer output have not been tested.
