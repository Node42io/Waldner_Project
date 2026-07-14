import type { Meta, StoryObj } from "@storybook/react";
import { Scrollbar } from "./Scrollbar";

const meta: Meta<typeof Scrollbar> = {
  title: "Components/Scrollbar",
  component: Scrollbar,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  argTypes: {
    orientation: {
      control: "inline-radio",
      options: ["vertical", "horizontal", "both"],
    },
  },
};

export default meta;
type Story = StoryObj<typeof Scrollbar>;

const rowStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontFamily: "var(--font-family-sans)",
  fontSize: "var(--font-size-b1)",
  lineHeight: "var(--line-height-b1)",
  color: "var(--text-body)",
};

const Rows = ({ count = 24 }: { count?: number }) => (
  <>
    {Array.from({ length: count }, (_, i) => (
      <div key={i} style={rowStyle}>
        Row {i + 1} — scrollable content
      </div>
    ))}
  </>
);

/** Vertical scroll (8px thumb). Hover the thumb to see the darker state. */
export const Vertical: Story = {
  args: { orientation: "vertical", maxHeight: 240 },
  render: (args) => (
    <div style={{ width: 280, border: "1px solid var(--border-card)", borderRadius: 16 }}>
      <Scrollbar {...args}>
        <Rows />
      </Scrollbar>
    </div>
  ),
};

/** Horizontal scroll — same 8px thumb on the bottom axis. */
export const Horizontal: Story = {
  args: { orientation: "horizontal", maxWidth: 280 },
  render: (args) => (
    <div style={{ border: "1px solid var(--border-card)", borderRadius: 16 }}>
      <Scrollbar {...args}>
        <div style={{ display: "flex", width: 900, ...rowStyle }}>
          A very wide block of content that overflows horizontally to demonstrate
          the horizontal scrollbar styling.
        </div>
      </Scrollbar>
    </div>
  ),
};

/** Both axes. */
export const Both: Story = {
  args: { orientation: "both", maxHeight: 240, maxWidth: 280 },
  render: (args) => (
    <div style={{ border: "1px solid var(--border-card)", borderRadius: 16 }}>
      <Scrollbar {...args}>
        <div style={{ width: 900 }}>
          <Rows />
        </div>
      </Scrollbar>
    </div>
  ),
};
