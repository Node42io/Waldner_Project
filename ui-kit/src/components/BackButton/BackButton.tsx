import { forwardRef } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import { Button } from "../Button/Button";
import type { ButtonProps } from "../Button/Button";

export interface BackButtonProps
  extends Omit<ButtonProps, "variant" | "size" | "iconOnly" | "leftIcon" | "rightIcon" | "children"> {
  /** Accessible label — required, since the button is icon-only (e.g. "Back to markets"). */
  label: string;
}

/**
 * The one back-navigation control for the whole app: an icon-only, outlined
 * secondary Button with a left arrow. Use it everywhere a "back" affordance is
 * needed so they stay identical. Pass `onClick` (and any other Button prop).
 */
export const BackButton = forwardRef<HTMLButtonElement, BackButtonProps>(
  ({ label, ...rest }, ref) => (
    <Button
      ref={ref}
      variant="secondary-outline"
      size="sm"
      iconOnly
      aria-label={label}
      leftIcon={<ArrowLeft size={16} weight="regular" />}
      {...rest}
    />
  ),
);

BackButton.displayName = "BackButton";
