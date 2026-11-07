# Pharmacy Desktop System — Architecture Specification

Version 1.0 · 30 October 2026 · Status: proposed design, implementation pending

## 1. Product scope

An offline, single-computer Windows pharmacy system. The operator creates medicines, searches available quantities, records sales and sees low-stock medicines on a dedicated screen. Daily operation requires no network connection. MERN is retained: MongoDB, Express, React through Next.js, and Node.js; Electron supplies the Windows desktop shell.

Initial scope: medicine catalog, opening stock, restocking, selling, minimum-stock alerts, invoices, backup and recovery. Multi-branch sync, online accounts, customer credit, tax integrations and supplier accounting are outside the initial release. Returns, batch/expiry tracking and user roles are future modules, not implied completed features. Batch/expiry tracking should be agreed before commercial pharmacy use; the initial quantity model is per medicine rather than per batch.

## 2. System context

```mermaid
flowchart LR
    O[Pharmacy operator] --> A[Windows Pharmacy Desktop]
    S[Optional USB barcode scanner] --> A
    A --> P[Optional local receipt printer]
    A --> B[Local backup folder or USB drive]
    A --> D[(Database on this Windows PC)]
```

No cloud database, remote fonts, CDN scripts, runtime licensing server or remote authentication is required. Downloads are needed only to prepare releases or obtain an installer.

## 3. Container architecture

```mermaid
flowchart TB
    subgraph PC[Windows computer - offline runtime]
        subgraph E[Electron application]
            M[Main process - lifecycle and privileged operations]
            U[Renderer - Next.js static React interface]
            I[Preload - narrow typed IPC bridge]
            U --> I
            I --> M
        end
        M -->|start and monitor| API[Node.js / Express local API]
        M -->|start and monitor| DB[(MongoDB single-node replica set)]
        U -->|HTTP with per-launch token on loopback| API
        API -->|Mongoose repositories| DB
        M --> F[Local settings / logs / backup files]
    end
```

Next.js is built as a static export: its routes use client-side local API calls. A small local server serves the exported assets; no Next.js production server or server actions are needed. This reduces offline startup processes. Express and MongoDB remain independent backend components. All local listeners bind to 127.0.0.1. Electron chooses available application ports and injects the API address securely.

## 4. Backend layers and ownership

```mermaid
flowchart TB
    R[HTTP routes] --> V[Request schemas and middleware]
    V --> C[Controllers - HTTP responses]
    C --> S[Application services - business rules]
    S --> RE[Repositories - database operations]
    RE --> MO[Mongoose models and indexes]
    MO --> D[(MongoDB)]
    S --> T[Transaction coordinator]
    S --> L[Structured audit logging]
```

Routes never write stock directly. InventoryService owns quantity changes; SalesService coordinates pricing, invoices, stock and movements in a single transaction. CatalogService owns names, strengths and prices. BackupService runs only through a restricted Electron command. Controllers translate validation, conflict, unavailable and internal errors into stable API responses.

## 5. Operator navigation

```mermaid
flowchart LR
    HOME[Dashboard] --> MED[Medicines / Search]
    HOME --> ADD[Add Medicine]
    HOME --> POS[New Sale]
    HOME --> LOW[Kam Stock]
    HOME --> BACK[Backup and Restore]
    MED --> REST[Restock selected medicine]
    MED --> EDIT[Edit medicine details]
    POS --> INV[Saved invoice]
```

Search results show name, form, strength, available quantity and unit sale prices. Kam Stock shows quantity less than or equal to the medicine's configured minimum; zero quantity is explicitly marked Out of stock. The button displays a count of affected medicines, not a count of units.

## 6. Add medicine and restock flow

```mermaid
flowchart TD
    A[Enter medicine information] --> B{Inputs valid?}
    B -->|No| C[Show field errors]
    C --> A
    B -->|Yes| D{Barcode already exists?}
    D -->|Yes| E[Open existing medicine / suggest restock]
    D -->|No| F[Begin database transaction]
    F --> G[Create catalog record and opening quantity]
    G --> H[Record opening stock movement]
    H --> I{Commit successful?}
    I -->|No| J[Rollback and show retryable error]
    I -->|Yes| K[Refresh inventory and Kam Stock count]
    E --> R[Enter positive restock quantity and purchase cost]
    R --> S[Transaction: increment stock and save movement]
    S --> K
```

Quantity is stored in sellable units: one tablet, capsule, injection, bottle or tube. mg/ml describes strength or volume, not stock count. Opening purchase total is divided by opening unit quantity to derive a purchase cost; decimal arithmetic and rounding rules are applied on the server. This first version does not calculate historical cost of goods sold from restock batches.

