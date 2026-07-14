import { forwardRef, Fragment } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { Dot } from "../Dot/Dot";
import styles from "./StatBreakdown.module.css";

export interface StatBreakdownItem {
  /** Row label, shown to the right of the marker + count. */
  label: ReactNode;
  /** The count / figure for this row. */
  count: ReactNode;
  /** Marker colour — renders a coloured Dot when no `icon` is supplied. */
  color?: string;
  /** Optional leading icon; replaces the colour dot as the row marker. */
  icon?: ReactNode;
}

export interface StatBreakdownProps extends HTMLAttributes<HTMLDivElement> {
  /** The large headline figure on the left. */
  value: ReactNode;
  /** Breakdown rows shown to the right of the figure. */
  items: StatBreakdownItem[];
}

/**
 * A large headline number paired with a compact breakdown list: the figure on the
 * left, a hairline rule, then rows of (marker · count · label) — all left-grouped
 * so the number and its breakdown read as one unit and the card stays short. Each
 * row shows either a supplied icon or a coloured Dot. Designed as the body of a
 * summary WidgetCard.
 */
export const StatBreakdown = forwardRef<HTMLDivElement, StatBreakdownProps>(
  ({ value, items, className, ...rest }, ref) => {
    const classes = [styles.root, className ?? ""].filter(Boolean).join(" ");
    return (
      <div ref={ref} className={classes} {...rest}>
        <span className={styles.figure}>{value}</span>
        <span aria-hidden className={styles.rule} />
        <div className={styles.grid}>
          {items.map((it, i) => (
            <Fragment key={i}>
              <span className={styles.marker}>
                {it.icon ?? (
                  <Dot size="sm" style={it.color ? { color: it.color } : undefined} />
                )}
              </span>
              <span className={styles.count}>{it.count}</span>
              <span className={styles.label}>{it.label}</span>
            </Fragment>
          ))}
        </div>
      </div>
    );
  },
);

StatBreakdown.displayName = "StatBreakdown";
