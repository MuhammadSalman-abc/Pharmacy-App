# License and Distribution Register

Reviewed: 30 October 2026. Proposed dependencies; no implementation lockfile exists yet. Exact versions, transitive dependencies and bundled binaries must be inventoried at release.

| Component | Upstream license | Distribution action |
|---|---|---|
| Electron | MIT; includes separately licensed components | Preserve Electron license and bundled Chromium/third-party notices |
| Next.js | MIT | Include license and copyright notice |
| React | MIT | Include license and copyright notice |
| Express | MIT | Include license and copyright notice |
| Node.js | MIT with third-party components | Include Node license and bundled dependency notices |
| Mongoose | MIT | Include license and copyright notice |
| Lucide React icons | ISC | Include the installed package's ISC license and notice |
| MongoDB Community Server | SSPL v1 | Review exact binary's redistribution/source obligations before bundling |

## Official sources

- Electron: https://www.electronjs.org/docs/latest/why-electron and https://github.com/electron/electron/blob/main/LICENSE
- Next.js: https://github.com/vercel/next.js/blob/canary/license.md
- React: https://github.com/facebook/react/blob/main/LICENSE
- Express: https://github.com/expressjs/express/blob/master/LICENSE
- Node.js: https://github.com/nodejs/node/blob/main/LICENSE
- Mongoose: https://github.com/Automattic/mongoose/blob/master/LICENSE.md
- MongoDB: https://www.mongodb.com/legal/licensing/community-edition
- MongoDB FAQ: https://www.mongodb.com/legal/licensing/server-side-public-license/faq
- MongoDB license text: https://github.com/mongodb/mongo/blob/master/LICENSE-Community.txt

## MongoDB packaging decision

MongoDB Community Server is not MIT licensed. Offline use does not remove redistribution obligations. Using MongoDB through its driver is distinct from distributing the database server in an installer. The SSPL FAQ distinguishes ordinary application use from offering MongoDB as a service; this application is designed for a local pharmacy workflow, not a database hosting service.

Before distributing a bundled Windows installer, select and document either a compliant Community Server distribution (including the relevant notices and corresponding-source obligations for the exact binary) or an appropriate commercial agreement. A separately installed local MongoDB is a development option, but changes the first-install experience and does not produce a self-contained installer. The architecture keeps MongoDB as requested; the distribution method remains a release decision. This document is a technical license inventory, not a legal clearance.

## Application ownership

No open-source license is assigned to the custom application by this document. The owner can choose proprietary commercial distribution terms or an open-source license. Do not insert an invented copyright owner or claim ownership terms have been agreed. If activation is later requested, use offline signed license files rather than requiring internet at startup; activation is outside the current feature scope.

## Release deliverables

1. THIRD-PARTY-NOTICES with actual license texts from pinned dependencies.
2. Versioned dependency inventory/SBOM covering npm packages, Electron and database binaries.
3. Required source provision or source offer for redistributed components where applicable.
4. Application EULA and privacy statement reflecting actual data handling, if commercially distributed.
5. Windows installer signing using a publisher certificate when available; code signing is separate from software licensing and is not currently configured.

This register does not replace the actual notices or source obligations shipped with a release.
