import { useEffect, useMemo, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import "leaflet.markercluster";
import { MapContainer, TileLayer, useMap, ZoomControl } from "react-leaflet";
import { renderToStaticMarkup } from "react-dom/server";
import { Pin } from "@node42/ui-kit";
import type { Company } from "@/lib/types";
import { useTheme } from "@/components/shell/ThemeToggle";

// Fix default marker URLs (Next.js bundler quirk)
delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Map markers reuse the @node42/ui-kit <Pin> component. Leaflet can't mount a
// React node, so we render the Pin to static HTML and wrap it in an L.divIcon.
// The Pin's CSS-module classes resolve because the component (and therefore its
// stylesheet) is imported. We use the pin HEAD only — company names keep coming
// from Leaflet tooltips (see ClusteredMarkers), so the Pin's own label box is
// hidden via .n42-kitpin in globals.css. Small size: 16px glyph + 4px padding = 24px.
const KIT_PIN_HEAD = 24;

// Multi-line HQ address (street / city + postcode / country), shown under the
// name in the kit Pin's SELECTED label — mirrors the kit's selected variant.
// Returns undefined when there's nothing beyond the name to show.
function hqAddress(c: Company): string | undefined {
  const hq = c.locations?.[0];
  const street = hq?.street ?? null;
  const city = hq?.city ?? c.city ?? null;
  const postcode = hq?.postcode ?? null;
  const country = hq?.country ?? c.country ?? null;
  const cityLine = [city, postcode ? `(${postcode})` : null].filter(Boolean).join(" ");
  const lines = [street, cityLine || null, country].filter(Boolean);
  return lines.length ? lines.join("\n") : undefined;
}

// HQ / company marker: default (secondary head) or selected (yellow head), kit
// "small" size. When `label` is set, the kit Pin renders its OWN label box (the
// name rectangle) — used at high zoom / when selected — instead of the old
// Leaflet permanent tooltip. The selected variant also shows `address` under the
// name. `dimmed` is for subordinate office pins.
function kitPinIcon(opts: { selected?: boolean; dimmed?: boolean; label?: string; address?: string } = {}): L.DivIcon {
  const labeled = !!opts.label;
  const inner = renderToStaticMarkup(
    <Pin
      variant={opts.selected ? "selected" : "default"}
      size="small"
      name={opts.label}
      address={opts.address}
      aria-hidden
    />,
  );
  const cls =
    "n42-kitpin" +
    (labeled ? " n42-kitpin-labeled" : "") +
    (opts.dimmed ? " n42-kitpin-dimmed" : "");
  // Anchor at the head centre so the head sits on the geo point and the label
  // box (when present) extends to the right. iconSize stays the head box; the
  // label overflows and is click-through (see .n42-kitpin-labeled in globals.css).
  return L.divIcon({
    html: `<div class="${cls}">${inner}</div>`,
    className: "n42-kitpin-wrapper",
    iconSize: [KIT_PIN_HEAD, KIT_PIN_HEAD],
    iconAnchor: [KIT_PIN_HEAD / 2, KIT_PIN_HEAD / 2],
    popupAnchor: [0, -KIT_PIN_HEAD / 2],
    tooltipAnchor: [KIT_PIN_HEAD / 2 + 2, 0],
  });
}

// Filter outliers and fit to the dense central cluster instead of including
// the whole world (a few US/Asia outliers stretch the bounds otherwise).
function denseBounds(points: Company[]): L.LatLngBounds | null {
  if (!points.length) return null;
  // Tight percentile band keeps the dense DACH cluster centered, dropping
  // far-out outliers (US/Asia) so the default view matches the Figma zoom.
  const lats = points.map((p) => p.lat as number).sort((a, b) => a - b);
  const lons = points.map((p) => p.lon as number).sort((a, b) => a - b);
  const q = (arr: number[], p: number) => arr[Math.max(0, Math.min(arr.length - 1, Math.floor(arr.length * p)))];
  const latLo = q(lats, 0.15), latHi = q(lats, 0.85);
  const lonLo = q(lons, 0.15), lonHi = q(lons, 0.85);
  return L.latLngBounds([latLo, lonLo], [latHi, lonHi]);
}

// Measure the right-edge (in container-local pixels) of any floating glass
// chrome (sidebar + drawer) that sits over the map. Works at any viewport
// size because it reads the live DOM. Returns 0 if the map element is
// missing or no floating panels are present (e.g. list view).
function measureLeftChromeRight(map: L.Map): number {
  try {
    const container = map.getContainer();
    const containerRect = container.getBoundingClientRect();
    const candidates = Array.from(
      document.querySelectorAll<HTMLElement>('main aside, [data-testid="company-drawer"]')
    );
    let maxRight = 0;
    for (const el of candidates) {
      const cs = window.getComputedStyle(el);
      if (cs.position !== "absolute" && cs.position !== "fixed") continue;
      const r = el.getBoundingClientRect();
      // Only count panels that visually overlap the map container on the LEFT.
      if (r.right <= containerRect.left) continue;
      if (r.left >= containerRect.right) continue;
      // Convert to container-local space.
      const localRight = r.right - containerRect.left;
      if (localRight < containerRect.width * 0.75) {
        // Heuristic: only panels rooted on the left half are "left chrome".
        // The MapControls top-right cluster sits in the right portion and
        // shouldn't influence centering.
        if (localRight > maxRight) maxRight = localRight;
      }
    }
    return Math.max(0, maxRight);
  } catch {
    return 0;
  }
}

function FitToBounds({ rows, selectedId }: { rows: Company[]; selectedId: string | null }) {
  const map = useMap();
  // State machine refs — survive across renders without causing re-runs.
  // `didInitialFitRef` flips to true once the first fit-overview has run
  // (after rows are loaded). `prevSelectedIdRef` tracks the previous
  // selection so we can distinguish:
  //   - new selection → flyTo
  //   - selection cleared (drawer close) → DO NOTHING (preserve view)
  //   - selection unchanged → no-op
  const didInitialFitRef = useRef(false);
  const prevSelectedIdRef = useRef<string | null>(null);
  useEffect(() => {
    const points = rows.filter((r) => r.lat != null && r.lon != null);
    if (!points.length) return;

    const recentreSelected = (sel: Company) => {
      try { map.invalidateSize(); } catch {}
      const containerSize = map.getSize();
      const leftChromeRight = measureLeftChromeRight(map);

      // Collect coords for the selected company: the flat HQ coord PLUS
      // every location (HQ + offices) with role HQ/office that has lat/lon.
      // For bounds-fitting we constrain to DACH (CHE/DEU/AUT) — the
      // customer's target geo — so a single overseas office doesn't drag
      // the view out to the world. Non-DACH office pins still render
      // (dimmed) via SelectedOfficePins; they're just excluded from bounds.
      const DACH = new Set(["CHE", "DEU", "AUT"]);
      const allLatLngs: L.LatLng[] = [];
      const hqCountry = sel.country ?? null;
      if (sel.lat != null && sel.lon != null && (!hqCountry || DACH.has(hqCountry))) {
        allLatLngs.push(L.latLng(sel.lat as number, sel.lon as number));
      }
      for (const loc of sel.locations ?? []) {
        const role = (loc as { role?: string }).role;
        if (role && role !== "HQ" && role !== "office") continue;
        if (loc.lat == null || loc.lon == null) continue;
        if (loc.country && !DACH.has(loc.country)) continue;
        allLatLngs.push(L.latLng(loc.lat as number, loc.lon as number));
      }
      // Safety: if filtering wiped everything (e.g. non-DACH HQ), fall
      // back to the flat HQ coord so we still recentre on the company.
      if (allLatLngs.length === 0 && sel.lat != null && sel.lon != null) {
        allLatLngs.push(L.latLng(sel.lat as number, sel.lon as number));
      }

      // De-dupe identical coords (HQ often duplicated in locations[0]).
      const seen = new Set<string>();
      const uniquePoints = allLatLngs.filter((p) => {
        const k = `${p.lat.toFixed(6)},${p.lng.toFixed(6)}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });

      // 2+ points → fit bounds across the whole footprint, respecting left chrome.
      if (uniquePoints.length >= 2) {
        const bounds = L.latLngBounds(uniquePoints);
        const visibleWidth = containerSize.x - leftChromeRight;
        const usableChrome =
          leftChromeRight > 0 && visibleWidth >= containerSize.x * 0.25
            ? leftChromeRight
            : 0;
        try {
          map.fitBounds(bounds, {
            paddingTopLeft: [usableChrome + 32, 32],
            paddingBottomRight: [32, 32],
            maxZoom: 11,
            animate: true,
            duration: 0.6,
          });
        } catch {}
        return;
      }

      // Single-point fallback — preserve the original flyTo behaviour.
      const target = uniquePoints[0] ?? L.latLng(sel.lat as number, sel.lon as number);
      const targetZoom = Math.max(map.getZoom(), 9);
      // If chrome covers ≥75% of the viewport (mobile-ish narrow screens),
      // skip the offset and just center normally — the panels would
      // overlap the map regardless and shifting further makes it worse.
      const visibleWidth = containerSize.x - leftChromeRight;
      if (leftChromeRight === 0 || visibleWidth < containerSize.x * 0.25) {
        map.flyTo(target, targetZoom, { duration: 0.5 });
        return;
      }
      // Visible map area runs from leftChromeRight → containerSize.x.
      // Centre the pin within that area.
      const visibleCenterX = (leftChromeRight + containerSize.x) / 2;
      const offsetX = visibleCenterX - containerSize.x / 2;
      const targetPoint = map.project(target, targetZoom).subtract([offsetX, 0]);
      const shifted = map.unproject(targetPoint, targetZoom);
      map.flyTo(shifted, targetZoom, { duration: 0.5 });
    };

    const fitOverview = () => {
      try { map.invalidateSize(); } catch {}
      const bounds = denseBounds(points);
      if (!bounds) return;
      const containerSize = map.getSize();
      const leftChromeRight = measureLeftChromeRight(map);
      // Pad on the left by chrome width (+ small gutter); if it would
      // crowd the viewport (>75%), drop back to a small symmetric pad.
      const leftPad =
        leftChromeRight > 0 && leftChromeRight < containerSize.x * 0.75
          ? leftChromeRight + 16
          : 20;
      try {
        map.fitBounds(bounds, {
          paddingTopLeft: [leftPad, 20],
          paddingBottomRight: [20, 20],
          maxZoom: 8,
        });
      } catch {}
    };

    // State-machine dispatch:
    // 1) Initial mount with data → fit overview ONCE, then mark done.
    // 2) New selection (differs from prev) → flyTo / fitBounds via recentre.
    // 3) Drawer close (selected → null) → preserve the user's view; just
    //    update the prev-selected ref so a future re-select still flies.
    // 4) No-op when selection is unchanged (e.g. rows reference changed).
    if (!didInitialFitRef.current) {
      didInitialFitRef.current = true;
      prevSelectedIdRef.current = selectedId;
      if (selectedId) {
        const sel = points.find((p) => p.id === selectedId);
        if (sel) {
          requestAnimationFrame(() => recentreSelected(sel));
          return;
        }
      }
      requestAnimationFrame(fitOverview);
      return;
    }

    if (selectedId && selectedId !== prevSelectedIdRef.current) {
      const sel = points.find((p) => p.id === selectedId);
      prevSelectedIdRef.current = selectedId;
      if (sel) {
        requestAnimationFrame(() => recentreSelected(sel));
      }
      return;
    }

    if (!selectedId && prevSelectedIdRef.current !== null) {
      // Drawer closed — KEEP the current camera. Just clear the ref.
      prevSelectedIdRef.current = null;
      return;
    }

    // selectedId === prevSelectedIdRef.current → nothing to do.
  }, [rows, selectedId, map]);

  // Re-fit when the window resizes so panel offsets stay correct on any
  // screen size (laptop → external monitor, browser-resize, devtools open).
  useEffect(() => {
    const handle = () => {
      try { map.invalidateSize(); } catch {}
    };
    window.addEventListener("resize", handle);
    return () => window.removeEventListener("resize", handle);
  }, [map]);
  return null;
}

// Cluster bubble — the @node42/ui-kit <Pin> "group" variant (pill head + count).
function clusterIconCreate(cluster: L.MarkerCluster) {
  const count = cluster.getChildCount();
  const inner = renderToStaticMarkup(
    <Pin variant="group" size="small" count={count} aria-hidden />,
  );
  // Approximate the (small) pill width so the divIcon box and its anchor track
  // the glyph + count text; Leaflet only needs this for centring.
  const width = 32 + String(count).length * 8;
  return L.divIcon({
    html: `<div class="n42-kitpin n42-kitpin-group">${inner}</div>`,
    className: "n42-kitpin-wrapper",
    iconSize: L.point(width, KIT_PIN_HEAD),
    iconAnchor: L.point(width / 2, KIT_PIN_HEAD / 2),
  });
}

// Imperative marker-cluster layer driven from inside <MapContainer>.
// Idempotent under React 19 strict-mode double-mount via useRef.
function ClusteredMarkers({
  rows,
  selectedId,
  onSelect,
}: {
  rows: Company[];
  selectedId: string | null;
  onSelect: (c: Company) => void;
}) {
  const map = useMap();
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const selectedMarkerRef = useRef<L.Marker | null>(null);

  // Lazily create the cluster group once.
  if (clusterRef.current === null) {
    clusterRef.current = (L as unknown as { markerClusterGroup: (opts: unknown) => L.MarkerClusterGroup })
      .markerClusterGroup({
        showCoverageOnHover: false,
        spiderfyOnMaxZoom: true,
        // Tight radius — only literally-overlapping coords merge. Same-city
        // pharma companies (which sit several blocks apart) remain visible
        // as distinct pins at city-level zoom.
        maxClusterRadius: 30,
        chunkedLoading: true,
        iconCreateFunction: clusterIconCreate,
      });
  }

  // Attach to map; on unmount just remove (don't dispose — keeps strict-mode safe).
  useEffect(() => {
    const cluster = clusterRef.current!;
    map.addLayer(cluster);
    return () => {
      map.removeLayer(cluster);
    };
  }, [map]);

  // Rebuild markers whenever rows/selectedId change. The selected marker is
  // rendered DIRECTLY on the map (outside the cluster) so its label is always
  // visible, even when its neighbours are clustered.
  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;
    cluster.clearLayers();
    // Remove any prior standalone selected marker.
    if (selectedMarkerRef.current) {
      try { map.removeLayer(selectedMarkerRef.current); } catch {}
      selectedMarkerRef.current = null;
    }
    const coordCounts = buildCoordCounts(rows);
    const markers: L.Marker[] = [];
    for (const c of rows) {
      if (c.lat == null || c.lon == null) continue;
      const isSelected = c.id === selectedId;
      const [lat, lon] = jitterCoords(c, coordCounts);
      // An individually-rendered (non-clustered) location ALWAYS shows its name
      // — only a cluster (the "group" pin) collapses names into a count. When a
      // marker is clustered, markercluster swaps it for the group icon anyway.
      const m = L.marker([lat, lon], {
        icon: kitPinIcon({
          selected: isSelected,
          label: c.name,
          address: isSelected ? hqAddress(c) : undefined,
        }),
        riseOnHover: true,
        zIndexOffset: isSelected ? 1000 : 0,
      });
      m.on("click", () => onSelect(c));
      if (isSelected) {
        // Render the selected marker outside the cluster so its label is
        // always visible (clusters hide their child markers from the DOM).
        m.addTo(map);
        selectedMarkerRef.current = m;
      } else {
        markers.push(m);
      }
    }
    cluster.addLayers(markers);
  }, [rows, selectedId, onSelect, map]);

  // Cleanup standalone selected marker on unmount.
  useEffect(() => {
    return () => {
      if (selectedMarkerRef.current) {
        try { map.removeLayer(selectedMarkerRef.current); } catch {}
        selectedMarkerRef.current = null;
      }
    };
  }, [map]);

  return null;
}

// Selection-driven office pin layer. Renders ONLY the office locations of the
// currently-selected company (HQ already rendered via `ClusteredMarkers` from
// the flat company.lat/lon). Pins use the secondary `buildOfficeIcon` style
// and link to the SAME drawer record when clicked. Cleared on selection
// change or unmount.
function SelectedOfficePins({
  rows,
  selectedId,
  onSelect,
}: {
  rows: Company[];
  selectedId: string | null;
  onSelect: (c: Company) => void;
}) {
  const map = useMap();
  const markersRef = useRef<L.Marker[]>([]);

  useEffect(() => {
    // Clear previous office pins on any change (selection swap or unselect).
    for (const m of markersRef.current) {
      try { map.removeLayer(m); } catch {}
    }
    markersRef.current = [];

    if (!selectedId) return;
    const sel = rows.find((r) => r.id === selectedId);
    if (!sel) return;
    const locs = sel.locations ?? [];
    if (locs.length <= 1) return;
    // Skip the HQ at locations[0]; render the rest.
    for (const loc of locs.slice(1)) {
      if (loc.lat == null || loc.lon == null) continue;
      // Visually mark non-DACH offices as dimmed — present but subordinate.
      const dimmed = !(loc.country === "DEU" || loc.country === "AUT" || loc.country === "CHE");
      const m = L.marker([loc.lat, loc.lon], {
        icon: kitPinIcon({ dimmed }),
        riseOnHover: true,
        zIndexOffset: 500,
      });
      m.bindTooltip(
        `<div class="n42-tooltip"><div class="n42-tooltip-name">${escapeHtml(sel.name)}</div><div class="n42-tooltip-meta">${escapeHtml(loc.city)}, ${escapeHtml(loc.country)} · office</div></div>`,
        { direction: "top", offset: [0, -6], opacity: 1, sticky: true },
      );
      // Clicking an office pin selects the SAME company — keeps the drawer
      // record stable so secondary-site clicks don't open a different record.
      m.on("click", () => onSelect(sel));
      m.addTo(map);
      markersRef.current.push(m);
    }

    return () => {
      for (const m of markersRef.current) {
        try { map.removeLayer(m); } catch {}
      }
      markersRef.current = [];
    };
  }, [rows, selectedId, map, onSelect]);

  return null;
}

// Deterministic 32-bit hash (FNV-1a) — stable across reloads.
function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h >>> 0;
}

// Build a coord-collision lookup: "lat,lon" → count. Used to decide whether
// a given company needs jitter (only when a sibling shares its exact coords,
// e.g. multiple companies geocoded to the same city centroid).
function buildCoordCounts(rows: Company[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const c of rows) {
    if (c.lat == null || c.lon == null) continue;
    const k = `${c.lat},${c.lon}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return counts;
}

// Returns the company's coords unchanged when unique, else applies a small
// deterministic jitter (~±0.008° ≈ ±900m) keyed by the company id so loads
// are stable. Keeps same-city duplicates visibly separate without merging
// them into a cluster bubble.
function jitterCoords(c: Company, counts: Map<string, number>): [number, number] {
  const lat = c.lat as number;
  const lon = c.lon as number;
  const key = `${lat},${lon}`;
  if ((counts.get(key) ?? 0) <= 1) return [lat, lon];
  const dLat = ((hash32(c.id) % 200) - 100) * 0.00008;
  const dLon = ((hash32(c.id + ":lon") % 200) - 100) * 0.00008;
  return [lat + dLat, lon + dLon];
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Coordinate hint used by the drawer's "Show on map" affordance. Each call
// gets a fresh `nonce` so a second click on the SAME location still triggers
// a flyTo (since the lat/lon tuple is reference-equal across renders).
export type MapHint = { lat: number; lon: number; nonce: number };

// Imperative flyTo driven by an external coordinate hint (e.g. the drawer's
// "Show on map" button). Mounted inside <MapContainer> so it has access to
// the live map instance.
//
// Chrome-aware: shifts the target horizontally so the pin lands in the
// VISIBLE map area (right of the drawer + sidebar), not behind them. Same
// pattern as `FitToBounds.recentreSelected`.
//
// Zoom heuristic: defaults to city-level (z=11) so the pin is recognizable.
// But if the user is currently zoomed out AND the target is far from the
// current center (>~200km), keeps the current zoom — otherwise a click on
// a faraway office (e.g. Bayer Bogota) would violently zoom in past
// continents.
function FlyToHint({ hint }: { hint: MapHint | null }) {
  const map = useMap();
  useEffect(() => {
    if (!hint) return;
    try {
      const target = L.latLng(hint.lat, hint.lon);
      try { map.invalidateSize(); } catch {}
      const containerSize = map.getSize();
      const leftChromeRight = measureLeftChromeRight(map);

      // Pick a sensible zoom: city-level by default, but back off when the
      // user is wide-zoomed and the target is far from the current center.
      const currentZoom = map.getZoom();
      let targetZoom = Math.max(currentZoom, 11);
      if (currentZoom < 11) {
        const distKm = map.getCenter().distanceTo(target) / 1000;
        if (distKm > 200) {
          // Keep the current zoom so we don't punch in across continents.
          targetZoom = currentZoom;
        }
      }

      const visibleWidth = containerSize.x - leftChromeRight;
      if (leftChromeRight === 0 || visibleWidth < containerSize.x * 0.25) {
        // No left chrome (or it covers ≥75% of viewport) → plain flyTo.
        map.flyTo(target, targetZoom, { duration: 0.5 });
        return;
      }
      // Visible map area runs from leftChromeRight → containerSize.x.
      // Centre the pin within that area by shifting the projected target left
      // by half the chrome width (so unprojecting yields a coord that, when
      // centered, leaves the pin in the visible band).
      const visibleCenterX = (leftChromeRight + containerSize.x) / 2;
      const offsetX = visibleCenterX - containerSize.x / 2;
      const targetPoint = map.project(target, targetZoom).subtract([offsetX, 0]);
      const shifted = map.unproject(targetPoint, targetZoom);
      map.flyTo(shifted, targetZoom, { duration: 0.5 });
    } catch {}
  }, [hint, map]);
  return null;
}

export default function MapCanvas({
  rows,
  selectedId,
  onSelect,
  hint,
}: {
  rows: Company[];
  selectedId: string | null;
  onSelect: (c: Company) => void;
  hint?: MapHint | null;
}) {
  const center = useMemo<[number, number]>(() => [49.5, 9.5], []);
  const points = useMemo(() => rows.filter((r) => r.lat != null && r.lon != null), [rows]);
  const theme = useTheme();
  const isLight = theme === "light";

  return (
    <div className="absolute inset-0" data-testid="map-canvas" style={{ minHeight: 300 }}>
      <MapContainer
        center={center}
        zoom={5}
        style={{ width: "100%", height: "100%" }}
        scrollWheelZoom
        zoomControl={false}
        attributionControl
      >
        {isLight ? (
          <TileLayer
            key="light-voyager"
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png"
            subdomains="abcd"
            detectRetina
          />
        ) : (
          <>
            <TileLayer
              key="dark-base"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              detectRetina
            />
            <TileLayer
              key="dark-labels"
              url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              detectRetina
            />
          </>
        )}
        <ZoomControl position="bottomright" />
        <FitToBounds rows={points} selectedId={selectedId} />
        <ClusteredMarkers
          rows={points}
          selectedId={selectedId}
          onSelect={onSelect}
        />
        <SelectedOfficePins rows={rows} selectedId={selectedId} onSelect={onSelect} />
        <FlyToHint hint={hint ?? null} />
      </MapContainer>
    </div>
  );
}
