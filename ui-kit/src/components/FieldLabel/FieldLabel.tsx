import { forwardRef } from "react";
import type { CSSProperties, ReactNode } from "react";
import styles from "./FieldLabel.module.css";

export interface FieldLabelProps {
  children: ReactNode;
  /** Optional inline-style overrides merged over the base caption style. */
  style?: CSSProperties;
  className?: string;
}

// Small uppercase mono caption sat above toolbar controls and metric values.
// Centralised so the app's field labels stay identical everywhere. Distinct
// from `Text variant="label-s"` (sans + Capitalize) on purpose — this is the
// mono-UPPERCASE toolbar caption.
export const FieldLabel = forwardRef<HTMLSpanElement, FieldLabelProps>(
  ({ children, style, className }, ref) => (
    <span
      ref={ref}
      className={[styles.label, className].filter(Boolean).join(" ")}
      style={style}
    >
      {children}
    </span>
  ),
);

FieldLabel.displayName = "FieldLabel";

export default FieldLabel;
