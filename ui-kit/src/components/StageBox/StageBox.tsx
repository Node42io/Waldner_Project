import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Text } from "../Text/Text";
import styles from "./StageBox.module.css";

export interface StageBoxProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Leading glyph shown before the label. */
  icon?: ReactNode;
  /** Short label (Text `label-xs`, truncated to one line). */
  label: ReactNode;
  /** Prominent value shown below the label — e.g. a count. */
  count: ReactNode;
  /** Selected (pressed) state — sets the selected surface + border. */
  selected?: boolean;
}

// A selectable stat tile: a small icon + label on top and a large value below.
// Used in a row to pick between segments/stages, each showing its own count.
export function StageBox({ icon, label, count, selected = false, className, ...rest }: StageBoxProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={[styles.box, selected ? styles.selected : "", className ?? ""].filter(Boolean).join(" ")}
      {...rest}
    >
      <span className={styles.head}>
        {icon ? <span className={styles.icon} aria-hidden="true">{icon}</span> : null}
        <Text variant="label-xs" as="span" className={styles.label}>{label}</Text>
      </span>
      <span className={styles.count}>{count}</span>
    </button>
  );
}

export default StageBox;