## 7. Sale sequence and stock consistency

```mermaid
sequenceDiagram
    actor Operator
    participant UI as POS interface
    participant API as Sales API
    participant DB as Local MongoDB
    Operator->>UI: Search name or scan barcode
    UI->>API: GET medicines?search=...
    API->>DB: Query matching medicines
    DB-->>UI: Names, strengths, quantities and prices via API
    Operator->>UI: Select quantity and complete sale
    UI->>API: POST sale with unique requestId
    API->>DB: Begin transaction / lookup requestId
    alt Sale already committed
        DB-->>API: Existing invoice
        API-->>UI: Return existing result without deduction
    else New request
        API->>DB: Read prices and conditionally decrement stock
        alt Stock unavailable or invalid input
            API->>DB: Abort transaction
            API-->>UI: Conflict or validation message
        else All lines valid
            API->>DB: Save invoice and stock movements
            API->>DB: Commit transaction
            API-->>UI: Saved invoice and affected quantities
            UI->>API: Refresh inventory and low-stock list
        end
    end
```

Duplicate medicine lines are combined before validation. Quantity must be a positive safe integer. The backend selects prices; frontend totals are previews. Conditional quantity updates and transactions protect against two concurrent checkout requests. A unique requestId prevents double deduction after retry or lost responses. A local single-node replica set supports transactions, but does not provide hardware redundancy.

## 8. Low-stock calculation

```mermaid
flowchart LR
    A[Sale / restock / threshold edit commits] --> B[Refresh affected medicine quantities]
    B --> C{Quantity <= minimumStock?}
    C -->|Yes| D[Include in Kam Stock]
    C -->|No| E[Exclude from Kam Stock]
    D --> F[Update badge count and screen]
    E --> F
```

The list is derived from current database values, not maintained as a second inventory collection. Refresh immediately after a write and whenever the screen opens. Background refresh every five seconds while the screen is visible handles another local window; stale data is marked when the API is unavailable. Server-sent events can be added later if multiple tills are introduced.

## 9. Data model

```mermaid
erDiagram
    MEDICINE ||--o{ STOCK_MOVEMENT : changes
    MEDICINE ||--o{ SALE_LINE : sold_as
    SALE ||--|{ SALE_LINE : contains
    SALE o|--o{ STOCK_MOVEMENT : causes
    MEDICINE {
        ObjectId id PK
        string name
        string normalizedName
        string barcode UK
        string form
        decimal strength
        string strengthUnit
        int quantity
        int minimumStock
        int purchasePricePaisa
        int retailPricePaisa
        int wholesalePricePaisa
        boolean archived
        datetime createdAt
        datetime updatedAt
    }
    SALE {
        ObjectId id PK
        string requestId UK
        string invoiceNumber UK
        string priceMode
        int totalPaisa
        datetime createdAt
    }
    SALE_LINE {
        ObjectId medicineId FK
        string nameSnapshot
        string strengthSnapshot
        int quantity
        int unitPricePaisa
        int totalPaisa
    }
    STOCK_MOVEMENT {
        ObjectId id PK
        ObjectId medicineId FK
        ObjectId saleId FK
        int delta
        string reason
        string note
        datetime createdAt
    }
```

SALE_LINE is an embedded array in a sale document, shown separately for clarity. Snapshot names/prices preserve historical invoices after catalog edits. Archive medicines instead of deleting records referenced by sales. Barcode uses a partial unique index only for nonempty strings. Other indexes: normalizedName for escaped prefix search, sales.createdAt, unique sales.requestId, unique invoiceNumber, and stockMovements(medicineId, createdAt). Low-stock comparison uses an expression query; monitor performance before adding a derived flag. All monetary calculations use safe integer paisa with explicit overflow and rounding checks. Timestamps use UTC and display in the PC's configured timezone.

## 10. API contract

| Method and route | Responsibility | Main rule |
|---|---|---|
| GET /api/health | Startup/readiness | Report actual database readiness |
| GET /api/medicines?search=&page=&limit= | Search and stock | Bounded pagination; literal prefix search |
| POST /api/medicines | Catalog and opening stock | Name, form, valid prices and integer quantity |
| PATCH /api/medicines/:id | Descriptive fields, prices, threshold | No direct quantity changes |
| POST /api/medicines/:id/restock | Stock receipt | Positive units; transaction and movement |
| POST /api/medicines/:id/adjustments | Explicit correction | Reason required; stock cannot become negative |
| GET /api/stock/low | Kam Stock screen | Include zero quantity; exclude archived records |
| POST /api/sales | Checkout | Unique requestId; atomic stock and sale |
| GET /api/sales/:id | Saved invoice | Read historical snapshot |
| GET /api/sales?page=&limit= | Invoice history | Stable pagination |

