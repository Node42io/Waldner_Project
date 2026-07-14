import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode } from "react";
import { X } from "@phosphor-icons/react";
import { Text } from "../Text/Text";
import { Table } from "../Table/Table";
import { Divider } from "../Divider/Divider";

const mono: CSSProperties = { fontFamily: "var(--font-family-mono)", fontWeight: "var(--font-weight-medium)" };

/** A plotted point: `x` (e.g. importance) and `y` (e.g. satisfaction), both on a
 *  0–10 scale. Any other fields are yours — the side table and tooltip read them
 *  through the `columns` / `renderTooltip` props. */
export interface MatrixPoint {
  x: number;
  y: number;
}

/** A side-table column over the picked points. */
export interface MatrixColumn<T> {
  header: ReactNode;
  render: (p: T) => ReactNode;
  /** colgroup width — a number (px), a percentage string, or omitted (fills). */
  width?: number | string;
  /** Keep the cell on one line (e.g. for a badge column). */
  nowrap?: boolean;
}

/** A label placed inside the plot, in domain coordinates. */
export interface MatrixQuadrant {
  x: number;
  y: number;
  label: ReactNode;
  bg: string;
  color: string;
}

/** An iso-opportunity threshold: the line sat = 2·x − c, with copy at the right edge. */
export interface MatrixIsoLine {
  c: number;
  lines: string[];
}

export interface OpportunityMatrixProps<T extends MatrixPoint> {
  points: T[];
  /** Axis titles (uppercase). */
  xLabel?: string;
  yLabel?: string;
  /** Five band labels, inner → outer, shown as pills on both axes. */
  bands?: string[];
  /** Labels placed inside the plot (domain coords). */
  quadrants?: MatrixQuadrant[];
  /** Dashed iso-opportunity lines + their right-edge copy. */
  isoLines?: MatrixIsoLine[];
  /** Extra dashed boundary lines, in domain coordinates. */
  boundaryLines?: { x1: number; y1: number; x2: number; y2: number }[];
  /** Side-table columns for the selected points. */
  columns: MatrixColumn<T>[];
  /** Tooltip body for a single hovered point. */
  renderTooltip?: (p: T) => ReactNode;
  /** Noun for counts, e.g. { one: "need", many: "needs" }. */
  noun?: { one: string; many: string };
  /** Hint shown above the plot. */
  hint?: ReactNode;
  /** Side-table empty-state hint. */
  emptyHint?: ReactNode;
  /** Cluster bin size in domain units — points within it merge into one bubble. */
  cell?: number;
}

const DEFAULT_BANDS = ["very low", "low", "medium", "high", "very high"];

type Cluster<T> = { i: number; key: string; points: T[]; n: number; x: number; y: number; cx: number; cy: number; rad: number };

// Side table beside the matrix — the points from the selected bubble(s) or dragged
// region, rendered through the caller's `columns`. Hovering a row lights up its
// exact point on the matrix (via onRowHover).
function SideTable<T extends MatrixPoint>({
  rows,
  columns,
  title,
  emptyHint,
  onClose,
  onRowHover,
}: {
  rows: T[];
  columns: MatrixColumn<T>[];
  title: ReactNode;
  emptyHint: ReactNode;
  onClose: () => void;
  onRowHover?: (row: T | null) => void;
}) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);
  const cell: CSSProperties = { verticalAlign: "top", fontSize: "var(--font-size-b4)" };
  const headSticky: CSSProperties = { position: "sticky", top: 0, zIndex: 1, background: "var(--surface-default-default-2)", fontSize: "var(--font-size-b4)" };
  return (
    <div style={{ flex: "2 1 0", minWidth: 0, alignSelf: "stretch", maxHeight: "78vh", display: "flex", flexDirection: "column", overflow: "hidden" }}>
      {rows.length === 0 ? (
        <div style={{ flex: "1 1 0", display: "grid", placeItems: "center", padding: "var(--space-400)", textAlign: "center" }}>
          <Text variant="b3" style={{ color: "var(--text-description)" }}>{emptyHint}</Text>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-100)", padding: "0 var(--space-100) var(--space-200)" }}>
            <Text variant="b3" weight="medium" as="span">{title}</Text>
            <button type="button" onClick={onClose} aria-label="Clear selection" style={{ flexShrink: 0, display: "grid", placeItems: "center", width: "var(--space-500)", height: "var(--space-500)", border: 0, borderRadius: "var(--radius-xs)", background: "transparent", color: "var(--icon-description)", cursor: "pointer" }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ flex: "1 1 0", minHeight: 0, overflow: "auto" }}>
            <Table aria-label="Selected points" striped="columns" style={{ tableLayout: "fixed", width: "100%" }}>
              <colgroup>
                {columns.map((c, i) => (
                  <col key={i} style={c.width != null ? { width: c.width } : undefined} />
                ))}
              </colgroup>
              <Table.Head>
                <Table.Row>
                  {columns.map((c, i) => (
                    <Table.HeaderCell key={i} style={headSticky}>{c.header}</Table.HeaderCell>
                  ))}
                </Table.Row>
              </Table.Head>
              <Table.Body>
                {rows.map((r, i) => {
                  const hl = hoverIdx === i ? { background: "var(--surface-default-hover)" } : null;
                  return (
                    <Table.Row
                      key={i}
                      style={{ cursor: "default" }}
                      onMouseEnter={() => { setHoverIdx(i); onRowHover?.(r); }}
                      onMouseLeave={() => { setHoverIdx((h) => (h === i ? null : h)); onRowHover?.(null); }}
                    >
                      {columns.map((c, ci) => (
                        <Table.Cell
                          key={ci}
                          style={c.nowrap
                            ? { ...cell, whiteSpace: "nowrap", ...hl }
                            : { ...cell, whiteSpace: "normal", overflowWrap: "anywhere", lineHeight: "var(--line-height-b3)", ...hl }}
                        >
                          {c.render(r)}
                        </Table.Cell>
                      ))}
                    </Table.Row>
                  );
                })}
              </Table.Body>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}

