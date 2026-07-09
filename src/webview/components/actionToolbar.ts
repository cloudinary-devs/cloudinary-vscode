import { actionIcons, IconSize } from "../icons";

export type ActionToolbarItemId = "home" | "refresh" | "upload" | "settings";

interface ActionToolbarItem {
  id: ActionToolbarItemId;
  action: string;
  label: string;
  title: string;
  icon: (size: IconSize) => string;
  group: "primary" | "upload" | "utility";
}

interface RenderActionToolbarOptions {
  id: string;
  ariaLabel: string;
  items?: ActionToolbarItemId[];
}

const defaultItems: ActionToolbarItem[] = [
  {
    id: "home",
    action: "showHomescreen",
    label: "Home",
    title: "Home",
    icon: actionIcons.home,
    group: "primary",
  },
  {
    id: "refresh",
    action: "refresh",
    label: "Refresh",
    title: "Refresh",
    icon: actionIcons.refresh,
    group: "primary",
  },
  {
    id: "upload",
    action: "openUploadWidget",
    label: "Upload",
    title: "Upload",
    icon: actionIcons.upload,
    group: "upload",
  },
  {
    id: "settings",
    action: "openGlobalConfig",
    label: "Configuration",
    title: "Configuration",
    icon: actionIcons.settings,
    group: "utility",
  },
];

export function renderActionToolbar(options: RenderActionToolbarOptions): string {
  const visibleItems = options.items
    ? defaultItems.filter((item) => options.items?.includes(item.id))
    : defaultItems;
  const groups = ["primary", "upload", "utility"] as const;
  const groupHtml = groups
    .map((group) => {
      const items = visibleItems.filter((item) => item.group === group);
      if (items.length === 0) {
        return "";
      }
      const buttons = items
        .map((item) => `
          <button
            class="cld-action-toolbar__button"
            type="button"
            data-action="${item.action}"
            title="${item.title}"
            aria-label="${item.label}"
          >${item.icon("sm")}</button>
        `)
        .join("");

      const utilityClass = group === "utility" ? " cld-action-toolbar__group--utility" : "";
      return `<div class="cld-action-toolbar__group${utilityClass}">${buttons}</div>`;
    })
    .join("");

  return `
    <div id="${options.id}" class="cld-action-toolbar" role="toolbar" aria-label="${options.ariaLabel}" data-cld-action-toolbar>
      ${groupHtml}
    </div>
  `;
}
