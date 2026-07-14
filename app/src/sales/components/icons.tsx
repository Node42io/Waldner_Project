// Brand glyphs sourced from @phosphor-icons/react (the kit's icon set) so they
// match every other icon in the app. Kept behind the LinkedInIcon name so the
// existing call sites don't change.
import { LinkedinLogo, type IconProps } from "@phosphor-icons/react";

export function LinkedInIcon({ size = 14, ...rest }: IconProps) {
  return <LinkedinLogo size={size} aria-hidden {...rest} />;
}
