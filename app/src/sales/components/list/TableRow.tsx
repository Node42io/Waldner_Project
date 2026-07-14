import {
  CaretDown as ChevronDown,
  Globe,
  MapPin,
} from "@phosphor-icons/react";
import { Table } from "@node42/ui-kit";
import { LinkedInIcon } from "@/components/icons";
import { revenueBand } from "@/lib/revenue";
import { coreNaics } from "@/lib/naics";
import type { Company } from "@/lib/types";

/**
 * Deterministic LinkedIn company URL derived from the company name.
 * Mirrors the convention used elsewhere in the app (ClientCard, CompaniesTable).
 * NOTE: This is a best-guess slug — LinkedIn doesn't guarantee any specific
 * pattern, so the link may 404 for some companies. Empty-state alternative
 * would be hiding the icon entirely; we keep it visible to match the Figma row.
 */
function linkedInUrl(name: string): string {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `https://www.linkedin.com/company/${slug}`;
}

/**
 * Single collapsed row of the Customer List, built on the New-UIKit `Table`
 * compound component (`Table.Row` + `Table.Cell`). The row keeps its rich
 * inline content (stacked address, icon links) inside kit cells so the list
 * reads as a first-class kit table while preserving the ported layout.
 *
 * Honest empty-states (no mocked data):
 *  - city / country missing  → "—" placeholder
 *  - employees null          → "—"
 *  - revenueBand returns "—" if employees null (the " $" suffix is still appended,
 *    matching the table column format used in CompaniesTable)
 *  - url null                → dim em-dash instead of clickable globe icon
 *
 * The street address is NOT shown — the existing `streetOf()` helper in
 * CompaniesTable is fake mock data and is intentionally not used here.
 */
export function TableRow({
  company,
  isExpanded,
  onToggleExpand,
}: {
  company: Company;
  isExpanded: boolean;
  onToggleExpand: () => void;
}) {
  const city = company.city || "";
  const country = company.country || "";
  const hasAddress = !!(city || country);
  const naics = coreNaics(company).code;
  const revenueLabel = `${revenueBand(company.employees, company.revLowerUsd, company.revHigherUsd)} $`;

  return (
    <Table.Row
      data-company-id={company.id}
      interactive
      selected={isExpanded}
      onClick={onToggleExpand}
    >
      {/* Chevron toggle */}
      <Table.Cell icon>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleExpand();
          }}
          className="grid place-items-center border-0 bg-transparent p-0 cursor-pointer text-[var(--muted)] hover:text-[var(--ink)]"
          aria-label={isExpanded ? "Collapse row" : "Expand row"}
          aria-expanded={isExpanded}
        >
          <ChevronDown
            size={16}
            className={`transition-transform ${isExpanded ? "rotate-180" : ""}`}
          />
        </button>
      </Table.Cell>

      {/* Company name */}
      <Table.Cell>
        <span className="font-medium text-[var(--ink)]">{company.name}</span>
      </Table.Cell>

      {/* Address — city + country, no mock street */}
      <Table.Cell>
        {hasAddress ? (
          <div className="flex items-start gap-1.5 min-w-0">
            <MapPin
              size={14}
              className="mt-0.5 shrink-0 text-[var(--dim)]"
              aria-hidden
            />
            <div className="min-w-0">
              <div className="truncate text-[var(--ink)]">{city || "—"}</div>
              <div className="truncate text-xs text-[var(--dim)]">{country || "—"}</div>
            </div>
          </div>
        ) : (
          <span className="text-[var(--dim)] text-xs">—</span>
        )}
      </Table.Cell>

      {/* Employees */}
      <Table.Cell align="right">
        <span className="font-mono text-[var(--ink)]">
          {company.employees != null ? company.employees.toLocaleString() : "—"}
        </span>
      </Table.Cell>

      {/* Revenue band */}
      <Table.Cell align="right">
        <span className="font-mono text-[var(--ink)]">{revenueLabel}</span>
      </Table.Cell>

      {/* Core NAICS */}
      <Table.Cell>
        <span className="font-mono text-[var(--ink)]">{naics}</span>
      </Table.Cell>

      {/* LinkedIn */}
      <Table.Cell align="center">
        <a
          href={linkedInUrl(company.name)}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="inline-grid size-7 place-items-center rounded-md bg-[var(--bg-elev)] hover:bg-[var(--bg-panel-2)] hover:ring-1 hover:ring-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]"
          aria-label={`LinkedIn page for ${company.name}`}
        >
          <LinkedInIcon size={14} />
        </a>
      </Table.Cell>

      {/* Website (honest empty-state when url is null) */}
      <Table.Cell align="center">
        {company.url ? (
          <a
            href={company.url}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-grid size-7 place-items-center rounded-md bg-[var(--bg-elev)] hover:bg-[var(--bg-panel-2)] hover:ring-1 hover:ring-[var(--line)] text-[var(--muted)] hover:text-[var(--ink)]"
            aria-label={`Website for ${company.name}`}
          >
            <Globe size={14} />
          </a>
        ) : (
          <span className="text-[var(--dim)] text-xs" aria-label="No website">
            —
          </span>
        )}
      </Table.Cell>
    </Table.Row>
  );
}
