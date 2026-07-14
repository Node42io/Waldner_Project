import { useEffect, useMemo, useRef, useState } from "react";
import { SearchBar, Badge, Scrollbar } from "@node42/ui-kit";
import { countryLabel as countryName } from "@/lib/market-query";
import type { Company } from "@/lib/types";

type CitySuggestion = { kind: "city"; city: string; country: string; lat: number; lon: number; count: number };
type CountrySuggestion = { kind: "country"; iso: string; lat: number; lon: number; count: number };
type LocationSuggestion = CitySuggestion | CountrySuggestion;

const MAX_PER_GROUP = 6;

/**
 * Floating map geocoder — pure navigation, fully independent of the result
 * search/filters. Typing a city or country flies the map there via
 * onPickCity/onPickCountry; it has its OWN input state and never touches
 * `filters.q` or the Customer List. Suggestions are drawn from the full dataset
 * so you can jump anywhere even before any filter is applied.
 */
export function MapSearch({
  rows,
  onPickCity,
  onPickCountry,
}: {
  rows: Company[];
  onPickCity: (city: string, lat: number, lon: number) => void;
  onPickCountry: (iso: string, lat: number, lon: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Unique cities (with a representative coordinate + count).
  const cities = useMemo(() => {
    const m = new Map<string, CitySuggestion>();
    for (const r of rows) {
      if (!r.city || r.lat == null || r.lon == null) continue;
      const key = `${r.city}|${r.country}`;
      const e = m.get(key);
      if (e) e.count += 1;
      else m.set(key, { kind: "city", city: r.city, country: r.country, lat: r.lat, lon: r.lon, count: 1 });
    }
    return [...m.values()];
  }, [rows]);

  // Unique countries (centroid of their companies + count).
  const countries = useMemo(() => {
    const m = new Map<string, { iso: string; sumLat: number; sumLon: number; n: number; count: number }>();
    for (const r of rows) {
      if (!r.country) continue;
      const e = m.get(r.country) ?? { iso: r.country, sumLat: 0, sumLon: 0, n: 0, count: 0 };
      e.count += 1;
      if (r.lat != null && r.lon != null) { e.sumLat += r.lat; e.sumLon += r.lon; e.n += 1; }
      m.set(r.country, e);
    }
    return [...m.values()]
      .filter((e) => e.n > 0)
      .map<CountrySuggestion>((e) => ({ kind: "country", iso: e.iso, lat: e.sumLat / e.n, lon: e.sumLon / e.n, count: e.count }));
  }, [rows]);

  const q = query.trim().toLowerCase();

  const matches = useMemo<LocationSuggestion[]>(() => {
    if (!q) return [];
    const cityHits = cities
      .filter((c) => c.city.toLowerCase().includes(q) || countryName(c.country).toLowerCase().includes(q))
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_PER_GROUP);
    const countryHits = countries
      .filter((c) => countryName(c.iso).toLowerCase().includes(q) || c.iso.toLowerCase().includes(q))
      .sort((a, b) => b.count - a.count)
      .slice(0, MAX_PER_GROUP);
    return [...countryHits, ...cityHits];
  }, [cities, countries, q]);

  const showDropdown = open && q.length > 0 && matches.length > 0;

  return (
    <div ref={wrapRef} className="relative w-60">
      <div className="rounded-lg shadow-md">
        <SearchBar
          size="sm"
          className="sb-full"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onClear={() => { setQuery(""); setOpen(false); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
          placeholder="Find a city or country…"
          aria-label="Find a city or country"
        />
      </div>

      {showDropdown && (
        <Scrollbar
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+var(--space-100))] z-30 max-h-[288px] rounded-[var(--radius-sm)] border border-[var(--border-default-default-lighter)] bg-[var(--surface-default-default)] shadow-[var(--shadow-s)] p-[var(--space-100)]"
        >
          {matches.map((loc) =>
            loc.kind === "country" ? (
              <button
                key={`country-${loc.iso}`}
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => { onPickCountry(loc.iso, loc.lat, loc.lon); setQuery(countryName(loc.iso)); setOpen(false); }}
                className="w-full flex items-center gap-[var(--space-200)] px-[var(--space-300)] py-[var(--space-200)] rounded-[var(--radius-xs)] text-left text-[length:var(--font-size-b2)] text-[var(--text-body)] hover:bg-[var(--surface-default-hover)] transition-colors"
              >
                <span className="flex-1 truncate">{countryName(loc.iso)}</span>
                <Badge variant="neutral" size="xs" className="font-mono">{loc.count}</Badge>
              </button>
            ) : (
              <button
                key={`city-${loc.city}-${loc.country}`}
                type="button"
                role="option"
                aria-selected={false}
                onClick={() => { onPickCity(loc.city, loc.lat, loc.lon); setQuery(loc.city); setOpen(false); }}
                className="w-full flex items-center gap-[var(--space-200)] px-[var(--space-300)] py-[var(--space-200)] rounded-[var(--radius-xs)] text-left text-[length:var(--font-size-b2)] text-[var(--text-body)] hover:bg-[var(--surface-default-hover)] transition-colors"
              >
                <span className="flex-1 truncate">{loc.city}</span>
                <span className="text-[length:var(--font-size-b4)] font-mono text-[var(--text-description)]">{countryName(loc.country)}</span>
                <Badge variant="neutral" size="xs" className="font-mono">{loc.count}</Badge>
              </button>
            )
          )}
        </Scrollbar>
      )}
    </div>
  );
}
