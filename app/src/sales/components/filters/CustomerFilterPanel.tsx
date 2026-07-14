import { useEffect, useMemo } from "react";
import { X, Globe, CurrencyDollar, Tag } from "@phosphor-icons/react";
import { Badge, Button, Divider, Dropdown, InputField, Text } from "@node42/ui-kit";
import type { DropdownOption } from "@node42/ui-kit";
import type { Company, Filters } from "@/lib/types";
import { countByValue } from "@/lib/filters";
import { revenueBand } from "@/lib/revenue";
import { countryLabel } from "@/lib/market-query";

// Focused "All filters" panel for the Customer List (map view) — the four
// dimensions the Customer List filters on: country, employees, revenue and
// specialties. Chrome mirrors the company drawer, sized to the full page height
// beside the Customer List overlay. Controls are all kit components (Dropdown /
// InputField). Counts derive from `rows` (the picked market's companies) so
// options reflect what's actually selectable.
//
// NOTE: the kit Dropdown menu is position:absolute (not portalled), so the
// controls must NOT sit inside an overflow/scroll ancestor or the menu clips.
// The body is a plain flex column and the four fields fit the full-height panel.
type Props = {
  rows: Company[];
  filters: Filters;
  onChange: (next: Filters) => void;
  onClose: () => void;
  /** Companies matching the current filters — shown in the footer. */
  resultCount: number;
  /** Companies in the picked market before filtering. */
  totalCount: number;
  /** Overrides the default positioning classes (map view anchors it beside the
   *  320px Customer List overlay; the list view anchors it to the right edge). */
  className?: string;
};

// Revenue bands in descending size — filtered to those present in the market.
const REVENUE_BANDS = ["1B+", "250M-1B", "50-250M", "20-50M", "5-20M", "1-5M"];

// Field label matching the kit Dropdown field label (mono, uppercase,
// --text-labels), so the employees range reads the same as the dropdowns.
const fieldLabel = "block font-mono text-[length:var(--font-size-label-mono-sm)] uppercase leading-[var(--line-height-label-mono-sm)] tracking-[0.06em] text-[var(--text-labels)]";

// Option label with a right-aligned count, so each Dropdown row reads "value  n".
function optionLabel(text: string, count: number) {
  return (
    <span className="flex w-full items-center justify-between gap-3">
      <span className="truncate">{text}</span>
      <span className="font-mono text-[11px] text-[var(--dim)]">{count}</span>
    </span>
  );
}

