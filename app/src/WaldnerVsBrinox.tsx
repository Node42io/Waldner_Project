import { useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Buildings, Cube } from '@phosphor-icons/react'
import {
  Badge,
  Breadcrumb,
  PageTemplate,
  Section,
  Text,
  TreeView,
  WidgetCard,
} from '@node42/ui-kit'
import type { BadgeVariant, TreeNode } from '@node42/ui-kit'
import { ReportActions } from './ReportActions'
import { ReportSidebar } from './ReportSidebar'
import versus from './data/versus.json'

// Waldner PAS vs Brinox — the same value-network view as the Market page, over
// the NAICS 325412 (Pharmaceutical Preparation Manufacturing) network, with each
// matched unit tagged W (Waldner only), B (Brinox only) or WB (both). Data comes
// straight from Neo4j (Product-[:matches_vn_unit]->ValueNetworkUnit) via
// scripts/export_versus.py.

type Tag = 'W' | 'B' | 'WB'
type Stats = { W: number; B: number; WB: number }
type VNode = {
  id: string
  name: string
  level: string
  cfj?: string
  tag?: Tag
  stats?: Stats
  dominant?: string
  waldnerProducts?: string[]
  brinoxProducts?: string[]
  children?: VNode[]
}

const data = versus as unknown as {
  meta: { naics: string; naics_title: string; root: string; waldner: string; brinox: string }
  question: string
  summary: { waldnerUnits: number; brinoxUnits: number; both: number; stages: number; waldnerStages: number; brinoxStages: number }
  stages: { name: string; w: number; b: number; wb: number; total: number; dominant: string }[]
  root: VNode
}

// Company colours. Waldner = information (blue), Brinox = warning (amber),
// both = success (green). All are ui-kit badge variants (tokens, never hex).
const TAG_VARIANT: Record<Tag, BadgeVariant> = { W: 'information', B: 'warning', WB: 'success' }
const TAG_LABEL: Record<Tag, string> = { W: 'Waldner', B: 'Brinox', WB: 'Both' }

const DOMINANCE: Record<string, { label: string; variant: BadgeVariant }> = {
  waldner: { label: 'Waldner-dominant', variant: 'information' },
  brinox: { label: 'Brinox-dominant', variant: 'warning' },
  contested: { label: 'Contested', variant: 'neutral' },
  shared: { label: 'Shared', variant: 'success' },
}

const mono: CSSProperties = { fontFamily: 'var(--font-family-mono)', fontWeight: 'var(--font-weight-medium)' }

// Per-level badge colour, matching the Market page's value-network tree.
const LEVEL_STYLE: Record<string, { bg: string; fg: string }> = {
  L7: { bg: 'var(--tertiary-800)', fg: 'var(--white)' },
  L6: { bg: 'var(--tertiary-default)', fg: 'var(--white)' },
  L6a: { bg: 'var(--tertiary-400)', fg: 'var(--white)' },
  L5: { bg: 'var(--tertiary-200)', fg: 'var(--secondary-700)' },
  L4: { bg: 'var(--tertiary-100)', fg: 'var(--secondary-700)' },
  L3: { bg: 'var(--tertiary-50)', fg: 'var(--secondary-700)' },
}
function levelStyle(level: string): CSSProperties {
  const c = LEVEL_STYLE[level] || { bg: 'var(--surface-default-default-2)', fg: 'var(--text-body)' }
  return { background: c.bg, color: c.fg }
}

// Row content: the W/B/WB marker on matched units, the name, the W·B·WB coverage
// tally on every aggregating level (so coverage reads at a glance at each level),
// and a dominance chip on the L6 process stages.
function rowText(n: VNode): ReactNode {
  const hasChildren = !!n.children?.length
  const tally = n.stats && hasChildren ? `W ${n.stats.W} · B ${n.stats.B} · WB ${n.stats.WB}` : null
  const dom = n.level === 'L6' && n.dominant ? DOMINANCE[n.dominant] : null
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-200)', minWidth: 0, flexWrap: 'wrap' }}>
      {n.tag ? <Badge variant={TAG_VARIANT[n.tag]} size="xs">{n.tag}</Badge> : null}
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.name}</span>
      {dom ? <Badge variant={dom.variant} size="xs">{dom.label}</Badge> : null}
      {tally ? <span style={{ ...mono, fontSize: 'var(--font-size-b4)', color: 'var(--text-labels)' }}>{tally}</span> : null}
    </span>
  )
}

const nodeById = new Map<string, VNode>()
function toTreeNode(n: VNode): TreeNode {
  nodeById.set(n.id, n)
  const node: TreeNode = { id: n.id, badge: n.level, text: rowText(n), badgeStyle: levelStyle(n.level) }
  if (n.children?.length) node.children = n.children.map(toTreeNode)
  return node
}
const tree: TreeNode[] = [toTreeNode(data.root)]
// Default view: L7 + L6 process stages only (expand the root); everything below
// stays collapsed until the user drills in.
const defaultExpanded = [data.root.id]

function Legend() {
  return (
    <div style={{ display: 'flex', gap: 'var(--space-400)', alignItems: 'center', flexWrap: 'wrap' }}>
      {(['W', 'B', 'WB'] as Tag[]).map((t) => (
        <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-100)' }}>
          <Badge variant={TAG_VARIANT[t]} size="xs">{t}</Badge>
          <Text variant="b3" as="span" style={{ color: 'var(--text-description)' }}>{TAG_LABEL[t]}</Text>
        </span>
      ))}
    </div>
  )
}

