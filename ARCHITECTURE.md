# Offline Windows Pharmacy — Fresh Architecture

> The authoritative detailed specification is [Professional Architecture](docs/PROFESSIONAL-ARCHITECTURE.md), including nine Mermaid diagrams, API contracts, Windows lifecycle, security and acceptance criteria. See [License Register](docs/LICENSES.md) for component licensing and distribution decisions. This file is an earlier overview; the detailed specification takes precedence where names or contracts differ.

## Requirements

- Add medicines with name, type, strength (mg/ml), quantity and prices.
- Search by medicine name and immediately show available stock.
- Complete a sale and immediately update quantity.
- A separate Low Stock button lists medicines at or below their configured minimum.
- Operate without internet after installation.

## Technology

Windows Electron desktop application → Next.js/React interface → local Node.js/Express API → local MongoDB database.

Electron will start and stop the local services, display startup errors and open the application only after services are ready. Services bind to loopback and do not depend on cloud accounts, CDNs or external APIs. The Windows installer must include the required runtime and local database setup.

## Database and consistency

Local MongoDB runs as a single-node replica set to support transactions. Medicine, sale and stock movement records persist outside the installation directory. A sale and its stock deductions commit in one transaction. Conditional updates prevent overselling; failed sales leave stock unchanged. Quantities must be positive integers for sales. Monetary values use integer paisa.

## Records

- Medicine: ID, name, optional barcode, type, strength, strength unit, current quantity, purchase price, retail price, wholesale price, minimum stock, timestamps.
- Sale: ID, unique request ID, invoice number, medicine snapshots, quantities, unit prices, total and timestamp.
- Stock movement: medicine ID, quantity change, reason (opening stock, restock, sale, adjustment), related sale and timestamp.

Prices for a sale are read and validated by the backend. Duplicate checkout requests must return the existing sale rather than deducting stock twice. Opening quantities and restocking create stock movement records.

## Backend API

- POST /api/medicines — create medicine with opening stock.
- GET /api/medicines?search= — search and return live quantities.
- PATCH /api/medicines/:id — edit descriptive fields, prices and minimum stock.
- POST /api/medicines/:id/restock — add stock and record purchase cost.
- GET /api/stock/low — quantity at or below minimum, including out of stock.
- POST /api/sales — validate and commit sale and stock deduction.
- GET /api/sales/:id — retrieve saved invoice.
- GET /api/health — service/database readiness.

Stock quantities change through stock operations rather than arbitrary medicine edits. Inventory and Low Stock views refresh immediately after a successful sale or restock and when revisited.

## Implementation order

1. Architecture (this document).
2. Backend, validation, local database bootstrap and transaction tests.
3. Next.js screens: medicines, add medicine, sale and Low Stock.
4. Electron lifecycle, offline Windows packaging and backup/restore.

## Required verification

Add a medicine → search it → restock → sell → verify remaining quantity → verify Low Stock entry. Also verify insufficient-stock rejection, transaction rollback, duplicate checkout handling, persistence after restart and operation with internet disconnected.

## Current state

Previous implementation removed. This document defines the fresh implementation; the new backend and desktop installer are not implemented yet. An existing local .env is retained as configuration and must be reviewed before reuse without exposing secrets.
