# Waldner App

Waldner PAS **Sterile Fill-Finish** engagement app — value network, Ulwick ODI needs
matrix, Waldner's matched products, and the DACH **sales customer map** — built on the
`@node42/ui-kit` design system, with all data exported from Neo4j into JSON.

```bash
cd ui-kit && npm install
cd ../app && npm install && npm run dev     # http://localhost:5173
```

- **`app/`** — the Vite + React app (routes: Product Management, Market, ODI Matrix, Sales).
- **`ui-kit/`** — vendored `@node42/ui-kit` (the app live-links its source).
- **`scripts/`** — Neo4j → JSON exporters (`export_sff.py`, `build_sales.py`).
- **`.github/workflows/pages.yml`** — builds and publishes to GitHub Pages.

Full build, data-refresh, kit-update and publishing instructions are in
**[MANUAL.md](./MANUAL.md)**.
