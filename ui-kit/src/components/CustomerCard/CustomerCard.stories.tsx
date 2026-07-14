import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { CustomerCard } from "./CustomerCard";

const meta: Meta<typeof CustomerCard> = {
  title: "Components/CustomerCard",
  component: CustomerCard,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  argTypes: {
    companyName: { control: "text" },
    location: { control: "text" },
    category: { control: "text" },
    employees: { control: "text" },
    revenue: { control: "text" },
    selected: { control: "boolean" },
  },
  args: {
    companyName: "Cerbios-Pharma SA",
    location: "Hitzkofer Strasse 1, Sigmaringendorf-Laucherthal (72517), Germany",
    category: "Pharmaceutical Manufacturing",
    employees: "120",
    revenue: "15-30M $",
  },
};

export default meta;
type Story = StoryObj<typeof CustomerCard>;

export const Default: Story = {
  render: (args) => (
    <div style={{ maxWidth: 320 }}>
      <CustomerCard {...args} />
    </div>
  ),
};

/** Selectable card: click or Tab + Enter/Space to toggle selection. */
export const Selectable: Story = {
  render: (args) => {
    const [selected, setSelected] = useState(false);
    return (
      <div style={{ maxWidth: 320 }}>
        <CustomerCard
          {...args}
          selected={selected}
          onClick={() => setSelected((s) => !s)}
        />
      </div>
    );
  },
};

/** Selected state (accent border + tinted surface). */
export const Selected: Story = {
  args: { selected: true },
  render: (args) => (
    <div style={{ maxWidth: 320 }}>
      <CustomerCard {...args} onClick={() => {}} />
    </div>
  ),
};

/**
 * All interactive states side by side. Hover the first card, Tab to focus a
 * card (visible focus ring), press-and-hold for active, and see the selected
 * one on the right.
 */
export const States: Story = {
  render: (args) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 24 }}>
      <div style={{ maxWidth: 320 }}>
        <CustomerCard {...args} onClick={() => {}} />
      </div>
      <div style={{ maxWidth: 320 }}>
        <CustomerCard {...args} selected onClick={() => {}} />
      </div>
    </div>
  ),
};

/** Minimal: name + location only. */
export const NameAndLocationOnly: Story = {
  args: { category: undefined, employees: undefined, revenue: undefined },
  render: (args) => (
    <div style={{ maxWidth: 320 }}>
      <CustomerCard {...args} />
    </div>
  ),
};
