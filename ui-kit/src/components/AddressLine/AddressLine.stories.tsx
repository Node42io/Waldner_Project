import type { Meta, StoryObj } from "@storybook/react";
import { AddressLine } from "./AddressLine";

const meta: Meta<typeof AddressLine> = {
  title: "Components/AddressLine",
  component: AddressLine,
  tags: ["autodocs"],
  parameters: { layout: "padded" },
  argTypes: {
    children: { control: "text" },
    href: { control: "text" },
    interactive: { control: "boolean" },
    size: { control: "inline-radio", options: ["b2", "b3"] },
    iconSize: { control: "number" },
  },
  args: {
    children: "15 Innovation Str., Basel (4051), Switzerland",
    interactive: true,
    size: "b3",
  },
};

export default meta;
type Story = StoryObj<typeof AddressLine>;

/** Clickable by default: hover to see the link colour + underline. */
export const Default: Story = {
  render: (args) => (
    <div style={{ maxWidth: 320 }}>
      <AddressLine {...args} />
    </div>
  ),
};

/** Static text — no link, no hover affordance. */
export const Static: Story = {
  args: { interactive: false },
  render: (args) => (
    <div style={{ maxWidth: 320 }}>
      <AddressLine {...args} />
    </div>
  ),
};

/** Larger body size. */
export const Body2: Story = {
  args: { size: "b2" },
  render: (args) => (
    <div style={{ maxWidth: 320 }}>
      <AddressLine {...args} />
    </div>
  ),
};
