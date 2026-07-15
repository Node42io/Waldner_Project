import { useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { ArrowElbowDownRight, ArrowRight, CaretDown, CaretRight, Cube, Prohibit } from '@phosphor-icons/react'
import { Badge, Divider, PageTemplate, Section, Text } from '@node42/ui-kit'
import { ReportActions } from './ReportActions'
import { ReportSidebar } from './ReportSidebar'
import versus from './data/versus.json'

// Value Network Coverage — Waldner vs Brinox coverage over the NAICS 325412
// value network. Real data from Neo4j (Product-[:matches_vn_unit]) via
// scripts/export_versus.py: each unit shows how many Waldner / Brinox products
// cover it, with the products in the detail panel.
type Company = 'waldner' | 'brinox'
type Product = { name: string; desc: string }
type VMU = { id: string; name: string; level: string; cfj?: string; waldner: Product[]; brinox: Product[]; children: VMU[] }

type VNode = {
  id: string; name: string; level: string; cfj?: string
  waldnerProducts?: string[]; brinoxProducts?: string[]; children?: VNode[]
}
const data = versus as unknown as {
  meta: { naics: string; naics_title: string; root: string }
  root: VNode
}

// Map the exported coverage tree into the view's VMU shape.
const toVMU = (n: VNode): VMU => ({
  id: n.id,
  name: n.name,
  level: n.level,
  cfj: n.cfj,
  waldner: (n.waldnerProducts ?? []).map((p) => ({ name: p, desc: '' })),
  brinox: (n.brinoxProducts ?? []).map((p) => ({ name: p, desc: '' })),
  children: (n.children ?? []).map(toVMU),
})
const TREE = toVMU(data.root)

// Level badge colours — copied from the Market page value network.
const LEVEL_STYLE: Record<string, { bg: string; fg: string }> = {
  L7: { bg: 'var(--tertiary-800)', fg: 'var(--white)' },
  L6: { bg: 'var(--tertiary-default)', fg: 'var(--white)' },
  L6a: { bg: 'var(--tertiary-400)', fg: 'var(--white)' },
  L5: { bg: 'var(--tertiary-200)', fg: 'var(--secondary-700)' },
  L4: { bg: 'var(--tertiary-100)', fg: 'var(--secondary-700)' },
  L3: { bg: 'var(--tertiary-50)', fg: 'var(--secondary-700)' },
}
const mono: CSSProperties = { fontFamily: 'var(--font-family-mono)', fontWeight: 'var(--font-weight-medium)' }
const levelStyle = (level: string): CSSProperties => {
  const c = LEVEL_STYLE[level] ?? { bg: 'var(--surface-default-default-2)', fg: 'var(--text-body)' }
  return { ...mono, background: c.bg, color: c.fg }
}

const anyProduct = (n: VMU, co: Company): boolean => n[co].length > 0 || n.children.some((c) => anyProduct(c, co))
function findPath(node: VMU, id: string, trail: VMU[] = []): VMU[] | null {
  const next = [...trail, node]
  if (node.id === id) return next
  for (const c of node.children) {
    const found = findPath(c, id, next)
    if (found) return found
  }
  return null
}

const COL_W = 96 // Waldner / Brinox column width
const SUB_W = 76 // sub-levels column width
const GUIDE = 'var(--border-default-default-lighter)'
const dotStyle: CSSProperties = { width: 'var(--space-200)', height: 'var(--space-200)', borderRadius: '50%', background: 'var(--primary-600)', flexShrink: 0, boxShadow: '0 0 0 var(--space-50) var(--surface-default-default)' }

// One company cell: the unit's own product count in a cube badge, a dot when only
// its sub-levels hold products, or the no-products glyph.
function CoverageMark({ node, co }: { node: VMU; co: Company }) {
  const own = node[co].length
  if (own > 0) {
    return (
      <Badge variant="neutral" size="xs" style={mono}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-50)' }}>
          {own}
          <Cube size={12} weight="regular" />
        </span>
      </Badge>
    )
  }
  if (node.children.some((c) => anyProduct(c, co))) {
    return <span style={dotStyle} aria-label="Products in sub-levels" />
  }
  return <Prohibit size={16} weight="regular" style={{ color: 'var(--icon-description)' }} />
}

// One product card in the detail panel: cube + name + arrow, and a description.
function ProductCard({ p }: { p: Product }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-100)', padding: 'var(--space-300)', borderRadius: 'var(--radius-md)', background: 'var(--surface-default-default-2)' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-200)' }}>
        <Cube size={16} weight="regular" style={{ flexShrink: 0, color: 'var(--text-headings)' }} />
        <Text variant="b1" weight="medium" as="span" style={{ flex: 1, minWidth: 0, color: 'var(--text-headings)' }}>{p.name}</Text>
        <ArrowRight size={16} weight="regular" style={{ flexShrink: 0, color: 'var(--icon-description)' }} />
      </span>
      {p.desc ? <Text variant="b3" as="span" style={{ color: 'var(--text-labels)' }}>{p.desc}</Text> : null}
    </div>
  )
}

