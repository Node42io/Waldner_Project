import { Question, ChatCircle } from "@phosphor-icons/react";
import { Navbar, Logo, Button, ThemeToggle } from "@node42/ui-kit";

export type View = "map" | "list";

export interface TopNavProps {
  chatOpen: boolean;
  onToggleChat: () => void;
}

/**
 * Slim navbar matching Figma 4398:20945 — logo + theme toggle + chat + help.
 * Built from the @node42/ui-kit `Navbar` + `Logo`: the logo is a single
 * currentColor SVG that adapts to the active `data-theme` (no more dual PNGs
 * or `useTheme`). All view/CSV/filters controls live in the MapControls overlay.
 */
export function TopNav({ chatOpen, onToggleChat }: TopNavProps) {
  return (
    <Navbar
      className="shrink-0 z-30"
      brand={<Logo aria-label="node42" className="h-4 w-auto" />}
    >
      {/* Order L→R: theme toggle · help (question) · "Open chat" button.
          Icons come from @phosphor-icons/react, the kit's icon set. */}
      <ThemeToggle />
      <Button
        variant="secondary-outline"
        size="xs"
        iconOnly
        aria-label="Help"
        leftIcon={<Question size={14} />}
      />
      <Button
        variant="secondary"
        size="xs"
        onClick={onToggleChat}
        aria-pressed={chatOpen}
        leftIcon={<ChatCircle size={14} />}
      >
        Open chat
      </Button>
    </Navbar>
  );
}
