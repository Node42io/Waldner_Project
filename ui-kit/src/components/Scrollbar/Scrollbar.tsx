import { forwardRef } from "react";
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import styles from "./Scrollbar.module.css";

export type ScrollbarOrientation = "vertical" | "horizontal" | "both";

export interface ScrollbarProps extends HTMLAttributes<HTMLDivElement> {
  /** Which axis scrolls. Default "vertical". */
  orientation?: ScrollbarOrientation;
  /** Convenience cap so vertical content actually scrolls. */
  maxHeight?: number | string;
  /** Convenience cap so horizontal content actually scrolls. */
  maxWidth?: number | string;
  children: ReactNode;
}

/**
 * Scroll container that just sets the scroll behaviour per orientation. The
 * custom scrollbar look (thin 2px, fully rounded, light/dark aware) is applied
 * kit-wide in globals.css, so every scroll area — this component included —
 * stays consistent.
 */
export const Scrollbar = forwardRef<HTMLDivElement, ScrollbarProps>(
  (
    {
      orientation = "vertical",
      maxHeight,
      maxWidth,
      className,
      style,
      children,
      ...rest
    },
    ref,
  ) => {
    const classes = [styles[orientation], className ?? ""]
      .filter(Boolean)
      .join(" ");

    const mergedStyle: CSSProperties = { ...style };
    if (maxHeight != null) mergedStyle.maxHeight = maxHeight;
    if (maxWidth != null) mergedStyle.maxWidth = maxWidth;

    return (
      <div ref={ref} className={classes} style={mergedStyle} {...rest}>
        {children}
      </div>
    );
  },
);

Scrollbar.displayName = "Scrollbar";
