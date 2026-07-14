import { X, Globe } from "@phosphor-icons/react";
import { AddressLine, Badge, Scrollbar } from "@node42/ui-kit";
import { LinkedInIcon } from "@/components/icons";
import { CompanyDetail } from "./CompanyDetail";
import { countryLabel as countryName } from "@/lib/market-query";
import type { Company } from "@/lib/types";

/**
 * Company detail panel — a faithful rebuild of the Figma "ClientCard"
 * (node 5095:70757). Layout: header (name + close, then an inline address with
 * LinkedIn/Globe), a sector Badge, then a scrollable body of About → metric
 * card (Headcount / Revenue / Core NAICS) → Specialities → Buying Center.
 *
 * In map view it floats to the RIGHT of the Customer List overlay (which is
 * pinned to the left edge, w-320). In list view it docks as a right column.
 * Styling uses the kit's semantic tokens (via the sales.css aliases) and kit
 * components (Badge, Button) — no ad-hoc colours.
 */
export function CompanyDrawer({
  company,
  onClose,
  floating = false,
  onShowLocation,
}: {
  company: Company;
  onClose: () => void;
  // Accepted for API parity with the source app; this Figma layout doesn't
  // surface status cycling.
  onCycleStatus?: (id: string) => void;
  floating?: boolean;
  // When provided (map view), clicking the address flies the on-page map to the
  // HQ instead of opening an external maps site.
  onShowLocation?: (lat: number, lon: number) => void;
}) {
  const linkedinHref = `https://www.linkedin.com/company/${company.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;

  // Address — prefer the HQ (locations[0]) for street/postcode, fall back to the
  // flat top-level fields. Street + locality collapse to a single line.
  const hq = company.locations?.[0];
  const street = hq?.street ?? null;
  const addrCity = hq?.city ?? company.city;
  const addrPostcode = hq?.postcode ?? null;
  const addrCountry = countryName(hq?.country ?? company.country);
  const addressLine = [
    street,
    addrPostcode ? `${addrCity} (${addrPostcode})` : addrCity,
    addrCountry,
  ]
    .filter(Boolean)
    .join(", ");

  // HQ coordinates for the in-page "fly the map here" affordance on the address.
  const locLat = hq?.lat ?? company.lat;
  const locLon = hq?.lon ?? company.lon;
  const canLocate = !!onShowLocation && locLat != null && locLon != null;

  // Shared card look; position/size differ between floating (map) and docked
  // (list) modes. Floating sits to the right of the w-320 Customer List overlay.
  const base =
    "flex flex-col gap-4 p-4 bg-[var(--bg-panel)] text-[var(--text-body)]";
  const className = floating
    ? `${base} absolute top-3 left-[332px] max-h-[calc(100%-24px)] w-[416px] max-w-[calc(100%-344px)] z-[900] pointer-events-auto rounded-2xl backdrop-blur-md shadow-[var(--shadow-md)] overflow-hidden`
    : `${base} w-[440px] shrink-0 h-full border-l border-[var(--line)] overflow-hidden`;

  // NOTE: this app loads Tailwind without Preflight, so headings/paragraphs keep
  // the browser's default margins — every text node below gets an explicit `m-0`.
  // Section labels use the kit's `Text` label-s variant (Aeonik, capitalized,
  // text-labels) so they read like the rest of the site rather than mono/uppercase.

  return (
    <aside data-testid="company-drawer" className={className}>
      {/* Header block: title + close, then inline address + social icons. */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <h3 className="m-0 min-w-0 flex-1 truncate text-[20px] font-medium leading-6 text-[var(--ink)]">
            {company.name}
          </h3>
          <button
            data-testid="drawer-close"
            onClick={onClose}
            className="grid size-6 shrink-0 place-items-center border-0 bg-transparent p-0 cursor-pointer text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
            aria-label="Close panel"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* Address — NOT a Google Maps link. When a map is on screen, clicking
              flies it to the HQ (kit AddressLine `onLocate`); the click target is
              the text only, so clicking elsewhere on the drawer never triggers it. */}
          <AddressLine
            interactive={canLocate}
            className={canLocate ? "max-w-full" : "min-w-0"}
            onLocate={
              canLocate
                ? () => onShowLocation!(locLat as number, locLon as number)
                : undefined
            }
          >
            {addressLine}
          </AddressLine>
          <span className="size-1 shrink-0 rounded-full bg-[var(--dim)]" aria-hidden />
          <div className="flex shrink-0 items-center gap-2">
            <a
              href={linkedinHref}
              target="_blank"
              rel="noreferrer"
              className="grid size-5 place-items-center text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
              aria-label="LinkedIn"
            >
              <LinkedInIcon size={16} />
            </a>
            {company.url && (
              <a
                href={company.url}
                target="_blank"
                rel="noreferrer"
                className="grid size-5 place-items-center text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
                aria-label="Website"
              >
                <Globe size={16} />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Sector badge */}
      <Badge variant="neutral" size="sm" className="shrink-0 self-start">
        {company.industry}
      </Badge>

      {/* Scrollable body — shared detail content (also used, laid out
          horizontally, in the expanded table row). */}
      <Scrollbar className="flex min-h-0 flex-1 flex-col gap-4">
        <CompanyDetail company={company} />
      </Scrollbar>
    </aside>
  );
}
