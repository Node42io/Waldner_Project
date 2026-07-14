import type { Meta, StoryObj } from "@storybook/react";
import { FieldLabel } from "./FieldLabel";

const meta: Meta<typeof FieldLabel> = {
  title: "Components/FieldLabel",
  component: FieldLabel,
  tags: ["autodocs"],
  args: {
    children: "Confidence",
  },
};
export default meta;

type Story = StoryObj<typeof FieldLabel>;

/** The mono-UPPERCASE caption on its own. */
export const Default: Story = {};

/** As used above a toolbar control — caption then the control below it. */
export const OverControl: Story = {
  render: () => (
    <label style={{ display: "flex", flexDirection: "column", gap: "var(--space-50)" }}>
      <FieldLabel>Job</FieldLabel>
      <span style={{ color: "var(--text-body)" }}>Diagnose the patient</span>
    </label>
  ),
};