export default function ValueNetworkCoverage() {
  // Collapsed by default to L7 + L6: expand only the root so its L6 process
  // stages show, with everything below (L6a/L5/…) collapsed.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([TREE.id]))
  const [selectedId, setSelectedId] = useState<string>(TREE.id)

  const path = useMemo(() => findPath(TREE, selectedId) ?? [TREE], [selectedId])
  const selected = path[path.length - 1]

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  // Recursively render tree rows with left-edge connector guides (like the kit
  // TreeView): a vertical line per continuing ancestor, plus this node's elbow.
  const renderNode = (node: VMU, depth: number, ancestorsLast: boolean[], isLast: boolean): ReactNode[] => {
    const isSel = node.id === selectedId
    const hasKids = node.children.length > 0
    const isOpen = expanded.has(node.id)
    const out: ReactNode[] = []
    out.push(
      <div
        key={node.id}
        onClick={() => setSelectedId(node.id)}
        style={{ display: 'flex', alignItems: 'stretch', minHeight: 40, cursor: 'pointer', borderRadius: 'var(--radius-sm)', background: isSel ? 'var(--surface-default-selected)' : 'transparent' }}
      >
        <span style={{ display: 'flex', alignItems: 'stretch', flex: '1 1 0', minWidth: 0 }}>
          {ancestorsLast.map((last, i) => (
            <span key={i} style={{ position: 'relative', width: 20, flexShrink: 0 }}>
              {!last ? <span style={{ position: 'absolute', left: 9, top: 0, bottom: 0, width: 1, background: GUIDE }} /> : null}
            </span>
          ))}
          {depth > 0 ? (
            <span style={{ position: 'relative', width: 20, flexShrink: 0 }}>
              <span style={{ position: 'absolute', left: 9, top: 0, height: isLast ? '50%' : '100%', width: 1, background: GUIDE }} />
              <span style={{ position: 'absolute', top: '50%', left: 9, right: 2, height: 1, background: GUIDE }} />
            </span>
          ) : null}
          <span style={{ flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'center', gap: 'var(--space-200)', padding: '0 var(--space-200)' }}>
            {hasKids ? (
              <button type="button" onClick={(e) => { e.stopPropagation(); toggle(node.id) }} aria-label={isOpen ? 'Collapse' : 'Expand'} style={{ flexShrink: 0, display: 'grid', placeItems: 'center', width: 20, height: 20, border: 0, background: 'transparent', padding: 0, cursor: 'pointer', color: 'var(--icon-description)' }}>
                {isOpen ? <CaretDown size={14} weight="bold" /> : <CaretRight size={14} weight="bold" />}
              </button>
            ) : (
              <span style={{ flexShrink: 0, width: 20 }} />
            )}
            <Badge variant="color" size="xs" style={levelStyle(node.level)}>{node.level}</Badge>
            <Text variant="b2" weight={isSel ? 'medium' : undefined} as="span" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-headings)' }}>{node.name}</Text>
          </span>
        </span>
        <span style={{ width: COL_W, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CoverageMark node={node} co="waldner" /></span>
        <span style={{ width: COL_W, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CoverageMark node={node} co="brinox" /></span>
        <span style={{ width: SUB_W, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', ...mono, fontSize: 'var(--font-size-b3)', color: hasKids ? 'var(--text-headings)' : 'var(--text-labels)' }}>
          {hasKids ? node.children.length : '–'}
        </span>
      </div>,
    )
    if (hasKids && isOpen) {
      node.children.forEach((c, i) => {
        out.push(...renderNode(
          c,
          depth + 1,
          depth === 0 ? [] : [...ancestorsLast, isLast],
          i === node.children.length - 1,
        ))
      })
    }
    return out
  }

  const treeRows = renderNode(TREE, 0, [], true)
  const tree = treeRows.flatMap((row, i) => (i === 0 ? [row] : [<Divider key={`d${i}`} />, row]))

  const headCell: CSSProperties = { flexShrink: 0, textAlign: 'center', fontFamily: 'var(--font-family-mono)', fontSize: 'var(--font-size-b4)', textTransform: 'uppercase', color: 'var(--text-labels)', letterSpacing: '0.04em' }
  const legendText: CSSProperties = { fontFamily: 'var(--font-family-sans)', fontSize: 'var(--font-size-b4)', color: 'var(--text-labels)' }

  return (
    <PageTemplate
      sidebar={<ReportSidebar />}
      sidebarDefaultCollapsed
      actions={<ReportActions />}
      title="Value Network Coverage"
      titleAside={
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-200)' }}>
          <Badge variant="neutral" size="sm" style={mono}>{data.meta.naics}</Badge>
          <Badge variant="information" size="sm">Waldner vs Brinox</Badge>
        </div>
      }
      description={`Where Waldner and Brinox cover the ${data.meta.naics_title} value network — product counts per unit, with the products behind each.`}
    >
      <div style={{ marginTop: 'var(--space-300)', padding: 'var(--space-400)', borderRadius: 'var(--radius-lg)', background: 'var(--surface-default-default)', boxShadow: 'var(--shadow-s)' }}>
      <div style={{ display: 'flex', gap: 'var(--space-400)', alignItems: 'stretch', width: '100%' }}>
        {/* Value Network — the coverage tree with Waldner / Brinox / sub-levels columns. */}
        <div style={{ flex: '3 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-200)' }}>
          <Text variant="label-s" as="span">Value network</Text>
          <div style={{ display: 'flex', alignItems: 'flex-end', padding: '0 var(--space-200)' }}>
            <span style={{ flex: '1 1 0' }} />
            <span style={{ ...headCell, width: COL_W }}>Waldner</span>
            <span style={{ ...headCell, width: COL_W }}>Brinox</span>
            <span style={{ ...headCell, width: SUB_W, lineHeight: 'var(--line-height-b4)' }}>Total sub-levels</span>
          </div>
          <Divider />
          <div style={{ display: 'flex', flexDirection: 'column' }}>{tree}</div>
          <Divider />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-400)', alignItems: 'center', padding: '0 var(--space-200)' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-100)' }}>
              <Badge variant="neutral" size="xs" style={mono}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-50)' }}>N<Cube size={12} weight="regular" /></span></Badge>
              <span style={legendText}>Products in unit</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-100)' }}>
              <span style={dotStyle} />
              <span style={legendText}>Products in sub-levels</span>
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-100)' }}>
              <Prohibit size={14} weight="regular" style={{ color: 'var(--icon-description)' }} />
              <span style={legendText}>No products</span>
            </span>
          </div>
        </div>

        <Divider orientation="vertical" />
        {/* Detail — the selected unit's path, CFJ and per-company products. */}
        <div style={{ flex: '2 1 0', minWidth: 0, alignSelf: 'stretch' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-300)' }}>
              <Text variant="h4" as="h2" style={{ margin: 0, color: 'var(--text-headings)' }}>{selected.name}</Text>
              <Divider />
              <Section label="Path">
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-100)', width: '100%' }}>
                  {path.map((n, i) => {
                    const isSel = n.id === selectedId
                    return (
                      <button
                        type="button"
                        key={n.id}
                        onClick={() => setSelectedId(n.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-200)', minWidth: 0, width: '100%', margin: 0, padding: 'var(--space-100)', paddingLeft: `calc(var(--space-100) + var(--space-400) * ${i})`, border: 0, borderRadius: 'var(--radius-xs)', background: isSel ? 'var(--surface-default-default-2)' : 'transparent', cursor: 'pointer', textAlign: 'left', font: 'inherit' }}
                      >
                        {i > 0 ? <ArrowElbowDownRight size={14} weight="regular" style={{ flexShrink: 0, color: 'var(--text-labels)' }} /> : null}
                        <Badge variant="color" size="xs" style={levelStyle(n.level)}>{n.level}</Badge>
                        <Text variant="b2" weight={isSel ? 'medium' : undefined} as="span" style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isSel ? 'var(--text-headings)' : 'var(--text-body)' }}>{n.name}</Text>
                      </button>
                    )
                  })}
                </div>
              </Section>
              {selected.cfj ? (
                <>
                  <Divider />
                  <Section label="Core functional job">
                    <div style={{ padding: 'var(--space-300)', borderRadius: 'var(--radius-md)', background: 'var(--surface-default-default-2)', width: '100%' }}>
                      <Text variant="b1" as="p" style={{ margin: 0 }}>{selected.cfj}</Text>
                    </div>
                  </Section>
                </>
              ) : null}
              <Divider />
              <Section label="Waldner products">
                {selected.waldner.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-200)', width: '100%' }}>
                    {selected.waldner.map((p, i) => <ProductCard key={i} p={p} />)}
                  </div>
                ) : (
                  <Text variant="b3" as="p" style={{ margin: 0, color: 'var(--text-labels)' }}>No Waldner products in this unit.</Text>
                )}
              </Section>
              <Divider />
              <Section label="Brinox products">
                {selected.brinox.length ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-200)', width: '100%' }}>
                    {selected.brinox.map((p, i) => <ProductCard key={i} p={p} />)}
                  </div>
                ) : (
                  <Text variant="b3" as="p" style={{ margin: 0, color: 'var(--text-labels)' }}>No Brinox products in this unit.</Text>
                )}
              </Section>
            </div>
        </div>
      </div>
      </div>
    </PageTemplate>
  )
}
