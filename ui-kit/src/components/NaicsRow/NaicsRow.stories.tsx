import type { Meta, StoryObj } from "@storybook/react";
import { NaicsRow } from "./NaicsRow";

const meta: Meta<typeof NaicsRow> = {
  title: "Components/NaicsRow",
  component: NaicsRow,
  tags: ["autodocs"],
  argTypes: {
    size: { control: "inline-radio", options: ["md", "sm"] },
    surface: { control: "inline-radio", options: ["default-2", "default"] },
    locked: { control: "boolean" },
    onOpen: { action: "open" },
  },
  args: {
    code: "622110",
    name: "General Medical & Surgical Hospitals",
    locked: false,
    size: "md",
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof NaicsRow>;

/** Live, clickable market row — trailing arrow, navigates on click. */
export const Live: Story = {};

/** Locked upsell row — greyed out with a lock icon, inert. */
export const Locked: Story = {
  args: { locked: true },
};

/** Locked row that reveals upsell copy in a tooltip on hover. */
export const LockedWithTooltip: Story = {
  args: {
    locked: true,
    lockedTooltip: "Upgrade to unlock additional NAICS markets.",
  },
};

/** Compact density — smaller badge, B2 name and tighter padding. */
export const Small: Story = {
  args: { size: "sm" },
};

/** md vs sm side by side. */
export const Sizes: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-400)" }}>
      <NaicsRow code="622110" name="General Medical & Surgical Hospitals" size="md" onOpen={() => {}} />
      <NaicsRow code="622110" name="General Medical & Surgical Hospitals" size="sm" onOpen={() => {}} />
    </div>
  ),
};

/** The two surface variants side by side: `default-2` (standard) vs `default`
 *  (lighter, for rows on a raised/page background). Shown on a page-tinted
 *  backdrop so the contrast between the two reads. */
export const Surfaces: Story = {
  render: () => (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-400)",
        padding: "var(--space-400)",
        background: "var(--color-page)",
      }}
    >
      <NaicsRow code="622110" name="Surface default-2 (standard)" surface="default-2" onOpen={() => {}} />
      <NaicsRow code="622110" name="Surface default (lighter)" surface="default" onOpen={() => {}} />
    </div>
  ),
};

/** A picker list mixing one live row with several locked ones. */
export const MarketList: Story = {
  render: () => (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-200)" }}>
      <NaicsRow code="622110" name="General Medical & Surgical Hospitals" onOpen={() => {}} />
      <NaicsRow code="621111" name="Offices of Physicians" locked lockedTooltip="Upgrade to unlock this market." />
      <NaicsRow code="621610" name="Home Health Care Services" locked lockedTooltip="Upgrade to unlock this market." />
      <NaicsRow code="623110" name="Nursing Care Facilities" locked lockedTooltip="Upgrade to unlock this market." />
    </div>
  ),
};
