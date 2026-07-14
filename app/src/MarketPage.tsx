import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { ArrowElbowDownRight, ArrowRight, ArrowsClockwise, ArrowSquareOut, ClipboardText, Cube, Envelope, Eye, Lightbulb, LinkedinLogo, LockSimple, Megaphone, Pulse, ShoppingCart, Trash, TreeStructure, UsersThree, Wrench, X } from '@phosphor-icons/react'
import type { Icon } from '@phosphor-icons/react'
import {
  Accordion,
  AddressLine,
  BackButton,
  Badge,
  Button,
  CardTable,
  Checkbox,
  ConfidenceBadge,
  ContentCard,
  Divider,
  EmailChip,
  InfoTooltip,
  JobEntry,
  NaicsRow,
  Number,
  PageTemplate,
  SearchBar,
  Section,
  StageBox,
  Tab,
  Text,
  Tooltip,
  TreeView,
  WidgetCard,
} from '@node42/ui-kit'
import type { TreeNode } from '@node42/ui-kit'
import { ReportActions } from './ReportActions'
import { ReportSidebar } from './ReportSidebar'
import { slugify } from './sections'
import { UPSELL_COPY } from './copy'
import { hospitalVN, vnMeta } from './hospitalValueNetwork'
import type { VNNode } from './hospitalValueNetwork'
import { odiNeeds } from './odiNeedsData'
import marketData from './data/market.json'
import odiIndex from './data/odi_index.json'
import stakeholdersByUnitData from './data/stakeholders_by_unit.json'
import productJobsByUnitData from './data/product_jobs_by_unit.json'

// Rated Sterile Fill-Finish units (unit name → ODI slug). Any value-network
// node whose name is a rated unit shows an enabled "Needs & Jobs" button that
// deep-links to /odi-matrix?unit=<slug>.
const RATED_SLUG_BY_NAME = new Map<string, string>(
  (odiIndex as { unit_name: string; slug: string }[]).map((u) => [u.unit_name, u.slug]),
)
import type { LifecycleStage } from './lifecycle'

// "Market Page" — the General Medical & Surgical Hospitals market (NAICS 622110),
// populated from the hospital value-network export (hospitalValueNetwork.ts):
// 680 functional units across levels L7 → L3. The Value Network tab renders the
// full taxonomy; selecting a node reveals its level, name, path and core
// functional job.

// Headline market-sizing stats shown to the right of the title. Figures are
// estimates for the US General Medical & Surgical Hospitals market (NAICS 622110).
const headerStats = marketData.headerStats

// One-line description of what this specific NAICS industry covers — shown
// under the market title, beside the NAICS badge.
const NAICS_DESCRIPTION = marketData.naicsDescription


// Walk the tree to the node with `id`, returning the chain of nodes from the
// root down to it (inclusive). Used to build the ancestry schema on the right.
function findNodePath(nodes: TreeNode[], id: string): TreeNode[] {
  for (const node of nodes) {
    if (node.id === id) return [node]
    if (node.children) {
      const sub = findNodePath(node.children, id)
      if (sub.length) return [node, ...sub]
    }
  }
  return []
}

// Per-level colour, keyed by the value-network level label. One step of the
// tertiary (alt-blue) ramp per level — darkest at the top of the taxonomy (L7),
// lightest at the leaves (L3) — so depth reads as shade. Text flips to white on
// the dark top shades. All values are ui-kit tokens, never raw hex.
const LEVEL_STYLE: Record<string, { bg: string; fg: string }> = {
  L7: { bg: 'var(--tertiary-800)', fg: 'var(--white)' },
  L6: { bg: 'var(--tertiary-default)', fg: 'var(--white)' },
  L6a: { bg: 'var(--tertiary-400)', fg: 'var(--white)' },
  L5: { bg: 'var(--tertiary-200)', fg: 'var(--secondary-700)' },
  L4: { bg: 'var(--tertiary-100)', fg: 'var(--secondary-700)' },
  L3: { bg: 'var(--tertiary-50)', fg: 'var(--secondary-700)' },
}
function levelStyle(label: ReactNode): CSSProperties {
  // Badges may carry a per-level index (e.g. "L6a.2"); colour by the level part.
  const key = typeof label === 'string' ? label.split('.')[0] : ''
  const c = LEVEL_STYLE[key] || { bg: 'var(--surface-default-default-2)', fg: 'var(--text-body)' }
  return { background: c.bg, color: c.fg }
}

// Convert the value-network data into kit TreeNodes (once), tagging each with its
// level-coloured badge. A parallel id → VNNode map powers the detail panel.
// Badge numbering: the root keeps its plain level ("L7"); every descendant gets
// its level + a 1-based index among same-level siblings under the same parent
// (e.g. "L6.1", "L6a.1", "L6a.2", "L5.1", "L5.2").

// The products Waldner sells into this market. A product can be sold into
// SEVERAL value-network units, so each carries a list of unit node ids. Both the
// products and their unit matches are real — exported from Neo4j (Hermann
// Waldner products matched to Sterile Fill-Finish units) by scripts/export_sff.py.
type ProductGroupRef = { code: string; name: string }
type CompanyProduct = { name: string; note?: string; unitIds: string[]; group?: ProductGroupRef }
const COMPANY_PRODUCTS: CompanyProduct[] = (
  marketData.products as { name: string; note: string | null; unitIds: string[]; group: ProductGroupRef | null }[]
).map((p) => ({ name: p.name, note: p.note ?? undefined, unitIds: p.unitIds, group: p.group ?? undefined }))
// Every value-network unit we sell any product into (union across products).
const PRODUCT_NODE_IDS = new Set(COMPANY_PRODUCTS.flatMap((p) => p.unitIds))

// Flag the product node(s) and the ancestry trail down to them, so the tree can
// mark each product with a box icon and breadcrumb the path with a yellow dot on
// every ancestor — a visible trail the user follows down to each product.
const productIds = new Set<string>()
const trailIds = new Set<string>()
;(function mark(nodes: VNNode[], ancestors: string[]) {
  for (const n of nodes) {
    if (PRODUCT_NODE_IDS.has(n.id)) {
      productIds.add(n.id)
      for (const a of ancestors) trailIds.add(a)
    }
    if (n.children) mark(n.children, [...ancestors, n.id])
  }
})(hospitalVN, [])

