import { X, Globe, MapPin } from "@phosphor-icons/react";
import { AddressLine, Badge, Scrollbar, Text } from "@node42/ui-kit";
import { LinkedInIcon } from "@/components/icons";
import { CompanyDetail } from "./CompanyDetail";
import { countryLabel as countryName } from "@/lib/market-query";
import type { Company, Location } from "@/lib/types";

// The company's sites (HQ + offices), each with a "Show on map" button that flies
// the on-page map to that location. Falls back to the flat HQ fields when the
// `locations` array is empty.
function LocationsSection({
  company,
  onShowLocation,
}: {
  company: Company;
  onShowLocation?: (lat: number, lon: number) => void;
}) {
  const locations = company.locations ?? [];
  type Row = Location & { _key: string };
  let rows: Row[] = [];
  if (locations.length > 0) {
    rows = locations.map((loc, i) => ({ ...loc, _key: `${loc.role}-${loc.city}-${i}` }));
  } else if (company.lat != null || company.city) {
    rows = [{ role: "HQ", street: null, city: company.city, postcode: null, country: company.country, lat: company.lat, lon: company.lon, employeesHint: null, _key: "hq-flat" }];
  }
  if (rows.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <Text variant="label-s" as="p" className="m-0">Locations</Text>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {rows.map((loc) => {
          const isHQ = loc.role === "HQ";
          const hasCoords = loc.lat != null && loc.lon != null && !!onShowLocation;
          return (
            <li key={loc._key} className="flex items-start gap-2 rounded-md border border-[var(--line)] bg-[var(--bg-panel-2)] px-2.5 py-2">
              <Badge variant={isHQ ? "color" : "neutral"} size="xs" className="mt-0.5 shrink-0">{isHQ ? "HQ" : "Office"}</Badge>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-medium leading-tight text-[var(--ink)]">
                  {(() => {
                    const country = loc.country ? countryName(loc.country) : "";
                    // Avoid "Germany, Germany" when the source city equals the country.
                    if (loc.city && country && loc.city !== country) return `${loc.city}, ${country}`;
                    return loc.city || country || "—";
                  })()}
                </div>
                {loc.street || loc.postcode ? (
                  <div className="mt-0.5 truncate text-[11px] leading-tight text-[var(--dim)]">
                    {[loc.street, loc.postcode].filter(Boolean).join(", ")}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                disabled={!hasCoords}
                onClick={() => { if (hasCoords) onShowLocation!(loc.lat as number, loc.lon as number); }}
                className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[var(--line)] bg-[var(--bg-elev)] px-1.5 py-1 text-[10px] font-medium leading-none text-[var(--muted)] transition-colors hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40"
                aria-label={`Show ${loc.city} on map`}
                title={hasCoords ? `Show ${loc.city} on map` : "No coordinates on file"}
              >
                <MapPin size={12} />
                <span>Show on map</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

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
        <LocationsSection company={company} onShowLocation={onShowLocation} />
        <CompanyDetail company={company} />
      </Scrollbar>
    </aside>
  );
}
