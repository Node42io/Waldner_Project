# Waldner App — build & maintenance manual

A self-contained Vite + React app that presents Waldner PAS's **Sterile Fill-Finish**
engagement: the value network, the Ulwick ODI needs matrix, Waldner's matched
products, and the **sales customer map** — all from real Neo4j data, exported to
JSON files the app reads.

This manual is the source of truth for *how it was built* so you can refresh the
data or update the UI kit later without re-deriving anything.

---

## 1. Folder layout

```
Waldner App/
├── app/                  # the Vite React app (odi-waldner)
│   ├── src/
│   │   ├── data/         # BUNDLED JSON (imported at build time)
│   │   │   ├── valueNetwork.json      # SFF unit tree + meta
│   │   │   ├── market.json            # header stats + Waldner products
│   │   │   ├── odi_default.json       # the default rated unit (bundled)
│   │   │   ├── odi_index.json         # list of rated units (bundled)
│   │   │   └── sales/
│   │   │       ├── companies.json     # the 91 customers (Company[])
│   │   │       └── meta.json          # country / market filter options
│   │   ├── *.tsx, sales/*             # pages (thin compositions of the kit)
│   │   └── ...
│   ├── public/data/odi/  # PER-UNIT ODI JSON (fetched at runtime by slug)
│   │   ├── index.json
│   │   └── <slug>.json   # one per rated unit
│   └── vite.config.ts    # alias @node42/ui-kit -> ../ui-kit/src, base './'
├── ui-kit/               # vendored @node42/ui-kit (the design system)
├── scripts/              # Neo4j -> JSON exporters (Python)
│   ├── export_sff.py     # value network + ODI + Waldner products
│   ├── build_sales.py    # customers: Neo4j -> enrich -> geocode
│   └── .geocode-cache.json
├── .github/workflows/pages.yml   # GitHub Pages CI
├── HANDOFF.md            # original scaffold handoff (design intent)
└── MANUAL.md             # this file
```

The app **does not bundle** the kit; it live-links the kit's TypeScript source via
the Vite/tsconfig alias `@node42/ui-kit -> ../ui-kit/src/index.ts`. Editing the kit
hot-reloads the app.

---

## 2. Running it locally

