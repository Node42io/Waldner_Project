import type { Meta, StoryObj } from "@storybook/react";
import { Briefcase, Eye, Megaphone, ShoppingCart, Wrench } from "@phosphor-icons/react";
import { StatBreakdown } from "./StatBreakdown";
import { WidgetCard } from "../WidgetCard/WidgetCard";

const meta: Meta<typeof StatBreakdown> = {
  title: "Components/StatBreakdown",
  component: StatBreakdown,
  tags: ["autodocs"],
  args: {
    value: 133,
    items: [
      { label: "Underserved", count: 65, color: "var(--danger-400)" },
      { label: "Served", count: 68, color: "var(--success-400)" },
      { label: "Overserved", count: 0, color: "var(--info-400)" },
    ],
  },
};

export default meta;
type Story = StoryObj<typeof StatBreakdown>;

/** Coloured dots as markers — the "Needs found" summary card. */
export const WithColourDots: Story = {};

/** Icons as markers — the "Stakeholders" summary card. */
export const WithIcons: Story = {
  args: {
    value: 9,
    items: [
      { label: "Job executor", count: 2, icon: <Wrench size={14} weight="regular" /> },
      { label: "Job overseer", count: 2, icon: <Eye size={14} weight="regular" /> },
      { label: "Purchase influencer", count: 3, icon: <Megaphone size={14} weight="regular" /> },
      { label: "Purchase executor", count: 2, icon: <ShoppingCart size={14} weight="regular" /> },
    ],
  },
};

/** Inside a WidgetCard, as it's used on the ODI Needs page. */
export const InWidgetCard: Story = {
  render: (args) => (
    <div style={{ maxWidth: 360 }}>
      <WidgetCard title="Jobs" icon={<Briefcase size={18} weight="regular" />}>
        <StatBreakdown {...args} />
      </WidgetCard>
    </div>
  ),
  args: {
    value: 58,
    items: [
      { label: "core", count: 33 },
      { label: "product", count: 0 },
      { label: "emotional", count: 16 },
      { label: "status", count: 9 },
    ],
  },
};
