import { Fragment, useEffect, useMemo, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { CaretDown } from '@phosphor-icons/react'
import { Badge, Table, Text, WidgetCard } from '@node42/ui-kit'
import type { BadgeVariant } from '@node42/ui-kit'

// Consolidated / Clusters view — the hierarchical roll-up that sits alongside the
// ODI Needs table: each CLUSTER (ConsolidatedNeed) expands to the CONSOLIDATED
// error statements (ConsolidatedErrorStatement) grouped under it. Scores are
// Ulwick ODI (importance × satisfaction → opportunity) and are frequently NULL
// (unscored) — every score cell is null-safe (em-dash, no badge) and the file is
// pre-ranked opportunity-DESC with unscored rows last.

// ---- export shape (mirrors scripts/export_consolidated.py) ----
interface ConsStmt {
  stmt: string
  imp: number | null; sat: number | null; opp: number | null
  imp_band: string; sat_band: string
  members: number; stakeholders: number; jobTypes: string[]
}
interface Cluster {
  need: string
  imp: number | null; sat: number | null; opp: number | null
  imp_band: string; sat_band: string
  cesCount: number; esCount: number; stakeholders: number
  jobTypes: string[]; track: string | null
  consolidated: ConsStmt[]
}
interface ConsolidatedData {
  unit: string; slug: string
  totals: { clusters: number; consolidated: number }
  clusters: Cluster[]
}

// Ulwick opportunity bands + band → badge helpers. Copied from ODIMatrix so the
// clusters view scores render identically to the ODI Needs table.
const OPP_HIGH = 12
const OPP_MODERATE = 10
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
function impVariant(band: string): BadgeVariant {
  return band === 'very high' || band === 'high' ? 'success' : 'neutral'
}
function satVariant(band: string): BadgeVariant {
  if (band === 'low' || band === 'very low') return 'error'
  if (band === 'medium') return 'warning'
  return 'success'
}

const mono: CSSProperties = { fontFamily: 'var(--font-family-mono)', fontWeight: 'var(--font-weight-medium)' }

// Vertical value cell: band badge on top, number below — so badges line up
// horizontally across the Opportunity/Importance/Satisfaction columns.
function stackCell(value: string, badge: ReactNode) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 'var(--space-200)' }}>
      {badge}
      <span style={{ ...mono, fontSize: 'var(--font-size-b1)', color: 'var(--text-headings)' }}>{value}</span>
    </div>
  )
}

// Null-safe score cell: unscored (null) renders a muted em-dash with no badge.
function scoreCell(v: number | null, variant: BadgeVariant, word: string) {
  if (v == null) return <span style={{ ...mono, color: 'var(--text-labels)' }}>—</span>
  return stackCell(v.toFixed(1), <Badge variant={variant} size="xs">{word}</Badge>)
}
const oppCell = (v: number | null) => scoreCell(v, v == null ? 'neutral' : oppVariant(v), v == null ? '' : oppWord(v))
const impCell = (v: number | null, band: string) => scoreCell(v, impVariant(band), band)
const satCell = (v: number | null, band: string) => scoreCell(v, satVariant(band), band)

// Compact mono figure for the count columns.
const numCell = (n: number) => <span style={{ ...mono, fontSize: 'var(--font-size-b1)', color: 'var(--text-headings)' }}>{n}</span>

// Sticky header: keep the header row fixed while the body scrolls.
const headerSticky: CSSProperties = { position: 'sticky', top: 0, zIndex: 2, background: 'var(--surface-default-default-3)' }

const jobBadges = (jobTypes: string[]) => (
  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-100)' }}>
    {jobTypes.map((t) => (
      <Badge key={t} variant="neutral" size="xs">{t}</Badge>
    ))}
  </div>
)

