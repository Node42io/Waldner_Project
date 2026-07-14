import type { ReactNode } from "react";
import { MapTrifold as MapIcon, List, DownloadSimple as Download, SlidersHorizontal } from "@phosphor-icons/react";
import { Button, Toggle } from "@node42/ui-kit";
import type { View } from "./TopNav";

/**
 * Floating top-right control cluster overlaying the map.
 * Figma 4398:20775 — segmented map/list toggle + CSV button. In the map view
 * the All filters toggle lives beside the "Customer List" heading; in the LIST
 * view it moves into this cluster so it sits on the same side as the filter
 * drawer that opens on the right.
 */
export function MapControls({
  view,
  onView,
  onDownload,
  leading,
  filtersOpen,
  onToggleFilters,
  activeFilterCount = 0,
}: {
  view: View;
  onView: (v: View) => void;
  onDownload: () => void;
  /** Optional slot rendered at the left edge of the cluster — e.g. the map
      geocoder, so it sits directly to the left of the map/list toggle. */
  leading?: ReactNode;
  /** List view only: the All filters toggle joins this cluster when provided. */
  filtersOpen?: boolean;
  onToggleFilters?: () => void;
  activeFilterCount?: number;
}) {
  return (
    <div className="absolute top-3 right-3 z-[1000] flex items-center gap-2">
      {/* Geocoder sits at the left edge of the cluster, just left of the
          toggle — map view only. */}
      {view === "map" && leading}

      {/* All filters — list view only, so the toggle sits on the same side as
          the drawer that opens on the right. */}
      {view === "list" && onToggleFilters && (
        <Button
          data-testid="toggle-filters"
          variant="secondary-neutral"
          size="sm"
          className="shadow-md"
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

      <Toggle
        className="shadow-md"
        value={view}
        onChange={(v) => onView(v as View)}
        options={[
          {
            value: "map",
            "aria-label": "Map view",
            icon: <MapIcon size={16} />,
          },
          {
            value: "list",
            "aria-label": "List view",
            icon: <List size={16} />,
          },
        ]}
      />

      <Button
        data-testid="download-csv"
        variant="secondary-neutral"
        size="sm"
        onClick={onDownload}
        rightIcon={<Download size={14} />}
        className="shadow-md"
      >
        CSV
      </Button>
    </div>
  );
}
