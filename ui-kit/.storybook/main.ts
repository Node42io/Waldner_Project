import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../src/**/*.mdx", "../src/**/*.stories.@(ts|tsx)"],
  addons: [
    "@storybook/addon-essentials",
    "@storybook/addon-interactions",
  ],
  framework: {
    name: "@storybook/react-vite",
    options: {},
  },
  typescript: {
    reactDocgen: "react-docgen-typescript",
  },
  async viteFinal(config) {
    const { mergeConfig } = await import("vite");
    return mergeConfig(config, {
      // Force Vite to pre-bundle the huge @phosphor-icons/react barrel (3045
      // exports). Without this, dev can serve broken/partial icon modules and
      // icons render empty.
      optimizeDeps: {
        include: ["@phosphor-icons/react"],
      },
    });
  },
};

export default config;
