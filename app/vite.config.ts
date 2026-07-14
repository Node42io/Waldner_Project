import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Live link to the @node42/ui-kit (vendored under ../ui-kit): the app compiles
// the kit's TS/CSS directly, so edits to the kit hot-reload here with no build.
export default defineConfig({
  // Relative asset base so the built app works from any GitHub Pages sub-path
  // (project site) without knowing the repo name. Paired with a HashRouter in
  // main.tsx so client-side routes resolve on Pages with no server rewrites.
  base: './',
  // tailwindcss() powers the Sales page (src/sales/*), ported from the
  // node42-pharma-map app whose components are styled with Tailwind utilities.
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@node42/ui-kit': path.resolve(__dirname, '../ui-kit/src/index.ts'),
      // The ported Sales code uses "@/..." absolute imports; map them to the
      // self-contained src/sales tree so those files stay untouched.
      '@': path.resolve(__dirname, 'src/sales'),
    },
    // One copy of React across app + kit source (avoids "Invalid hook call").
    dedupe: ['react', 'react-dom'],
  },
  server: {
    // Allow Vite to read the sibling kit folder outside this app root.
    fs: { allow: ['..'] },
  },
})
