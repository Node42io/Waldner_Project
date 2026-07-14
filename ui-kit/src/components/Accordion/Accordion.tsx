import { useId, useState } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { Text } from "../Text/Text";
import styles from "./Accordion.module.css";

export interface AccordionProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Header title (Text `label-s`, like a Section label). */
  title: ReactNode;
  /** Optional trailing affordance next to the title — e.g. an InfoTooltip. */
  info?: ReactNode;
  /** Recap shown on the right of the header — a summary of the collapsed body
   *  (e.g. counts), so the section reads at a glance when closed. */
  summary?: ReactNode;
  /** Uncontrolled initial open state (default closed). */
  defaultOpen?: boolean;
  /** Controlled open state — pair with `onOpenChange`. */
  open?: boolean;
  /** Called with the next open state whenever the header is toggled. */
  onOpenChange?: (open: boolean) => void;
  children?: ReactNode;
}

// A collapsible section: a clickable header (title + optional info + a recap
// summary + chevron) over content that shows only when open. Uncontrolled by
// default; pass `open`/`onOpenChange` to control it.
export function Accordion({
  title,
  info,
  summary,
  defaultOpen = false,
  open,
  onOpenChange,
  children,
  className,
  ...rest
}: AccordionProps) {
  const [internal, setInternal] = useState(defaultOpen);
  const isOpen = open ?? internal;
  const bodyId = useId();

  const toggle = () => {
    const next = !isOpen;
    if (open === undefined) setInternal(next);
    onOpenChange?.(next);
  };

  return (
    <div className={[styles.accordion, className ?? ""].filter(Boolean).join(" ")} {...rest}>
      <button
        type="button"
        className={styles.header}
        aria-expanded={isOpen}
        aria-controls={bodyId}
        onClick={toggle}
      >
        <span className={styles.titleWrap}>
          <Text variant="label-s" as="span">{title}</Text>
          {info}
        </span>
        {summary != null ? <span className={styles.summary}>{summary}</span> : null}
        <CaretDown
          size={16}
          weight="regular"
          className={styles.caret}
          data-open={isOpen || undefined}
          aria-hidden="true"
        />
      </button>
      {isOpen ? (
        <div id={bodyId} className={styles.body}>
          {children}
        </div>
      ) : null}
    </div>
  );
}

export default Accordion;
