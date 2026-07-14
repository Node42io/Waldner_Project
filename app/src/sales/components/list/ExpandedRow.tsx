import { CompanyDetail } from "@/components/company/CompanyDetail";
import type { Company } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* ExpandedRow — inline content for an expanded company row. Same      */
/* content as the CompanyDrawer detail panel (About / Headcount ·      */
/* Revenue · Core NAICS / Specialities / Buying Center), but           */
/* distributed HORIZONTALLY across the full-width row (layout="row").   */
/* ------------------------------------------------------------------ */

export function ExpandedRow({ company }: { company: Company }) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      className="border-t border-[var(--line)] bg-[var(--bg-panel)] px-6 py-5"
    >
      <CompanyDetail company={company} layout="row" />
    </div>
  );
}
