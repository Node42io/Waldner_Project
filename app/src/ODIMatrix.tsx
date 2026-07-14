import { Fragment, useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Briefcase, CaretDown, DownloadSimple, Eye, ListChecks, Megaphone, Rows, ShoppingCart, SquaresFour, Target, Users, Wrench } from '@phosphor-icons/react'
import {
  BackButton,
  Badge,
  Breadcrumb,
  Button,
  Checkbox,
  ConfidenceBadge,
  Dropdown,
  FieldLabel,
  PageTemplate,
  SearchBar,
  StatBreakdown,
  Table,
  Text,
  Toggle,
  WidgetCard,
  OpportunityMatrix,
} from '@node42/ui-kit'
import type { BadgeVariant } from '@node42/ui-kit'
import { odiNeeds } from './odiNeedsData'
import type { OdiRow, OdiData } from './odiNeedsData'
import { JOB_STAGE, STAGE_LABEL } from './lifecycle'
import { ReportActions } from './ReportActions'
import { ReportSidebar } from './ReportSidebar'

// ODI Matrix — ODI Needs table (Ulwick Importance × Satisfaction → Opportunity).
// Rebuilt from the standalone mri_odi_needs export, reorganised onto the
// @node42/ui-kit PageTemplate chrome and its components + tokens.

const mono: CSSProperties = { fontFamily: 'var(--font-family-mono)', fontWeight: 'var(--font-weight-medium)' }

// Ulwick opportunity bands and innovation-status gap thresholds — the single
// source of truth for the scoring cut-offs used across this page.
const OPP_HIGH = 12 // opportunity ≥ this → high (error)
const OPP_MODERATE = 10 // opportunity ≥ this → moderate (warning)
const GAP_UNDERSERVED = 3 // importance − satisfaction ≥ this → underserved
const GAP_OVERSERVED = -1 // importance − satisfaction ≤ this → overserved

function impVariant(band: string): BadgeVariant {
  return band === 'very high' || band === 'high' ? 'success' : 'neutral'
}
// Opportunity band → Badge colour + word (Ulwick opportunity algorithm).
function oppVariant(opp: number): BadgeVariant {
  if (opp >= OPP_HIGH) return 'error'
  if (opp >= OPP_MODERATE) return 'warning'
  return 'neutral'
}
function oppWord(opp: number): string {
  if (opp >= OPP_HIGH) return 'high'
  if (opp >= OPP_MODERATE) return 'moderate'
  return 'low'
}
function satVariant(band: string): BadgeVariant {
  if (band === 'low' || band === 'very low') return 'error'
  if (band === 'medium') return 'warning'
  return 'success'
}

const meanConf = (r: OdiRow) => Math.round((r.imp_conf + r.sat_conf) / 2)

// ODI innovation status from the importance vs. satisfaction gap: underserved
// (importance outruns satisfaction), overserved (the reverse), or served.
// `order` drives the column sort (most actionable first).
function statusOf(r: OdiRow): { label: string; variant: BadgeVariant; order: number; note: string } {
  // Product jobs aren't rated on the ODI importance/satisfaction gap — they map to
  // a lifecycle status instead of underserved/served/overserved.
  if (r.job_type === 'product') return { label: 'Lifecycle', variant: 'neutral', order: 0, note: 'A product job — tracked on the product lifecycle rather than the ODI importance − satisfaction gap.' }
  const gap = r.imp - r.sat
  if (gap >= GAP_UNDERSERVED) return { label: 'Underserved', variant: 'error', order: 3, note: 'Importance clearly exceeds satisfaction — a real innovation opportunity.' }
  if (gap <= GAP_OVERSERVED) return { label: 'Overserved', variant: 'information', order: 1, note: 'Satisfaction exceeds importance — likely more invested here than needed.' }
  return { label: 'Served', variant: 'success', order: 2, note: 'Satisfaction is roughly in line with importance — adequately met.' }
}

