import { SlidersHorizontal } from "@phosphor-icons/react";
import { Button } from "@node42/ui-kit";

// Shared "Customer List" heading with an optional "All filters" toggle pinned to
// its right. Used by both the map-view Customer List overlay and the list-view
// table header so the title reads identically (h5) and the filters button sits
// in the same spot in both views.
export function CustomerListHeader({
  title = "Customer List",
  showFilters = false,
  filtersOpen = false,
  onToggleFilters,
  activeFilterCount = 0,
  align = "between",
  className,
}: {
  title?: string;
  /** Whether the All filters toggle is shown (map view only reveals it once a
   *  market is picked; the list view always shows it). */
  showFilters?: boolean;
  filtersOpen?: boolean;
  onToggleFilters?: () => void;
  activeFilterCount?: number;
  /** `between` pins the button to the far edge (narrow map column); `start`
   *  keeps it right beside the title (full-width list header). */
  align?: "between" | "start";
  className?: string;
}) {
  return (
    <div
      className={`flex items-center gap-2 ${align === "start" ? "justify-start" : "justify-between"} ${className ?? ""}`}
    >
      <h2 className="m-0 text-[length:var(--font-size-h5)] font-medium leading-7 text-[var(--text-headings)]">
        {title}
      </h2>
      {showFilters && onToggleFilters && (
        <Button
          data-testid="toggle-filters"
          variant="secondary-outline"
          size="xs"
          className="shrink-0"
          onClick={onToggleFilters}
          aria-pressed={filtersOpen}
          leftIcon={<SlidersHorizontal size={14} />}
        >
          All filters
          {activeFilterCount > 0 && (
            <span
              aria-label={`${activeFilterCount} active filters`}
              className="ml-1 inline-block size-1.5 rounded-full bg-[var(--tertiary-default)] align-middle"
            />
          )}
        </Button>
      )}
    </div>
  );
}
