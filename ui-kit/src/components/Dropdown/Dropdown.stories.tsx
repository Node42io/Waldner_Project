import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { Globe } from "@phosphor-icons/react";
import { Dropdown } from "./Dropdown";
import type { DropdownOption } from "./Dropdown";

const meta: Meta<typeof Dropdown> = {
  title: "Components/Dropdown",
  component: Dropdown,
  tags: ["autodocs"],
  decorators: [
    (Story) => (
      <div style={{ padding: 24, background: "var(--color-page)", minHeight: 360 }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Dropdown>;

const FRUITS: DropdownOption[] = [
  { value: "apple", label: "Apple" },
  { value: "banana", label: "Banana" },
  { value: "cherry", label: "Cherry" },
  { value: "date", label: "Date" },
];

const COUNTRIES: DropdownOption[] = [
  { value: "", label: "World" },
  { value: "DEU", label: "Germany" },
  { value: "CHE", label: "Switzerland" },
  { value: "AUT", label: "Austria" },
  { value: "ITA", label: "Italy" },
  { value: "FRA", label: "France" },
];

const MARKETS: DropdownOption[] = [
  { value: "biotech_research", label: "Biotech Research" },
  { value: "originator_pharma", label: "Originator Pharma" },
  { value: "cdmo_classic", label: "CDMO Classic" },
  { value: "vaccines", label: "Vaccines" },
  { value: "atmp_cell_gene", label: "ATMP Cell & Gene" },
  { value: "oncology_hpapi", label: "Oncology HPAPI" },
  { value: "sterile_generics", label: "Sterile Generics" },
];

/** Single-select (default). Menu closes on pick. */
export const Default: Story = {
  render: () => {
    const [value, setValue] = useState("apple");
    return (
      <Dropdown options={FRUITS} value={value} onChange={setValue} ariaLabel="Pick a fruit" />
    );
  },
};

/** Field style: uppercase `label` above + leading `icon`, stretched full width. */
export const WithLabelAndIcon: Story = {
  render: () => {
    const [value, setValue] = useState("");
    return (
      <div style={{ width: 280 }}>
        <Dropdown
          label="Country"
          icon={<Globe size={16} />}
          options={COUNTRIES}
          value={value}
          onChange={setValue}
        />
      </div>
    );
  },
};

/** Searchable: an in-menu filter field for long option lists. */
export const Searchable: Story = {
  render: () => {
    const [value, setValue] = useState<string>();
    return (
      <Dropdown
        searchable
        placeholder="Select a market…"
        ariaLabel="Market"
        options={MARKETS}
        value={value}
        onChange={setValue}
      />
    );
  },
};

/** Multi-select: a checkbox per option, menu stays open while picking. */
export const Multiple: Story = {
  render: () => {
    const [values, setValues] = useState<string[]>(["vaccines"]);
    const toggle = (v: string) =>
      setValues((prev) => (prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]));
    return (
      <Dropdown
        multiple
        searchable
        placeholder="All markets"
        ariaLabel="Markets"
        options={MARKETS}
        values={values}
        onToggle={toggle}
      />
    );
  },
};

/**
 * Confirmable multi-select: picks are buffered in the open menu and applied
 * only on **Ok** (via `onConfirm`); **Cancel** — or dismissing the menu —
 * discards them. The trigger count reflects the committed selection, not the
 * pending draft.
 */
export const Confirmable: Story = {
  render: () => {
    const [values, setValues] = useState<string[]>(["vaccines"]);
    return (
      <Dropdown
        label="Markets"
        size="sm"
        multiple
        searchable
        confirmable
        placeholder="All markets"
        fullWidth
        options={MARKETS}
        values={values}
        onConfirm={setValues}
      />
    );
  },
};

/** Sizes match InputField 1:1 — `md` (40px), `sm` (32px), `xs` (24px). Trigger
 *  height, padding, text and the field `label` all step down together. */
export const Sizes: Story = {
  render: () => {
    const [value, setValue] = useState("apple");
    return (
      <div style={{ display: "flex", gap: 16, alignItems: "flex-end" }}>
        {(["md", "sm", "xs"] as const).map((size) => (
          <div key={size} style={{ width: 160 }}>
            <Dropdown
              size={size}
              label="Fruit"
              options={FRUITS}
              value={value}
              onChange={setValue}
            />
          </div>
        ))}
      </div>
    );
  },
};

/** Empty selection shows the placeholder; `disabled` greys the trigger. */
export const States: Story = {
  render: () => (
    <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
      <Dropdown options={FRUITS} placeholder="Choose…" ariaLabel="Empty" />
      <Dropdown options={FRUITS} value="banana" disabled ariaLabel="Disabled" />
    </div>
  ),
};
