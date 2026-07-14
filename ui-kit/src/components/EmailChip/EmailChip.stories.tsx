import type { Meta, StoryObj } from "@storybook/react";
import { EmailChip } from "./EmailChip";

const meta: Meta<typeof EmailChip> = {
  title: "Components/EmailChip",
  component: EmailChip,
  tags: ["autodocs"],
  args: {
    email: "dr.rossi@hospital.example",
  },
};
export default meta;

type Story = StoryObj<typeof EmailChip>;

export const Default: Story = {};
