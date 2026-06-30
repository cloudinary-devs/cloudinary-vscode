export interface UploadPresetOptionInput {
  name: string;
  signed?: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}

export function buildUploadPresetOptions(presets: UploadPresetOptionInput[]): SelectOption[] {
  return [
    { value: "", label: "No preset (signed upload)" },
    ...presets.map((preset) => ({
      value: preset.name,
      label: `${preset.name} (${preset.signed ? "Signed" : "Unsigned"})`,
    })),
  ];
}
