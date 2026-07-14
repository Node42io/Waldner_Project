import { useEffect, useState } from "react";
import type { HTMLAttributes, MouseEvent as ReactMouseEvent } from "react";
import { Envelope, Copy, CheckCircle } from "@phosphor-icons/react";
import styles from "./EmailChip.module.css";

export interface EmailChipProps extends HTMLAttributes<HTMLSpanElement> {
  /** Email address — rendered as a mailto link with a copy-to-clipboard button. */
  email: string;
}

// Inline email display: an envelope glyph, the address as a mailto link, and a
// copy button that flips to a success check for ~1.5s after copying.
export function EmailChip({ email, className, ...rest }: EmailChipProps) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  const copy = (e: ReactMouseEvent) => {
    e.stopPropagation();
    navigator.clipboard?.writeText(email).then(() => setCopied(true)).catch(() => {});
  };

  return (
    <span className={[styles.chip, className ?? ""].filter(Boolean).join(" ")} {...rest}>
      <Envelope size={14} weight="regular" className={styles.leadIcon} aria-hidden="true" />
      <a href={`mailto:${email}`} onClick={(e) => e.stopPropagation()} className={styles.link}>
        {email}
      </a>
      <button
        type="button"
        onClick={copy}
        title={copied ? "Copied" : "Copy email"}
        aria-label={copied ? "Email copied" : "Copy email"}
        className={[styles.copy, copied ? styles.copied : ""].filter(Boolean).join(" ")}
      >
        {copied ? <CheckCircle size={14} weight="fill" /> : <Copy size={14} weight="regular" />}
      </button>
    </span>
  );
}

export default EmailChip;
