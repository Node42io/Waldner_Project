import { useEffect, useMemo, useRef, useState } from "react";
import { MagnifyingGlass, Buildings } from "@phosphor-icons/react";
import { InputField, Scrollbar } from "@node42/ui-kit";
import { COUNTRY_OPTIONS } from "@/lib/market-query";
import type { Company } from "@/lib/types";

const COUNTRY_NAME: Record<string, string> = Object.fromEntries(
  COUNTRY_OPTIONS.filter((o) => o.value).map((o) => [o.value, o.label])
);
const countryName = (iso: string) => COUNTRY_NAME[iso] ?? iso;

const MAX_RESULTS = 6;

/**
 * Customer typeahead for the Customer List card. Typing narrows the list live
 * (drives `value`/`onChange`), and the dropdown surfaces matching companies —
 * pick one to open its card and fly the map there. This searches customers
 * only; map navigation (cities/countries) lives in the separate floating
 * MapSearch on the map.
 */
export function SmartSearch({
  rows,
  value,
  onChange,
  onPickCompany,
}: {
  rows: Company[];
  value: string;
  onChange: (q: string) => void;
  onPickCompany: (c: Company) => void;
}) {
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

  const q = value.trim().toLowerCase();

  const companyMatches = useMemo(() => {
    if (!q) return [];
    return rows.filter((r) => r.name.toLowerCase().includes(q)).slice(0, MAX_RESULTS);
  }, [rows, q]);

  const showDropdown = open && q.length > 0 && companyMatches.length > 0;

  return (
    <div ref={wrapRef} className="relative">
      <InputField
        type="search"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
        placeholder="Search customers…"
        leading={<MagnifyingGlass size={14} />}
      />

      {showDropdown && (
        <Scrollbar
          role="listbox"
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-30 max-h-[320px] rounded-xl border border-[var(--line)] bg-[var(--bg-elev)] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.55)] py-1.5 px-1.5"
        >
          {companyMatches.map((c) => (
            <button
              key={c.id}
              type="button"
              role="option"
              aria-selected={false}
              onClick={() => { onPickCompany(c); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left text-[13px] text-[var(--ink)] hover:bg-[var(--bg-panel-2)] transition-colors"
            >
              <Buildings size={15} className="text-[var(--muted)] shrink-0" />
              <span className="flex-1 truncate">{c.name}</span>
              {(c.city || c.country) && (
                <span className="text-[10px] font-mono text-[var(--dim)] truncate max-w-[120px]">
                  {[c.city, countryName(c.country)].filter(Boolean).join(", ")}
                </span>
              )}
            </button>
          ))}
        </Scrollbar>
      )}
    </div>
  );
}
