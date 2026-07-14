import { forwardRef } from "react";
import type { HTMLAttributes, KeyboardEvent, MouseEvent, ReactNode } from "react";
import { Badge } from "../Badge/Badge";
import { AddressLine } from "../AddressLine/AddressLine";
import styles from "./CustomerCard.module.css";

export interface CustomerCardProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Company name — the card title (Aeonik Medium / B1). */
  companyName: ReactNode;
  /** Location line, shown next to a map-pin icon. */
  location?: ReactNode;
  /**
   * When set, the location becomes a button that calls this on click (to drive
   * an on-page map) instead of opening a Google Maps search. The click doesn't
   * bubble, so it won't also select the card.
   */
  onLocate?: (event: MouseEvent<HTMLElement>) => void;
  /** Category label — rendered inside a neutral `Badge`. */
  category?: ReactNode;
  /** Headcount value (e.g. "120"). */
  employees?: ReactNode;
  /** Headcount label (default "Employees"). */
  employeesLabel?: ReactNode;
  /** Revenue value (e.g. "15-30M $"). */
  revenue?: ReactNode;
  /** Revenue label (default "Revenue"). */
  revenueLabel?: ReactNode;
  /** Marks the card as selected (accent border + tinted surface). */
  selected?: boolean;
}

/**
 * Directory card for a customer/company: name, location, a category `Badge`,
 * and headcount/revenue stats. When an `onClick` is provided the card becomes
 * a selectable control (keyboard-reachable, `aria-pressed`), exposing hover,
 * focus-visible, active and selected states — all driven by tokens in CSS.
 */
export const CustomerCard = forwardRef<HTMLDivElement, CustomerCardProps>(
  (
    {
      companyName,
      location,
      onLocate,
      category,
      employees,
      employeesLabel = "Employees",
      revenue,
      revenueLabel = "Revenue",
      selected = false,
      onClick,
      onKeyDown,
      className,
      ...rest
    },
    ref,
  ) => {
    const interactive = onClick != null;

    const classes = [
      styles.card,
      interactive ? styles.interactive : "",
      selected ? styles.selected : "",
      className ?? "",
    ]
      .filter(Boolean)
      .join(" ");

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      onKeyDown?.(event);
      if (interactive && (event.key === "Enter" || event.key === " ")) {
        event.preventDefault();
        onClick?.(event as unknown as MouseEvent<HTMLDivElement>);
      }
    };

    const interactiveProps = interactive
      ? {
          role: "button" as const,
          tabIndex: 0,
          "aria-pressed": selected,
          onClick,
          onKeyDown: handleKeyDown,
        }
      : {};

    const hasStats = employees != null || revenue != null;

    return (
      <div ref={ref} className={classes} {...interactiveProps} {...rest}>
        <div className={styles.header}>
          <p className={styles.name}>{companyName}</p>

          {location != null ? (
            <AddressLine className={styles.location} onLocate={onLocate}>
              {location}
            </AddressLine>
          ) : null}
        </div>

        {category != null ? (
          <Badge variant="neutral" size="sm">
            {category}
          </Badge>
        ) : null}

        {hasStats ? (
          <div className={styles.stats}>
            {employees != null ? (
              <span className={styles.stat}>
                <span className={styles.value}>{employees}</span>
                <span className={styles.label}>{employeesLabel}</span>
              </span>
            ) : null}

            {employees != null && revenue != null ? (
              <span className={styles.separator} aria-hidden="true" />
            ) : null}

            {revenue != null ? (
              <span className={styles.stat}>
                <span className={styles.value}>{revenue}</span>
                <span className={styles.label}>{revenueLabel}</span>
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  },
);

CustomerCard.displayName = "CustomerCard";