export function ConsolidatedView({ slug }: { slug: string }) {
  const [data, setData] = useState<ConsolidatedData | null>(null)
  const [err, setErr] = useState(false)
  const [open, setOpen] = useState<Set<number>>(new Set())

  useEffect(() => {
    let alive = true
    setData(null)
    setErr(false)
    setOpen(new Set())
    if (!slug) { setErr(true); return }
    fetch(`${import.meta.env.BASE_URL}data/consolidated/${slug}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => { if (alive) setData(d as ConsolidatedData) })
      .catch(() => { if (alive) setErr(true) })
    return () => { alive = false }
  }, [slug])

  const toggleRow = (i: number) =>
    setOpen((prev) => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })

  // Column-header metadata (opportunity-ranked cluster table). Not sortable —
  // the JSON is pre-ranked opportunity-DESC with unscored rows last.
  const headers = useMemo(
    () => [
      { label: 'Opp.', align: 'left' as const, info: 'Opportunity = importance + max(importance − satisfaction, 0). Higher = more underserved and more actionable. Blank = not yet scored.' },
      { label: 'Need', align: 'left' as const, info: 'The consolidated need statement this cluster represents (ConsolidatedNeed).' },
      { label: 'Job type', align: 'left' as const, info: "The cluster's ODI job types — core · emotional · status." },
      { label: 'Track', align: 'left' as const, info: 'The innovation track this cluster was assigned to, if any.' },
      { label: '#Consol.', align: 'left' as const, info: 'Consolidated error statements grouped under this cluster (member_ces_count).' },
      { label: '#ES', align: 'left' as const, info: 'Raw error statements rolled up (member_es_count).' },
      { label: 'Stk', align: 'left' as const, info: 'Distinct stakeholders holding this need.' },
      { label: 'Imp.', align: 'left' as const, info: 'Importance — how important this outcome is, rated 0–10 (Ulwick importance). Blank = not yet scored.' },
      { label: 'Sat.', align: 'left' as const, info: 'Satisfaction — how well the outcome is met today, rated 0–10 (Ulwick satisfaction). Blank = not yet scored.' },
    ],
    [],
  )

  // Empty / error states — one card with a centred muted line.
  if (err || (data && data.totals.clusters === 0)) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-400)' }}>
        <WidgetCard title="Consolidated needs">
          <div style={{ padding: 'var(--space-600) var(--space-400)', textAlign: 'center' }}>
            <Text variant="b2" style={{ color: 'var(--text-subtle)' }}>
              No consolidated clusters have been built for this unit yet.
            </Text>
          </div>
        </WidgetCard>
      </div>
    )
  }

  if (data == null) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-400)' }}>
        <WidgetCard title="Consolidated needs">
          <div style={{ padding: 'var(--space-600) var(--space-400)', textAlign: 'center' }}>
            <Text variant="b2" style={{ color: 'var(--text-subtle)' }}>Loading…</Text>
          </div>
        </WidgetCard>
      </div>
    )
  }

  const topCell: CSSProperties = { verticalAlign: 'top' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-400)' }}>
      <WidgetCard
        title="Consolidated needs"
        description={`${data.totals.clusters} clusters · ${data.totals.consolidated} consolidated statements`}
      >
        <div className="odi-tablescroll" style={{ borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
          <Table aria-label="Consolidated needs" striped="columns" style={{ tableLayout: 'fixed' }}>
            {/* Fixed column widths so the header never shifts when rows expand. */}
            <colgroup>
              <col style={{ width: 32 }} />{/* caret */}
              <col style={{ width: 92 }} />{/* opportunity */}
              <col />{/* need — remaining width */}
              <col style={{ width: 132 }} />{/* job type */}
              <col style={{ width: 110 }} />{/* track */}
              <col style={{ width: 84 }} />{/* #consol. */}
              <col style={{ width: 84 }} />{/* #es */}
              <col style={{ width: 72 }} />{/* stakeholders */}
              <col style={{ width: 92 }} />{/* importance */}
              <col style={{ width: 92 }} />{/* satisfaction */}
            </colgroup>
            <Table.Head>
              <Table.Row>
                <Table.HeaderCell aria-label="Expand" style={headerSticky} />
                {headers.map((h) => (
                  <Table.HeaderCell
                    key={h.label}
                    align={h.align}
                    style={headerSticky}
                    info={Boolean(h.info)}
                    infoTooltip={h.info}
                  >
                    {h.label}
                  </Table.HeaderCell>
                ))}
              </Table.Row>
            </Table.Head>
            <Table.Body>
              {data.clusters.map((c, i) => {
                const isOpen = open.has(i)
                return (
                  <Fragment key={i}>
                    <Table.Row onClick={() => toggleRow(i)} style={{ cursor: 'pointer' }}>
                      <Table.Cell icon style={topCell}>
                        <CaretDown size={16} weight="regular" style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 120ms ease', color: 'var(--icon-description)' }} />
                      </Table.Cell>
                      <Table.Cell style={topCell}>{oppCell(c.opp)}</Table.Cell>
                      <Table.Cell style={{ ...topCell, whiteSpace: 'normal', lineHeight: 'var(--line-height-b2)' }}>{c.need}</Table.Cell>
                      <Table.Cell style={topCell}>{jobBadges(c.jobTypes)}</Table.Cell>
                      <Table.Cell style={topCell}>{c.track ? <Badge variant="color" size="xs">{c.track}</Badge> : <span style={{ ...mono, color: 'var(--text-labels)' }}>—</span>}</Table.Cell>
                      <Table.Cell style={topCell}>{numCell(c.cesCount)}</Table.Cell>
                      <Table.Cell style={topCell}>{numCell(c.esCount)}</Table.Cell>
                      <Table.Cell style={topCell}>{numCell(c.stakeholders)}</Table.Cell>
                      <Table.Cell style={topCell}>{impCell(c.imp, c.imp_band)}</Table.Cell>
                      <Table.Cell style={topCell}>{satCell(c.sat, c.sat_band)}</Table.Cell>
                    </Table.Row>

                    {isOpen ? (
                      <Table.Row>
                        <Table.Cell style={{ padding: 0 }} />
                        <Table.Cell colSpan={9} style={{ padding: 0 }}>
                          <ConsolidatedPanel items={c.consolidated} />
                        </Table.Cell>
                      </Table.Row>
                    ) : null}
                  </Fragment>
                )
              })}
            </Table.Body>
          </Table>
        </div>
      </WidgetCard>
    </div>
  )
}

// Expanded detail — the consolidated error statements grouped under a cluster,
// already opportunity-DESC/null-last ordered from the export.
function ConsolidatedPanel({ items }: { items: ConsStmt[] }) {
  return (
    <div style={{ padding: 'var(--space-400) var(--space-500)', background: 'var(--surface-default-default-2)', borderTop: '1px solid var(--border-card)', display: 'flex', flexDirection: 'column', gap: 'var(--space-300)' }}>
      <Text variant="b3" weight="medium" style={{ color: 'var(--text-subtle)' }}>
        Consolidated statements ({items.length})
      </Text>
      <div style={{ borderRadius: 'var(--radius-sm)', overflow: 'hidden', background: 'var(--surface-default-default)' }}>
        <Table aria-label="Consolidated statements" striped="columns" style={{ tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 84 }} />{/* opportunity */}
            <col />{/* statement */}
            <col style={{ width: 96 }} />{/* members */}
            <col style={{ width: 72 }} />{/* stakeholders */}
            <col style={{ width: 88 }} />{/* importance */}
            <col style={{ width: 88 }} />{/* satisfaction */}
          </colgroup>
          <Table.Head>
            <Table.Row>
              <Table.HeaderCell>Opp.</Table.HeaderCell>
              <Table.HeaderCell>Statement</Table.HeaderCell>
              <Table.HeaderCell>#members</Table.HeaderCell>
              <Table.HeaderCell>Stk</Table.HeaderCell>
              <Table.HeaderCell>Imp.</Table.HeaderCell>
              <Table.HeaderCell>Sat.</Table.HeaderCell>
            </Table.Row>
          </Table.Head>
          <Table.Body>
            {items.map((s, j) => {
              const topCell: CSSProperties = { verticalAlign: 'top' }
              return (
                <Table.Row key={j}>
                  <Table.Cell style={topCell}>{oppCell(s.opp)}</Table.Cell>
                  <Table.Cell style={{ ...topCell, whiteSpace: 'normal', lineHeight: 'var(--line-height-b2)' }}>{s.stmt}</Table.Cell>
                  <Table.Cell style={topCell}>{numCell(s.members)}</Table.Cell>
                  <Table.Cell style={topCell}>{numCell(s.stakeholders)}</Table.Cell>
                  <Table.Cell style={topCell}>{impCell(s.imp, s.imp_band)}</Table.Cell>
                  <Table.Cell style={topCell}>{satCell(s.sat, s.sat_band)}</Table.Cell>
                </Table.Row>
              )
            })}
          </Table.Body>
        </Table>
      </div>
    </div>
  )
}

export default ConsolidatedView
