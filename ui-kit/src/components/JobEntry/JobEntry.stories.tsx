import type { Meta, StoryObj } from "@storybook/react";
import { UsersThree } from "@phosphor-icons/react";
import { JobEntry } from "./JobEntry";

const meta: Meta<typeof JobEntry> = {
  title: "Components/JobEntry",
  component: JobEntry,
  tags: ["autodocs"],
  args: {
    title: "Detect tissue abnormalities",
    description: "Identify subtle low-contrast lesions during image review.",
    meta: "Radiologist",
    metaIcon: <UsersThree size={13} weight="regular" />,
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 420 }}>
        <Story />
      </div>
    ),
  ],
};
export default meta;

type Story = StoryObj<typeof JobEntry>;

export const Default: Story = {};

/** Title + description only, no meta row. */
export const NoMeta: Story = {
  args: { meta: undefined, metaIcon: undefined },
};
