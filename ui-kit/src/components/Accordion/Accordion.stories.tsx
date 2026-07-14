import type { Meta, StoryObj } from "@storybook/react";
import { Accordion } from "./Accordion";
import { InfoTooltip } from "../InfoTooltip/InfoTooltip";
import { Text } from "../Text/Text";

const meta: Meta<typeof Accordion> = {
  title: "Components/Accordion",
  component: Accordion,
  tags: ["autodocs"],
  args: {
    title: "Product Groups & Products",
    summary: "8 groups · 5 products",
    defaultOpen: false,
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

type Story = StoryObj<typeof Accordion>;

const Body = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-200)" }}>
    <Text variant="b2" as="p" style={{ margin: 0 }}>Item one</Text>
    <Text variant="b2" as="p" style={{ margin: 0 }}>Item two</Text>
    <Text variant="b2" as="p" style={{ margin: 0 }}>Item three</Text>
  </div>
);

/** Collapsed by default — the recap summary conveys the gist. */
export const Collapsed: Story = {
  render: (args) => <Accordion {...args}><Body /></Accordion>,
};

/** Open by default. */
export const Open: Story = {
  args: { defaultOpen: true },
  render: (args) => <Accordion {...args}><Body /></Accordion>,
};

/** With a trailing info affordance next to the title. */
export const WithInfo: Story = {
  args: {
    info: <InfoTooltip tooltip="What this section contains." label="About this section" />,
  },
  render: (args) => <Accordion {...args}><Body /></Accordion>,
};
