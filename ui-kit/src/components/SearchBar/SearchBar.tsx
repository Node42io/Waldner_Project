import { forwardRef } from "react";
import type { InputHTMLAttributes } from "react";
import { MagnifyingGlass, X } from "@phosphor-icons/react";
import { InputField } from "../InputField/InputField";
import styles from "./SearchBar.module.css";

export interface SearchBarProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "type"> {
  /**
   * Compact size. `xs` (default) matches the navbar action buttons (24px);
   * `sm` (32px) suits denser toolbars.
   */
  size?: "xs" | "sm";
  /**
   * Show a trailing clear (×) button whenever there's a `value`; called on
   * click. The consumer owns the value, so `onClear` should reset it to "".
   */
  onClear?: () => void;
}

// Icon scales with the box height.
const ICON_SIZE: Record<NonNullable<SearchBarProps["size"]>, number> = {
  xs: 14,
  sm: 16,
};

/**
 * Search field: an `InputField` (compact size) composed with a leading
 * magnifier and search semantics. It reuses InputField's box/border/focus so
 * the two stay visually in lockstep; SearchBar only adds the fixed toolbar
 * width and the icon.
 */
export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(
  (
    {
      size = "xs",
      placeholder = "Search",
      "aria-label": ariaLabel = "Search",
      className,
      value,
      onClear,
      ...rest
    },
    ref,
  ) => {
    const wrapClasses = [styles.wrap, styles[`size-${size}`], className ?? ""]
      .filter(Boolean)
      .join(" ");

    const showClear = onClear != null && value != null && String(value).length > 0;

    return (
      <div className={wrapClasses}>
        <InputField
          ref={ref}
          type="search"
          size={size}
          value={value}
          placeholder={placeholder}
          aria-label={ariaLabel}
          leading={
            <MagnifyingGlass
              size={ICON_SIZE[size]}
              weight="light"
              style={{ color: "var(--icon-description)" }}
              aria-hidden
            />
          }
          trailing={
            showClear ? (
              <button
                type="button"
                className={styles.clear}
                aria-label="Clear search"
                onClick={onClear}
                tabIndex={-1}
              >
                <X size={ICON_SIZE[size]} weight="bold" aria-hidden />
              </button>
            ) : undefined
          }
          {...rest}
        />
      </div>
    );
  },
);

SearchBar.displayName = "SearchBar";
