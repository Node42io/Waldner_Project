import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "@phosphor-icons/react";
import { BackButton, Divider, Scrollbar, Text } from "@node42/ui-kit";
import { ValueNetworkView } from "../../../MarketPage";
import { ODIMatrixView } from "../../../ODIMatrix";

/**
 * Value Network modal — opened from the CompanyDrawer's "Open Value Network"
 * button. Reuses the exact same tree + detail view as the Market page
 * (ValueNetworkView), so it stays visually identical; here it runs in `modal`
 * mode, which lists the account's REAL people (KeyPersons from Neo4j) under each
 * buying-centre function and force-enables the node's Needs
 * button. Pressing Needs swaps the body for the ODI needs table (ODIMatrixView),
 * the very same table shown on the ODI Matrix page. Back returns to the network.
 *
 * Rendered through a portal on document.body so it overlays the whole app.
 * Dismiss on backdrop click or Escape.
 */
export function ValueNetworkModal({
  companyName,
  peopleByUnitRole,
  onClose,
}: {
  companyName: string;
  /** Real buying-centre people for this company, keyed by unit name -> role title. */
  peopleByUnitRole?: Record<string, Record<string, { name: string; role: string; location: string; linkedin: string; email: string }[]>>;
  onClose: () => void;
}) {
  const [showNeeds, setShowNeeds] = useState(false);
  // Stakeholder(s) to pre-filter the in-modal needs table by. Empty = the whole
  // node's needs (header Needs button); a single name = that stakeholder's needs
  // (a card's "View needs" button). Kept in-modal — no navigation.
  const [needsStk, setNeedsStk] = useState<string[]>([]);
  // The rated unit whose needs to show (its ODI slug), and that unit's loaded ODI
  // data — so the table shows the SELECTED unit's needs, not a fixed default.
  const [needsSlug, setNeedsSlug] = useState<string | null>(null);
  const [needsData, setNeedsData] = useState<unknown>(null);

  useEffect(() => {
    if (!showNeeds || !needsSlug) return;
    let alive = true;
    setNeedsData(null);
    fetch(`${import.meta.env.BASE_URL}data/odi/${needsSlug}.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => { if (alive) setNeedsData(d); })
      .catch(() => { if (alive) setNeedsData(null); });
    return () => { alive = false; };
  }, [showNeeds, needsSlug]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    // Lock background scroll while the modal is open.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Value Network"
      onMouseDown={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--space-500)",
        background: "rgba(0, 0, 0, 0.55)",
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          display: "flex",
          flexDirection: "column",
          width: "min(1120px, 100%)",
          maxHeight: "88vh",
          background: "var(--surface-default-default)",
          color: "var(--text-body)",
          border: "var(--border-width-default) solid var(--border-default-default)",
          borderRadius: "var(--radius-lg)",
          boxShadow: "var(--shadow-lg, var(--shadow-md))",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-200)",
            padding: "var(--space-400) var(--space-500)",
          }}
        >
          {showNeeds ? (
            <BackButton label="Back to value network" onClick={() => setShowNeeds(false)} style={{ flexShrink: 0 }} />
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}>
            {/* Section label — small/muted, above the prominent company name. */}
            <Text
              variant="label-s"
              as="span"
              style={{
                color: "var(--text-labels)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {showNeeds ? "Needs - Opportunity Score" : "Value Network"}
            </Text>
            {/* Selected company — the prominent heading, kept across both the
                Value Network and the Needs screens. */}
            <Text variant="h4" as="h2" style={{ margin: 0 }}>
              {companyName}
            </Text>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Value Network"
            style={{
              flexShrink: 0,
              display: "grid",
              placeItems: "center",
              width: "var(--space-600)",
              height: "var(--space-600)",
              border: 0,
              borderRadius: "var(--radius-xs)",
              background: "transparent",
              color: "var(--icon-description)",
              cursor: "pointer",
            }}
          >
            <X size={20} />
          </button>
        </div>
        <Divider />

        {/* Body — the value-network view (with per-stakeholder contacts), or the
            ODI needs table once a node's Needs button is pressed. */}
        <Scrollbar style={{ padding: "var(--space-500)" }}>
          {showNeeds ? (
            needsSlug && !needsData ? (
              <Text variant="b2" as="p" style={{ color: "var(--text-labels)" }}>Loading needs…</Text>
            ) : (
              // Show the SELECTED unit's needs (needsData). Falls back to the
              // bundled default only if the unit's file couldn't be loaded.
              <ODIMatrixView key={needsSlug ?? "default"} initialStk={needsStk} data={(needsData as never) ?? undefined} />
            )
          ) : (
            <ValueNetworkView
              onNeeds={(stk, slug) => {
                setNeedsStk(stk ? [stk] : []);
                setNeedsSlug(slug ?? null);
                // Clear immediately so the table never renders the previous
                // unit's data against the new stakeholder filter (→ empty).
                setNeedsData(null);
                setShowNeeds(true);
              }}
              modal
              peopleByUnitRole={peopleByUnitRole}
            />
          )}
        </Scrollbar>
      </div>
    </div>,
    document.body,
  );
}
