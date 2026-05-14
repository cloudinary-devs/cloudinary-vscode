export type ActionToolbarAction =
  | "showHomescreen"
  | "refresh"
  | "openUploadWidget"
  | "openGlobalConfig";

interface InitActionToolbarOptions {
  onAction: (action: ActionToolbarAction) => void;
  root?: ParentNode;
}

export function initActionToolbar(options: InitActionToolbarOptions): void {
  const root = options.root ?? document;
  root
    .querySelectorAll<HTMLButtonElement>("[data-cld-action-toolbar] [data-action]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const action = button.dataset.action as ActionToolbarAction | undefined;
        if (action) {
          options.onAction(action);
        }
      });
    });
}
