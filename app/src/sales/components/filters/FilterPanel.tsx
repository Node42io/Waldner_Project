import { useEffect, useMemo, useRef, useState } from "react";
import { MagnifyingGlass as Search, X, CaretDown as ChevronDown, Sparkle, Check, Storefront, Globe } from "@phosphor-icons/react";
import { InputField, Badge, Button, Text, Dropdown, Scrollbar } from "@node42/ui-kit";
import { COUNTRY_OPTIONS, countryLabel } from "@/lib/market-query";
import type { Filters, Company } from "@/lib/types";
import { EMPTY_FILTERS } from "@/lib/types";
import { countByValue } from "@/lib/filters";
import { NAICS_GROUPS, coreNaics } from "@/lib/naics";
import { prettifyTag } from "@/lib/format";

type Props = {
  rows: Company[];
  filters: Filters;
  onChange: (next: Filters) => void;
  /** Dismiss the floating box (X button + outside click). */
  onClose?: () => void;
  /** Render flush inside a parent (Customer List) instead of as a floating box. */
  inline?: boolean;
};

function SectionCard({
  title,
  count,
  children,
  defaultOpen = true,
  leadingIcon,
}: {
  title: string;
  count?: number;
  children?: React.ReactNode;
  defaultOpen?: boolean;
  leadingIcon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="bg-[var(--bg-panel)] border border-[var(--line)] rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-[13px] hover:bg-[var(--bg-panel-2)]/40 transition-colors"
      >
        <span className="flex items-center gap-2 font-medium text-[var(--ink)]">
          {leadingIcon}
          <Text variant="b2" weight="medium" as="span">{title}</Text>
          {count != null && count > 0 && (
            <Badge variant="neutral" size="xs" className="font-mono">{count}</Badge>
          )}
        </span>
        <ChevronDown
          size={14}
          weight="bold"
          className={`text-[var(--muted)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && children && <div className="px-4 pb-4 pt-1">{children}</div>}
    </section>
  );
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <Badge variant="neutral" size="sm" onClose={onRemove} closeLabel={`Remove ${label}`}>
      <span className="truncate max-w-[140px]">{label}</span>
    </Badge>
  );
}

function YellowCheckbox({ checked }: { checked: boolean }) {
  return (
    <span
      className={`size-[18px] rounded-[5px] grid place-items-center shrink-0 transition border ${
        checked
          ? "bg-[var(--accent)] border-[var(--accent)] shadow-[0_0_0_2px_rgba(253,255,152,0.12)]"
          : "bg-transparent border-[var(--line)] group-hover:border-[var(--muted)]"
      }`}
      aria-checked={checked}
      role="checkbox"
    >
      {checked && <Check size={12} weight="bold" className="text-black" />}
    </span>
  );
}

function SearchInput({
  value,
  onChange,
  placeholder,
  testId,
  icon,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  testId?: string;
  icon?: React.ReactNode;
}) {
  return (
    <InputField
      data-testid={testId}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      leading={icon ?? <Search size={14} weight="bold" />}
      trailing={
        value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="size-5 grid place-items-center rounded-full text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--bg-panel-2)]"
          >
            <X size={14} weight="bold" />
          </button>
        ) : undefined
      }
    />
  );
}

function ListItem({
  label,
  count,
  checked,
  onToggle,
}: {
  label: string;
  count?: number;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onToggle}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(); } }}
      className={`group w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-[13px] text-left cursor-pointer transition-colors ${
        checked ? "text-[var(--ink)]" : "text-[var(--muted)] hover:text-[var(--ink)]"
      } hover:bg-[var(--bg-panel-2)]/40`}
    >
      <YellowCheckbox checked={checked} />
      <span className="flex-1 truncate">{label}</span>
      {count != null && (
        <span className="text-[10px] font-mono text-[var(--dim)] group-hover:text-[var(--muted)]">{count}</span>
      )}
    </div>
  );
}

export function FilterPanel({ rows, filters, onChange, onClose, inline = false }: Props) {
  const boxRef = useRef<HTMLDivElement>(null);

  // Close on outside click / Escape. The Filters toggle button is excluded so
  // clicking it while open hands control back to the toggle (close → reopen).
  useEffect(() => {
    if (!onClose) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as HTMLElement;
      if (boxRef.current?.contains(t)) return;
      if (t.closest('[data-testid="toggle-filters"]')) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const bucketCounts = useMemo(() => countByValue(rows, "buckets"), [rows]);
  const countryCounts = useMemo(() => countByValue(rows, "country"), [rows]);
  const naicsCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const r of rows) {
      const code = coreNaics(r).code;
      out[code] = (out[code] ?? 0) + 1;
    }
    return out;
  }, [rows]);

  const coverage = useMemo(() => {
    const total = rows.length;
    let nWithContacts = 0;
    let nWithDescription = 0;
    let nWithGrowth = 0;
    let nWithCoords = 0;
    for (const r of rows) {
      if ((r.contacts?.length ?? 0) > 0) nWithContacts += 1;
      if ((r.description ?? "").trim().length >= 80) nWithDescription += 1;
      if (r.growth12mPct != null || !!r.buildSignal?.trim()) nWithGrowth += 1;
      if (r.lat != null && r.lon != null) nWithCoords += 1;
    }
    return { total, nWithContacts, nWithDescription, nWithGrowth, nWithCoords };
  }, [rows]);

  const buckets = useMemo(
    () => Object.entries(bucketCounts).sort((a, b) => b[1] - a[1]),
    [bucketCounts]
  );
  const countries = useMemo(
    () => Object.entries(countryCounts).sort((a, b) => b[1] - a[1]),
    [countryCounts]
  );

  const [marketSearch, setMarketSearch] = useState("");
  const filteredBuckets = useMemo(() => {
    const q = marketSearch.trim().toLowerCase();
    if (!q) return buckets;
    return buckets.filter(
      ([b]) => b.toLowerCase().includes(q) || prettifyTag(b).toLowerCase().includes(q)
    );
  }, [buckets, marketSearch]);

  const activeCount =
    (filters.q ? 1 : 0) +
    filters.buckets.length +
    filters.oncologyTags.length +
    filters.countries.length +
    (filters.employeesMin != null ? 1 : 0) +
    (filters.employeesMax != null ? 1 : 0) +
    filters.status.length +
    filters.tiers.length +
    filters.naicsGroups.length +
    (filters.hasBuildSignal ? 1 : 0);

  const hasActive = activeCount > 0;

  function toggle<T extends string>(arr: T[], v: T): T[] {
    return arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v];
  }

  return (
    <aside
      ref={boxRef}
      className={
        inline
          ? "filter-panel w-full h-full flex flex-col overflow-hidden"
          : "filter-panel absolute top-14 right-3 z-[1100] w-[342px] max-h-[calc(100vh-72px)] bg-[var(--bg-panel)]/95 backdrop-blur-xl backdrop-saturate-150 border border-[var(--line)] rounded-2xl shadow-[0_24px_70px_-15px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.04)_inset] flex flex-col overflow-hidden"
      }
    >
      {/* Panel header — shown for the floating box and the inline drawer (when it
          provides onClose); a bare inline embed with no onClose hides it. */}
      {(!inline || onClose) && (
        <div className="px-4 pt-4 pb-2 flex items-center justify-between">
          <Text variant="label-s" as="h2" className="flex items-center text-[var(--muted)]">
            Filters
            {hasActive && (
              <Badge variant="neutral" size="xs" className="ml-2 font-mono normal-case tracking-normal">
                {activeCount}
              </Badge>
            )}
          </Text>
          <div className="flex items-center gap-1">
            {hasActive && (
              <Button
                variant="tertiary"
                size="xs"
                data-testid="clear-filters"
                leftIcon={<X size={14} weight="bold" />}
                onClick={() => onChange({ ...EMPTY_FILTERS })}
              >
                Clear all
              </Button>
            )}
            {onClose && (
              <Button
                variant="tertiary"
                size="xs"
                iconOnly
                aria-label="Close filters"
                onClick={onClose}
              >
                <X size={16} weight="bold" />
              </Button>
            )}
          </div>
        </div>
      )}

      <Scrollbar className="flex-1 space-y-2.5 px-3 pb-4 pt-1">
        {/* Country — single-select shortcut, synced with the Countries list below */}
        <div className="space-y-2">
          <Dropdown
            label="Country"
            icon={<Globe size={16} />}
            value={filters.countries[0] ?? ""}
            onChange={(v) => onChange({ ...filters, countries: v ? [v] : [] })}
            options={COUNTRY_OPTIONS}
          />
        </div>

        {/* Semantic Search section */}
        <SectionCard
          title="Semantic Search"
          defaultOpen
          leadingIcon={<Sparkle size={14} weight="fill" className="text-[var(--accent)]" />}
        >
          <SearchInput
            testId="search"
            value={filters.q}
            onChange={(v) => onChange({ ...filters, q: v })}
            placeholder="Search a specific company…"
          />
          {hasActive && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {filters.buckets.map((b) => (
                <FilterChip key={b} label={prettifyTag(b)} onRemove={() => onChange({ ...filters, buckets: filters.buckets.filter((x) => x !== b) })} />
              ))}
              {filters.countries.map((c) => (
                <FilterChip key={c} label={countryLabel(c)} onRemove={() => onChange({ ...filters, countries: filters.countries.filter((x) => x !== c) })} />
              ))}
            </div>
          )}
        </SectionCard>

        {/* Markets / Buckets — main NAICS-style hierarchical filter */}
        <SectionCard title="Markets NAICS code" count={filters.buckets.length} defaultOpen>
          <div className="mb-5">
            <Text variant="b3" className="leading-snug text-balance text-[var(--muted)]">
              The markets your company operates in — or could sell into.
            </Text>
          </div>
          <SearchInput
            value={marketSearch}
            onChange={setMarketSearch}
            placeholder="Search Markets…"
            icon={<Storefront size={14} weight="bold" />}
          />

          {filters.buckets.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {filters.buckets.map((b) => (
                <FilterChip key={b} label={prettifyTag(b)} onRemove={() => onChange({ ...filters, buckets: filters.buckets.filter((x) => x !== b) })} />
              ))}
            </div>
          )}

          <div className="mt-4 flex items-center gap-2 px-1">
            <Text variant="label-s" as="span" className="text-[var(--muted)]">Markets</Text>
            <Badge variant="neutral" size="xs" className="font-mono">
              {filteredBuckets.length}
            </Badge>
          </div>

          <Scrollbar className="mt-1.5 max-h-72 pr-1 -mr-1">
            {filteredBuckets.length === 0 ? (
              <div className="text-[12px] text-[var(--dim)] py-3 px-2">No markets match “{marketSearch}”.</div>
            ) : (
              filteredBuckets.map(([b, c]) => (
                <ListItem
                  key={b}
                  label={prettifyTag(b)}
                  count={c}
                  checked={filters.buckets.includes(b)}
                  onToggle={() => onChange({ ...filters, buckets: toggle(filters.buckets, b) })}
                />
              ))
            )}
          </Scrollbar>
        </SectionCard>

        <SectionCard title="Core NAICS Groups" count={filters.naicsGroups.length}>
          <div className="-mx-1">
            {NAICS_GROUPS.map((g) => {
              const n = naicsCounts[g.code] ?? 0;
              if (n === 0) return null;
              return (
                <ListItem
                  key={g.code}
                  label={g.group}
                  count={n}
                  checked={filters.naicsGroups.includes(g.code)}
                  onToggle={() =>
                    onChange({ ...filters, naicsGroups: toggle(filters.naicsGroups, g.code) })
                  }
                />
              );
            })}
          </div>
        </SectionCard>

        <SectionCard title="Countries" count={filters.countries.length} defaultOpen={false}>
          <Scrollbar className="max-h-72 pr-1 -mr-1 -mx-1">
            {countries.map(([c, n]) => (
              <ListItem
                key={c}
                label={countryLabel(c)}
                count={n}
                checked={filters.countries.includes(c)}
                onToggle={() => onChange({ ...filters, countries: toggle(filters.countries, c) })}
              />
            ))}
          </Scrollbar>
        </SectionCard>

        <SectionCard title="Number of employees" defaultOpen={false}>
          <div className="flex items-center gap-2">
            <InputField
              type="number"
              placeholder="Min"
              aria-label="Minimum employees"
              className="w-full"
              value={filters.employeesMin ?? ""}
              onChange={(e) => onChange({ ...filters, employeesMin: e.target.value === "" ? null : Number(e.target.value) })}
            />
            <Text variant="b3" as="span" className="text-[var(--dim)]">–</Text>
            <InputField
              type="number"
              placeholder="Max"
              aria-label="Maximum employees"
              className="w-full"
              value={filters.employeesMax ?? ""}
              onChange={(e) => onChange({ ...filters, employeesMax: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </div>
        </SectionCard>

        <SectionCard title="Industry" defaultOpen={false}>
          <Text variant="b3" className="leading-relaxed text-[var(--muted)]">
            Industry derived from <code className="text-[var(--accent)] font-mono text-[11px] px-1 py-0.5 rounded-md bg-[var(--bg-elev)]">specialty</code> column. Use Markets filter above for primary categorization.
          </Text>
        </SectionCard>

        {/* Data coverage snapshot */}
        <section
          data-testid="data-coverage"
          className="bg-[var(--bg-panel)] border border-[var(--line)] rounded-2xl px-4 py-3"
        >
          <Text variant="label-s" as="div" className="text-[var(--muted)] mb-2">
            Data coverage
          </Text>
          <ul className="space-y-1.5">
            {[
              { n: coverage.nWithContacts, label: "companies have decision-maker contacts" },
              { n: coverage.nWithDescription, label: "have a full description (≥80 chars)" },
              { n: coverage.nWithGrowth, label: "have growth or funding signals" },
              { n: coverage.nWithCoords, label: "appear on the map" },
            ].map((row, i) => (
              <li
                key={i}
                className="flex items-start gap-2 text-[11px] text-[var(--muted)] font-mono leading-snug"
              >
                <span
                  aria-hidden
                  className="mt-[5px] size-[5px] rounded-full bg-[var(--accent)] shrink-0"
                />
                <span>
                  <span className="text-[var(--ink)]">{row.n}</span>
                  <span className="text-[var(--dim)]"> / {coverage.total}</span>{" "}
                  {row.label}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </Scrollbar>
    </aside>
  );
}
