import { useMemo, useState, useCallback } from "react";
import { Plus } from "@phosphor-icons/react";
import { Number, Sidebar, Navbar, Logo, Badge, CustomerCard, SearchBar, Scrollbar, NaicsRow } from "@node42/ui-kit";
import MapCanvas from "@/components/map/MapCanvas";
import { MapSearch } from "@/components/shell/MapSearch";
import { MapControls } from "@/components/shell/MapControls";
import { CustomerListHeader } from "@/components/shell/CustomerListHeader";
import { CustomerFilterPanel } from "@/components/filters/CustomerFilterPanel";
import { CompanyDrawer } from "@/components/company/CompanyDrawer";
import { CompaniesTable } from "@/components/list/CompaniesTable";
import { applyFilters } from "@/lib/filters";
import { NAICS_GROUPS } from "@/lib/naics";
import { revenueBand } from "@/lib/revenue";
import { downloadCsv } from "@/lib/csv";
import type { Company, Filters, Status } from "@/lib/types";
import { EMPTY_FILTERS } from "@/lib/types";
import type { View } from "@/components/shell/TopNav";
import { MOCK_COMPANIES } from "@/lib/mockCompanies";
import { SALES_SEGMENTS } from "@/lib/market-query";
import { ReportSidebar } from "../ReportSidebar";
import { ReportActions } from "../ReportActions";
// Leaflet + marker-cluster stylesheets — without these the map tiles, panes and
// cluster icons render unpositioned. Ported from the pharma-map app, where they
// were loaded globally; they must be imported here for the map to lay out.
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "./sales.css";

type MapHint = { lat: number; lon: number; nonce: number };

const STATUS_CYCLE: Record<Status, Status> = { PROSPECT: "LEAD", LEAD: "ACTIVE", ACTIVE: "PROSPECT" };

// The markets shown in the Customer List column (NAICS groups, minus the
// catch-all "other"). Only the first is interactive in this structural demo.
const MARKETS = NAICS_GROUPS.filter((g) => g.code !== "other");