// Selected-unit detail: level · name · core job · the products each company
// matches into this unit.
function Detail({ node }: { node: VNode }) {
  const productBlock = (label: string, variant: BadgeVariant, items?: string[]) =>
    items && items.length ? (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-150)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-100)' }}>
          <Badge variant={variant} size="xs">{label}</Badge>
          <Text variant="b3" as="span" style={{ color: 'var(--text-labels)' }}>{items.length} product{items.length === 1 ? '' : 's'}</Text>
        </span>
        {items.map((p) => (
          <span key={p} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-100)', color: 'var(--text-body)' }}>
            <Cube size={14} weight="regular" style={{ color: 'var(--icon-description)', flexShrink: 0 }} />
            <Text variant="b3" as="span">{p}</Text>
          </span>
        ))}
      </div>
    ) : null

  const hasProducts = (node.waldnerProducts?.length ?? 0) + (node.brinoxProducts?.length ?? 0) > 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-300)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-200)', flexWrap: 'wrap' }}>
        <Badge variant="color" size="xs" style={levelStyle(node.level)}>{node.level}</Badge>
        {node.tag ? <Badge variant={TAG_VARIANT[node.tag]} size="xs">{TAG_LABEL[node.tag]}</Badge> : null}
        <Text variant="h5" as="h3" style={{ margin: 0 }}>{node.name}</Text>
      </div>
      {node.cfj ? (
        <Section label="Core Functional Job">
          <div style={{ padding: 'var(--space-400)', borderRadius: 'var(--radius-md)', background: 'var(--surface-default-default-2)', borderLeft: '3px solid var(--tertiary-default)' }}>
            <Text variant="b2" as="p" style={{ margin: 0, color: 'var(--text-headings)' }}>{node.cfj}</Text>
          </div>
        </Section>
      ) : null}
      {node.stats ? (
        <Section label="Matched units in this stage">
          <div style={{ display: 'flex', gap: 'var(--space-300)', flexWrap: 'wrap' }}>
            <Badge variant="information" size="sm">Waldner {node.stats.W}</Badge>
            <Badge variant="warning" size="sm">Brinox {node.stats.B}</Badge>
            <Badge variant="success" size="sm">Both {node.stats.WB}</Badge>
          </div>
        </Section>
      ) : null}
      {hasProducts ? (
        <Section label="Matched products">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-300)' }}>
            {productBlock('Waldner', 'information', node.waldnerProducts)}
            {productBlock('Brinox', 'warning', node.brinoxProducts)}
          </div>
        </Section>
      ) : (
        <Text variant="b3" as="p" style={{ color: 'var(--text-labels)', margin: 0 }}>
          Select a process stage or a matched unit (W / B / WB) to see the products behind it.
        </Text>
      )}
    </div>
  )
}

export default function WaldnerVsBrinox() {
  const [selectedId, setSelectedId] = useState<string>(data.root.id)
  const selected = nodeById.get(selectedId) ?? data.root
  const s = data.summary

  // Ancestor path of the selected node, so the tree accents the route to it.
  const highlighted = useMemo(() => {
    const path = new Set<string>()
    const walk = (n: VNode, trail: string[]): boolean => {
      if (n.id === selectedId) { trail.forEach((id) => path.add(id)); return true }
      return (n.children ?? []).some((c) => walk(c, [...trail, n.id]))
    }
    walk(data.root, [])
    return path
  }, [selectedId])

  return (
    <PageTemplate
      breadcrumb={<Breadcrumb items={[{ label: `NAICS ${data.meta.naics}: ${data.meta.naics_title}` }, { label: 'Waldner PAS vs Brinox' }]} />}
      title="Waldner PAS vs Brinox"
      titleLeading={<Buildings size={24} weight="regular" />}
      description={data.question}
      sidebar={<ReportSidebar />}
      actions={<ReportActions />}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-400)', marginTop: 'var(--space-400)' }}>
        {/* Legend + coverage summary — minimal, the tree tells the story. */}
        <div style={{ display: 'flex', gap: 'var(--space-500)', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          <Legend />
          <div style={{ display: 'flex', gap: 'var(--space-300)', flexWrap: 'wrap' }}>
            <Badge variant="information" size="sm">Waldner · {s.waldnerUnits} units</Badge>
            <Badge variant="warning" size="sm">Brinox · {s.brinoxUnits} units</Badge>
            <Badge variant="success" size="sm">Both · {s.both}</Badge>
            <Badge variant="neutral" size="sm">{s.stages} process stages</Badge>
          </div>
        </div>

        {/* Same value-network view as Product Management: the tree on the left,
            a detail panel on the right. */}
        <div style={{ display: 'flex', gap: 'var(--space-400)', alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <WidgetCard title="Value Network" icon={<Buildings size={18} weight="regular" />} style={{ flex: '1 1 460px', minWidth: 320 }}>
            <div style={{ maxHeight: '70vh', overflow: 'auto', marginTop: 'var(--space-200)' }}>
              <TreeView
                nodes={tree}
                selectedId={selectedId}
                onSelect={(n) => setSelectedId(n.id)}
                defaultExpandedIds={defaultExpanded}
                highlightedIds={highlighted}
              />
            </div>
          </WidgetCard>
          <WidgetCard title="Detail" style={{ flex: '1 1 380px', minWidth: 300 }}>
            <div style={{ marginTop: 'var(--space-200)' }}>
              <Detail node={selected} />
            </div>
          </WidgetCard>
        </div>
      </div>
    </PageTemplate>
  )
}
