import type { Meta, StoryObj } from "@storybook/react";
import { SegmentBar } from "./SegmentBar";

const meta: Meta<typeof SegmentBar> = {
  title: "Components/SegmentBar",
  component: SegmentBar,
  tags: ["autodocs"],
  args: {
    height: 10,
    segments: [
      { value: 3, color: "var(--info-400)", label: "only A" },
      { value: 5, color: "var(--success-400)", label: "both" },
      { value: 3, color: "var(--warning-400)", label: "only B" },
      { value: 2, color: "var(--border-default-default)", label: "none" },
    ],
  },
  render: (args) => (
    <div style={{ width: 360 }}>
      <SegmentBar {...args} />
    </div>
  ),
};

export default meta;
type Story = StoryObj<typeof SegmentBar>;

/** A fully-filled stacked bar — segment widths are shares of the total. */
export const Stacked: Story = {};

/** A single value against a larger total leaves an empty remainder track. */
export const SingleValueVsTotal: Story = {
  args: {
    total: 13,
    segments: [{ value: 8, color: "var(--info-400)" }],
  },
};