Success responses: `{ data, meta? }`. Errors: `{ error: { code, message, fields?, requestId } }`. Use 400 for malformed inputs, 404 for missing records, 409 for duplicate/conflicting stock, 503 for unavailable database and 500 for unexpected failures. Never return raw database stack traces to the operator.

## 11. Windows startup and shutdown

```mermaid
flowchart TD
    A[Open installed application] --> B[Acquire single-instance lock]
    B --> C[Load configuration and local credentials]
    C --> D[Start or connect to application-owned MongoDB]
    D --> E[Initialize replica set on first run]
    E --> F[Wait for primary and validate schema version]
    F --> G[Start local API and static asset server]
    G --> H{Health ready?}
    H -->|Yes| I[Open Electron window]
    H -->|Timeout or failure| J[Show actionable recovery screen and logs]
    I --> K[Application close]
    K --> L[Finish or reject pending writes]
    L --> M[Stop app-owned processes and release lock]
```

Install binaries under Program Files; store per-user data under `%LOCALAPPDATA%/PharmacyDesktop/` with separate db, logs, backups and config directories. A standard user can run daily operations after setup. Never terminate unrelated MongoDB or Node processes. Do not automatically reset the database on startup errors. Installer and upgrades preserve data; an uninstall removes binaries by default and requires an explicit separate data deletion choice.

## 12. Security and offline operations

- Electron renderer: nodeIntegration disabled, contextIsolation and sandbox enabled. Only allowlisted IPC commands; no arbitrary command or filesystem bridge.
- Load packaged assets only, block unexpected navigation and new windows, and apply a restrictive content security policy.
- API: per-launch secret held in preload/main, allowlisted local origin, input size limits and no network exposure. CORS alone is not authentication.
- MongoDB: loopback binding, authenticated least-privilege application user, local file permissions. Store credentials through Windows-protected storage; do not embed secrets in source.
- Backups: pause new writes, wait for active transactions, create a consistent supported database dump and manifest, verify readability, then resume writes. Never treat a live copy of database files as a verified backup.
- Restore: close database clients, validate backup/schema compatibility, create pre-restore backup, restore into a temporary database and validate before switching. Failure retains existing data.
- Upgrades: local installer, backup before migration, versioned migrations and no automatic downgrade of incompatible data.
- Logs: local rotating files, request IDs and useful failure context; redact credentials. Do not log customer details unnecessarily.

## 13. Proposed source layout

```text
apps/
  desktop/       Electron main, preload, lifecycle, packaging
  web/           Next.js routes, UI components, API client
  api/           Express routes, controllers, services, repositories
packages/
  contracts/     Shared request schemas and response types
  config/        Shared development configuration
docs/            Architecture, diagrams, license inventory
tests/           API integration and desktop acceptance tests
```

Use TypeScript throughout. Keep modules in one backend initially; microservices add no benefit for this single-PC workflow. Lock dependency versions and run installation from the lockfile. Do not ship development tools or development servers.

## 14. Acceptance and release gates

| Scenario | Required result |
|---|---|
| Create 100 tablets; search name | Correct strength and 100 available |
| Sell 7 units | Invoice persists and quantity becomes 93 |
| Threshold 10; sell down to 10 | Kam Stock includes the medicine and badge updates |
| Restock 25 from quantity 10 | Quantity 35; removed from Kam Stock |
| Attempt sale exceeding available stock | No invoice or partial stock change |
| Retry same checkout request | Same invoice; one deduction |
| Simultaneous checkouts | No negative stock or overselling |
| Forced failure before commit | Sale and all stock changes roll back |
| Restart app with internet disabled | Data persists; complete add/search/sell flow works |
| Database cannot start | Recovery screen; no empty database silently created |
| Backup and restore on a clean installation | Invoices, stock and movement totals agree |
| Install/upgrade/uninstall | No unintended data loss; notices included |

Proposed targets to measure on supported hardware: first screen ready within 10 seconds after setup, indexed search within 300 ms at 10,000 medicines, and checkout feedback within 1 second under normal local operation. These are acceptance targets, not measured claims.

## 15. Implementation milestones

1. Approve scope and record packaging/license decisions.
2. Implement backend contracts, models, indexes and local replica-set bootstrap.
3. Verify transactions, concurrency, validation and idempotency against real local MongoDB.
4. Build medicines, sales, Kam Stock and invoice screens.
5. Integrate Electron lifecycle and backup/restore.
6. Verify Windows installer offline on a clean PC and assemble third-party notices.

License inventory and release obligations are recorded in [LICENSES.md](LICENSES.md). This specification describes planned behavior and does not claim an existing working application.
