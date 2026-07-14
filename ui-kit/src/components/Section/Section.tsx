import type { HTMLAttributes, ReactNode } from "react";
import { Text } from "../Text/Text";
import styles from "./Section.module.css";

export interface SectionProps extends HTMLAttributes<HTMLDivElement> {
  /** Small uppercase section label (Text `label-s`). */
  label: ReactNode;
  /** Optional trailing element after the label — e.g. an InfoTooltip. */
  info?: ReactNode;
  children?: ReactNode;
}

// A labelled content section: a small uppercase label (with an optional trailing
// info affordance) above its content. Keeps stacked report sections visually
// identical wherever they appear.
export function Section({ label, info, children, className, ...rest }: SectionProps) {
  return (
    <div className={[styles.section, className ?? ""].filter(Boolean).join(" ")} {...rest}>
      <div className={styles.header}>
        <Text variant="label-s">{label}</Text>
        {info}
      </div>
      {children}
    </div>
  );
}

export default Section;