// Tree-row marker shown just after the level badge: a box on the product node, a
// yellow dot on each ancestor leading to it, nothing elsewhere.
function treeMarker(n: VNNode): ReactNode {
  if (productIds.has(n.id)) {
    // Product box (Figma 5084:69454): a Cube with a yellow fill and a dark
    // outline — two stacked layers using the nearest existing tokens
    // (--primary-400 fill, --secondary-450 outline).
    return (
      <span style={{ position: 'relative', display: 'inline-flex', width: 'var(--space-400)', height: 'var(--space-400)', flexShrink: 0 }} aria-hidden>
        <Cube size={16} weight="fill" style={{ position: 'absolute', inset: 0, color: 'var(--primary-400)' }} />
        <Cube size={16} weight="regular" style={{ position: 'absolute', inset: 0, color: 'var(--secondary-450)' }} />
      </span>
    )
  }
  if (trailIds.has(n.id)) {
    return <span style={{ width: 'var(--space-200)', height: 'var(--space-200)', borderRadius: '50%', background: 'var(--primary-600)', flexShrink: 0, boxShadow: '0 0 0 var(--space-50) var(--surface-default-default)' }} />
  }
  return null
}
function treeText(n: VNNode): ReactNode {
  const marker = treeMarker(n)
  if (!marker) return n.name
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-100)', minWidth: 0 }}>
      {marker}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.name}</span>
    </span>
  )
}

const nodeById = new Map<string, VNNode>()
function toTreeNode(n: VNNode, badge: string): TreeNode {
  nodeById.set(n.id, n)
  const node: TreeNode = { id: n.id, badge, text: treeText(n), badgeStyle: levelStyle(n.level) }
  if (n.children?.length) {
    const perLevel: Record<string, number> = {}
    node.children = n.children.map((c) => {
      perLevel[c.level] = (perLevel[c.level] ?? 0) + 1
      return toTreeNode(c, `${c.level}.${perLevel[c.level]}`)
    })
  }
  return node
}
const valueTree: TreeNode[] = hospitalVN.map((n) => toTreeNode(n, n.level))

// Company products resolved against the tree. `companyProducts` is the FLAT
// (product × unit) list used by the node detail and coverage marking. `product`
// carries the product's own name (which can differ from the unit's), while `name`
// is the unit/node name.
type ResolvedProduct = { product: string; nodeId: string; name: string; note?: string; group?: ProductGroupRef }
const companyProducts: ResolvedProduct[] = COMPANY_PRODUCTS.flatMap((p) =>
  p.unitIds.flatMap((id) => {
    const n = nodeById.get(id)
    return n ? [{ product: p.name, nodeId: id, name: n.name, note: p.note, group: p.group }] : []
  })
)
// Stable identity key for a product group (UNSPSC code when present, else name).
const groupKey = (g: ProductGroupRef): string => g.code || g.name

// Grouped for the Products tab: one entry per product, each carrying every
// value-network unit it's sold into (that unit's own-level badge + name), so a
// product sold in multiple units reads as one product with several units.
type ResolvedUnit = { nodeId: string; badge: string; name: string }
type ProductGroup = { name: string; note?: string; units: ResolvedUnit[] }
const companyProductGroups: ProductGroup[] = COMPANY_PRODUCTS.map((p) => ({
  name: p.name,
  note: p.note,
  units: p.unitIds.flatMap((id) => {
    const chain = findNodePath(valueTree, id)
    if (!chain.length) return []
    const seg = chain[chain.length - 1]
    return [{ nodeId: id, badge: String(seg.badge), name: nodeById.get(seg.id)?.name ?? '' }]
  }),
}))

// The distinct Neutral Product Groups a set of products belongs to (UNSPSC-derived
// technology classes), sorted so coded groups lead. Used to head the Product
// Groups & Products panel for the selected unit's subtree.
function groupsOf(products: ResolvedProduct[]): ProductGroupRef[] {
  const seen = new Map<string, ProductGroupRef>()
  for (const p of products) if (p.group && !seen.has(groupKey(p.group))) seen.set(groupKey(p.group), p.group)
  return Array.from(seen.values()).sort((a, b) => groupKey(a).localeCompare(groupKey(b)))
}
// Order products by the group they belong to (coded groups first, by code), then
// by product name.
const byGroupThenName = (a: ResolvedProduct, b: ResolvedProduct): number => {
  const ca = a.group?.code, cb = b.group?.code
  if (ca && cb) return ca.localeCompare(cb) || a.product.localeCompare(b.product)
  if (ca) return -1
  if (cb) return 1
  return a.product.localeCompare(b.product)
}

// Path schema: the full chain from the root down to and including the selected
// node, each shown as a per-level colour badge + its name, indented step by step
// to convey the hierarchy. Every row selects that node; the selected level is
// highlighted (filled row + heading-weight name).
function LevelSchema({ path, selectedId, onSelect }: { path: TreeNode[]; selectedId: string; onSelect: (node: TreeNode) => void }) {
  if (!path.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-100)', width: '100%' }}>
      {path.map((node, i) => {
        const isSelected = node.id === selectedId
        return (
          <button
            type="button"
            key={node.id}
            onClick={() => onSelect(node)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-200)',
              minWidth: 0,
              width: '100%',
              margin: 0,
              padding: 'var(--space-100)',
              paddingLeft: `calc(var(--space-100) + var(--space-400) * ${i})`,
              border: 0,
              borderRadius: 'var(--radius-xs)',
              background: isSelected ? 'var(--surface-default-default-2)' : 'transparent',
              cursor: 'pointer',
              textAlign: 'left',
              font: 'inherit',
            }}
          >
            {i > 0 ? (
              <ArrowElbowDownRight size={14} weight="regular" style={{ flexShrink: 0, color: 'var(--text-labels)' }} />
            ) : null}
            <Badge variant="color" size="xs" style={levelStyle(node.badge)}>
              {node.badge}
            </Badge>
            <Text
              variant="b2"
              weight={isSelected ? 'medium' : undefined}
              as="span"
              style={{
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: isSelected ? 'var(--text-headings)' : 'var(--text-body)',
              }}
            >
              {node.text}
            </Text>
          </button>
        )
      })}
    </div>
  )
}

// Stakeholders — the market's buying centre, sourced from the ODI analysis
// (odiNeedsData): nine roles across four buying-centre functions, each with its
// ESCO occupation code. Shown on every node's detail.
const escoUrl = (esco: string) => `https://esco.ec.europa.eu/en/search-occupations?text=${encodeURIComponent(esco)}`

const mono: CSSProperties = { fontFamily: 'var(--font-family-mono)', fontWeight: 'var(--font-weight-medium)' }

// --- Jobs-to-be-Done per stakeholder ------------------------------------------
// Derived from the ODI needs rows: each row is a need tied to a source_job with
// a job_type (core / emotional / status). We dedupe to the distinct jobs each
// stakeholder holds (first-seen order). Product jobs are a separate category with
// no data source yet — the bucket stays empty until it's populated.
type JobKind = 'core' | 'product' | 'emotional' | 'status'
type StakeholderJobs = Record<JobKind, string[]>

