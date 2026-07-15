// ODI Needs dataset — Ulwick ODI (Importance × Satisfaction → Opportunity),
// needs scoring v2. Exported live from Neo4j by `scripts/export_sff.py`.
//
// `odiNeeds` here is the DEFAULT rated unit (the highest-opportunity Sterile
// Fill-Finish unit), bundled from `src/data/odi_default.json` for the pages that
// read it synchronously (the Market page's buying-centre summary, and the ODI
// Matrix's initial render). The ODI Matrix additionally loads any other rated
// unit at runtime from `public/data/odi/<slug>.json` (see ODIMatrix.tsx).
//
// To refresh: run `python scripts/export_sff.py` (see MANUAL.md).
import defaultOdi from './data/odi_default.json'

export interface OdiStakeholder {
  role: string
  role_label: string
  title: string
  esco_code: string
  n: number
}

export interface OdiRow {
  stk: string
  role: string
  role_label: string
  esco_code: string
  job_type: string
  source_job: string
  stmt: string
  imp: number
  imp_band: string
  imp_rat: string
  imp_conf: number | null
  imp_conf_b: string
  sat: number
  sat_band: string
  sat_rat: string
  // Confidence is null for product-job needs (they carry no per-need confidence).
  sat_conf: number | null
  sat_conf_b: string
  opp: number
  rank: number
  // Plain-language rewrite of the need statement (gpt-5.6-luna), on the top/bottom
  // opportunity needs. Empty for needs without a plain-language version.
  plain?: string
  plain_band?: string
  // Set on product-job rows (job_type='product'): the product life-cycle stage
  // (Acquisition · Preparation · Usage · Maintenance · Disposal).
  lifecycle?: string
}

export interface OdiData {
  unit: { name: string; level: string; cfj: string | null }
  meta: { method: string; model: string; effort: string; stakeholders: number; ratings: number; issues: number; cost_usd: number | null; generated_from: string }
  totals: { stakeholders: number; jobs: number; needs: number }
  naics: string
  market_label: string
  stakeholders: OdiStakeholder[]
  rows: OdiRow[]
  slug?: string
}

export const odiNeeds = defaultOdi as unknown as OdiData
