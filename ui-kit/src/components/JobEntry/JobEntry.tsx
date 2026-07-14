import type { HTMLAttributes, ReactNode } from "react";
import { Text } from "../Text/Text";
import styles from "./JobEntry.module.css";

export interface JobEntryProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Primary title (Text `b2` medium). */
  title: ReactNode;
  /** Supporting description line (Text `b3`). */
  description?: ReactNode;
  /** Trailing meta value — e.g. a related stakeholder name. */
  meta?: ReactNode;
  /** Leading glyph for the meta line. */
  metaIcon?: ReactNode;
}

// A list-item card for a single job/outcome: a title, a description line, and an
// optional meta row (icon + value, e.g. the stakeholder that holds it).
export function JobEntry({ title, description, meta, metaIcon, className, ...rest }: JobEntryProps) {
  return (
    <div className={[styles.entry, className ?? ""].filter(Boolean).join(" ")} {...rest}>
      <Text variant="b2" weight="medium" as="span">{title}</Text>
      {description != null ? (
        <Text variant="b3" as="span" className={styles.description}>{description}</Text>
      ) : null}
      {meta != null ? (
        <span className={styles.meta}>
          {metaIcon ? <span className={styles.metaIcon} aria-hidden="true">{metaIcon}</span> : null}
          <span className={styles.metaLabel}>{meta}</span>
        </span>
      ) : null}
    </div>
  );
}

export default JobEntry;
