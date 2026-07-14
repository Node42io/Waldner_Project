import { useState } from "react";
import type { Meta, StoryObj } from "@storybook/react";
import { ShoppingCart, Wrench, Pulse, Trash, ArrowsClockwise } from "@phosphor-icons/react";
import { StageBox } from "./StageBox";

const meta: Meta<typeof StageBox> = {
  title: "Components/StageBox",
  component: StageBox,
  tags: ["autodocs"],
  args: {
    label: "Usage",
    count: 24,
    selected: false,
    icon: <Pulse size={14} weight="regular" />,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 160 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof StageBox>;

export const Default: Story = {};

export const Selected: Story = { args: { selected: true } };

/** A row of stages, one selectable at a time. */
export const Row: Story = {
  render: () => {
    const stages = [
      { key: "acq", label: "Acquisition", icon: <ShoppingCart size={14} />, count: 8 },
      { key: "prep", label: "Preparation", icon: <ArrowsClockwise size={14} />, count: 5 },
      { key: "use", label: "Usage", icon: <Pulse size={14} />, count: 24 },
      { key: "maint", label: "Maintenance", icon: <Wrench size={14} />, count: 11 },
      { key: "disp", label: "Disposal", icon: <Trash size={14} />, count: 2 },
    ];
    const [sel, setSel] = useState("use");
    return (
      <div style={{ display: "flex", gap: "var(--space-200)", width: 620 }}>
        {stages.map((s) => (
          <StageBox
            key={s.key}
            icon={s.icon}
            label={s.label}
            count={s.count}
            selected={sel === s.key}
            onClick={() => setSel(s.key)}
          />
        ))}
      </div>
    );
  },
};
