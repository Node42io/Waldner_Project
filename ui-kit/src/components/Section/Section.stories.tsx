import type { Meta, StoryObj } from "@storybook/react";
import { Section } from "./Section";
import { InfoTooltip } from "../InfoTooltip/InfoTooltip";
import { Text } from "../Text/Text";

const meta: Meta<typeof Section> = {
  title: "Components/Section",
  component: Section,
  tags: ["autodocs"],
  args: {
    label: "Core Functional Job",
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 520 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof Section>;

/** Label + content. */
export const Default: Story = {
  render: (args) => (
    <Section {...args}>
      <Text variant="b2" as="p" style={{ margin: 0 }}>
        Deliver comprehensive inpatient diagnostic, surgical and medical care.
      </Text>
    </Section>
  ),
};

/** With a trailing info affordance next to the label. */
export const WithInfo: Story = {
  args: {
    label: "Product Groups & Products",
    info: <InfoTooltip tooltip="What this section lists." label="About this section" />,
  },
  render: (args) => (
    <Section {...args}>
      <Text variant="b2" as="p" style={{ margin: 0 }}>
        The classifications and products available in this unit.
      </Text>
    </Section>
  ),
};