// Structural port of the node42-pharma-map single-page app. Layout: a detached,
// full-height Customer List column (market picker → customer cards) sits on the
// left; the full-bleed map area fills the rest. The page Navbar lives one level
// up in SalesPage. Runs on MOCK_COMPANIES (see lib/mockCompanies) — no live data.
function SalesApp() {
  // Mock data is static; per-company status changes flow through statusOverrides.
  const [rows] = useState<Company[]>(MOCK_COMPANIES);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [view, setView] = useState<View>("map");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<string | null>(null);
  // Second picker step: after a NAICS market is chosen, the user picks the market
  // segment (e.g. Sterile Fill-Finish) before the customers/map populate.
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null);
  const segmentsForMarket = useMemo(
    () => SALES_SEGMENTS.filter((s) => s.naics === selectedMarket),
    [selectedMarket],
  );
  // Clearing the market resets the segment so the picker restarts cleanly.
  const clearMarket = useCallback(() => {
    setSelectedMarket(null);
    setSelectedSegment(null);
  }, []);
  const [cardQuery, setCardQuery] = useState("");
  const [statusOverrides, setStatusOverrides] = useState<Record<string, Status>>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mapHint, setMapHint] = useState<MapHint | null>(null);

  const handleShowLocation = useCallback((lat: number, lon: number) => {
    setMapHint({ lat, lon, nonce: Date.now() });
  }, []);

  const merged = useMemo(
    () => rows.map((r) => (statusOverrides[r.id] ? { ...r, status: statusOverrides[r.id] } : r)),
    [rows, statusOverrides]
  );
  const selected = useMemo(() => merged.find((r) => r.id === selectedId) ?? null, [merged, selectedId]);

  // Map view is driven by the picked market + segment; list view keeps the filter
  // set. Customers only populate once BOTH the NAICS market and the segment are
  // chosen. We filter by the real segment membership (all validated accounts are
  // Sterile Fill-Finish) rather than the coreNaics heuristic, which would scatter
  // the accounts across NAICS buckets and under-count them.
  const marketCompanies = useMemo(() => {
    if (!selectedMarket || !selectedSegment) return [];
    const segName = SALES_SEGMENTS.find((s) => s.id === selectedSegment)?.name;
    return merged.filter((c) => c.segment === segName);
  }, [merged, selectedMarket, selectedSegment]);
  // The Customer List "All filters" (country / employees / revenue / specialties)
  // narrow the picked market — reflected in both the cards and the map pins.
  const marketFiltered = useMemo(() => applyFilters(marketCompanies, filters), [marketCompanies, filters]);
  const selectedMarketLabel = selectedMarket
    ? MARKETS.find((g) => g.code === selectedMarket)?.label ?? selectedMarket
    : null;
  const selectedSegmentLabel = selectedSegment
    ? segmentsForMarket.find((s) => s.id === selectedSegment)?.name ?? selectedSegment
    : null;

  const filtered = useMemo(() => applyFilters(merged, filters), [merged, filters]);
  const activeFilterCount =
    (filters.q ? 1 : 0) +
    filters.buckets.length +
    filters.oncologyTags.length +
    filters.countries.length +
    filters.revenues.length +
    filters.specialties.length +
    filters.status.length +
    (filters.employeesMin != null ? 1 : 0) +
    (filters.employeesMax != null ? 1 : 0);
  // Demo: show the mock companies in the list view even with no active filter,
  // so the table layout is visible. (Was gated on activeFilterCount > 0.)
  const listVisible = filtered;

  const cycleStatus = useCallback((id: string) => {
    setStatusOverrides((prev) => {
      const cur = prev[id] ?? merged.find((r) => r.id === id)?.status ?? "PROSPECT";
      return { ...prev, [id]: STATUS_CYCLE[cur] };
    });
  }, [merged]);

  const handleDownload = useCallback(() => {
    downloadCsv(view === "map" ? marketFiltered : listVisible, "node42-companies.csv");
  }, [view, marketFiltered, listVisible]);

  const mapControls = (
    <MapControls
      view={view}
      onView={setView}
      onDownload={handleDownload}
      filtersOpen={filtersOpen}
      onToggleFilters={() => setFiltersOpen((v) => !v)}
      activeFilterCount={activeFilterCount}
      leading={
        <MapSearch
          rows={merged}
          onPickCity={(_city, lat, lon) => handleShowLocation(lat, lon)}
          onPickCountry={(_iso, lat, lon) => handleShowLocation(lat, lon)}
        />
      }
    />
  );

  // Right-hand column: the full-bleed map, beside the Customer List.
  const mapColumn = (
    <div className="flex flex-1 min-w-0 min-h-0 flex-col">
      <div className="relative flex-1 min-h-0">
        {/* Full-bleed map — shows the picked market's companies. */}
        <div className="absolute inset-0">
          <MapCanvas rows={marketFiltered} selectedId={selectedId} onSelect={(c) => setSelectedId(c.id)} hint={mapHint} />
        </div>

        {/* Independent map geocoder now lives inside MapControls, aligned to
            the right just left of the map/list toggle. */}
        {mapControls}

        {/* Floating glass detail drawer, over the left edge of the map. */}
        {selected && (
          <CompanyDrawer
            company={selected}
            onClose={() => setSelectedId(null)}
            onCycleStatus={cycleStatus}
            floating
            onShowLocation={handleShowLocation}
          />
        )}
      </div>
    </div>
  );

  if (view === "list") {
    return (
      <div className="flex h-full w-full min-w-0 flex-col bg-[var(--bg-page)]">
        <div className="relative flex min-h-0 flex-1">
          <div className="relative min-w-0 flex-1 overflow-hidden">
            <CompaniesTable
              rows={listVisible}
              searchQuery={filters.q}
              onSearchQuery={(q) => setFilters({ ...filters, q })}
            />
            {mapControls}
          </div>
          {/* No company drawer in the list view — clicking a row expands its
              detail inline (ExpandedRow), which shows the same content. */}
          {/* Same panel as the map view (CustomerFilterPanel), here anchored as a
              full-height drawer on the right edge of the table. */}
          {filtersOpen && (
            <CustomerFilterPanel
              rows={merged}
              filters={filters}
              onChange={setFilters}
              onClose={() => setFiltersOpen(false)}
              resultCount={listVisible.length}
              totalCount={merged.length}
              className="w-[416px] max-w-full shrink-0 border-l border-[var(--line)]"
            />
          )}
        </div>
      </div>
    );
  }

  // Cards visible in the panel: the picked market's companies, narrowed by the
  // "All filters" panel (country / employees / revenue / specialties) and then by
  // the in-panel search box (matches Figma "Search for a specific customer...").
  const q = cardQuery.trim().toLowerCase();
  const visibleCards = q
    ? marketFiltered.filter((c) => c.name.toLowerCase().includes(q))
    : marketFiltered;

  // Short market label for the filter chip (drop the "325412 — " NAICS prefix).
  const marketChipLabel = selectedMarketLabel
    ? selectedMarketLabel.split("—").pop()?.trim() ?? selectedMarketLabel
    : null;

  // Map view — full-bleed map with the Customer List as a glass overlay on the
  // left (Figma "customer list - map view", node 5095:70611).
  return (
    <div className="relative flex h-full w-full min-w-0 bg-[var(--bg-page)]">
      {mapColumn}

      <aside
        className="absolute left-0 top-0 bottom-0 z-[600] flex w-[320px] flex-col gap-2 overflow-hidden rounded-br-lg pt-3 pb-4 pl-4 pr-2"
        style={{
          background: "var(--color-page)",
        }}
      >
        {/* Header — shared "Customer List" title + All filters toggle. Filters
            only apply once a market is picked, so the button only shows then.
            Opens the drawer-style panel to the right. */}
        <CustomerListHeader
          className="pr-2"
          showFilters={selectedSegment != null}
          filtersOpen={filtersOpen}
          onToggleFilters={() => setFiltersOpen((v) => !v)}
          activeFilterCount={activeFilterCount}
        />

        {selectedMarket == null ? (
          /* No market picked yet — inline market picker (not shown in Figma, which
             depicts the selected state; kept functional and token-styled). */
          <>
            <p className="m-0 -mt-1.5 text-[13px] leading-snug text-[var(--text-labels)]">
              Select a market to view its customers.
            </p>
            <Scrollbar className="-mr-2 min-h-0 flex-1 pr-2">
              {/* Uniform gaps via flex `gap` rather than `space-y` — the latter
                  drops the margin on the row after a taller (two-line) row, so
                  the spacing reads uneven. */}
              <div className="flex flex-col gap-[var(--space-200)]">
                {MARKETS.map((g, i) => {
                  const clickable = i === 0;
                  // Same NaicsRow as Product Management: code badge + market name +
                  // arrow/lock. Label is "code — name"; show just the name.
                  const name = g.label.split("—").pop()?.trim() ?? g.label;
                  return (
                    <NaicsRow
                      key={g.code}
                      code={g.code}
                      name={name}
                      size="sm"
                      surface="default"
                      locked={!clickable}
                      onOpen={clickable ? () => setSelectedMarket(g.code) : undefined}
                    />
                  );
                })}
              </div>
            </Scrollbar>
          </>
        ) : selectedSegment == null ? (
          /* Second step — market picked, now pick the market segment. */
          <>
            <div className="flex flex-wrap items-center gap-1 pr-2">
              <Badge
                variant="color"
                size="xs"
                onClose={clearMarket}
                closeLabel={`Remove market ${marketChipLabel ?? ""}`}
              >
                {marketChipLabel}
              </Badge>
            </div>
            <p className="m-0 -mt-1.5 text-[13px] leading-snug text-[var(--text-labels)]">
              Select a segment to view its customers.
            </p>
            <Scrollbar className="-mr-2 min-h-0 flex-1 pr-2">
              <div className="flex flex-col gap-[var(--space-200)]">
                {segmentsForMarket.length === 0 ? (
                  <p className="m-0 p-6 text-center text-sm text-[var(--text-labels)]">
                    No segments in this market.
                  </p>
                ) : (
                  segmentsForMarket.map((sg) => (
                    <NaicsRow
                      key={sg.id}
                      code={sg.naics}
                      name={sg.name}
                      size="sm"
                      surface="default"
                      onOpen={() => setSelectedSegment(sg.id)}
                    />
                  ))
                )}
              </div>
            </Scrollbar>
          </>
        ) : (
          <>
            {/* Market + segment chips — kit Badge: active market & segment (color,
                removable via the built-in X) + Add market (primary, trailing +). */}
            <div className="flex flex-wrap items-center gap-1 pr-2">
              <Badge
                variant="color"
                size="xs"
                onClose={clearMarket}
                closeLabel={`Remove market ${marketChipLabel ?? ""}`}
              >
                {marketChipLabel}
              </Badge>
              <Badge
                variant="color"
                size="xs"
                onClose={() => setSelectedSegment(null)}
                closeLabel={`Remove segment ${selectedSegmentLabel ?? ""}`}
              >
                {selectedSegmentLabel}
              </Badge>
              <Badge
                variant="primary"
                size="xs"
                trailingIcon={<Plus />}
                role="button"
                tabIndex={0}
                style={{ cursor: "pointer" }}
                onClick={clearMarket}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    clearMarket();
                  }
                }}
              >
                Add market
              </Badge>
            </div>

            {/* Total customers in the market — between the market chips and the
                search. Kit Number at its smallest size (sm), scaled down further
                since `sm` is the component's floor. */}
            <div className="flex items-center gap-2 pr-2">
              <span className="font-mono text-[11px] uppercase tracking-wider leading-none text-[var(--text-labels)]">
                Total
              </span>
              <span className="inline-flex origin-left" style={{ transform: "scale(0.72)" }}>
                <Number type="colored-full" color="blue" numberSize="sm">
                  {visibleCards.length}
                </Number>
              </span>
            </div>

            {/* Search — kit SearchBar (same component as the Value Network search). */}
            <div className="pr-2">
              <SearchBar
                size="sm"
                className="sb-full"
                value={cardQuery}
                onChange={(e) => setCardQuery(e.target.value)}
                onClear={() => setCardQuery("")}
                placeholder="Search for a specific customer..."
                aria-label="Search customers"
              />
            </div>

            {/* Cards — kit CustomerCard, one per company in the market. */}
            <Scrollbar className="-mr-2 min-h-0 flex-1 space-y-2 pr-2">
              {visibleCards.length === 0 ? (
                <div className="p-6 text-center text-sm text-[var(--text-labels)]">
                  {marketCompanies.length === 0
                    ? "No customers in this market."
                    : "No customers match your filters or search."}
                </div>
              ) : (
                visibleCards.map((c) => (
                  <CustomerCard
                    key={c.id}
                    companyName={c.name}
                    location={`${c.city}, ${c.country}`}
                    onLocate={
                      c.lat != null && c.lon != null
                        ? () => handleShowLocation(c.lat as number, c.lon as number)
                        : undefined
                    }
                    category={c.industry}
                    employees={c.employees != null ? c.employees.toLocaleString("en-US") : undefined}
                    revenue={`${revenueBand(c.employees, c.revLowerUsd, c.revHigherUsd)} $`}
                    selected={c.id === selectedId}
                    onClick={() => setSelectedId(c.id)}
                  />
                ))
              )}
            </Scrollbar>
          </>
        )}
      </aside>

      {/* Focused "All filters" panel — floats over the right side of the map.
          Only shown once a market is picked (the button lives in that state). */}
      {selectedSegment != null && filtersOpen && (
        <CustomerFilterPanel
          rows={marketCompanies}
          filters={filters}
          onChange={setFilters}
          onClose={() => setFiltersOpen(false)}
          resultCount={marketFiltered.length}
          totalCount={marketCompanies.length}
        />
      )}
    </div>
  );
}

// Sales page = the ported pharma-map app inside the odi_waldner chrome. A single
// full-width Navbar (brand logo + actions) spans the top of the whole page; below
// it the shared sidebar (Product Management / Sales) sits left of the SalesApp,
// so "Sales" reads as the current selection. The logo now lives in the Navbar,
// not the sidebar.
export default function SalesPage() {
  return (
    <div className="sales-root" style={{ display: "flex", flexDirection: "column", height: "100vh", background: "var(--color-page)" }}>
      <Navbar brand={<Logo style={{ height: 16, width: "auto", display: "block" }} />}>
        <ReportActions />
      </Navbar>

      <div style={{ display: "flex", flex: 1, minWidth: 0, minHeight: 0 }}>
        <Sidebar>
          <ReportSidebar />
        </Sidebar>

        <div style={{ display: "flex", flex: 1, minWidth: 0 }}>
          <SalesApp />
        </div>
      </div>
    </div>
  );
}
