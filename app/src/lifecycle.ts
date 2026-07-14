// Product life-cycle stages and the job → stage mapping, shared by the Market
// Page (Product Life Cycle tab) and the ODI Matrix (Product Life Cycle column).
// The ODI export carries no lifecycle tag, so the stage is assigned here per job.
import { odiNeeds } from './odiNeedsData'

export type LifecycleStage = 'acquisition' | 'preparation' | 'usage' | 'maintenance' | 'disposal'

export const STAGE_LABEL: Record<LifecycleStage, string> = {
  acquisition: 'Acquisition',
  preparation: 'Preparation',
  usage: 'Usage',
  maintenance: 'Maintenance',
  disposal: 'Disposal',
}

const STAGE_JOBS_SEED: Record<LifecycleStage, string[]> = {
  acquisition: [
    'Verify Return Realization', 'The Shrewd Steward of Capital', 'Substantiate recommendation',
    'Solicit Competitive Bids', 'Optimize Capital Allocation', 'Minimize Total Cost of Ownership',
    'Justify the Financial Case', 'Justify Capital Investment', 'Disciplined Steward of Capital',
    'Define Technical Criteria', 'Define Procurement Requirements',
    'feel reassured the payback is landing', 'feel reassured the fit is sound',
    'feel in control of the negotiation', 'feel confident the deal holds up',
    'feel confident in the specification', 'feel confident in the allocation call',
  ],
  preparation: [
    'Translate Symptoms to Questions', 'Safeguard Patient Suitability', 'Position Patient Accurately',
    'Determine Imaging Need', 'Verify Patient Safety Screening', 'Uncompromising Guardian of MRI Safety',
    'Prevent Projectile Incidents', 'Adjudicate Implant Safety',
    'feel reassured the patient is safe', 'feel confident in the referral',
  ],
  usage: [
    'Trusted Imaging Performance Authority', 'Resolve Ambiguous Findings', 'Maintain Referral Confidence',
    'Execute Imaging Sequences', 'Ensure Image Quality', 'Administer Contrast Agents',
    'Adapt to Patient Constraints', 'Optimize Exam Throughput', 'The Definitive Diagnostician',
    'Differentiate ambiguous tissue', 'Detect tissue abnormalities', 'Definitive Diagnostic Authority',
    'Confirm image adequacy', 'feel reassured the answer will come back',
    'feel confident throughput will hold', 'feel confident the scan is diagnostic',
    'feel reassured nothing was missed', 'feel confident in the read',
  ],
  maintenance: [
    'Verify performance conformance', 'Trusted Infrastructure Steward', 'Sustain Workforce Capability',
    'Sustain System Uptime', 'Ensure Imaging Reliability', 'Diagnose image degradation',
    'Demonstrate Department Performance', 'Ensure Staff Competency', 'The Dependable Imaging Steward',
    'feel reassured performance holds', 'feel reassured metrics stand up', 'feel confident uptime holds',
  ],
  disposal: [],
}

// job → stage. Jobs absent from the seed have no stage (treated as N/A where the
// caller needs a hard answer, e.g. the ODI table column).
export const JOB_STAGE: Record<string, LifecycleStage> = (() => {
  const m: Record<string, LifecycleStage> = {}
  for (const [stage, jobs] of Object.entries(STAGE_JOBS_SEED)) {
    for (const j of jobs) m[j] = stage as LifecycleStage
  }
  return m
})()

// Distinct jobs bucketed by stage for the Product Life Cycle view — jobs missing
// from the seed fall back to Usage so nothing is silently dropped.
export const jobsByStage: Record<LifecycleStage, string[]> = (() => {
  const out: Record<LifecycleStage, string[]> = { acquisition: [], preparation: [], usage: [], maintenance: [], disposal: [] }
  const seen = new Set<string>()
  for (const r of odiNeeds.rows) {
    if (seen.has(r.source_job)) continue
    seen.add(r.source_job)
    out[JOB_STAGE[r.source_job] ?? 'usage'].push(r.source_job)
  }
  return out
})()
