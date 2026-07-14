import { forwardRef, useEffect, useId, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { CaretDown, MagnifyingGlass } from "@phosphor-icons/react";
import { InputField } from "../InputField/InputField";
import { Checkbox } from "../Checkbox/Checkbox";
import { Button } from "../Button/Button";
import styles from "./Dropdown.module.css";

export interface DropdownOption {
  value: string;
  label: ReactNode;
}

export interface DropdownProps {
  options: DropdownOption[];
  /** Placeholder shown when nothing is selected. */
  placeholder?: string;
  /** Accessible name for the trigger — use when there is no visible `label`. */
  ariaLabel?: string;
  /** Small filter field at the top of the menu (for long option lists). */
  searchable?: boolean;
  /** Single-select value (ignored when `multiple`). */
  value?: string;
  /** Single-select change handler. */
  onChange?: (value: string) => void;
  /** Enable multi-select: a checkbox per option, menu stays open on pick. */
  multiple?: boolean;
  /** Multi-select selected values. */
  values?: string[];
  /** Multi-select toggle handler (add if absent, remove if present). */
  onToggle?: (value: string) => void;
  /**
   * Multi-select only: buffer picks in the open menu and show a Cancel / Ok
   * footer. Selections are held as a draft and applied via `onConfirm` on Ok;
   * Cancel (or dismissing the menu) discards them.
   */
  confirmable?: boolean;
  /** Called with the final selection when Ok is pressed (`confirmable` mode). */
  onConfirm?: (values: string[]) => void;
  /** Uppercase field label rendered above the trigger (also makes it a block field). */
  label?: string;
  /** Leading icon inside the trigger. */
  icon?: ReactNode;
  /** Stretch the trigger to fill its container. */
  fullWidth?: boolean;
  /**
   * Trigger height — matches InputField so the two pair up: `md` (default,
   * 40px), `sm` (32px), `xs` (24px).
   */
  size?: "xs" | "sm" | "md";
  disabled?: boolean;
  className?: string;
}

// Plain text of an option label, for the in-menu filter.
const labelText = (o: DropdownOption): string =>
  typeof o.label === "string" ? o.label : o.value;

/**
 * Single- or multi-select dropdown. The kit has no native-select replacement,
 * so this fills that gap with a themed, token-styled popover.
 *
 * - Single-select: `value` + `onChange` (menu closes on pick).
 * - Multi-select: `multiple` + `values` + `onToggle` (checkboxes, menu stays open).
 * - `searchable` adds an in-menu filter field for long lists.
 * - `label` renders an uppercase field label above the trigger (block layout);
 *   `icon` adds a leading glyph; `fullWidth` stretches the trigger.
 */
export const Dropdown = forwardRef<HTMLDivElement, DropdownProps>(
  (
    {
      options,
      value,
      onChange,
      multiple = false,
      values = [],
      onToggle,
      confirmable = false,
      onConfirm,
      placeholder = "Select…",
      ariaLabel,
      searchable = false,
      label,
      icon,
      fullWidth = false,
      size = "md",
      disabled = false,
      className,
    },
    ref,
  ) => {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");
    // Buffered multi-select (confirmable): the in-menu draft, applied on Ok.
    const buffered = confirmable && multiple;
    const [draft, setDraft] = useState<string[]>(values);
    const selectedValues = buffered ? draft : values;
    const rootRef = useRef<HTMLDivElement | null>(null);
    const listboxId = useId();
    const selected = options.find((o) => o.value === value);
    const isBlock = fullWidth || label != null;

    const setRef = (node: HTMLDivElement | null) => {
      rootRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
    };

    useEffect(() => {
      if (!open) return;
      setQ(""); // reset the filter each time the menu opens
      if (buffered) setDraft(values); // snapshot the committed selection
      const onDoc = (e: MouseEvent) => {
        if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
      };
      const onKey = (e: KeyboardEvent) => {
        if (e.key === "Escape") setOpen(false);
      };
      document.addEventListener("mousedown", onDoc);
      document.addEventListener("keydown", onKey);
      return () => {
        document.removeEventListener("mousedown", onDoc);
        document.removeEventListener("keydown", onKey);
      };
    }, [open]);

    const shown = useMemo(() => {
      if (!searchable || !q.trim()) return options;
      const needle = q.trim().toLowerCase();
      return options.filter((o) => labelText(o).toLowerCase().includes(needle));
    }, [options, q, searchable]);

    // Trigger text: in multi mode show a count once anything is picked.
    const triggerContent: ReactNode = multiple
      ? values.length === 0
        ? <span className={styles.placeholder}>{placeholder}</span>
        : `${values.length} selected`
      : selected
        ? selected.label
        : <span className={styles.placeholder}>{placeholder}</span>;

    const rootClasses = [styles.root, styles[`size-${size}`], isBlock ? styles.block : "", className ?? ""]
      .filter(Boolean)
      .join(" ");
    const triggerClasses = [styles.trigger, isBlock ? styles.full : ""]
      .filter(Boolean)
      .join(" ");

    return (
      <div ref={setRef} className={rootClasses}>
        {label != null ? <span className={styles.fieldLabel}>{label}</span> : null}

        <button
          type="button"
          className={triggerClasses}
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listboxId : undefined}
          aria-label={ariaLabel}
          onClick={() => setOpen((o) => !o)}
        >
          {icon != null ? <span className={styles.triggerIcon}>{icon}</span> : null}
          <span className={styles.triggerText}>{triggerContent}</span>
          <CaretDown
            size={12}
            weight="regular"
            className={[styles.caret, open ? styles.caretOpen : ""].filter(Boolean).join(" ")}
          />
        </button>

        {open ? (
          <div
            id={listboxId}
            role="listbox"
            aria-multiselectable={multiple || undefined}
            className={styles.menu}
          >
            {searchable ? (
              <div className={styles.search}>
                <InputField
                  autoFocus
                  size={size}
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search…"
                  aria-label="Filter options"
                  leading={<MagnifyingGlass size={16} weight="regular" aria-hidden />}
                />
              </div>
            ) : null}

            <div className={styles.list}>
              {shown.length === 0 ? (
                <div className={styles.empty}>No matches</div>
              ) : (
                shown.map((o) => {
                  const isSel = multiple ? selectedValues.includes(o.value) : o.value === value;
                  const optionClasses = [
                    styles.option,
                    isSel && !multiple ? styles.optionSelected : "",
                  ]
                    .filter(Boolean)
                    .join(" ");
                  return (
                    <button
                      key={o.value}
                      type="button"
                      role="option"
                      aria-selected={isSel}
                      className={optionClasses}
                      onClick={() => {
                        if (buffered) {
                          setDraft((d) =>
                            d.includes(o.value) ? d.filter((x) => x !== o.value) : [...d, o.value],
                          );
                          // keep the menu open; changes apply on Ok
                        } else if (multiple) {
                          onToggle?.(o.value);
                          // keep the menu open so several can be picked in a row
                        } else {
                          onChange?.(o.value);
                          setOpen(false);
                        }
                      }}
                    >
                      {multiple ? (
                        <Checkbox checked={isSel} readOnly aria-hidden tabIndex={-1} />
                      ) : null}
                      <span className={styles.optionText}>{o.label}</span>
                    </button>
                  );
                })
              )}
            </div>

            {buffered ? (
              <div className={styles.footer}>
                <Button variant="secondary-neutral" size="xs" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="xs"
                  onClick={() => {
                    onConfirm?.(draft);
                    setOpen(false);
                  }}
                >
                  Ok
                </Button>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  },
);

Dropdown.displayName = "Dropdown";