// CSV export of the needs table — same download behaviour as the Sales page's CSV
// button (build a blob, click a temp <a>). Columns mirror the visible table.
const CSV_COLS: { header: string; get: (r: OdiRow) => string | number }[] = [
  { header: 'Opportunity', get: (r) => r.opp.toFixed(1) },
  { header: 'Opportunity band', get: (r) => oppWord(r.opp) },
  { header: 'Stakeholder', get: (r) => r.stk },
  { header: 'Role', get: (r) => r.role_label },
  { header: 'Job', get: (r) => r.source_job },
  { header: 'Job type', get: (r) => r.job_type },
  { header: 'Need', get: (r) => r.stmt },
  { header: 'Need (plain language)', get: (r) => r.plain ?? '' },
  { header: 'Status', get: (r) => statusOf(r).label },
  { header: 'Importance', get: (r) => r.imp.toFixed(1) },
  { header: 'Importance band', get: (r) => r.imp_band },
  { header: 'Satisfaction', get: (r) => r.sat.toFixed(1) },
  { header: 'Satisfaction band', get: (r) => r.sat_band },
  { header: 'Confidence', get: (r) => meanConf(r) },
]
function downloadNeedsCsv(rows: OdiRow[], filename = 'odi-needs.csv') {
  const esc = (v: string | number) => { const s = String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const header = CSV_COLS.map((c) => c.header).join(',')
  const lines = rows.map((r) => CSV_COLS.map((c) => esc(c.get(r))).join(','))
  const blob = new Blob([header + '\n' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  setTimeout(() => { URL.revokeObjectURL(url); a.remove() }, 0)
}

// ---- sortable columns (the leftmost data column is Opportunity; a caret column
// sits to its left as the expand affordance) ----
type SortKey = 'opp' | 'imp' | 'sat' | 'status' | 'conf' | 'source_job' | 'stk' | 'stmt' | 'job_type'
const TEXT_KEYS: SortKey[] = ['source_job', 'stk', 'stmt']

// `sortable: false` drops the column's sort caret (Stakeholder / Job / Need are
// descriptive, not ranked — they carry an info tooltip instead).
const columns: { key: SortKey; label: string; align?: 'left' | 'right'; info?: string; sortable?: boolean }[] = [
  { key: 'opp', label: 'Opp.', info: 'Opportunity = importance + max(importance − satisfaction, 0). Higher = more underserved and more actionable.' },
  { key: 'stk', label: 'Stakeholder', sortable: false, info: 'The stakeholder role that holds this need — job executor, overseer, purchase influencer or executor.' },
  { key: 'source_job', label: 'Job', sortable: false, info: 'The core functional job this desired outcome was derived from.' },
  { key: 'stmt', label: 'Need (desired outcome)', sortable: false, info: 'The desired outcome phrased as a measurable need (Ulwick outcome statement).' },
  { key: 'job_type', label: 'Job type', sortable: false, info: "The job's ODI type — core · emotional · status. Product jobs instead show “Product job” with their product life-cycle stage (Acquisition → Preparation → Usage → Maintenance → Disposal)." },
  { key: 'status', label: 'Status', info: 'ODI status from the importance − satisfaction gap: underserved · served · overserved. Product jobs show lifecycle instead.' },
  { key: 'imp', label: 'Imp.', info: 'Importance — how important this desired outcome is to the stakeholder, rated 0–10 (Ulwick importance).' },
  { key: 'sat', label: 'Sat.', info: 'Satisfaction — how well the outcome is met today, rated 0–10 (Ulwick satisfaction).' },
  { key: 'conf', label: 'Conf.', info: 'Confidence — mean of the importance and satisfaction confidences, calibrated to the Sherman-Kent scale.' },
]

const ROLE_ORDER = ['job_executor', 'job_overseer', 'job_influencer', 'purchase_influencer', 'purchase_executor']

// Expanded-row rationale panel — Option A: two rationale cards side by side
// (Importance / Satisfaction), each showing value · band · confidence + its
// rationale text. The Opportunity / Status summary strip is intentionally
// omitted for now.
function MetricCard({ label, value, band, variant, conf, rat }: { label: string; value: number; band: string; variant: BadgeVariant; conf: number; rat: string }) {
  const caption = <FieldLabel>{label}</FieldLabel>
  return (
    <div style={{ borderRadius: 'var(--radius-sm)', padding: 'var(--space-400)', background: 'var(--surface-default-default)', display: 'flex', flexDirection: 'column', gap: 'var(--space-300)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-200)', flexWrap: 'wrap' }}>
        {caption}
        <span style={{ ...mono, fontSize: 'var(--font-size-b1)', color: 'var(--text-headings)' }}>{value.toFixed(1)}</span>
        <Badge variant={variant} size="xs">{band}</Badge>
        <div style={{ marginLeft: 'auto' }}>
          {/* Neutral (uncoloured) confidence: same shape as ConfidenceBadge but
              no level colour — keeps the row cards from carrying too many hues. */}
          <Badge variant="neutral" size="xs" icon={<Target weight="regular" aria-hidden />}>{conf}%</Badge>
        </div>
      </div>
      <Text variant="b2" style={{ color: 'var(--text-body)' }}>{rat}</Text>
    </div>
  )
}

function RationalePanel({ r }: { r: OdiRow }) {
  return (
    <div style={{ padding: 'var(--space-500)', background: 'var(--surface-default-default-2)', borderTop: '1px solid var(--border-card)', display: 'flex', flexDirection: 'column', gap: 'var(--space-400)' }}>
      {r.plain ? (
        <div style={{ padding: 'var(--space-300) var(--space-400)', background: 'var(--surface-default-default)', border: '1px solid var(--border-card)', borderRadius: 'var(--radius-200)' }}>
          <Text variant="b3" weight="medium" as="p" style={{ margin: '0 0 var(--space-100)', color: 'var(--text-subtle)' }}>In plain language</Text>
          <Text variant="b2" as="p" style={{ margin: 0, color: 'var(--text-body)' }}>{r.plain}</Text>
        </div>
      ) : null}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-400)' }}>
        <MetricCard label="Importance" value={r.imp} band={r.imp_band} variant={impVariant(r.imp_band)} conf={r.imp_conf} rat={r.imp_rat} />
        <MetricCard label="Satisfaction" value={r.sat} band={r.sat_band} variant={satVariant(r.sat_band)} conf={r.sat_conf} rat={r.sat_rat} />
      </div>
    </div>
  )
}

// Table / Graph view switch.
function ViewToggle({ value, onChange }: { value: 'table' | 'graph'; onChange: (v: 'table' | 'graph') => void }) {
  return (
    <Toggle
      aria-label="View mode"
      value={value}
      onChange={(v) => onChange(v as 'table' | 'graph')}
      options={[
        { value: 'table', icon: <Rows size={16} weight="regular" />, label: 'Table' },
        { value: 'graph', icon: <SquaresFour size={16} weight="regular" />, label: 'Graph' },
      ]}
    />
  )
}


// The ODI Needs body — summary cards + the search/filter/table "Needs" card.
// Extracted from the page so the exact same needs table can be reused inside the
// sales Value Network modal (opened from a node's Needs button). Self-contained:
// all filter/sort/expand state lives here; the page wrapper only adds chrome.
export function ODIMatrixView({ initialStk, data = odiNeeds }: { initialStk?: string[]; data?: OdiData } = {}) {
  // Pre-filter by stakeholder. `initialStk` (passed when the table is embedded,
  // e.g. inside the Value Network modal) wins; otherwise a ?stk=<title> query
  // param (repeatable) is used to deep-link into a stakeholder's needs.
  const [searchParams] = useSearchParams()
  const [stk, setStk] = useState<string[]>(() => initialStk ?? searchParams.getAll('stk'))
  const [job, setJob] = useState<string[]>([])
  const toggleIn = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const toggleStk = (v: string) => setStk((p) => toggleIn(p, v))
  const toggleJob = (v: string) => setJob((p) => toggleIn(p, v))
  const [query, setQuery] = useState<string>('')
  const [view, setView] = useState<'table' | 'graph'>(() => (searchParams.get('view') === 'graph' ? 'graph' : 'table'))
  // Importance × satisfaction rectangle deep-link (from the ODI viz playground):
  // ?impMin&impMax&satMin&satMax filter the table to a concentration region.
  const [range, setRange] = useState<{ impMin: number; impMax: number; satMin: number; satMax: number } | null>(() => {
    const n = (k: string): number | null => { const v = searchParams.get(k); const x = v == null ? NaN : Number(v); return Number.isFinite(x) ? x : null }
    const impMin = n('impMin'), impMax = n('impMax'), satMin = n('satMin'), satMax = n('satMax')
    return impMin != null && impMax != null && satMin != null && satMax != null ? { impMin, impMax, satMin, satMax } : null
  })
  const bandName = (v: number) => ['very low', 'low', 'medium', 'high', 'very high'][Math.min(4, Math.floor(v / 2))]
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'imp', dir: -1 })
  const [open, setOpen] = useState<Set<number>>(new Set())
  const [expandAll, setExpandAll] = useState(false)
  // When on, the Need column/graph shows the plain-language rewrite where one
  // exists (top/bottom-opportunity needs), falling back to the technical
  // statement. The expanded row always shows both regardless of this toggle.
  const [showPlain, setShowPlain] = useState(false)
  const hasPlain = useMemo(() => data.rows.some((r) => r.plain), [data])
  const needText = (r: OdiRow) => (showPlain && r.plain ? r.plain : r.stmt)

  // Stable id per need (index in the source array), for expand state.
  const rowId = useMemo(() => new Map(data.rows.map((r, i) => [r, i] as const)), [data])
  const toggleRow = (id: number) =>
    setOpen((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const orderedStakeholders = useMemo(
    () => ROLE_ORDER.flatMap((role) => data.stakeholders.filter((s) => s.role === role)),
    [data],
  )

  // Unique jobs for the Job filter dropdown.
  const jobOptions = useMemo(
    () => Array.from(new Set(data.rows.map((r) => r.source_job))).sort((a, b) => a.localeCompare(b)),
    [data],
  )

  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return data.rows.filter(
      (r) =>
        (stk.length === 0 || stk.includes(r.stk)) &&
        (job.length === 0 || job.includes(r.source_job)) &&
        (range == null || (r.imp >= range.impMin && (r.imp < range.impMax || range.impMax === 10) && r.sat >= range.satMin && (r.sat < range.satMax || range.satMax === 10))) &&
        (q === '' || r.stmt.toLowerCase().includes(q) || (r.plain ?? '').toLowerCase().includes(q) || r.source_job.toLowerCase().includes(q) || r.stk.toLowerCase().includes(q)),
    )
  }, [data, stk, job, query, range])

  // Points for the kit OpportunityMatrix: each row plotted at x = importance,
  // y = satisfaction (its other ODI fields ride along for the tooltip/table).
  const graphPoints = useMemo(() => list.map((r) => ({ ...r, x: r.imp, y: r.sat })), [list])

  // Summary counts for the widget cards (over the full dataset).
  const stats = useMemo(() => {
    const status: Record<string, number> = { Underserved: 0, Served: 0, Overserved: 0, Lifecycle: 0 }
    for (const r of data.rows) status[statusOf(r).label]++
    const roles: Record<string, number> = {}
    for (const s of data.stakeholders) roles[s.role_label] = (roles[s.role_label] || 0) + 1
    const jobType = new Map<string, string>()
    for (const r of data.rows) if (!jobType.has(r.source_job)) jobType.set(r.source_job, r.job_type)
    const jobTypes: Record<string, number> = {}
    for (const t of jobType.values()) jobTypes[t] = (jobTypes[t] || 0) + 1
    return { status, roles, jobTypes, jobCount: jobType.size }
  }, [data])

  const rows = useMemo(() => {
    const val = (r: OdiRow): number | string => {
      if (sort.key === 'conf') return meanConf(r)
      if (sort.key === 'status') return statusOf(r).order
      return (r as unknown as Record<SortKey, number | string>)[sort.key]
    }
    return [...list].sort((a, b) => {
      const av = val(a)
      const bv = val(b)
      if (typeof av === 'string' && typeof bv === 'string') return sort.dir * av.localeCompare(bv)
      return sort.dir * ((Number(av) || 0) - (Number(bv) || 0))
    })
  }, [list, sort])

  const onSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key
        ? { key, dir: (s.dir * -1) as 1 | -1 }
        : { key, dir: TEXT_KEYS.includes(key) ? 1 : -1 },
    )

  // Sticky header: keep the header row fixed while the body scrolls.
  const headerSticky: CSSProperties = { position: 'sticky', top: 0, zIndex: 2, background: 'var(--surface-default-default-3)' }

  // Filter chip: darker neutral surface so the grey badge stands out against
  // the card (the default neutral tone is too faint here).
  const chipStyle: CSSProperties = { background: 'var(--surface-default-default-3)', color: 'var(--text-headings)' }

  // Labelled toolbar control: a small uppercase caption over the control.
  const field = (label: string, control: ReactNode) => (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-50)' }}>
      <FieldLabel>{label}</FieldLabel>
      {control}
    </label>
  )

  // Vertical value cell: band badge on top, number below — so the badges line
  // up horizontally across the Opportunity/Importance/Satisfaction columns.
  const stackCell = (value: string, badge: ReactNode) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-200)' }}>
      {badge}
      <span style={{ ...mono, fontSize: 'var(--font-size-b1)', color: 'var(--text-headings)' }}>{value}</span>
    </div>
  )


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-400)', marginTop: 'var(--space-500)' }}>
        {/* Summary widget cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 'var(--space-300)' }}>
          <WidgetCard span={4} title="Stakeholders" icon={<Users size={18} weight="regular" />}>
            <StatBreakdown
              value={data.totals.stakeholders}
              items={[
                { label: 'Job executor', icon: <Wrench size={14} weight="regular" /> },
                { label: 'Job overseer', icon: <Eye size={14} weight="regular" /> },
                { label: 'Purchase influencer', icon: <Megaphone size={14} weight="regular" /> },
                { label: 'Purchase executor', icon: <ShoppingCart size={14} weight="regular" /> },
              ].map(({ label, icon }) => ({
                label,
                icon,
                count: stats.roles[label] ?? 0,
              }))}
            />
          </WidgetCard>

          <WidgetCard span={4} title="Jobs" icon={<Briefcase size={18} weight="regular" />}>
            <StatBreakdown
              value={stats.jobCount}
              // Same order + set as the value-network stakeholder card (core,
              // product, emotional, status). Product jobs have no ODI rows yet, so
              // the count stays 0 until they're populated.
              items={['core', 'product', 'emotional', 'status'].map((label) => ({
                label,
                count: stats.jobTypes[label] ?? 0,
              }))}
            />
          </WidgetCard>

          <WidgetCard span={4} title="Needs found" icon={<ListChecks size={18} weight="regular" />}>
            <StatBreakdown
              value={data.totals.needs}
              items={[
                { label: 'Underserved', count: stats.status.Underserved, color: 'var(--danger-400)' },
                { label: 'Served', count: stats.status.Served, color: 'var(--success-400)' },
                { label: 'Overserved', count: stats.status.Overserved, color: 'var(--info-400)' },
              ]}
            />
          </WidgetCard>
        </div>

        {/* Search, filters and the table all live inside one "Needs" card */}
        <WidgetCard title="Needs" style={{ position: 'relative' }}>
        {/* View switch — pinned top-right, level with the card title (Graph is a platform upsell) */}
        <div style={{ position: 'absolute', top: 'var(--space-300)', right: 'var(--space-300)', height: 'var(--line-height-b1)', display: 'flex', alignItems: 'center', zIndex: 5 }}>
          <ViewToggle value={view} onChange={setView} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-400)' }}>
        {/* Search + filters (left, each with a label) · view controls (right) */}
        <div style={{ display: 'flex', gap: 'var(--space-400)', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 'var(--space-300)', alignItems: 'flex-end', flexWrap: 'wrap' }}>
            {field('Search need', (
              <SearchBar
                size="sm"
                className="odi-searchbar"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onClear={() => setQuery('')}
                placeholder="Search needs…"
                aria-label="Search needs"
              />
            ))}
            {field('Stakeholder', (
              <Dropdown
                size="sm"
                multiple
                ariaLabel="Filter by stakeholder"
                placeholder="All stakeholders"
                values={stk}
                onToggle={toggleStk}
                options={orderedStakeholders.map((s) => ({ value: s.title, label: `${s.role_label} · ${s.title} (${s.n})` }))}
              />
            ))}
            {field('Job', (
              <Dropdown
                size="sm"
                multiple
                searchable
                ariaLabel="Filter by job"
                placeholder="All jobs"
                values={job}
                onToggle={toggleJob}
                options={jobOptions.map((j) => ({ value: j, label: j }))}
              />
            ))}
            {stk.length > 0 || job.length > 0 || query || range ? (
              <Button variant="tertiary" size="sm" onClick={() => { setStk([]); setJob([]); setQuery(''); setRange(null) }}>
                Clear all
              </Button>
            ) : null}
          </div>

          <div style={{ display: 'flex', gap: 'var(--space-400)', alignItems: 'center', flexWrap: 'wrap' }}>
            {view !== 'graph' ? (
              <Checkbox
                checked={expandAll}
                onChange={() => setExpandAll((v) => !v)}
                label="See all rationals"
              />
            ) : null}
            {hasPlain ? (
              <Checkbox
                checked={showPlain}
                onChange={() => setShowPlain((v) => !v)}
                label="Plain language"
              />
            ) : null}
            {/* CSV export — same button as the Sales page (secondary-neutral + download
                icon); exports the current filtered/sorted needs. */}
            <Button
              variant="secondary-neutral"
              size="sm"
              rightIcon={<DownloadSimple size={14} weight="regular" />}
              onClick={() => downloadNeedsCsv(rows)}
            >
              CSV
            </Button>
          </div>
        </div>

        {/* Active filter chips: one closable neutral badge per selected value.
            A darker surface + hairline border lifts the grey chip off the card. */}
        {stk.length > 0 || job.length > 0 || range ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-200)', alignItems: 'center' }}>
            {range ? (
              <Badge key="range" variant="neutral" size="sm" style={chipStyle} onClose={() => setRange(null)} closeLabel="Remove importance/satisfaction filter">
                importance {bandName(range.impMin)} · satisfaction {bandName(range.satMin)}
              </Badge>
            ) : null}
            {stk.map((v) => (
              <Badge key={`stk-${v}`} variant="neutral" size="sm" style={chipStyle} onClose={() => toggleStk(v)} closeLabel={`Remove ${v}`}>
                {v}
              </Badge>
            ))}
            {job.map((v) => (
              <Badge key={`job-${v}`} variant="neutral" size="sm" style={chipStyle} onClose={() => toggleJob(v)} closeLabel={`Remove ${v}`}>
                {v}
              </Badge>
            ))}
          </div>
        ) : null}

        {view === 'graph' ? (
          <div style={{ display: 'flex', height: 'min(72vh, 640px)', minHeight: 440, width: '100%' }}>
          <OpportunityMatrix
            points={graphPoints}
            xLabel="Importance"
            yLabel="Satisfaction"
            noun={{ one: 'need', many: 'needs' }}
            hint="Bubble size shows how many needs overlap · click a bubble or drag a region to list its needs."
            isoLines={[
              { c: 10, lines: ['Opp>10', 'Solid', 'Opportunity'] },
              { c: 12, lines: ['Opp>12', 'High', 'Opportunity'] },
              { c: 15, lines: ['Opp>15', 'Extreme', 'Opportunity'] },
            ]}
            boundaryLines={[{ x1: 0, y1: 1, x2: 9, y2: 10 }]}
            quadrants={[
              { x: 1.1, y: 9.2, label: 'Overserved', bg: 'var(--surface-default-error)', color: 'var(--text-error)' },
              { x: 1.6, y: 1.2, label: 'Appropriately served', bg: 'var(--surface-default-warning)', color: 'var(--text-warning)' },
              { x: 6.4, y: 0.7, label: 'Underserved', bg: 'var(--surface-default-success)', color: 'var(--text-success)' },
            ]}
            emptyHint="Click a bubble or drag a region on the matrix to list its needs here."
            renderTooltip={(p) => (
              <>
                <Text variant="b3" weight="medium" as="span">{p.source_job}</Text>
                <span style={{ fontFamily: 'var(--font-family-sans)', fontSize: 'var(--font-size-b4)', color: 'var(--text-description)' }}>{p.stk}</span>
                <Text variant="b3" as="span" style={{ color: 'var(--text-body)' }}>{needText(p)}</Text>
                <span style={{ display: 'flex', gap: 'var(--space-300)', marginTop: 'var(--space-50)' }}>
                  <span style={{ ...mono, fontSize: 'var(--font-size-b4)', color: 'var(--text-description)' }}>imp {p.imp.toFixed(1)}</span>
                  <span style={{ ...mono, fontSize: 'var(--font-size-b4)', color: 'var(--text-description)' }}>sat {p.sat.toFixed(1)}</span>
                  <span style={{ ...mono, fontSize: 'var(--font-size-b4)', color: 'var(--text-body)', fontWeight: 'var(--font-weight-medium)' }}>opp {p.opp.toFixed(1)}</span>
                </span>
              </>
            )}
            columns={[
              { header: 'Opp.', width: 78, nowrap: true, render: (p) => (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-50)' }}>
                  <Badge variant={oppVariant(p.opp)} size="xs">{oppWord(p.opp)}</Badge>
                  <span style={{ ...mono, fontSize: 'var(--font-size-b3)', color: 'var(--text-headings)' }}>{p.opp.toFixed(1)}</span>
                </div>
              ) },
              { header: 'Stakeholder', width: '26%', render: (p) => (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span>{p.stk}</span>
                  <span style={{ ...mono, fontSize: 'var(--font-size-b4)', color: 'var(--text-labels)' }}>{p.role_label}</span>
                </div>
              ) },
              { header: 'Job', width: '22%', render: (p) => p.source_job },
              { header: 'Need', render: (p) => needText(p) },
            ]}
          />
          </div>
        ) : (
        /* Table */
        <div className="odi-tablescroll" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <Table aria-label="ODI needs" striped="columns" style={{ tableLayout: 'fixed' }}>
            {/* Fixed column widths so the header never shifts when rows expand
                (expanding merges the right-hand columns into one wide cell). */}
            <colgroup>
              <col style={{ width: 32 }} />{/* caret — hugs the 16px arrow with 8px each side */}
              <col style={{ width: 92 }} />{/* opportunity */}
              <col style={{ width: 176 }} />{/* stakeholder */}
              <col style={{ width: 156 }} />{/* job */}
              <col />{/* need — takes the remaining width */}
              <col style={{ width: 128 }} />{/* product life cycle */}
              <col style={{ width: 116 }} />{/* status */}
              <col style={{ width: 96 }} />{/* importance */}
              <col style={{ width: 96 }} />{/* satisfaction */}
              <col style={{ width: 92 }} />{/* confidence */}
            </colgroup>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell aria-label="Expand" style={headerSticky} />
                {columns.map((c) => {
                  const canSort = c.sortable !== false
                  return (
                    <Table.HeaderCell
                      key={c.key}
                      align={c.align}
                      style={headerSticky}
                      sortable={canSort}
                      sortDirection={canSort && sort.key === c.key ? (sort.dir < 0 ? 'desc' : 'asc') : undefined}
                      onSort={canSort ? () => onSort(c.key) : undefined}
                      info={Boolean(c.info)}
                      infoTooltip={c.info}
                    >
                      {c.label}
                    </Table.HeaderCell>
                  )
                })}
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {rows.map((r) => {
                const id = rowId.get(r)!
                const isOpen = expandAll || open.has(id)
                const conf = meanConf(r)
                const s = statusOf(r)
                const topCell: CSSProperties = { verticalAlign: 'top' }
                return (
                  <Fragment key={id}>
                    {/* Data row — every value stays in its own column, expanded or not */}
                    <Table.Row onClick={() => toggleRow(id)} style={{ cursor: 'pointer' }}>
                      {/* Caret — expand affordance */}
                      <Table.Cell icon style={topCell}>
                        <CaretDown size={16} weight="regular" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 120ms ease', color: 'var(--icon-description)' }} />
                      </Table.Cell>
                      {/* Opportunity */}
                      <Table.Cell style={topCell}>{stackCell(r.opp.toFixed(1), <Badge variant={oppVariant(r.opp)} size="xs">{oppWord(r.opp)}</Badge>)}</Table.Cell>
                      {/* Stakeholder */}
                      <Table.Cell style={topCell}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span>{r.stk}</span>
                          <span style={{ ...mono, fontSize: 'var(--font-size-b4)', color: 'var(--text-labels)' }}>{r.role_label}</span>
                        </div>
                      </Table.Cell>
                      {/* Job */}
                      <Table.Cell style={topCell}>{r.source_job}</Table.Cell>
                      {/* Need */}
                      <Table.Cell style={{ ...topCell, whiteSpace: 'normal', lineHeight: 'var(--line-height-b2)' }}>{needText(r)}</Table.Cell>
                      {/* Job type — the job's ODI type; a product job instead reads
                          "Product job" + its product life-cycle stage. */}
                      <Table.Cell style={topCell}>
                        {r.job_type === 'product' ? (
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-100)' }}>
                            <Badge variant="color" size="xs">Product job</Badge>
                            <Badge variant="neutral" size="xs">{STAGE_LABEL[JOB_STAGE[r.source_job] ?? 'usage']}</Badge>
                          </div>
                        ) : (
                          <Badge variant="neutral" size="xs">{r.job_type}</Badge>
                        )}
                      </Table.Cell>
                      {/* Status */}
                      <Table.Cell style={topCell}><Badge variant={s.variant} size="xs">{s.label}</Badge></Table.Cell>
                      {/* Importance (number over band badge) */}
                      <Table.Cell style={topCell}>{stackCell(r.imp.toFixed(1), <Badge variant={impVariant(r.imp_band)} size="xs">{r.imp_band}</Badge>)}</Table.Cell>
                      {/* Satisfaction (number over band badge) */}
                      <Table.Cell style={topCell}>{stackCell(r.sat.toFixed(1), <Badge variant={satVariant(r.sat_band)} size="xs">{r.sat_band}</Badge>)}</Table.Cell>
                      {/* Confidence — badge only */}
                      <Table.Cell style={topCell}><ConfidenceBadge value={conf} size="xs" /></Table.Cell>
                    </Table.Row>

                    {/* Detail row — full-width rationale below; only the caret
                        column stays intact, the rest spans the whole table. */}
                    {isOpen ? (
                      <Table.Row>
                        <Table.Cell style={{ padding: 0 }} />
                        <Table.Cell colSpan={columns.length} style={{ padding: 0 }}>
                          <RationalePanel r={r} />
                        </Table.Cell>
                      </Table.Row>
                    ) : null}
                  </Fragment>
                )
              })}
            </Table.Body>
          </Table>
        </div>
        )}
        </div>
        </WidgetCard>
      </div>
  )
}

