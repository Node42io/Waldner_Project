import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
// Design tokens + globals from the UI kit. These MUST be imported directly here
// in the app entry: when the kit is aliased to its source, Vite's production
// build tree-shakes the CSS side-effect imports out of the kit's barrel
// (index.ts), leaving the app with no :root token definitions (everything renders
// unstyled). Importing them explicitly keeps them in the bundle. Dev is unaffected.
import '../../ui-kit/src/styles/tokens.css'
import '../../ui-kit/src/styles/globals.css'
import './index.css'
import { lazy, Suspense } from 'react'
import ODIMatrix from './ODIMatrix.tsx'
import MarketPage from './MarketPage.tsx'
import ProductManagementPage from './ProductManagementPage.tsx'
import WaldnerVsBrinox from './WaldnerVsBrinox.tsx'
import { GlossaryProvider } from './Glossary.tsx'

// Lazy-loaded so the Sales page's extra weight (Leaflet, Tailwind utilities,
// the ported pharma-map component tree) only loads when /sales is visited and
// never touches the two report pages.
const SalesPage = lazy(() => import('./sales/SalesPage.tsx'))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <HashRouter>
      <GlossaryProvider>
        <Routes>
          <Route path="/" element={<Navigate to="/odi-matrix" replace />} />
          <Route path="/odi-matrix" element={<ODIMatrix />} />
          <Route path="/product-management" element={<ProductManagementPage />} />
          <Route path="/market-page" element={<MarketPage />} />
          <Route path="/waldner-vs-brinox" element={<WaldnerVsBrinox />} />
          <Route
            path="/sales"
            element={
              <Suspense fallback={<div style={{ padding: 'var(--space-600)' }}>Loading…</div>}>
                <SalesPage />
              </Suspense>
            }
          />
        </Routes>
      </GlossaryProvider>
    </HashRouter>
  </StrictMode>,
)
