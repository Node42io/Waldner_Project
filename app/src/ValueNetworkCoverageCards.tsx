import { useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { ArrowElbowDownRight, CaretDown, CaretRight, Cube, Prohibit } from '@phosphor-icons/react'
import { Badge, DonutChart, Divider, PageTemplate, SegmentBar, Section, Text } from '@node42/ui-kit'
import { ReportActions } from './ReportActions'
import { ReportSidebar } from './ReportSidebar'
import versus from './data/versus.json'

// Value Network Coverage (cards) — an alternative layout of the Waldner vs Brinox
// coverage view: two overview cards (per-company coverage bars + a split donut for
// a chosen level) above the coverage tree + detail. Same real data as the classic
// page (scripts/export_versus.py → Product-[:matches_vn_unit] over NAICS 325412);
// the classic page lives at /value-network-coverage.
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

// Shared coverage colours — Waldner (yellow) vs Brinox (tertiary blue); the
// shared/in-common slice is a lighter tertiary, no-coverage a faint neutral.
const COV = {
  waldner: 'var(--yellow-default)',
  brinox: 'var(--tertiary-default)',
  common: 'var(--tertiary-200)',
  none: 'var(--border-default-default)',
}

// Per-level coverage for the overview cards: total units at the level, how many
// each company covers (own products), and how many are covered by both.
const LEVEL_ORDER = ['L7', 'L6', 'L6a', 'L5', 'L4', 'L3']
type LevelCoverage = { level: string; u: number; w: number; b: number; both: number }
function coverageByLevel(root: VMU): LevelCoverage[] {
  const m = new Map<string, { u: number; w: number; b: number; both: number }>()
  const walk = (n: VMU) => {
    const e = m.get(n.level) ?? { u: 0, w: 0, b: 0, both: 0 }
    e.u++
    const cw = n.waldner.length > 0
    const cb = n.brinox.length > 0
    if (cw) e.w++
    if (cb) e.b++
    if (cw && cb) e.both++
    m.set(n.level, e)
    n.children.forEach(walk)
  }
  walk(root)
  return LEVEL_ORDER.filter((l) => m.has(l)).map((l) => ({ level: l, ...m.get(l)! }))
}

const COL_W = 96 // Waldner / Brinox column width
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

// One product card in the detail panel: cube + name (+ description when present).
function ProductCard({ p }: { p: Product }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-100)', padding: 'var(--space-300)', borderRadius: 'var(--radius-md)', background: 'var(--surface-default-default-2)' }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-200)' }}>
        <Cube size={16} weight="regular" style={{ flexShrink: 0, color: 'var(--text-headings)' }} />
        <Text variant="b1" weight="medium" as="span" style={{ flex: 1, minWidth: 0, color: 'var(--text-headings)' }}>{p.name}</Text>
      </span>
      {p.desc ? <Text variant="b3" as="span" style={{ color: 'var(--text-labels)' }}>{p.desc}</Text> : null}
    </div>
  )
}

