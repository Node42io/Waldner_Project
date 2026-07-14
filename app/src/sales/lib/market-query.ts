// Options for the landing search fields. The country lists are generated from
// the real data by `scripts/build_sales.py` (src/data/sales/meta.json) so they
// always match the plant countries actually present in the account list.
//   - country: ISO3 code, or "" for All (no country filter).
//   - market:  bucket key, or "" for All markets (no bucket filter).
import meta from "../../data/sales/meta.json";

export const COUNTRY_OPTIONS: { value: string; label: string }[] =
  meta.countryOptions;

// Market segments for the Customer List's second picker step (NAICS → segment →
// customers). Each ties to the NAICS group it appears under.
export type SalesSegment = { id: string; name: string; naics: string; count: number };
export const SALES_SEGMENTS: SalesSegment[] = meta.segments;

// ISO-3166 alpha-3 → display name for every country code present in the data,
// so filter lists/chips and the map geocoder read full names, not raw codes.
export const COUNTRY_NAMES: Record<string, string> = meta.countryNames;

/** Full country name for an ISO-3 code, falling back to the code itself. */
export const countryLabel = (iso: string): string => COUNTRY_NAMES[iso] ?? iso;

export const MARKET_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "All markets" },
  { value: "cdmo_classic", label: "CDMO — Contract Development & Manufacturing" },
  { value: "originator_pharma", label: "Originator pharma" },
  { value: "sterile_generics", label: "Sterile generics" },
  { value: "vaccines", label: "Vaccines" },
  { value: "plasma_fractionation", label: "Plasma fractionation" },
  { value: "specialty_orphan", label: "Specialty & orphan" },
  { value: "atmp_cell_gene", label: "ATMP — cell & gene" },
  { value: "oncology_hpapi", label: "Oncology / HPAPI" },
  { value: "veterinary_pharma", label: "Veterinary pharma" },
  { value: "late_stage_biotech", label: "Late-stage biotech" },
  { value: "bioprocess_vendors", label: "Bioprocess vendors" },
  { value: "medical_cannabis", label: "Medical cannabis" },
  { value: "academic_gmp", label: "Academic GMP" },
];
