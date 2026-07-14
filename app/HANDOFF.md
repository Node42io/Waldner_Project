# ODI / Waldner — Developer Handoff

This app (`odi-waldner`, Vite + React 18 + TypeScript) is a set of **structural, review-ready pages**. The layout, components and interactions are done; **the data is mock / placeholder**. Your job is to swap the mock data sources listed under **[Data to fill in](#data-to-fill-in)** for real data — without touching the page layouts.

---

## 1. What you receive (deliver as TWO sibling folders)

```
NODE42 DEV/            ← keep this parent; the two folders MUST stay siblings
├── Waldner/           ← this app (odi-waldner)
└── New-UIKit/         ← the design-system kit (@node42/ui-kit)
```

**Why both:** the app does NOT bundle the kit. It live-links to the kit's *source* via a Vite alias (`vite.config.ts`):

```ts
'@node42/ui-kit': path.resolve(__dirname, '../New-UIKit/src/index.ts')
'@'            : path.resolve(__dirname, 'src/sales')   // ported pharma-map code
```

So if `New-UIKit` isn't a sibling of `Waldner`, the app won't compile. Edits to the kit hot-reload into the app.

---

## 2. Run it

- Node 20+ recommended.
- Install in **both** folders:
  ```bash
  cd New-UIKit && npm install
  cd ../Waldner && npm install     # needs `sass` (already in devDeps) to compile the kit's styles
  npm run dev                      # http://localhost:5173
  ```
- Scripts (Waldner): `dev`, `build` (`tsc -b && vite build`), `lint`, `preview`.
- The kit has its own Storybook (`cd New-UIKit && npm run storybook`) if you want to browse components.

> The repo is **not under git yet** — run `git init` + commit in both folders before starting so you have history/branches.

---

## 3. Pages (routes)

| Route | Page file | What it shows |
|---|---|---|
| `/product-management` | `src/ProductManagementPage.tsx` | NAICS market picker (entry point) |
| `/market-page` | `src/MarketPage.tsx` | Market header (TAM/SAM) + Value Network tree + Your Products |
| `/odi-matrix` (default `/`) | `src/ODIMatrix.tsx` | ODI Needs table (Importance × Satisfaction → Opportunity) |
| `/odi-viz` | `src/ODIViz.tsx` | ODI visualisation playground |
| `/sales` | `src/sales/SalesPage.tsx` | Customer map + list (ported from node42-pharma-map) |

**Architecture:** pages live in the app and are thin **compositions of kit components** (`PageTemplate`, `WidgetCard`, `NaicsRow`, `Dropdown`, `Table`, …). Pages own the data, routing and app context; the kit owns the presentational components. **Fill data in the app pages / data files below — do not move page logic into the kit.**

---

## 4. Data to fill in

Every field currently comes from one of these files. Replace the mock module with a real fetch/parse that returns the **same shape**, and the UI keeps working.

### Sales (`/sales`)
| File | Export | Contains (mock) | Replace with |
|---|---|---|---|
| `src/sales/lib/mockCompanies.ts` | `SPECS` (29) → `MOCK_COMPANIES` | Invented oncology-pharma companies across Europe (`MOCK_COMPANIES = SPECS.map(build)`) | Real companies — replace the `SPECS` array; `build()` fills defaults into the `Company` shape (below) |
| `src/sales/lib/types.ts` | `Company` type | The row/card/drawer contract | — (this is the schema to match) |
| `src/sales/lib/market-query.ts` | `COUNTRY_OPTIONS`, `MARKET_OPTIONS`, `COUNTRY_NAMES` | Country/market dropdown options + ISO3→name map | Real option lists; extend `COUNTRY_NAMES` for any new ISO3 codes |
| `src/sales/lib/naics.ts` | `NAICS_GROUPS` | The market buckets in the Customer List picker | Real markets |

**`Company` shape** (`types.ts`): `{ id, name, country /* ISO3 */, city, employees|null, revLowerUsd|null, revHigherUsd|null, buckets[], industry, description, url, oncologyTags[], status /* PROSPECT|LEAD|ACTIVE */, lat|null, lon|null, locations[], contacts? }`. `lat/lon` drive the map pins; `revLowerUsd/revHigherUsd` drive the revenue band (falls back to an employees-derived band when null).

### Product Management (`/product-management`)
| File | Export | Contains (mock) | Replace with |
|---|---|---|---|
| `src/ProductManagementPage.tsx` | `NAICS_LIST` | 9 NAICS industries; **1st is live** (mirrors `vnMeta`), rest are **locked** placeholders | Real markets in scope |

### Market page (`/market-page`)
| File | Export / location | Contains (mock) | Replace with |
|---|---|---|---|
| `src/MarketPage.tsx` | `headerStats` | **TAM `$1.5T` / SAM `$412B`** hardcoded estimates | Real market-size figures |
| `src/MarketPage.tsx` | `COMPANY_PRODUCTS` | Fabricated product portfolio `{name, note, unitIds}` (units reference real VN node ids) | Real "Your Products" list |
| `src/hospitalValueNetwork.ts` | `hospitalVN`, `vnMeta` | The **real** hospital value-network tree (680 units) + meta (naics `622110`, market, root, levels) | Real; other markets need their own VN tree |
| `src/MarketPage.tsx` | UNSPSC classifications | Only the **imaging cluster** is seeded — known gap | Full UNSPSC per node |

### ODI (`/odi-matrix`, `/odi-viz`)
| File | Export | Contains (mock) | Replace with |
|---|---|---|---|
| `src/odiNeedsData.ts` | `odiNeeds` | ODI needs for the MRI System (importance/satisfaction/opportunity + rationale) | Real per-product ODI data |

### Shared copy / reference
| File | Contains |
|---|---|
| `src/glossaryData.ts` | Glossary terms |
| `src/copy.ts` | `UPSELL_COPY` and similar UI strings |
| `src/lifecycle.ts`, `src/sections.ts` | Product-lifecycle stages / section slugs (mostly stable) |

---

## 5. Rules of the road

- **Match the shape, not the layout.** Each data file has a TypeScript type — return the same type and the page renders unchanged. `tsc -b` will catch mismatches.
- **Don't edit `New-UIKit`** to fill data — it's the presentational kit and must stay app-agnostic. All data lives in `Waldner/src`.
- **Keep the two folders siblings** (or, later, publish `@node42/ui-kit` to a registry and switch the Vite alias to the installed package).
- Mock data is deliberately "structure, not truth" — nothing here is a real company/figure.

---

_Questions on a specific field's meaning or source → ask; each mock file has header comments explaining intent._