export function CustomerFilterPanel({ rows, filters, onChange, onClose, resultCount, totalCount, className }: Props) {
  // Close on Escape only — like the company drawer, the panel stays open on
  // outside clicks and dismisses via its close button or the All filters toggle.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const countryCounts = useMemo(() => countByValue(rows, "country"), [rows]);
  const specialtyCounts = useMemo(() => countByValue(rows, "industry"), [rows]);
  const revenueCounts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const r of rows) {
      const band = revenueBand(r.employees, r.revLowerUsd, r.revHigherUsd);
      out[band] = (out[band] ?? 0) + 1;
    }
    return out;
  }, [rows]);

  const countryOptions: DropdownOption[] = useMemo(
    () =>
      Object.entries(countryCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([c, n]) => ({ value: c, label: optionLabel(countryLabel(c), n) })),
    [countryCounts]
  );
  const specialtyOptions: DropdownOption[] = useMemo(
    () =>
      Object.entries(specialtyCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([s, n]) => ({ value: s, label: optionLabel(s, n) })),
    [specialtyCounts]
  );
  const revenueOptions: DropdownOption[] = useMemo(
    () =>
      REVENUE_BANDS.filter((b) => revenueCounts[b]).map((b) => ({
        value: b,
        label: optionLabel(`${b} $`, revenueCounts[b]),
      })),
    [revenueCounts]
  );

  const activeCount =
    filters.countries.length +
    filters.revenues.length +
    filters.specialties.length +
    (filters.employeesMin != null ? 1 : 0) +
    (filters.employeesMax != null ? 1 : 0);
  const hasActive = activeCount > 0;

  const clearAll = () =>
    onChange({ ...filters, countries: [], revenues: [], specialties: [], employeesMin: null, employeesMax: null });

  return (
    <aside
      data-testid="customer-filters"
      className={`flex flex-col bg-[var(--bg-panel)] text-[var(--text-body)] z-[900] pointer-events-auto shadow-[var(--shadow-md)] ${className ?? "absolute top-0 bottom-0 left-[320px] w-[416px] max-w-[calc(100%-320px)] rounded-br-lg"}`}
    >
      {/* Header — title + active count + close, mirroring the company drawer. */}
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3">
        <h3 className="m-0 flex min-w-0 flex-1 items-center gap-2 text-[20px] font-medium leading-6 text-[var(--ink)]">
          All filters
          {hasActive && (
            <Badge variant="neutral" size="xs" className="font-mono normal-case tracking-normal">
              {activeCount}
            </Badge>
          )}
        </h3>
        <button
          onClick={onClose}
          className="grid size-6 shrink-0 place-items-center border-0 bg-transparent p-0 cursor-pointer text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
          aria-label="Close panel"
        >
          <X size={20} />
        </button>
      </div>

      <Divider />

      {/* Body — one kit control per dimension. No overflow ancestor here so the
          Dropdown menus (position:absolute) are never clipped. */}
      <div className="flex flex-1 flex-col gap-4 px-4 py-4">
        <Dropdown
          label="Country"
          size="sm"
          icon={<Globe size={16} />}
          placeholder="All countries"
          fullWidth
          searchable
          multiple
          options={countryOptions}
          values={filters.countries}
          confirmable
          onConfirm={(vals) => onChange({ ...filters, countries: vals })}
        />

        <div className="flex flex-col gap-1">
          <span className={fieldLabel}>Number of employees</span>
          <div className="flex items-center gap-2">
            <InputField
              type="number"
              size="sm"
              placeholder="Min"
              aria-label="Minimum employees"
              className="min-w-0 flex-1"
              value={filters.employeesMin ?? ""}
              onChange={(e) => onChange({ ...filters, employeesMin: e.target.value === "" ? null : Number(e.target.value) })}
            />
            <Text variant="b3" as="span" className="shrink-0 text-[var(--dim)]">–</Text>
            <InputField
              type="number"
              size="sm"
              placeholder="Max"
              aria-label="Maximum employees"
              className="min-w-0 flex-1"
              value={filters.employeesMax ?? ""}
              onChange={(e) => onChange({ ...filters, employeesMax: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </div>
        </div>

        <Dropdown
          label="Revenue"
          size="sm"
          icon={<CurrencyDollar size={16} />}
          placeholder="Any revenue"
          fullWidth
          multiple
          options={revenueOptions}
          values={filters.revenues}
          confirmable
          onConfirm={(vals) => onChange({ ...filters, revenues: vals })}
        />

        <Dropdown
          label="Specialties"
          size="sm"
          icon={<Tag size={16} />}
          placeholder="All specialties"
          fullWidth
          searchable
          multiple
          options={specialtyOptions}
          values={filters.specialties}
          confirmable
          onConfirm={(vals) => onChange({ ...filters, specialties: vals })}
        />
      </div>

      {/* Footer — live result count + Clear all, pinned to the bottom. */}
      <Divider />
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <Text variant="b3" as="span" className="text-[var(--muted)]">
          <span className="font-mono text-[var(--ink)]">{resultCount}</span> of{" "}
          <span className="font-mono">{totalCount}</span> customers
        </Text>
        {hasActive && (
          <Button variant="tertiary" size="sm" leftIcon={<X size={14} weight="bold" />} onClick={clearAll}>
            Clear all
          </Button>
        )}
      </div>
    </aside>
  );
}
