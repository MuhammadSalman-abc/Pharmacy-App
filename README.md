# Pharmacy Desktop — Design Pack

Offline Windows pharmacy application using Next.js/React, Express/Node.js and local MongoDB.

## Open in a desktop window

Run `create-desktop-shortcut.vbs` once from this folder to add **MediStock Pharmacy** to the Windows desktop. Double-click that shortcut to start the local database, API and frontend and open the pharmacy in its own app window. Keep the black launcher window open while using the app; close it when finished.

The app window uses Microsoft Edge's installed app mode, without tabs or an address bar. The database and API remain on this computer.

- [Professional architecture and flow diagrams](docs/PROFESSIONAL-ARCHITECTURE.md)
- [Software licenses and distribution register](docs/LICENSES.md)

Open the architecture Markdown in a Mermaid-capable preview to view all nine diagrams. Diagram sources are included directly in the document and can be edited with the specification.

Backend implementation is in `apps/api` with shared schemas in `packages/contracts`. The Next.js frontend is in `apps/web`. See [Backend setup and API guide](docs/BACKEND.md) and [Frontend setup](docs/FRONTEND.md).

Run `npm run dev:web` and open http://127.0.0.1:3000. Start the configured backend with `npm run dev:api`, then enter its local address and API token in frontend Settings. `npm run dev` starts both development servers after the database/environment are configured.

Checks: `npm run validate` builds both apps; `npm test` runs the backend integration suite. A local MongoDB replica set and private API_TOKEN are required for real data; see `.env.example`. The frontend static production build uses no remote fonts, CDN assets or online services.
# Pharmacy_App
