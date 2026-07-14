import { useState } from "react";
import { UsersThree, CurrencyDollar, Storefront, Info } from "@phosphor-icons/react";
import { Badge, Button, Text } from "@node42/ui-kit";
import { ValueNetworkModal } from "./ValueNetworkModal";
import { revenueBand } from "@/lib/revenue";
import { coreNaics } from "@/lib/naics";
import { prettifyTag } from "@/lib/format";
import type { Company } from "@/lib/types";

function formatEmployees(n: number | null) {
  if (n == null) return "—";
  return n.toLocaleString();
}

/**
 * Company detail content — About → metric card (Headcount / Revenue / Core
 * NAICS) → Specialities → Buying Center. Shared so the CompanyDrawer panel and
 * the inline expanded table row read identically at the content level.
 *
 * `layout` adapts the arrangement to the container:
 * - `stack` (default) — vertical column, for the narrow drawer.
 * - `row` — the same four blocks distributed horizontally across the full-width
 *   expanded table row (About and Specialities flex; metric card and Buying
 *   Center size to content).
 */
export function CompanyDetail({
  company,
  layout = "stack",
}: {
  company: Company;
  layout?: "stack" | "row";
}) {
  const [vnOpen, setVnOpen] = useState(false);

  const oncologyTags = company.oncologyTags ?? [];
  const buckets = company.buckets ?? [];
  const specialties: string[] =
    oncologyTags.length > 0
      ? Array.from(new Set(oncologyTags.map(prettifyTag)))
      : Array.from(new Set(buckets.map(prettifyTag)));

  const description = (company.description ?? "").trim();

  const naicsGroup = coreNaics(company);
  const naicsDisplay = naicsGroup.group.startsWith(naicsGroup.code)
    ? naicsGroup.group
    : `${naicsGroup.code} — ${naicsGroup.label}`;

  const about = (
    <section className="flex min-w-0 flex-col gap-1">
      <Text variant="label-s" as="p" className="m-0">About</Text>
      <p className="m-0 text-[12px] leading-[16px] text-[var(--text-body)]">
        {description || <span className="italic text-[var(--dim)]">No description available.</span>}
      </p>
    </section>
  );

  const metrics = (
    <section className="flex gap-2 rounded-lg bg-[var(--bg-panel-2)] p-2">
      <div className="flex w-[97px] shrink-0 flex-col gap-2 self-stretch border-r border-[var(--line)] pr-2">
        <div className="flex items-center gap-1">
          <UsersThree size={16} className="text-[var(--dim)]" />
          <Text variant="label-s" as="span">Headcount</Text>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-[16px] leading-5 text-[var(--text-body)]">
            {formatEmployees(company.employees)}
          </span>
          <span className="text-[9px] leading-[10px] text-[var(--dim)]">Employees</span>
        </div>
      </div>

      <div className="flex w-[97px] shrink-0 flex-col gap-2 self-stretch border-r border-[var(--line)] pr-2">
        <div className="flex items-center gap-1">
          <CurrencyDollar size={16} className="text-[var(--dim)]" />
          <Text variant="label-s" as="span">Revenue</Text>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-[16px] leading-5 text-[var(--text-body)]">
            {revenueBand(company.employees, company.revLowerUsd, company.revHigherUsd)}
          </span>
          <span className="text-[9px] leading-[10px] text-[var(--dim)]">$</span>
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1">
            <Storefront size={16} className="text-[var(--dim)]" />
            <Text variant="label-s" as="span">Core NAICS Code</Text>
          </div>
          <Info size={16} className="text-[var(--dim)]" />
        </div>
        <p className="m-0 text-[14px] font-medium leading-4 text-[var(--text-body)]">
          {naicsDisplay}
        </p>
      </div>
    </section>
  );

  const specialitiesBlock = (
    <section className="flex min-w-0 flex-col gap-1">
      <Text variant="label-s" as="p" className="m-0">Specialities</Text>
      {specialties.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {specialties.map((t) => (
            <Badge key={t} variant="neutral" size="sm">
              {t}
            </Badge>
          ))}
        </div>
      ) : (
        <p className="m-0 text-[12px] italic text-[var(--dim)]">No specialities listed.</p>
      )}
    </section>
  );

  const buyingCenter = (
    <section className="flex flex-col items-start gap-1">
      <Text variant="label-s" as="p" className="m-0">Buying Center</Text>
      <p className="m-0 text-[12px] leading-[14px] text-[var(--text-body)]">
        Select a Value Network level to visualise the buying center
      </p>
      <Button variant="primary" size="sm" className="mt-1" onClick={() => setVnOpen(true)}>
        Open Value Network
      </Button>
    </section>
  );

  const modal = vnOpen ? (
    <ValueNetworkModal companyName={company.name} onClose={() => setVnOpen(false)} />
  ) : null;

  if (layout === "row") {
    // Horizontal distribution across the full-width expanded row. The metric
    // card (Headcount / Revenue / Core NAICS) is intentionally omitted here —
    // those values already sit in the table's own columns, so the row shows
    // only what the table doesn't: About, Specialities and Buying Center.
    // Thin dividers separate the blocks so the row reads as distinct sections.
    return (
      <>
        <div className="grid grid-cols-1 items-start gap-x-8 gap-y-6 md:grid-cols-2 xl:[grid-template-columns:minmax(280px,2.2fr)_minmax(160px,1fr)_minmax(200px,1fr)]">
          {about}
          <div className="xl:border-l xl:border-[var(--line)] xl:pl-8">{specialitiesBlock}</div>
          <div className="xl:border-l xl:border-[var(--line)] xl:pl-8">{buyingCenter}</div>
        </div>
        {modal}
      </>
    );
  }

  return (
    <>
      {about}
      {metrics}
      {specialitiesBlock}
      {buyingCenter}
      {modal}
    </>
  );
}