const jobsByStakeholder: Record<string, StakeholderJobs> = (() => {
  const acc: Record<string, { core: string[]; emotional: string[]; status: string[]; seen: Set<string> }> = {}
  for (const r of odiNeeds.rows) {
    const a = (acc[r.stk] ??= { core: [], emotional: [], status: [], seen: new Set<string>() })
    const key = `${r.job_type}::${r.source_job}`
    if (a.seen.has(key)) continue
    a.seen.add(key)
    if (r.job_type === 'core') a.core.push(r.source_job)
    else if (r.job_type === 'emotional') a.emotional.push(r.source_job)
    else if (r.job_type === 'status') a.status.push(r.source_job)
  }
  const out: Record<string, StakeholderJobs> = {}
  for (const [stk, a] of Object.entries(acc)) {
    out[stk] = { core: a.core, product: [], emotional: a.emotional, status: a.status }
  }
  return out
})()

const emptyJobs: StakeholderJobs = { core: [], product: [], emotional: [], status: [] }

const ROLE_META: Record<string, { label: string; icon: Icon; desc: string }> = {
  job_executor: { label: 'Job Executor', icon: Wrench, desc: 'Operates the system day to day.' },
  job_overseer: { label: 'Job Overseer', icon: Eye, desc: 'Governs safety and service quality.' },
  job_influencer: { label: 'Job Influencer', icon: Lightbulb, desc: 'Advises how the job gets done.' },
  purchase_influencer: { label: 'Purchase Influencer', icon: Megaphone, desc: 'Shapes specification and vendor choice.' },
  purchase_executor: { label: 'Purchase Executor', icon: ShoppingCart, desc: 'Holds budget and signs the purchase.' },
}
const ROLE_ORDER = ['job_executor', 'job_overseer', 'job_influencer', 'purchase_influencer', 'purchase_executor']

// The buying centre is built PER value-network unit from that unit's own ODI
// stakeholders (each rated unit has a different buying centre). Roles with no
// stakeholders for the unit drop out. `stakeholdersByUnit` is keyed by the unit's
// ODI slug (see scripts/export_sff.py).
type UnitStakeholder = { role: string; role_label: string; title: string; esco_code: string }
const stakeholdersByUnit = stakeholdersByUnitData as Record<string, { name: string; level: string; stakeholders: UnitStakeholder[] }>

function buildStakeholderGroups(stakeholders: UnitStakeholder[]) {
  return ROLE_ORDER.map((role) => ({
    role,
    label: ROLE_META[role].label,
    icon: ROLE_META[role].icon,
    desc: ROLE_META[role].desc,
    roles: stakeholders
      .filter((s) => s.role === role)
      .map((s) => ({ name: s.title, esco: s.esco_code, jobs: jobsByStakeholder[s.title] ?? emptyJobs })),
  })).filter((g) => g.roles.length)
}

// --- Job life cycle -----------------------------------------------------------
// A second lens on the SAME jobs surfaced under the stakeholders: instead of
// "who holds the job", every distinct job is grouped by its consumption-chain
// stage (acquisition → preparation → usage → maintenance → disposal). The ODI
// export carries no lifecycle tag, so the stage is assigned here per job. Any
// job missing from the seed falls back to Usage so nothing is silently dropped.

// A real product job (Burleson L1) for a unit, bucketed by lifecycle stage.
type ProductJob = { name: string; statement: string; description: string; userGroup: string; frequency: string; kind: string }
const productJobsByUnit = productJobsByUnitData as Record<string, Partial<Record<LifecycleStage, ProductJob[]>>>

const LIFECYCLE_STAGES: { key: LifecycleStage; label: string; icon: Icon; desc: string }[] = [
  { key: 'acquisition', label: 'Acquisition', icon: ShoppingCart, desc: 'Specifying, sourcing and buying the system.' },
  { key: 'preparation', label: 'Preparation', icon: ClipboardText, desc: 'Installing, qualifying and readying the system.' },
  { key: 'usage', label: 'Usage', icon: Pulse, desc: 'Operating the system to do its job.' },
  { key: 'maintenance', label: 'Maintenance', icon: Wrench, desc: 'Keeping the system and team performing.' },
  { key: 'disposal', label: 'Disposal', icon: Trash, desc: 'Retiring and replacing the system.' },
]


// One selectable lifecycle-stage box in the acquisition → … → disposal chain.
// Clicking it reveals that stage's jobs below (see JobLifeCycleView).
// Job Life Cycle tab — the five stages as a clickable acquisition → … → disposal
// chain. Selecting a stage reveals its jobs below, each with title, description
// and the corresponding stakeholder.
function JobLifeCycleView({ jobs }: { jobs: Partial<Record<LifecycleStage, ProductJob[]>> }) {
  const count = (k: LifecycleStage) => jobs[k]?.length ?? 0
  const total = LIFECYCLE_STAGES.reduce((n, st) => n + count(st.key), 0)
  // Default to the first stage that actually has jobs.
  const firstWithJobs = LIFECYCLE_STAGES.find((st) => count(st.key) > 0)?.key ?? null
  const [selected, setSelected] = useState<LifecycleStage | null>(firstWithJobs)
  const active = LIFECYCLE_STAGES.find((s) => s.key === selected)
  const stageJobs = selected ? (jobs[selected] ?? []) : []

  if (total === 0) {
    return (
      <Text variant="b3" as="p" style={{ margin: 0, color: 'var(--text-labels)' }}>
        No product jobs mapped to this unit. Open a unit Waldner sells a product into to see its product life-cycle jobs.
      </Text>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-400)', width: '100%' }}>
      {/* Clickable stage chain — select one to reveal its jobs below. */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 'var(--space-100)', width: '100%', overflowX: 'auto' }}>
        {LIFECYCLE_STAGES.map((st, i) => (
          <Fragment key={st.key}>
            {i > 0 ? (
              <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0, color: 'var(--icon-description)' }} aria-hidden>
                <ArrowRight size={14} weight="bold" />
              </span>
            ) : null}
            <StageBox
              icon={<st.icon size={14} weight="regular" />}
              label={st.label}
              count={count(st.key)}
              selected={selected === st.key}
              title={`${st.label} — ${st.desc}`}
              onClick={() => setSelected((prev) => (prev === st.key ? null : st.key))}
            />
          </Fragment>
        ))}
      </div>

      {active ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-200)', minWidth: 0, borderLeft: '2px solid var(--border-default-default)', paddingLeft: 'var(--space-300)' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-100)', flexWrap: 'wrap', minWidth: 0 }}>
            <active.icon size={14} weight="regular" style={{ flexShrink: 0 }} />
            <Text variant="b3" weight="medium" as="span">{active.label}</Text>
            <Badge variant="neutral" size="xs">{stageJobs.length}</Badge>
            <span style={{ width: 'var(--space-100)', height: 'var(--space-100)', borderRadius: '50%', background: 'var(--icon-description)', flexShrink: 0 }} />
            <Text variant="b3" as="span" style={{ color: 'var(--text-description)' }}>{active.desc}</Text>
          </span>
          {stageJobs.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-200)', width: '100%', minWidth: 0 }}>
              {stageJobs.map((j) => (
                <JobEntry
                  key={j.name}
                  title={j.name}
                  description={j.statement || j.description}
                  meta={j.userGroup || '—'}
                  metaIcon={<UsersThree size={13} weight="regular" />}
                />
              ))}
            </div>
          ) : (
            <Text variant="b3" as="span" style={{ color: 'var(--text-description)', fontStyle: 'italic' }}>No product jobs in this stage.</Text>
          )}
        </div>
      ) : (
        <Text variant="b3" as="span" style={{ color: 'var(--text-description)', fontStyle: 'italic' }}>Select a stage above to see its product jobs.</Text>
      )}
    </div>
  )
}