// ODI Matrix page — the shared needs view (ODIMatrixView) wrapped in the report
// PageTemplate chrome (breadcrumb + back-nav to the market page).
export function ODIMatrix() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  // Which rated unit to show. Any rated Sterile Fill-Finish unit can be opened
  // via /odi-matrix?unit=<slug>; the bundled default (highest-opportunity unit)
  // is used when there's no ?unit or its file can't be fetched.
  const unit = searchParams.get('unit')
  const [data, setData] = useState<OdiData>(odiNeeds)
  useEffect(() => {
    let alive = true
    if (!unit || unit === (odiNeeds.slug ?? '')) {
      setData(odiNeeds)
      return
    }
    fetch(`${import.meta.env.BASE_URL}data/odi/${unit}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => { if (alive) setData(d as OdiData) })
      .catch(() => { if (alive) setData(odiNeeds) })
    return () => { alive = false }
  }, [unit])

  // Browser-tab (document) title for this page — "Needs-<analysed level name>".
  useEffect(() => {
    document.title = `Needs-${data.unit.name}`
  }, [data])

  return (
    <PageTemplate
      breadcrumb={
        <Breadcrumb
          items={[
            { label: `NAICS ${data.naics}: ${data.market_label}` },
            {
              label: `${data.unit.level} ${data.unit.name}`,
              onClick: (e) => {
                e.preventDefault()
                navigate('/market-page')
              },
            },
            { label: 'Needs' },
          ]}
        />
      }
      title="Needs - Opportunity Score"
      description="Every desired outcome, rated on Ulwick ODI importance × satisfaction from each stakeholder's core functional job. Click a row to reveal its rationale and confidence."
      titleLeading={
        <BackButton label="Back to value network" onClick={() => navigate('/market-page')} />
      }
      sidebar={<ReportSidebar />}
      actions={<ReportActions />}
    >
      <ODIMatrixView key={data.slug ?? data.unit.name} data={data} />
    </PageTemplate>
  )
}

export default ODIMatrix
