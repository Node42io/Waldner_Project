import { useState } from "react";
import { ArrowRight, LockSimple } from "@phosphor-icons/react";
import { Badge } from "../Badge/Badge";
import { Text } from "../Text/Text";
import { Tooltip } from "../Tooltip/Tooltip";
import styles from "./NaicsRow.module.css";

export type NaicsRowSize = "md" | "sm";
/** Row background. `default-2` (default) is the standard surface; `default`
 *  is the lighter surface for rows sitting on a raised/page background. */
export type NaicsRowSurface = "default-2" | "default";

export interface NaicsRowProps {
  /** NAICS code shown in the leading badge. */
  code: string;
  /** Industry / market name. */
  name: string;
  /** Locked (upsell) row — inert, greyed, shows a lock instead of an arrow. */
  locked?: boolean;
  /** Click handler for a live (unlocked) row. */
  onOpen?: () => void;
  /** When set, locked rows reveal this copy in a tooltip on hover. */
  lockedTooltip?: string;
  /** Row density. `md` (default) is the full picker row; `sm` is compact. */
  size?: NaicsRowSize;
  /** Row background surface. Defaults to `default-2`. */
  surface?: NaicsRowSurface;
}

// Per-size tokens: badge size, name text variant and trailing-icon px.
const SIZES: Record<NaicsRowSize, { badge: "sm" | "xs"; text: "b1" | "b2"; icon: number }> = {
  md: { badge: "sm", text: "b1", icon: 18 },
  sm: { badge: "xs", text: "b2", icon: 16 },
};

// One NAICS market row — a code badge + industry name + a trailing affordance.
// Shared between the Product Management market picker and the Sales customer-list
// market picker so the two read identically. A live row is a button (arrow →
// opens); locked rows are inert, showing a lock and (optionally) an upsell
// tooltip on hover.
export function NaicsRow({
  code,
  name,
  locked,
  onOpen,
  lockedTooltip,
  size = "md",
  surface = "default-2",
}: NaicsRowProps) {
  const [hover, setHover] = useState(false);
  const s = SIZES[size];
  const rowClass = [
    styles.row,
    size === "sm" ? styles.sm : "",
    surface === "default" ? styles.surfaceDefault : "",
  ]
    .filter(Boolean)
    .join(" ");

  const inner = (
    <>
      <Badge
        variant="color"
        size={s.badge}
        style={{ flexShrink: 0, opacity: locked ? 0.55 : 1 }}
      >
        {code}
      </Badge>
      <Text
        variant={s.text}
        weight="medium"
        as="span"
        style={{
          flex: 1,
          minWidth: 0,
          overflowWrap: "anywhere",
          color: locked ? "var(--text-action-disabled)" : "var(--text-headings)",
        }}
      >
        {name}
      </Text>
      {locked ? (
        <LockSimple
          size={s.icon}
          weight="regular"
          style={{ flexShrink: 0, color: "var(--icon-action-disabled)" }}
        />
      ) : (
        <ArrowRight
          size={s.icon}
          weight="regular"
          style={{ flexShrink: 0, color: "var(--text-headings)" }}
        />
      )}
    </>
  );

  if (locked) {
    return (
      <span
        className={styles.wrap}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
      >
        <div className={`${rowClass} ${styles.locked}`}>{inner}</div>
        {hover && lockedTooltip ? (
          <span className={styles.tip}>
            <Tooltip arrow="top-center" maxWidth={260} description={lockedTooltip} />
          </span>
        ) : null}
      </span>
    );
  }

  return (
    <button type="button" onClick={onOpen} className={rowClass}>
      {inner}
    </button>
  );
}

export default NaicsRow;