// An email address + a copy-to-clipboard button, with transient "copied"
// Per-person email. The envelope shows ONLY when the contact has a work email;
// clicking it opens a small modal with the address (copy) + a "Send email"
// mailto action. No email → no envelope at all.
function RequestEmailButton({ name, role, email }: { name: string; role: string; email: string; linkedin: string }) {
  const available = email.trim().length > 0
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  // No work email on file → don't render the envelope at all.
  if (!available) return null

  return (
    <>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        title={`Email ${name}`}
        aria-label={`Email ${name}`}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          width: 'var(--space-500)', height: 'var(--space-500)', padding: 0, border: 0,
          borderRadius: 'var(--radius-xs)', background: 'transparent', cursor: 'pointer',
          color: 'var(--icon-description)', transition: 'color 120ms ease',
        }}
      >
        <Envelope size={16} weight="regular" />
      </button>

      {open ? createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Email ${name}`}
          onMouseDown={() => setOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-500)', background: 'rgba(0, 0, 0, 0.55)', backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
        >
          <div
            onMouseDown={(e) => e.stopPropagation()}
            style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-300)', width: 'min(420px, 100%)', padding: 'var(--space-500)', background: 'var(--surface-default-default)', color: 'var(--text-body)', border: 'var(--border-width-default) solid var(--border-default-default)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg, var(--shadow-md))' }}
          >
            {/* Header — envelope · name/role · X close */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-200)' }}>
              <span style={{ display: 'grid', placeItems: 'center', flexShrink: 0, width: 'var(--space-700)', height: 'var(--space-700)', borderRadius: 'var(--radius-full)', background: 'var(--surface-default-information)', color: 'var(--text-information)' }}>
                <Envelope size={20} weight="regular" />
              </span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-50)', minWidth: 0, flex: 1 }}>
                <Text variant="h5" as="h2" style={{ margin: 0 }}>Email</Text>
                <Text variant="b3" as="p" style={{ margin: 0, color: 'var(--text-description)' }}>{name} · {role}</Text>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                style={{ flexShrink: 0, display: 'grid', placeItems: 'center', width: 'var(--space-600)', height: 'var(--space-600)', border: 0, borderRadius: 'var(--radius-xs)', background: 'transparent', color: 'var(--icon-description)', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* The email address, with the kit's copy chip. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-200)', padding: 'var(--space-300)', borderRadius: 'var(--radius-md)', background: 'var(--surface-default-default-2)', border: '1px solid var(--border-default-default)' }}>
              <EmailChip email={email} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--space-200)' }}>
              <Button variant="secondary-outline" size="sm" onClick={() => setOpen(false)}>Close</Button>
              <Button variant="primary" size="sm" leftIcon={<Envelope size={16} weight="regular" />} onClick={() => { window.location.href = `mailto:${email}` }}>Send email</Button>
            </div>
          </div>
        </div>,
        document.body,
      ) : null}
    </>
  )
}

// A list of REAL buying-centre people (KeyPersons from Neo4j): each row is
// name · their job title · location · LinkedIn · request-email. No synthetic data.
function PeopleList({ people }: { people: Person[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-100)' }}>
      {people.map((p) => (
        <div key={p.linkedin || p.name} style={{ display: 'flex', alignItems: 'center', columnGap: 'var(--space-200)', rowGap: 'var(--space-50)', flexWrap: 'wrap', minWidth: 0 }}>
          {p.linkedin ? (
            <a
              href={p.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              title={`${p.name} on LinkedIn`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-100)', flexShrink: 0, textDecoration: 'none', color: 'var(--text-link)' }}
            >
              <LinkedinLogo size={14} weight="fill" style={{ flexShrink: 0 }} />
              <Text variant="b3" weight="medium" as="span" style={{ color: 'var(--text-link)' }}>{p.name}</Text>
            </a>
          ) : (
            <Text variant="b3" weight="medium" as="span">{p.name}</Text>
          )}
          {p.role ? (
            <>
              <span style={{ width: 'var(--space-50)', height: 'var(--space-50)', borderRadius: '50%', background: 'var(--icon-description)', flexShrink: 0 }} aria-hidden />
              <Text variant="b3" as="span" style={{ color: 'var(--text-description)' }}>{p.role}</Text>
            </>
          ) : null}
          {p.location ? (
            <>
              <span style={{ width: 'var(--space-50)', height: 'var(--space-50)', borderRadius: '50%', background: 'var(--icon-description)', flexShrink: 0 }} aria-hidden />
              <AddressLine size="b3">{p.location}</AddressLine>
            </>
          ) : null}
          <RequestEmailButton name={p.name} role={p.role} email={p.email} linkedin={p.linkedin} />
        </div>
      ))}
    </div>
  )
}

// One stakeholder role: name + ESCO link + a Needs & Jobs button, and — in the
// sales modal — the REAL people at this account who fill THIS role in THIS unit
// (KeyPerson-[:fills_role]->StakeholderRole), listed right under the role.
function StakeholderCard({ name, esco, people, onNeeds }: { name: string; esco: string; people?: Person[]; onNeeds: (stk: string) => void }) {
  const [hover, setHover] = useState(false)
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{ borderRadius: 'var(--radius-md)', background: hover ? 'var(--surface-default-hover)' : 'var(--surface-default-default-2)', transition: 'background 120ms ease', overflow: 'hidden' }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-200)', padding: 'var(--space-200) var(--space-300)', minWidth: 0 }}>
        {/* Title row — name · ESCO link · a button that deep-links to this
            stakeholder's pre-filtered needs & jobs. */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-200)', minWidth: 0 }}>
          <Text variant="b2" weight="medium" as="span" style={{ flex: '0 1 auto', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</Text>
          <a
            href={escoUrl(esco)}
            target="_blank"
            rel="noopener noreferrer"
            title={`Open ESCO ${esco} on esco.ec.europa.eu`}
            style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, textDecoration: 'none', color: 'inherit' }}
          >
            <Badge variant="neutral" size="xs">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-100)' }}>
                ESCO {esco}
                <ArrowSquareOut size={11} weight="regular" />
              </span>
            </Badge>
          </a>
          <Button
            variant="secondary-outline"
            size="xs"
            rightIcon={<ArrowRight size={13} weight="regular" />}
            onClick={() => onNeeds(name)}
            style={{ marginLeft: 'auto', flexShrink: 0 }}
          >
            View Needs & Jobs
          </Button>
        </div>
        {/* Real people filling this exact role at this account (sales modal). */}
        {people && people.length ? <PeopleList people={people} /> : null}
      </div>
    </div>
  )
}

function StakeholderGroup({ label, icon: RoleIcon, desc, roles, withPeople, peopleByRole, onNeeds }: { label: string; icon: Icon; desc: string; roles: { name: string; esco: string; jobs: StakeholderJobs }[]; withPeople?: boolean; peopleByRole?: Record<string, Person[]>; onNeeds: (stk: string) => void }) {
  // A left rail brackets the header + its cards so the group reads as one unit
  // without a full card container.
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-200)', minWidth: 0, borderLeft: '2px solid var(--border-default-default)', paddingLeft: 'var(--space-300)' }}>
      {/* Role header — icon · label · count · dot · description, all on one line */}
      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-100)', flexWrap: 'wrap', minWidth: 0 }}>
        <RoleIcon size={14} weight="regular" style={{ flexShrink: 0 }} />
        <Text variant="b3" weight="medium" as="span">{label}</Text>
        <Badge variant="neutral" size="xs">{roles.length}</Badge>
        <span style={{ width: 'var(--space-100)', height: 'var(--space-100)', borderRadius: '50%', background: 'var(--icon-description)', flexShrink: 0 }} />
        <Text variant="b3" as="span" style={{ color: 'var(--text-description)' }}>{desc}</Text>
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-200)', width: '100%', minWidth: 0 }}>
        {roles.map((role) => (
          <StakeholderCard
            key={role.name}
            name={role.name}
            esco={role.esco}
            people={withPeople ? peopleByRole?.[role.name] : undefined}
            onNeeds={onNeeds}
          />
        ))}
      </div>
    </div>
  )
}

// UNSPSC classification home — the product-group ContentCards link out here.
const UNSPSC_HOME = 'https://www.unspsc.org/'

// "Needs" button, shown beside every node's title. On the analysed product it
// opens the ODI matrix; on every other node it's locked, and hovering reveals an
// upgrade prompt (the feature ships with the full Node42 platform).
function NeedsButton({ enabled, onOpen }: { enabled: boolean; onOpen: () => void }) {
  const [hover, setHover] = useState(false)
  if (enabled) {
    return (
      <Button variant="primary" size="sm" rightIcon={<ArrowRight size={14} weight="regular" />} onClick={() => onOpen()} style={{ flexShrink: 0 }}>
        Needs & Jobs
      </Button>
    )
  }
  return (
    <span
      style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <Button variant="secondary-outline" size="sm" disabled rightIcon={<LockSimple size={14} weight="regular" />} style={{ pointerEvents: 'none' }}>
        Needs & Jobs
      </Button>
      {hover ? (
        <span style={{ position: 'absolute', top: 'calc(100% + var(--space-100))', right: 0, zIndex: 30 }}>
          <Tooltip
            arrow="top-center"
            maxWidth={260}
            description={UPSELL_COPY}
          />
        </span>
      ) : null}
    </span>
  )
}

// --- Named people behind each buying-centre function --------------------------
// Each buying-centre function lists the account's REAL people to reach out to —
// KeyPersons from Neo4j (KeyPerson-[:fills_role]->StakeholderRole), each with
// their job title, location, LinkedIn and (where known) work email. Surfaced only
// in the sales Value Network modal. No synthetic/fabricated identities.
type Person = { name: string; role: string; location: string; linkedin: string; email: string }

// Detail panel for the selected tree node: level badge + name, the ancestry
// path, the node's core functional job, the (MRI-only) product, and the buying
// centre. The Needs button jumps to the ODI matrix for the MRI product.
// `modal` = rendered inside the sales Value Network modal: it pairs each
// stakeholder with a named contact person and force-enables the Needs button.
function MarketDetail({ node, path, onSelect, onNeeds, modal, peopleByUnitRole }: { node: TreeNode; path: TreeNode[]; onSelect: (node: TreeNode) => void; onNeeds: (stk?: string, slug?: string) => void; modal?: boolean; peopleByUnitRole?: Record<string, Record<string, Person[]>> }) {
  const data = nodeById.get(node.id)
  // A node is "analysed" if its unit has ODI ratings — its Needs button then
  // deep-links to that unit's ODI page (/odi-matrix?unit=<slug>).
  const ratedSlug = data ? RATED_SLUG_BY_NAME.get(data.name) : undefined
  const isRated = !!ratedSlug
  // This unit's own buying centre — each rated unit has different stakeholders.
  const unitGroups = ratedSlug ? buildStakeholderGroups(stakeholdersByUnit[ratedSlug]?.stakeholders ?? []) : []
  // Real people at this account for THIS unit, keyed by stakeholder-role title
  // (sales modal only). Each role card shows the people who fill that exact role.
  const unitRolePeople = modal && data ? (peopleByUnitRole?.[data.name] ?? {}) : {}
  // The products we sell at or under this segment — listed in Product Groups &
  // Products (so a higher level shows every product beneath it).
  // Our products at/under this segment, ordered by the UNSPSC group they belong to
  // (then name); products with no UNSPSC sort last.
  const productsHere = useMemo(
    () => companyProducts
      .filter((p) => p.nodeId === node.id || findNodePath(valueTree, p.nodeId).some((n) => n.id === node.id))
      .sort(byGroupThenName),
    [node.id],
  )
  // Product groups = the Neutral Product Groups (UNSPSC-derived technology classes)
  // that Waldner's products at/under this unit belong to.
  const unspscGroups = useMemo(() => groupsOf(productsHere), [productsHere])
  // Nest each product under its group. A product mapped into several sub-units
  // appears once per unit in the flat list, so dedupe by (group, product name).
  const { productsByCode, ungrouped } = useMemo(() => {
    const byCode = new Map<string, ResolvedProduct[]>()
    const rest: ResolvedProduct[] = []
    const seen = new Set<string>()
    for (const p of productsHere) {
      const key = p.group ? groupKey(p.group) : null
      const dedupe = `${key ?? '—'}|${p.product}`
      if (seen.has(dedupe)) continue
      seen.add(dedupe)
      if (!key) { rest.push(p); continue }
      const arr = byCode.get(key) ?? []
      arr.push(p)
      byCode.set(key, arr)
    }
    return { productsByCode: byCode, ungrouped: rest }
  }, [productsHere])
  // Products actually shown (deduped) — for the Product Groups & Products recap.
  const shownProductCount = ungrouped.length + Array.from(productsByCode.values()).reduce((n, a) => n + a.length, 0)
  const groupCount = unspscGroups.length
  const productGroupsRecap = `${groupCount} ${groupCount === 1 ? 'group' : 'groups'} · ${shownProductCount} ${shownProductCount === 1 ? 'product' : 'products'}`
  // Buying-centre view toggle: the stakeholder groups, or the same jobs regrouped
  // by lifecycle stage.
  const [buyingTab, setBuyingTab] = useState<'stakeholders' | 'lifecycle'>('stakeholders')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-300)', flex: '1 1 0', minWidth: 0 }}>
      {/* Unit name header — kept pinned to the top of the detail column while the
          rest scrolls (the column is the scroll container). The trailing Divider is
          part of the sticky block, and a paddingBottom lets scrolling content pass
          cleanly under it. */}
      <div
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 3,
          background: 'var(--surface-default-default)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-300)',
          paddingBottom: 'var(--space-300)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-300)', minWidth: 0, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-200)', flex: '1 1 auto', minWidth: 0 }}>
            <Badge variant="color" size="xs" style={{ ...levelStyle(node.badge), flexShrink: 0 }}>
              {node.badge}
            </Badge>
            {data ? treeMarker(data) : null}
            {/* Render the raw name (not node.text): node.text carries the tree row's
                single-line `white-space: nowrap` truncation, which here would run the
                title under the Needs button. A plain wrapping name fills the row and
                breaks onto a second line when long. Shared by the market card and the
                sales Value Network modal (both render through MarketDetail). */}
            <Text variant="h4" as="p" style={{ minWidth: 0, overflowWrap: 'anywhere' }}>{data?.name ?? node.text}</Text>
          </div>
          <NeedsButton enabled={isRated || !!modal} onOpen={() => onNeeds(undefined, ratedSlug)} />
        </div>
        <Divider />
      </div>
      <Section label="Path">
        <LevelSchema path={path} selectedId={node.id} onSelect={onSelect} />
      </Section>
      {data?.cfj ? (
        <>
          <Divider />
          {/* Core Functional Job — the node's raison d'être, so it stands out:
              a callout with an accent left border and medium-weight B1 text in
              the headings colour. */}
          <Section label="Core Functional Job">
            <div style={{ padding: 'var(--space-400)', borderRadius: 'var(--radius-md)', background: 'var(--surface-default-default-2)', borderLeft: '3px solid var(--tertiary-default)', width: '100%' }}>
              <Text variant="b2" weight="medium" as="p" style={{ margin: 0, color: 'var(--text-headings)' }}>{data.cfj}</Text>
            </div>
          </Section>
        </>
      ) : null}
      {/* Product Groups & Products — one block per UNSPSC code: the classification
          (ContentCard linking to the lookup) with the company's products for that
          code nested underneath it. */}
      <Divider />
      <Accordion
        title="Product Groups & Products"
        info={<InfoTooltip tooltip="Product groups are the neutral technology-class groups (UNSPSC-derived) our products fall into; the products nested under each are the individual items Waldner sells in that group, at or under this value-network unit." size={16} label="About product groups & products" style={{ color: 'var(--text-labels)' }} />}
        summary={productGroupsRecap}
        defaultOpen={false}
      >
        {unspscGroups.length || productsHere.length ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-300)', width: '100%', minWidth: 0 }}>
            {/* Neutral product group (UNSPSC code where known) + its products. */}
            {unspscGroups.map((g) => {
              const prods = productsByCode.get(groupKey(g)) ?? []
              return (
                <div key={groupKey(g)} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-200)', width: '100%', minWidth: 0 }}>
                  <ContentCard
                    size="sm"
                    badge={<Badge style={mono}>{g.code ? `UNSPSC ${g.code}` : 'Product group'}</Badge>}
                    buttonLabel="Open UNSPSC classification"
                    button={Boolean(g.code)}
                    onButtonClick={g.code ? () => window.open(UNSPSC_HOME, '_blank', 'noopener') : undefined}
                  >
                    {g.name}
                  </ContentCard>
                  {prods.length ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-150)', width: '100%', minWidth: 0, paddingLeft: 'var(--space-400)' }}>
                      {prods.map((p) => (
                        <ContentCard
                          key={`${groupKey(g)}-${p.nodeId}-${p.product}`}
                          size="sm"
                          icon={<Cube size={16} weight="regular" />}
                          button={false}
                        >
                          {p.product}
                        </ContentCard>
                      ))}
                    </div>
                  ) : null}
                </div>
              )
            })}
            {/* Products with no UNSPSC code and no codes to fall back to. */}
            {ungrouped.length ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-150)', width: '100%', minWidth: 0 }}>
                {ungrouped.map((p) => (
                  <ContentCard
                    key={`ungrouped-${p.nodeId}-${p.product}`}
                    size="sm"
                    icon={<Cube size={16} weight="regular" />}
                    button={false}
                  >
                    {p.product}
                  </ContentCard>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <Text variant="b3" as="p" style={{ margin: 0, color: 'var(--text-labels)' }}>No product classifications in this value network unit.</Text>
        )}
      </Accordion>
      <Divider />
      {/* Two tabs — the buying centre (stakeholders) and the product life cycle
          (the jobs regrouped by consumption-chain stage). */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-300)', width: '100%' }}>
        <div style={{ display: 'flex', gap: 'var(--space-200)' }}>
          <Tab size="sm" selected={buyingTab === 'stakeholders'} onClick={() => setBuyingTab('stakeholders')} prefixIcon={<UsersThree size={16} weight="regular" />}>
            Buying center
          </Tab>
          <Tab size="sm" selected={buyingTab === 'lifecycle'} onClick={() => setBuyingTab('lifecycle')} prefixIcon={<ArrowsClockwise size={16} weight="regular" />}>
            Product life cycle
          </Tab>
        </div>
        {buyingTab === 'stakeholders' ? (
          unitGroups.length ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-500)', width: '100%' }}>
              {unitGroups.map((g) => (
                <StakeholderGroup key={g.role} label={g.label} icon={g.icon} desc={g.desc} roles={g.roles} withPeople={modal} peopleByRole={unitRolePeople} onNeeds={(stk?: string) => onNeeds(stk, ratedSlug)} />
              ))}
            </div>
          ) : (
            <Text variant="b3" as="p" style={{ margin: 0, color: 'var(--text-labels)' }}>
              This value-network unit has no mapped buying centre yet. Open a rated L5 unit (the ones with a “Needs &amp; Jobs” button) to see its stakeholders.
            </Text>
          )
        ) : (
          <JobLifeCycleView key={node.id} jobs={data ? (productJobsByUnit[data.name] ?? {}) : {}} />
        )}
      </div>
    </div>
  )
}

// Prune the tree to nodes whose title matches `query`, keeping the ancestor
// chain of every match so branches stay navigable. A matching node keeps its
// full subtree; a node kept only for a descendant keeps just the matched path.
// Match against the source name (via nodeById), not `node.text` — product/trail
// rows render `text` as a React element (icon + name), so String(text) would be
// "[object Object]" and never match (e.g. the MRI System node).
function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  const q = query.trim().toLowerCase()
  if (!q) return nodes
  const walk = (node: TreeNode): TreeNode | null => {
    const name = nodeById.get(node.id)?.name ?? (typeof node.text === 'string' ? node.text : '')
    if (name.toLowerCase().includes(q)) return node
    const kids = (node.children ?? []).map(walk).filter(Boolean) as TreeNode[]
    return kids.length ? { ...node, children: kids } : null
  }
  return nodes.map(walk).filter(Boolean) as TreeNode[]
}

// Every id in a tree — used to expand all branches while a filter is active.
const allNodeIds = (nodes: TreeNode[]): string[] =>
  nodes.flatMap((n) => [n.id, ...(n.children ? allNodeIds(n.children) : [])])

// The product nodes only (the box-icon levels), flattened — for "Show products",
// which lists just the levels that actually hold a product, not their ancestors
// (the dot/pallino nodes only *contain* a product deeper down).
function collectProductNodes(nodes: TreeNode[]): TreeNode[] {
  const out: TreeNode[] = []
  const walk = (n: TreeNode) => {
    if (productIds.has(n.id)) out.push({ ...n, children: undefined })
    n.children?.forEach(walk)
  }
  nodes.forEach(walk)
  return out
}
const productNodesFlat = collectProductNodes(valueTree)

// Draggable column splitter — a wide invisible hit area over a hairline, with a
// small grab handle. Dragging left/right resizes the left (tree) column so a long
// value-network unit title can be fully revealed. Replaces the plain vertical
// Divider between the tree and the detail.
function ResizableDivider({ width, setWidth, min, max }: { width: number; setWidth: (w: number) => void; min: number; max: number }) {
  const onMouseDown = (e: ReactMouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = width
    const move = (ev: MouseEvent) => setWidth(Math.min(max, Math.max(min, startW + (ev.clientX - startX))))
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize the value network tree column"
      onMouseDown={onMouseDown}
      style={{
        flexShrink: 0,
        alignSelf: 'stretch',
        // A 12px hit area, negatively margined so it doesn't eat into the gap.
        width: 'var(--space-300)',
        margin: '0 calc(-1 * var(--space-150))',
        cursor: 'col-resize',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'none',
      }}
    >
      {/* Hairline + a short pill handle centred on it to signal draggability. */}
      <div style={{ position: 'relative', alignSelf: 'stretch', width: 1, background: 'var(--border-card)' }}>
        <span
          aria-hidden
          style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 'var(--space-100)', height: 'var(--space-700)', borderRadius: 'var(--radius-full)', background: 'var(--border-default-default)' }}
        />
      </div>
    </div>
  )
}

// Value Network view — the taxonomy tree on the left (with a search box in place
// of the old heading) and the selected node's detail on the right. Extracted from
// the market-page card so the exact same tree + detail can be reused inside the
// sales Value Network modal. `onNeeds` handles the detail's Needs button;
// `modal` = rendered in the sales modal (pairs stakeholders with contact people
// and force-enables the Needs button).
export function ValueNetworkView({ onNeeds, modal, initialSelectedId, peopleByUnitRole }: { onNeeds: (stk?: string, slug?: string) => void; modal?: boolean; initialSelectedId?: string; peopleByUnitRole?: Record<string, Record<string, Person[]>> }) {
  // Open focused on a specific node (e.g. a product picked in the coverage view),
  // falling back to the root. Its ancestor chain seeds the tree's expanded set so
  // the node is visible on mount.
  const initialChain = useMemo(() => (initialSelectedId ? findNodePath(valueTree, initialSelectedId) : []), [initialSelectedId])
  const [selected, setSelected] = useState<TreeNode>(initialChain.length ? initialChain[initialChain.length - 1] : valueTree[0])
  const [query, setQuery] = useState('')
  // "Show only segments with products": the left tree becomes a flat list of just
  // the product nodes (the box-icon levels). Clicking a higher level in the Path
  // (right) exits this and reveals the full tree, focused on that node.
  const [showProducts, setShowProducts] = useState(false)
  const path = useMemo(() => findNodePath(valueTree, selected.id), [selected.id])
  const filtered = useMemo(() => filterTree(valueTree, query), [query])
  // Search wins; then the flat product-only list; otherwise the full tree expanded
  // down to (and including) the selected node.
  const treeNodes = query ? filtered : (showProducts ? productNodesFlat : valueTree)
  const expandedIds = query ? allNodeIds(filtered) : (showProducts ? undefined : path.map((n) => n.id))

  // Draggable left-column width — start at 360, widen to reveal long unit titles.
  const [treeWidth, setTreeWidth] = useState(360)

  // Cap the whole view at the remaining viewport height so the card never grows
  // taller than the screen on desktop; each column then scrolls internally and the
  // row scrolls horizontally once the tree is widened. Skipped in the sales modal,
  // which sizes itself. Measured from the row's top to the viewport bottom.
  const rootRef = useRef<HTMLDivElement>(null)
  const [availH, setAvailH] = useState<number | null>(null)
  useLayoutEffect(() => {
    if (modal) return
    const el = rootRef.current
    if (!el) return
    const recompute = () => {
      const top = el.getBoundingClientRect().top
      setAvailH(Math.max(360, window.innerHeight - top - 32))
    }
    recompute()
    window.addEventListener('resize', recompute)
    return () => window.removeEventListener('resize', recompute)
  }, [modal])

  return (
    <div
      ref={rootRef}
      style={{
        display: 'flex',
        flexDirection: 'row',
        gap: 'var(--space-300)',
        width: '100%',
        // Desktop: bound to the viewport and scroll the row horizontally (the tree
        // can be widened past the container). Columns scroll vertically inside.
        ...(modal ? {} : { height: availH ?? undefined, overflowX: 'auto', overflowY: 'hidden' }),
      }}
    >
      <div
        style={{
          // Resizable, fixed-basis left column. overflow:hidden on the wrapper so
          // only the tree area below scrolls; the search + checkbox stay pinned.
          flex: `0 0 ${treeWidth}px`,
          width: treeWidth,
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-200)',
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        <SearchBar
          className="vn-searchbar"
          size="sm"
          placeholder="Search value network…"
          aria-label="Search the value network"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery('')}
        />
        <Checkbox
          label="Show only value network units with products"
          checked={showProducts}
          onChange={(e) => setShowProducts(e.target.checked)}
        />
        {/* Scroll the (long) tree vertically; clip horizontally — widen the column
            with the divider (or scroll the row) to see deep rows in full. */}
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
          <TreeView
            // Remount when the query or the products toggle changes so the expanded
            // set is re-seeded (and non-matching branches collapse).
            key={`${query}|${showProducts}`}
            nodes={treeNodes}
            defaultExpandedIds={expandedIds}
            selectedId={selected.id}
            onSelect={setSelected}
            style={{ overflow: 'visible' }}
          />
        </div>
      </div>
      <ResizableDivider width={treeWidth} setWidth={setTreeWidth} min={280} max={720} />
      {/* Detail column — keeps a min width so widening the tree pushes the row into
          horizontal scroll rather than crushing the detail; scrolls vertically. */}
      <div style={{ flex: '1 0 480px', minWidth: 480, minHeight: 0, overflowY: modal ? 'visible' : 'auto' }}>
        <MarketDetail
          node={selected}
          path={path}
          // Clicking a higher level in the Path exits "show only segments with
          // products" and reveals the full value network on the left, at that node.
          onSelect={(n) => { setSelected(n); if (n.id !== selected.id) setShowProducts(false) }}
          onNeeds={onNeeds}
          modal={modal}
          peopleByUnitRole={peopleByUnitRole}
        />
      </div>
    </div>
  )
}

// Card header text per tab (the tab bar now lives outside the card).
const PRODUCTS_TAB_DESCRIPTION =
  'The products we sell in this market and the value-network unit(s) each is sold into — a product can serve several. Open a unit to explore it in the full network.'
const NETWORK_TAB_DESCRIPTION =
  `The full ecosystem of functional units this market needs to produce its output — ${vnMeta.units.toLocaleString()} units organised across levels, from the top-level production system down to granular service lines.`

// Products tab — one kit CardTable per product: a box icon + the product name
// (kept compact) fills the left column; the value-network unit(s) it's sold into
// fill the right slot as kit NaicsRows (level badge + unit name + arrow). A
// product can serve several units, so this reads one-product-to-many instead of
// repeating the product once per unit. Opening a unit reveals the full network
// focused on that node.
function ProductPanel({ onOpenNode }: { onOpenNode: (nodeId: string) => void }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-300)', width: '100%' }}>
      {companyProductGroups.map((g) => (
        <CardTable
          key={g.name}
          title={
            <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-200)' }}>
              <Cube size={18} weight="regular" style={{ flexShrink: 0, color: 'var(--text-headings)' }} />
              <Text variant="b1" weight="medium" as="span" style={{ color: 'var(--text-headings)' }}>{g.name}</Text>
            </span>
          }
          mainWidth="42%"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-150)', width: '100%' }}>
            {g.units.map((u) => (
              <NaicsRow
                key={u.nodeId}
                code={u.badge}
                name={u.name}
                size="sm"
                onOpen={() => onOpenNode(u.nodeId)}
              />
            ))}
          </div>
        </CardTable>
      ))}
    </div>
  )
}

// Market workspace: the Products / Value network tabs sit OUTSIDE the card; the
// card below renders the active tab. The two are linked — the arrow in a product's
// detail jumps to the network focused on that node. Only the active tab is mounted,
// so entering the network always re-seeds on the current focus node.
function MarketWorkspace() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<'products' | 'network'>('network')
  // The node the network opens on — set when a product's arrow is pressed, else
  // null (root). Kept across tab switches so the network reopens where you left.
  const [focusNodeId, setFocusNodeId] = useState<string | null>(null)
  const onNeeds = (stk?: string, slug?: string) => {
    const p = new URLSearchParams()
    if (slug) p.set('unit', slug)
    if (stk) p.set('stk', stk)
    const qs = p.toString()
    navigate(qs ? `/odi-matrix?${qs}` : '/odi-matrix')
  }

  const openProductNode = (nodeId: string) => { setFocusNodeId(nodeId); setTab('network') }
  const products = tab === 'products'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-300)', width: '100%', marginTop: 'var(--space-300)' }}>
      {/* Tab bar — outside the card. */}
      <div style={{ display: 'flex', gap: 'var(--space-200)' }}>
        <Tab size="sm" selected={!products} onClick={() => setTab('network')} prefixIcon={<TreeStructure size={16} weight="regular" />}>
          Value network
        </Tab>
        <Tab size="sm" selected={products} onClick={() => setTab('products')} prefixIcon={<Cube size={16} weight="regular" />}>
          Your products
        </Tab>
      </div>
      {/* No card title/icon — the selected tab already names the section, so a
          repeated heading would be a redundant double-heading. Keep only the
          description as intro context. */}
      <WidgetCard
        description={products ? PRODUCTS_TAB_DESCRIPTION : NETWORK_TAB_DESCRIPTION}
      >
        {products ? (
          <ProductPanel onOpenNode={openProductNode} />
        ) : (
          <ValueNetworkView onNeeds={onNeeds} initialSelectedId={focusNodeId ?? undefined} />
        )}
      </WidgetCard>
    </div>
  )
}

export default function MarketPage() {
  const navigate = useNavigate()
  const stats = (
    <div style={{ display: 'flex', gap: 'var(--space-200)' }}>
      {headerStats.map((stat) => (
        <HeaderStat key={stat.label} label={stat.label} value={stat.value} tip={stat.tip} />
      ))}
    </div>
  )

  return (
    <PageTemplate
      sidebar={<ReportSidebar />}
      actions={<ReportActions />}
      // Above the title: a back button to the NAICS market picker, then the
      // market's NAICS code and confidence (moved up here from the description).
      beforeTitle={
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-200)' }}>
          <BackButton label="Back to markets" onClick={() => navigate('/product-management')} />
          <Badge variant="color" size="sm">NAICS: {vnMeta.naics}</Badge>
          <ConfidenceBadge value={96} />
        </span>
      }
      title={vnMeta.market}
      titleId={slugify(vnMeta.market)}
      description={<span style={{ display: 'block' }}>{NAICS_DESCRIPTION}</span>}
      titleAside={stats}
    >
      <MarketWorkspace />
    </PageTemplate>
  )
}

// Small headline stat: a label + info icon (with tooltip) over a medium Number,
// on the lighter surface. Not a single kit component, so composed from tokens.
function HeaderStat({ label, value, tip }: { label: string; value: string; tip?: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-200)',
        padding: 'var(--space-300)',
        borderRadius: 'var(--radius-md)',
        background: 'var(--surface-default-default)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-200)' }}>
        <Text variant="label-s">{label}</Text>
        <InfoTooltip tooltip={tip} size={16} label={`About ${label}`} style={{ color: 'var(--text-labels)' }} />
      </div>
      <Number color="none" numberSize="md" style={{ alignSelf: 'flex-start' }}>
        {value}
      </Number>
    </div>
  )
}
