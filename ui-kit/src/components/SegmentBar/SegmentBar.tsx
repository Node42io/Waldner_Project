import { forwardRef } from "react";
import type { HTMLAttributes } from "react";
import styles from "./SegmentBar.module.css";

export interface SegmentBarSegment {
  /** Segment magnitude, in the same unit as the other segments / `total`. */
  value: number;
  /** Fill colour — any CSS colour or design token. */
  color: string;
  /** Optional label — not drawn by the bar itself, but used as the segment's
   *  hover title and handy when building a matching legend. */
  label?: string;
}

export interface SegmentBarProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Ordered segments filling the track left → right. */
  segments: SegmentBarSegment[];
  /** Denominator for the segment widths. Defaults to the sum of the values, so
   *  the bar is fully filled. Pass a larger total to leave an empty remainder
   *  (e.g. a single value against a whole). */
  total?: number;
  /** Track height in px (default 8). */
  height?: number;
  /** Colour of the empty remainder / track (default a faint neutral surface). */
  trackColor?: string;
  /** Round the outer ends (default true). */
  rounded?: boolean;
}

/**
 * A single horizontal track split into proportional coloured segments. Fully
 * filled by default (denominator = sum of values); pass a larger `total` to show
 * one or more values against a whole, leaving an empty remainder. Pair it with a
 * legend for the segment meanings.
 */
export const SegmentBar = forwardRef<HTMLDivElement, SegmentBarProps>(
  (
    { segments, total, height = 8, trackColor, rounded = true, className, style, ...rest },
    ref,
  ) => {
    const sum = segments.reduce((s, x) => s + Math.max(0, x.value), 0);
    const denom = total != null && total > 0 ? total : sum || 1;
    const classes = [styles.track, rounded ? styles.rounded : "", className ?? ""]
      .filter(Boolean)
      .join(" ");
    return (
      <div
        ref={ref}
        className={classes}
        style={{ height, ...(trackColor ? { background: trackColor } : null), ...style }}
        {...rest}
      >
        {segments.map((s, i) =>
          s.value > 0 ? (
            <span
              key={i}
              className={styles.segment}
              style={{ width: `${(s.value / denom) * 100}%`, background: s.color }}
              title={s.label}
            />
          ) : null,
        )}
      </div>
    );
  },
);

SegmentBar.displayName = "SegmentBar";