// An importance × satisfaction bubble matrix. Points at (nearly) the same spot
// merge into one navy bubble sized by count; clicking a bubble or dragging a
// region lists those points in a side table; hovering a row lights the exact
// point back on the matrix. Data-agnostic — pass `points`, `columns` and the
// axis/quadrant/iso-line config.
export function OpportunityMatrix<T extends MatrixPoint>({
  points,
  xLabel = "Importance",
  yLabel = "Satisfaction",
  bands = DEFAULT_BANDS,
  quadrants = [],
  isoLines = [],
  boundaryLines = [],
  columns,
  renderTooltip,
  noun = { one: "item", many: "items" },
  hint,
  emptyHint = "Click a bubble or drag a region on the matrix to list its points here.",
  cell = 0.5,
}: OpportunityMatrixProps<T>) {
  const [hover, setHover] = useState<number | null>(null);
  const [pick, setPick] = useState<{ key: string; rows: T[]; region?: { x: number; y: number; w: number; h: number } } | null>(null);
  const [hoverPoint, setHoverPoint] = useState<T | null>(null);
  useEffect(() => { setPick(null); setHoverPoint(null); }, [points]);
  const [cursor, setCursor] = useState<{ x: number; y: number } | null>(null);
  const [brush, setBrush] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null);

  const VBW = 1000, VBH = 640;
  const padL = 108, padR = 120, padT = 36, padB = 96;
  const plotW = VBW - padL - padR;
  const plotH = VBH - padT - padB;
  const xOf = (x: number) => padL + (x / 10) * plotW;
  const yOf = (y: number) => padT + (1 - y / 10) * plotH;
  const xInv = (px: number) => Math.max(0, Math.min(10, ((px - padL) / plotW) * 10));
  const yInv = (py: number) => Math.max(0, Math.min(10, (1 - (py - padT) / plotH) * 10));
  const toVB = (e: ReactMouseEvent<SVGSVGElement>) => {
    const rc = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - rc.left) / rc.width) * VBW, y: ((e.clientY - rc.top) / rc.height) * VBH };
  };
  const gridTicks = Array.from({ length: 11 }, (_, i) => i);
  const bandDefs = bands.map((label, i) => ({ c: i * 2 + 1, label }));
  const axisNum: CSSProperties = { fontFamily: "var(--font-family-sans)", fontSize: 10, fill: "var(--text-body)" };

  const pts = useMemo<Cluster<T>[]>(() => {
    const groups = new Map<string, { rows: T[]; sx: number; sy: number; ci: number; cj: number }>();
    for (const p of points) {
      const ci = Math.round(p.x / cell), cj = Math.round(p.y / cell);
      const key = `${ci}_${cj}`;
      const g = groups.get(key) ?? { rows: [], sx: 0, sy: 0, ci, cj };
      g.rows.push(p); g.sx += p.x; g.sy += p.y;
      groups.set(key, g);
    }
    return Array.from(groups.entries()).map(([key, g], i) => {
      const n = g.rows.length;
      const x = g.sx / n, y = g.sy / n;
      const rad = Math.min(32, 7 * Math.sqrt(n));
      const cx = Math.max(padL + rad, Math.min(padL + plotW - rad, xOf(x)));
      const cy = Math.max(padT + rad, Math.min(padT + plotH - rad, yOf(y)));
      return { i, key, points: g.rows, n, x, y, cx, cy, rad };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, cell]);

  const active = hover != null ? pts[hover] : null;
  const pickCount = pick?.rows.length ?? 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-200)", width: "100%", flex: "1 1 0", minHeight: 0 }}>
      {points.length === 0 ? (
        <div style={{ padding: "var(--space-800) 0", textAlign: "center" }}>
          <Text variant="b2" style={{ color: "var(--text-description)" }}>No points to plot.</Text>
        </div>
      ) : (
        <div style={{ display: "flex", gap: "var(--space-300)", alignItems: "stretch", width: "100%", flex: "1 1 0", minHeight: 0, background: "var(--surface-default-default-2)", borderRadius: "var(--radius-md)", padding: "var(--space-300)" }}>
          <div style={{ flex: "3 1 0", minWidth: 440, minHeight: 0, display: "flex", flexDirection: "column", gap: "var(--space-200)" }}>
            {hint ? (
              <span style={{ fontFamily: "var(--font-family-sans)", fontSize: "var(--font-size-b4)", color: "var(--text-labels)" }}>{hint}</span>
            ) : null}
            <div style={{ position: "relative", flex: "1 1 0", minWidth: 0, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <svg
                viewBox={`0 0 ${VBW} ${VBH}`}
                width={VBW}
                height={VBH}
                style={{ display: "block", overflow: "visible", maxWidth: "100%", maxHeight: "100%", userSelect: "none", cursor: "crosshair" }}
                role="img"
                aria-label={`${xLabel} × ${yLabel} matrix of ${points.length} points. Drag to select a region.`}
                onMouseDown={(e) => { const p = toVB(e); setBrush({ x0: p.x, y0: p.y, x1: p.x, y1: p.y }); }}
                onMouseMove={(e) => { const p = toVB(e); setCursor(p); setBrush((b) => (b ? { ...b, x1: p.x, y1: p.y } : b)); }}
                onMouseUp={() => {
                  setBrush((b) => {
                    if (b && Math.abs(b.x1 - b.x0) > 10 && Math.abs(b.y1 - b.y0) > 10) {
                      const xMin = xInv(Math.min(b.x0, b.x1)), xMax = xInv(Math.max(b.x0, b.x1));
                      const yMin = yInv(Math.max(b.y0, b.y1)), yMax = yInv(Math.min(b.y0, b.y1));
                      const picked = points.filter((p) => p.x >= xMin && p.x <= xMax && p.y >= yMin && p.y <= yMax);
                      if (picked.length) {
                        const x = Math.min(b.x0, b.x1), y = Math.min(b.y0, b.y1);
                        setPick({ key: "region", rows: picked, region: { x, y, w: Math.abs(b.x1 - b.x0), h: Math.abs(b.y1 - b.y0) } });
                      }
                    }
                    return null;
                  });
                }}
                onMouseLeave={() => { setCursor(null); setHover(null); setBrush(null); }}
              >
                {boundaryLines.map((l, i) => (
                  <line key={`bl${i}`} x1={xOf(l.x1)} y1={yOf(l.y1)} x2={xOf(l.x2)} y2={yOf(l.y2)} stroke="var(--text-description)" strokeWidth={1} strokeDasharray="5 5" opacity={0.5} />
                ))}
                {gridTicks.map((t) => (
                  <line key={`gx${t}`} x1={xOf(t)} y1={yOf(10)} x2={xOf(t)} y2={yOf(0)} stroke="var(--border-default-default-lighter)" strokeWidth={1} strokeDasharray="3 3" />
                ))}
                {gridTicks.map((t) => (
                  <line key={`gy${t}`} x1={xOf(0)} y1={yOf(t)} x2={xOf(10)} y2={yOf(t)} stroke="var(--border-default-default-lighter)" strokeWidth={1} strokeDasharray="3 3" />
                ))}
                {isoLines.map((o) => (
                  <line key={`iso${o.c}`} x1={xOf(o.c / 2)} y1={yOf(0)} x2={xOf(10)} y2={yOf(20 - o.c)} stroke="var(--text-description)" strokeWidth={1} strokeDasharray="5 5" opacity={0.45} />
                ))}
                {isoLines.map((o) => (
                  <text key={`isolbl${o.c}`} x={xOf(10) + 12} y={yOf(20 - o.c) - 6} style={axisNum}>
                    {o.lines.map((ln, i) => (
                      <tspan key={i} x={xOf(10) + 12} dy={i === 0 ? 0 : 12}>{ln}</tspan>
                    ))}
                  </text>
                ))}
                {gridTicks.map((t) => (
                  <text key={`nx${t}`} x={xOf(t)} y={yOf(0) + 16} textAnchor="middle" style={axisNum}>{t}</text>
                ))}
                {gridTicks.map((t) => (
                  <text key={`ny${t}`} x={padL - 14} y={yOf(t)} textAnchor="end" dominantBaseline="central" style={axisNum}>{t}</text>
                ))}
                {bandDefs.map((b) => {
                  const yTop = yOf(b.c + 1), yBot = yOf(b.c - 1), xL = xOf(b.c - 1), xR = xOf(b.c + 1);
                  const yc = (yTop + yBot) / 2, xc = (xL + xR) / 2;
                  return (
                    <g key={`pill${b.c}`}>
                      <rect x={padL - 62} y={yTop + 4} width={14} height={yBot - yTop - 8} rx={7} fill="var(--secondary-50)" />
                      <text x={padL - 55} y={yc} textAnchor="middle" dominantBaseline="central" transform={`rotate(-90 ${padL - 55} ${yc})`} style={axisNum}>{b.label}</text>
                      <rect x={xL + 4} y={yOf(0) + 30} width={xR - xL - 8} height={14} rx={7} fill="var(--secondary-50)" />
                      <text x={xc} y={yOf(0) + 37} textAnchor="middle" dominantBaseline="central" style={axisNum}>{b.label}</text>
                    </g>
                  );
                })}
                <text x={xOf(5)} y={yOf(0) + 64} textAnchor="middle" style={{ ...mono, fontSize: 12, fill: "var(--text-body)", textTransform: "uppercase" }}>{xLabel}</text>
                <text x={padL - 84} y={yOf(5)} textAnchor="middle" dominantBaseline="central" transform={`rotate(-90 ${padL - 84} ${yOf(5)})`} style={{ ...mono, fontSize: 12, fill: "var(--text-body)", textTransform: "uppercase" }}>{yLabel}</text>
                <g stroke="var(--text-labels)" strokeWidth={1.5} fill="var(--text-labels)">
                  <line x1={xOf(0)} y1={yOf(0)} x2={xOf(10) + 14} y2={yOf(0)} />
                  <polygon points={`${xOf(10) + 22},${yOf(0)} ${xOf(10) + 12},${yOf(0) - 5} ${xOf(10) + 12},${yOf(0) + 5}`} stroke="none" />
                  <line x1={xOf(0)} y1={yOf(0)} x2={xOf(0)} y2={yOf(10) - 14} />
                  <polygon points={`${xOf(0)},${yOf(10) - 22} ${xOf(0) - 5},${yOf(10) - 12} ${xOf(0) + 5},${yOf(10) - 12}`} stroke="none" />
                </g>
                {quadrants.map((q, i) => (
                  <foreignObject key={i} x={xOf(q.x)} y={yOf(q.y) - 11} width={240} height={22} style={{ overflow: "visible" }}>
                    <div style={{ display: "inline-flex" }}>
                      <span style={{ ...mono, fontSize: 12, lineHeight: "12px", textTransform: "uppercase", whiteSpace: "nowrap", padding: "4px", background: q.bg, color: q.color }}>{q.label}</span>
                    </div>
                  </foreignObject>
                ))}
                {cursor && cursor.x >= padL && cursor.x <= padL + plotW && cursor.y >= padT && cursor.y <= padT + plotH ? (
                  <g pointerEvents="none">
                    <line x1={cursor.x} y1={yOf(10)} x2={cursor.x} y2={yOf(0)} stroke="var(--text-description)" strokeWidth={1} strokeDasharray="3 3" opacity={0.55} />
                    <line x1={xOf(0)} y1={cursor.y} x2={xOf(10)} y2={cursor.y} stroke="var(--text-description)" strokeWidth={1} strokeDasharray="3 3" opacity={0.55} />
                  </g>
                ) : null}
                {pts.map((p) => (
                  <g key={p.i}>
                    <circle
                      cx={p.cx}
                      cy={p.cy}
                      r={p.rad}
                      fill="var(--secondary-default)"
                      opacity={hover == null || hover === p.i ? 0.55 : 0.3}
                      style={{ cursor: "pointer", transition: "opacity 120ms ease" }}
                      onMouseEnter={() => setHover(p.i)}
                      onMouseLeave={() => setHover((h) => (h === p.i ? null : h))}
                      onClick={() => setPick({ key: p.key, rows: p.points })}
                    />
                    {p.n > 1 && p.rad >= 11 ? (
                      <text x={p.cx} y={p.cy} textAnchor="middle" dominantBaseline="central" pointerEvents="none" style={{ fontFamily: "var(--font-family-sans)", fontWeight: "var(--font-weight-medium)", fontSize: Math.min(16, p.rad * 0.85), fill: "var(--surface-default-default)" }}>{p.n}</text>
                    ) : null}
                  </g>
                ))}
                {pick && pick.key !== "region" ? pts.filter((p) => p.key === pick.key).map((p) => (
                  <circle key={`sel${p.i}`} cx={p.cx} cy={p.cy} r={p.rad + 2.5} fill="none" stroke="var(--text-headings)" strokeWidth={2.5} pointerEvents="none" />
                )) : null}
                {pick?.region ? (
                  <rect x={pick.region.x} y={pick.region.y} width={pick.region.w} height={pick.region.h} fill="var(--tertiary-default)" fillOpacity={0.1} stroke="var(--text-headings)" strokeWidth={1.5} strokeDasharray="4 4" pointerEvents="none" />
                ) : null}
                {active ? (
                  <circle cx={active.cx} cy={active.cy} r={active.rad + 1.5} fill="none" stroke="var(--text-body)" strokeWidth={2} pointerEvents="none" />
                ) : null}
                {hoverPoint ? (
                  <g pointerEvents="none">
                    <circle cx={xOf(hoverPoint.x)} cy={yOf(hoverPoint.y)} r={12} fill="var(--tertiary-default)" opacity={0.6} />
                    <circle cx={xOf(hoverPoint.x)} cy={yOf(hoverPoint.y)} r={5.5} fill="var(--surface-default-default)" stroke="var(--text-headings)" strokeWidth={2} />
                  </g>
                ) : null}
                {brush && Math.abs(brush.x1 - brush.x0) > 2 && Math.abs(brush.y1 - brush.y0) > 2 ? (
                  <rect x={Math.min(brush.x0, brush.x1)} y={Math.min(brush.y0, brush.y1)} width={Math.abs(brush.x1 - brush.x0)} height={Math.abs(brush.y1 - brush.y0)} fill="var(--tertiary-default)" fillOpacity={0.14} stroke="var(--text-headings)" strokeWidth={1.25} strokeDasharray="4 4" pointerEvents="none" />
                ) : null}
              </svg>

              {active ? (
                <div
                  style={{
                    position: "absolute",
                    left: `${(active.cx / VBW) * 100}%`,
                    top: `${(active.cy / VBH) * 100}%`,
                    transform: "translate(-50%, calc(-100% - 10px))",
                    zIndex: 10,
                    pointerEvents: "none",
                    width: "min(280px, 70vw)",
                    padding: "var(--space-300)",
                    background: "var(--surface-default-default)",
                    border: "1px solid var(--border-default-default)",
                    borderRadius: "var(--radius-md)",
                    boxShadow: "var(--shadow-md)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--space-100)",
                  }}
                >
                  {active.n === 1 && renderTooltip ? (
                    renderTooltip(active.points[0])
                  ) : (
                    <>
                      <Text variant="b3" weight="medium" as="span">{active.n} {active.n === 1 ? noun.one : noun.many} here</Text>
                      <span style={{ display: "flex", gap: "var(--space-300)" }}>
                        <span style={{ ...mono, fontSize: "var(--font-size-b4)", color: "var(--text-description)" }}>{xLabel.toLowerCase()} ≈ {active.x.toFixed(1)}</span>
                        <span style={{ ...mono, fontSize: "var(--font-size-b4)", color: "var(--text-description)" }}>{yLabel.toLowerCase()} ≈ {active.y.toFixed(1)}</span>
                      </span>
                      <span style={{ fontFamily: "var(--font-family-sans)", fontSize: "var(--font-size-b4)", color: "var(--text-labels)" }}>Click to list these {noun.many}</span>
                    </>
                  )}
                </div>
              ) : null}
            </div>
          </div>
          {pickCount ? (
            <>
              <Divider orientation="vertical" />
              <SideTable
                rows={pick!.rows}
                columns={columns}
                title={`${pickCount} selected ${pickCount === 1 ? noun.one : noun.many}`}
                emptyHint={emptyHint}
                onClose={() => setPick(null)}
                onRowHover={setHoverPoint}
              />
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default OpportunityMatrix;