export default function ValueNetworkCoverageCards() {
  // Expand the spine down to the first covered level so the tree opens informative.
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const s = new Set<string>()
    const seed = (n: VMU, depth: number) => { if (depth < 3) s.add(n.id); n.children.forEach((c) => seed(c, depth + 1)) }
    seed(TREE, 0)
    return s
  })
  const [selectedId, setSelectedId] = useState<string>(TREE.id)

  const byLevel = useMemo(() => coverageByLevel(TREE), [])
  // Overview cards summarise one level — default to the level with the most
  // combined coverage (L5 for the SFF network), selectable via the chips.
  const defaultLevel = useMemo(
    () => byLevel.slice().sort((a, b) => (b.w + b.b) - (a.w + a.b))[0]?.level ?? 'L5',
    [byLevel],
  )
  const [ovLevel, setOvLevel] = useState<string>(defaultLevel)

  const path = useMemo(() => findPath(TREE, selectedId) ?? [TREE], [selectedId])
  const selected = path[path.length - 1]

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const renderNode = (node: VMU, depth: number, ancestorsLast: boolean[], isLast: boolean): ReactNode[] => {
    const isSel = node.id === selectedId
    const hasKids = node.children.length > 0
    const isOpen = expanded.has(node.id)
    const out: ReactNode[] = []
    out.push(
      <div
        key={node.id}
        onClick={() => setSelectedId(node.id)}
        style={{ display: 'flex', alignItems: 'stretch', minHeight: 40, cursor: 'pointer', borderRadius: 'var(--radius-sm)', background: isSel ? 'var(--surface-default-default-2)' : 'transparent' }}
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
            <Text variant="b2" weight={isSel ? 'medium' : undefined} as="span" style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: isSel ? 'var(--text-action-tertiary)' : 'var(--text-headings)' }}>{node.name}</Text>
          </span>
        </span>
        <span style={{ width: COL_W, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CoverageMark node={node} co="waldner" /></span>
        <span style={{ width: COL_W, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><CoverageMark node={node} co="brinox" /></span>
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

  // The overview cards focus on the chosen level. Left = per-company coverage bars
  // (share of the level each covers); right = a donut of the level's split.
  const lv = byLevel.find((r) => r.level === ovLevel) ?? { level: ovLevel, u: 0, w: 0, b: 0, both: 0 }
  const onlyW = Math.max(0, lv.w - lv.both)
  const onlyB = Math.max(0, lv.b - lv.both)
  const noneLv = Math.max(0, lv.u - lv.both - onlyW - onlyB)
  const donutData = [
    { value: lv.both, label: 'In common', color: COV.common },
    { value: onlyW, label: 'Only Waldner', color: COV.waldner },
    { value: onlyB, label: 'Only Brinox', color: COV.brinox },
    { value: noneLv, label: 'No coverage', color: COV.none },
  ]
  const dot = (color: string) => <span style={{ width: 'var(--space-200)', height: 'var(--space-200)', borderRadius: '50%', background: color, flexShrink: 0 }} />
  const miniHdr: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 'var(--space-100)', fontFamily: 'var(--font-family-sans)', fontSize: 'var(--font-size-b3)', color: 'var(--text-body)' }
  const miniVal: CSSProperties = { ...mono, fontSize: 'var(--font-size-b3)', color: 'var(--text-headings)' }
  // One company's coverage bar — name + a same-scale proportional bar + count/%.
  const covBar = (name: string, val: number, total: number, color: string) => {
    const pct = total > 0 ? Math.round((val / total) * 100) : 0
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-300)' }}>
        <span style={{ ...miniHdr, width: 76, flexShrink: 0 }}>{dot(color)}{name}</span>
        <div style={{ flex: 1, minWidth: 0 }}><SegmentBar total={total} segments={[{ value: val, color }]} height={12} /></div>
        <span style={{ ...miniVal, width: 68, flexShrink: 0, textAlign: 'right' }}>{val}/{total} · {pct}%</span>
      </div>
    )
  }

  // Level selector chips shared by both overview cards.
  const levelChips = (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-100)' }}>
      {byLevel.map((r) => {
        const active = r.level === ovLevel
        return (
          <button
            key={r.level}
            type="button"
            onClick={() => setOvLevel(r.level)}
            aria-pressed={active}
            style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', opacity: active ? 1 : 0.5, transition: 'opacity 120ms ease' }}
          >
            <Badge variant="color" size="xs" style={levelStyle(r.level)}>{r.level}</Badge>
          </button>
        )
      })}
    </span>
  )

  return (
    <PageTemplate
      sidebar={<ReportSidebar />}
      sidebarDefaultCollapsed
      actions={<ReportActions />}
      title="Value Network Coverage"
      titleAside={
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-200)' }}>
          <Badge variant="neutral" size="sm" style={mono}>{data.meta.naics}</Badge>
          <Badge variant="color" size="sm" style={{ ...mono, background: COV.waldner, color: 'var(--secondary-700)' }}>Waldner</Badge>
          <Badge variant="color" size="sm" style={{ ...mono, background: COV.brinox, color: 'var(--white)' }}>Brinox</Badge>
        </div>
      }
      description={`Where Waldner and Brinox cover the ${data.meta.naics_title} value network — product counts per unit, with the products behind each.`}
    >
      <div style={{ marginTop: 'var(--space-300)', height: 'calc(100vh - 150px)', minHeight: 600, display: 'flex', flexDirection: 'column', gap: 'var(--space-300)' }}>

      {/* Two overview cards for the chosen level: coverage bars + split donut. */}
      <div style={{ display: 'flex', gap: 'var(--space-300)', flexWrap: 'wrap', alignItems: 'stretch' }}>
        <div style={{ flex: '1 1 340px', minWidth: 0, padding: 'var(--space-300)', borderRadius: 'var(--radius-lg)', background: 'var(--surface-default-default)', boxShadow: 'var(--shadow-s)', display: 'flex', flexDirection: 'column', gap: 'var(--space-300)' }}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-200)' }}>
            <Text variant="label-s" as="span">Coverage</Text>
            {levelChips}
          </span>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'var(--space-300)' }}>
            {covBar('Waldner', lv.w, lv.u, COV.waldner)}
            {covBar('Brinox', lv.b, lv.u, COV.brinox)}
          </div>
        </div>

        <div style={{ flex: '1 1 340px', minWidth: 0, padding: 'var(--space-300)', borderRadius: 'var(--radius-lg)', background: 'var(--surface-default-default)', boxShadow: 'var(--shadow-s)', display: 'flex', flexDirection: 'column', gap: 'var(--space-300)' }}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-200)' }}>
            <Text variant="label-s" as="span">Split</Text>
            <Badge variant="color" size="xs" style={levelStyle(lv.level)}>{lv.level}</Badge>
          </span>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 'var(--space-500)' }}>
            <DonutChart data={donutData} size={116} thickness={16} gap={6} title={`${lv.level} coverage split`}>
              <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <span style={{ ...mono, fontWeight: 'var(--font-weight-medium)', fontSize: 'var(--font-size-b1)', color: 'var(--text-headings)' }}>{lv.u}</span>
                <span style={{ fontFamily: 'var(--font-family-sans)', fontSize: 'var(--font-size-b4)', color: 'var(--text-labels)' }}>units</span>
              </span>
            </DonutChart>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-150)' }}>
              {donutData.map((d) => (
                <span key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-200)' }}>
                  {dot(d.color)}
                  <span style={{ fontFamily: 'var(--font-family-sans)', fontSize: 'var(--font-size-b3)', color: 'var(--text-body)' }}>{d.label}</span>
                  <span style={{ ...mono, fontSize: 'var(--font-size-b3)', color: 'var(--text-headings)', marginLeft: 'auto' }}>{d.value}</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tree + detail box. */}
      <div style={{ flex: '1 1 auto', minHeight: 320, padding: 'var(--space-400)', borderRadius: 'var(--radius-lg)', background: 'var(--surface-default-default)', boxShadow: 'var(--shadow-s)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 'var(--space-400)', alignItems: 'stretch', width: '100%', flex: '1 1 auto', minHeight: 0 }}>
        <div style={{ flex: '3 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 'var(--space-200)', minHeight: 0 }}>
          <Text variant="label-s" as="span">Value network</Text>
          <div style={{ display: 'flex', alignItems: 'flex-end', padding: '0 var(--space-200)' }}>
            <span style={{ flex: '1 1 0' }} />
            <span style={{ ...headCell, width: COL_W }}>Waldner</span>
            <span style={{ ...headCell, width: COL_W }}>Brinox</span>
          </div>
          <Divider />
          <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>{tree}</div>
          </div>
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
        <div style={{ flex: '2 1 0', minWidth: 0, alignSelf: 'stretch', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-300)' }}>
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
      </div>
    </PageTemplate>
  )
}
