import { forwardRef } from "react";
import type { HTMLAttributes, MouseEvent, ReactNode, Ref } from "react";
import { MapPin } from "@phosphor-icons/react";
import styles from "./AddressLine.module.css";

export type AddressLineSize = "b2" | "b3";

export interface AddressLineProps
  extends Omit<HTMLAttributes<HTMLElement>, "children"> {
  /** Address text. When a plain string it also drives the auto map link. */
  children: ReactNode;
  /**
   * Explicit link target. Overrides the Google Maps search that is otherwise
   * derived from the (string) address.
   */
  href?: string;
  /**
   * When false, renders static text with no link/hover affordance. Defaults to
   * true, so a string address becomes a clickable Google Maps search.
   */
  interactive?: boolean;
  /**
   * In-page locate handler. When provided (and `interactive` isn't false), the
   * line renders as a button that calls this on click INSTEAD of opening an
   * external Google Maps search — e.g. to fly a map already on the page to the
   * address. Takes precedence over the Google Maps href / `href`. The click is
   * stopped from bubbling so tapping it inside a selectable card doesn't also
   * toggle the card. Only the pin + text are clickable (content-width).
   */
  onLocate?: (event: MouseEvent<HTMLElement>) => void;
  /** Token text size — `b3` (12px, default) or `b2` (14px). */
  size?: AddressLineSize;
  /** Pin icon size in px. Default 16. */
  iconSize?: number;
}

/** Flatten a string / string[] node to plain text; null for anything richer. */
function toText(node: ReactNode): string | null {
  if (typeof node === "string") return node;
  if (Array.isArray(node) && node.every((n) => typeof n === "string")) {
    return node.join("");
  }
  return null;
}

const mapsHref = (query: string) =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;

/**
 * Map-pin + address, shared by the company cards (CustomerCard, ClientCard) and
 * the company detail drawer so they read identically. When the address is a
 * plain string the whole line becomes a link to a Google Maps search (opens in
 * a new tab, underlines + turns link-coloured on hover); pass `href` to point
 * somewhere else, `onLocate` to drive an on-page map (a button, no external
 * maps), or `interactive={false}` for static text. Click is stopped from
 * bubbling so tapping the address inside a selectable card doesn't also toggle
 * the card.
 */
export const AddressLine = forwardRef<HTMLElement, AddressLineProps>(
  (
    {
      children,
      href,
      interactive = true,
      onLocate,
      size = "b3",
      iconSize = 16,
      className,
      onClick,
      ...rest
    },
    ref,
  ) => {
    const text = toText(children);
    // In-page locate wins over any maps link.
    const locate = interactive ? onLocate : undefined;
    const linkHref =
      interactive && !locate
        ? (href ?? (text ? mapsHref(text) : undefined))
        : undefined;

    const classes = [
      styles.address,
      styles[`size-${size}`],
      locate || linkHref ? styles.link : "",
      className ?? "",
    ]
      .filter(Boolean)
      .join(" ");

    const pin = (
      <span
        className={styles.pin}
        aria-hidden="true"
        style={iconSize !== 16 ? { width: iconSize, height: iconSize } : undefined}
      >
        <MapPin size={iconSize} weight="regular" />
      </span>
    );

    const handleClick = (event: MouseEvent<HTMLElement>) => {
      // Keep a click on the address from also selecting the enclosing card.
      event.stopPropagation();
      onClick?.(event);
    };

    if (locate) {
      return (
        <button
          ref={ref as Ref<HTMLButtonElement>}
          type="button"
          className={[classes, styles.button].filter(Boolean).join(" ")}
          title={text ?? undefined}
          aria-label={text ? `${text} — show on map` : undefined}
          onClick={(event) => {
            event.stopPropagation();
            locate(event);
            onClick?.(event);
          }}
          {...rest}
        >
          {pin}
          <span className={styles.text}>{children}</span>
        </button>
      );
    }

    if (linkHref) {
      return (
        <a
          ref={ref as Ref<HTMLAnchorElement>}
          className={classes}
          href={linkHref}
          target="_blank"
          rel="noreferrer"
          title={text ?? undefined}
          aria-label={text ? `${text} — open in maps` : undefined}
          onClick={handleClick}
          {...rest}
        >
          {pin}
          <span className={styles.text}>{children}</span>
        </a>
      );
    }

    return (
      <span
        ref={ref as Ref<HTMLSpanElement>}
        className={classes}
        onClick={onClick}
        {...rest}
      >
        {pin}
        <span className={styles.text}>{children}</span>
      </span>
    );
  },
);

AddressLine.displayName = "AddressLine";