Node 20+. Install both folders once (the app compiles the kit's source, so the
kit's dev deps — react types, phosphor icons — must be present):

```bash
cd "Waldner App/ui-kit" && npm install
cd ../app             && npm install
npm run dev           # http://localhost:5173
```

Other scripts (in `app/`): `npm run build` (`tsc -b && vite build`), `npm run preview`, `npm run lint`.
Browse the kit on its own: `cd ui-kit && npm run storybook`.

Routing uses a **HashRouter** (URLs look like `.../#/odi-matrix`) and a **relative
asset base** (`base: './'` in `vite.config.ts`) so the built app works from any
GitHub Pages sub-path with no server rewrites and without hard-coding the repo name.

Routes: `#/product-management`, `#/market-page`, `#/odi-matrix` (default),
`#/odi-matrix?unit=<slug>`, `#/sales`.

---

## 3. Updating the UI kit (when you add features)

The kit lives in `ui-kit/` as a vendored copy. Two ways to bring in changes you
make to the design system:

- **Edit in place** — just edit files under `ui-kit/src/...`; the app hot-reloads.
  Re-export any new component from `ui-kit/src/index.ts` (kit house rule).
- **Re-sync from the master kit** — if you keep evolving the kit in
  `Platform UI Mockups/Waldner UI Kit/New-UIKit 2`, pull its changes in with:

  ```bash
  rsync -a --delete \
    --exclude node_modules --exclude .git --exclude dist \
    "Platform UI Mockups/Waldner UI Kit/New-UIKit 2/" \
    "Platform UI Mockups/Waldner App/ui-kit/"
  cd "Platform UI Mockups/Waldner App/ui-kit" && npm install
  ```

After any kit change, `cd app && npm run build` to confirm the app still typechecks
against the new kit API. If a component's props changed, the pages that use it are
in `app/src/*.tsx` and `app/src/sales/**`.

---

## 4. Refreshing the data from Neo4j

Both exporters read `NEO4J_URI` / `NEO4J_USERNAME` / `NEO4J_PASSWORD` / `NEO4J_DATABASE`
from the repo-root `.env` (`Node42 Backend/.env`). Run from the repo root with the
repo's Python venv:

```bash
cd "Node42 Backend"
.venv/bin/python3 "Platform UI Mockups/Waldner App/scripts/export_sff.py"
.venv/bin/python3 "Platform UI Mockups/Waldner App/scripts/build_sales.py"
```

Then rebuild the app (`cd "Platform UI Mockups/Waldner App/app" && npm run build`).

### `export_sff.py` — Sterile Fill-Finish report data

Reads value network `325412/Sterile Fill-Finish` and writes:

| Output | Contents |
|---|---|
| `app/src/data/valueNetwork.json` | `{ meta, root }` — the 6,616-unit tree (L7→L3) + naics/market/level counts |
| `app/src/data/market.json` | header TAM/SAM tiles, NAICS description, and Waldner's products matched to SFF units (`{name, note, unitIds}`) |
| `app/src/data/odi_default.json` | the highest-opportunity rated unit (bundled default) |
| `app/src/data/odi_index.json` + `app/public/data/odi/index.json` | one row per rated unit (slug, counts, top opp, product_matched) |
| `app/public/data/odi/<slug>.json` | per rated unit: stakeholders + every ODI need row |

**Schema note (important):** the current graph has **no `ODIRating` nodes**. Ulwick
scores live directly on each `ErrorStatement` as `*_v2` properties (needs scoring
v2). The mapping to the UI's `OdiRow` is:

- `imp` ← `importance_v2`, `sat` ← `satisfaction_v2`, `opp` ← `opportunity_v2`,
  `rank` ← `opportunity_rank_v2`
- `imp_band` / `sat_band` are **derived** from the 0–10 score
  (`very low`/`low`/`medium`/`high`/`very high` = `floor(v/2)`), matching the page's own bands.
- `imp_rat` ← `importance_rationale_v2`; `sat_rat` = the `satisfaction_*_rationale_v2`
  sub-rationales (reliability/time/skill/cost) joined into one paragraph.
- `source_job` ← the core/emotional/status job node linked to the statement via
  `(:StakeholderCoreJob|EmotionalJob|StatusJob)-[:has_error]->(es)`.
- `stk` / `role` / `esco_code` ← the `StakeholderRole`.
- **Confidence:** v2 scoring carries **no per-need confidence**. The exporter uses the
  `StakeholderRole.confidence` (0–1, a real modelled value) as the shared
  importance/satisfaction confidence. If you later add per-need confidence, change
  `conf` in `export_sff.py`.

**TAM/SAM** are external market-research estimates (not in the graph), defined in the
`HEADER_STATS` constant at the top of `export_sff.py`. Edit there with a source.

### `build_sales.py` — customer dataset

The authoritative list is the **91 validated Sterile Fill-Finish target accounts** in
Neo4j: `(:Company)-[:in_lead_list]->(:LeadList {customer_name:'Waldner PAS'})`. Each
carries only name / hq_country / dach_site / website / segment / lead_status. The
script enriches every account to the full `Company` shape (`app/src/sales/lib/types.ts`)
by joining, in priority order:

1. `node42-pharma-map/public/companies.json` — already-built full records (employees,
   revenue, industry, description, lat/lon, contacts, logo). **52–55 of 91 match here.**
2. `data/waldner_pas_enriched.csv` — Crustdata+research enrichment CSV (fallback firmographics).
3. `data/waldner_pas_tier1_management*.csv` + `..._person_photos.csv` — real management contacts.
4. **Geocoding** — `node42-pharma-map/scripts/.geocode-cache.json` + live Nominatim
   (OpenStreetMap) for cache misses, results written back to `scripts/.geocode-cache.json`.
   Pins land at the **DACH plant** (country parsed from the `dach_site` text), not the
   corporate HQ — so global groups (AbbVie/Sanofi/MSD) pin at their German/Swiss site.

Outputs `app/src/data/sales/companies.json` (Company[]) and `meta.json` (country +
market filter options derived from the data).

Flags: `--no-geocode` (cache only, skip live Nominatim).

**Enriching gaps further:** accounts not matched in (1)/(2) keep `null` employees/revenue
(the UI falls back to employees-derived bands and empty states). To fill them, query
**CompanyEnrich** (`CompanyEnrich_API` in `.env`) or **Crustdata** (`CRUSTDATA_API`,
see `scripts/crustdata_waldner_pas.py` for a client and
`reference_crustdata_2025_11_api` in memory for the current endpoints) and add the
result into `build_company()`.

---

## 5. How each page maps to the data

| Page (route) | Reads | Wired in |
|---|---|---|
| Product Management (`#/product-management`) | `vnMeta` (first row = live SFF market) | `ProductManagementPage.tsx` |
| Market (`#/market-page`) | `valueNetwork.json` (tree), `market.json` (TAM/SAM, products), `odi_index.json` (rated units) | `hospitalValueNetwork.ts`, `MarketPage.tsx` |
| ODI Matrix (`#/odi-matrix[?unit=slug]`) | `odi_default.json` (default) + `public/data/odi/<slug>.json` (runtime fetch) | `odiNeedsData.ts`, `ODIMatrix.tsx` |
| Sales (`#/sales`) | `sales/companies.json`, `sales/meta.json` | `sales/lib/mockCompanies.ts`, `sales/lib/market-query.ts` |

The data modules (`hospitalValueNetwork.ts`, `odiNeedsData.ts`, `sales/lib/mockCompanies.ts`,
`sales/lib/market-query.ts`) were the scaffold's mock modules; they now just
re-export the JSON under the **same export names**, so no page layout changed. The
historical names (`hospitalVN`, `vnMeta`, `odiNeeds`, `MOCK_COMPANIES`) are kept on
purpose.

**ODI unit browsing:** the Market page's value-network tree marks every rated unit
(20 of them) and its "Needs & Jobs" button deep-links to `#/odi-matrix?unit=<slug>`.
`ODIMatrix.tsx` fetches that unit's JSON from `public/data/odi/`, falling back to the
bundled default. The Market page's inline buying-centre summary always reflects the
default rated unit (as the original single-unit scaffold did).

---

## 6. Publishing to GitHub Pages

1. Make `Waldner App/` its own git repo (or a subtree) and push to GitHub.
2. Settings → Pages → Build and deployment → **GitHub Actions**.
3. The included workflow `.github/workflows/pages.yml` installs `ui-kit` + `app`,
   runs `npm run build`, and publishes `app/dist`. It triggers on push to `main`.

Because the app uses a relative base + HashRouter, it works at
`https://<user>.github.io/<repo>/` with no further config.

---

## 7. CSS gotchas (do not remove these imports)

Two CSS imports are load-bearing and easy to lose in a refactor:

- **`app/src/main.tsx`** imports `../../ui-kit/src/styles/tokens.css` and
  `globals.css` **directly**. When the kit is aliased to its source, Vite's
  production build tree-shakes the CSS side-effect imports out of the kit's barrel
  (`ui-kit/src/index.ts`), so the built app has **no design-token definitions** and
  renders completely unstyled (dev works fine — this only bites the build). Keep
  these imports. Sanity check after a build: `grep -c ':root' app/dist/assets/index-*.css`
  must be ≥ 1, and `grep -o -- '--space-400:16px' app/dist/assets/index-*.css` must hit.
- **`app/src/sales/SalesPage.tsx`** imports `leaflet/dist/leaflet.css` +
  `leaflet.markercluster/dist/MarkerCluster*.css`. Without them the map tiles and
  cluster icons render unpositioned. (The original pharma-map loaded these globally.)

After changing CSS, hard-reload the browser — Vite preview serves a hashed
`index.html`, and a stale cached one points at the old CSS bundle.

## 8. Known gaps / notes

- **Luye Pharma AG** has an empty `dach_site` in the graph, so it has no map pin
  (its card still lists in the customer list). Add a site to the graph or to
  `build_sales.py` to place it.
- **Contacts** exist for ~22 of 91 accounts (the tier-1 management CSVs). Others show
  an empty contacts state until enriched (see §4).
- **TAM/SAM** are documented external estimates, not graph values (§4).
- The main JS bundle is large (~1.9 MB) because `valueNetwork.json` (6,616 nodes) and
  the default ODI unit are bundled. It still loads fine; if you want it smaller, move
  `valueNetwork.json` to `public/` and fetch it (the Market page would need an async
  load state).
- `unspsc` on value-network nodes is optional and currently omitted (the graph stores
  UNSPSC as separate nodes, not unit props).
```
