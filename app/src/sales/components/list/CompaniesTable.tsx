import { Fragment, useState, useMemo } from "react";
import { SearchBar, Number, Table, Scrollbar } from "@node42/ui-kit";
import { revenueBand, revenueOrder } from "@/lib/revenue";
import { coreNaics } from "@/lib/naics";
import type { Company } from "@/lib/types";
import { CustomerListHeader } from "@/components/shell/CustomerListHeader";
import { TableRow } from "./TableRow";
import { ExpandedRow } from "./ExpandedRow";

type SortKey =
  | "name"
  | "address"
  | "employees"
  | "revenue"
  | "naics"
  | "linkedin"
  | "website";

type Col = {
  key: SortKey;
  label: string;
  align?: "left" | "right" | "center";
  minWidth?: number;
  info?: string;
};

const COLS: Col[] = [
  { key: "name", label: "Company Name", minWidth: 200 },
  { key: "address", label: "Address", minWidth: 200 },
  { key: "employees", label: "Employees", align: "right", minWidth: 110 },
  { key: "revenue", label: "Revenue", align: "right", minWidth: 110 },
  {
    key: "naics",
    label: "Core NAICS Code",
    align: "left",
    minWidth: 150,
    info: "Core NAICS industry code derived from the company's primary activity.",
  },
  { key: "linkedin", label: "LinkedIn", align: "center", minWidth: 90 },
  { key: "website", label: "Website", align: "center", minWidth: 90 },
];

// chevron column + the 7 data columns
const COL_SPAN = COLS.length + 1;

function revenueOf(c: Company): { label: string; sortValue: number } {
  return {
    label: `${revenueBand(c.employees, c.revLowerUsd, c.revHigherUsd)} $`,
    sortValue: revenueOrder(c.employees, c.revLowerUsd, c.revHigherUsd),
  };
}

function naicsOf(c: Company): string {
  // Real derived NAICS code based on buckets/industry (see src/lib/naics.ts).
  return coreNaics(c).code;
}

function compare(a: Company, b: Company, key: SortKey): number {
  switch (key) {
    case "name":
      return a.name.localeCompare(b.name);
    case "address":
      return `${a.country} ${a.city}`.localeCompare(`${b.country} ${b.city}`);
    case "employees":
      return (a.employees ?? -1) - (b.employees ?? -1);
    case "revenue":
      return revenueOf(a).sortValue - revenueOf(b).sortValue;
    case "naics":
      return naicsOf(a).localeCompare(naicsOf(b));
    case "linkedin":
    case "website":
      return a.name.localeCompare(b.name);
  }
}

export function CompaniesTable({
  rows,
  searchQuery,
  onSearchQuery,
}: {
  rows: Company[];
  searchQuery: string;
  onSearchQuery: (v: string) => void;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const arr = [...rows];
    arr.sort((a, b) => {
      const v = compare(a, b, sortKey);
      return sortDir === "asc" ? v : -v;
    });
    return arr;
  }, [rows, sortKey, sortDir]);

  const missingCoords = useMemo(
    () => rows.filter((r) => r.lat == null || r.lon == null).length,
    [rows]
  );

  function setSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  }

  return (
    <Scrollbar orientation="both" className="h-full bg-[var(--bg-page)]" data-testid="companies-table">
      {/* Page header — shared "Customer List" title (same size as the map view)
          with the All filters toggle pinned to its right. */}
      <div className="px-6 pt-6 pb-3">
        <CustomerListHeader align="start" />

        {/* TOTAL count — same treatment as the map-view Customer List: a mono
            "Total" label + the kit Number (colored-full, blue, scaled down). */}
        <div className="mt-3 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-wider leading-none text-[var(--text-labels)]">
              Total
            </span>
            <span className="inline-flex origin-left" style={{ transform: "scale(0.72)" }}>
              <Number type="colored-full" color="blue" numberSize="sm">
                {rows.length}
              </Number>
            </span>
          </div>
          {missingCoords > 0 && (
            <span
              data-testid="missing-coords-notice"
              className="text-[10px] font-mono text-[var(--dim)]"
            >
              ({missingCoords} missing coords — list-only)
            </span>
          )}
        </div>

        {/* Search input — kit SearchBar (same component as the map-view panel) */}
        <div className="mt-4 max-w-[640px]">
          <SearchBar
            size="sm"
            className="sb-full"
            value={searchQuery}
            onChange={(e) => onSearchQuery(e.target.value)}
            onClear={() => onSearchQuery("")}
            placeholder="Search for a specific customer..."
            aria-label="Search customers"
          />
        </div>
      </div>

      {/* Customer list — New-UIKit Table (sortable headers, interactive rows,
          per-row expandable detail spanning all columns). */}
      <div className="px-6 pb-8">
        <Table aria-label="Customer list" striped="columns">
          <Table.Head>
            <Table.Row>
              {/* Chevron / expand column */}
              <Table.HeaderCell aria-label="" />
              {COLS.map((c) => (
                <Table.HeaderCell
                  key={c.key}
                  align={c.align}
                  sortable
                  sortDirection={sortKey === c.key ? sortDir : undefined}
                  onSort={() => setSort(c.key)}
                  info={!!c.info}
                  infoTooltip={c.info}
                  style={c.minWidth ? { minWidth: c.minWidth } : undefined}
                >
                  {c.label}
                </Table.HeaderCell>
              ))}
            </Table.Row>
          </Table.Head>

          <Table.Body>
            {sorted.map((r) => (
              <Fragment key={r.id}>
                <TableRow
                  company={r}
                  isExpanded={expandedId === r.id}
                  onToggleExpand={() =>
                    setExpandedId((prev) => (prev === r.id ? null : r.id))
                  }
                />
                {expandedId === r.id && (
                  <Table.Row>
                    <Table.Cell colSpan={COL_SPAN} style={{ padding: 0 }}>
                      <ExpandedRow company={r} />
                    </Table.Cell>
                  </Table.Row>
                )}
              </Fragment>
            ))}

            {sorted.length === 0 && (
              <Table.Row>
                <Table.Cell colSpan={COL_SPAN}>
                  <div className="py-16 text-center">
                    <div className="text-3xl font-mono text-[var(--accent)]">no leads</div>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      No companies match your current filters. Try clearing them.
                    </p>
                  </div>
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table>
      </div>
    </Scrollbar>
  );
}
