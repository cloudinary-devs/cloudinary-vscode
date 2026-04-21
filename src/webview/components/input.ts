/**
 * Input and Select components for Cloudinary VS Code extension webviews.
 * Provides consistent form control styling.
 */

import { escapeHtml } from "../utils/helpers";

/**
 * Text input configuration options.
 */
export interface InputOptions {
  /** Input ID (required for label association) */
  id: string;
  /** Input name attribute */
  name?: string;
  /** Input type */
  type?: "text" | "email" | "url" | "password" | "number" | "search";
  /** Placeholder text */
  placeholder?: string;
  /** Current value */
  value?: string;
  /** Label text */
  label?: string;
  /** Hint text below the input */
  hint?: string;
  /** Whether the input is required */
  required?: boolean;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Inline onchange handler */
  onChange?: string;
  /** Inline oninput handler */
  onInput?: string;
  /** Inline onkeypress handler */
  onKeypress?: string;
}

/**
 * Select dropdown configuration options.
 */
export interface SelectOptions {
  /** Select ID (required for label association) */
  id: string;
  /** Select name attribute */
  name?: string;
  /** Array of options */
  options: SelectOption[];
  /** Label text */
  label?: string;
  /** Hint text below the select */
  hint?: string;
  /** Currently selected value */
  value?: string;
  /** Whether the select is required */
  required?: boolean;
  /** Whether the select is disabled */
  disabled?: boolean;
  /** Additional CSS classes */
  className?: string;
  /** Inline onchange handler */
  onChange?: string;
}

/**
 * Individual select option.
 */
export interface SelectOption {
  /** Option value */
  value: string;
  /** Display label */
  label: string;
  /** Whether this option is disabled */
  disabled?: boolean;
}

/**
 * Form group container options.
 */
export interface FormGroupOptions {
  /** Group content (input, select, etc.) */
  content: string;
  /** Group label */
  label?: string;
  /** Associated input ID (for label's for attribute) */
  htmlFor?: string;
  /** Whether this is a full-width group */
  fullWidth?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Returns CSS styles for input and select components.
 */
export function getInputStyles(): string {
  return `
    /* ========================================
       Form Group
       ======================================== */
    .form-group {
      display: flex;
      flex-direction: column;
      gap: var(--space-xs);
      min-width: 200px;
    }

    .form-group--full {
      width: 100%;
    }

    .form-group__label {
      font-size: var(--font-sm);
      font-weight: 600;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    .form-group__hint {
      font-size: var(--font-xs);
      color: var(--color-text-muted);
      margin-top: var(--space-xs);
    }

    /* ========================================
       Text Input
       ======================================== */
    .input {
      width: 100%;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border, var(--color-border));
      border-radius: var(--radius-sm);
      padding: 0.5rem 0.75rem;
      font-family: inherit;
      font-size: var(--font-md);
      line-height: 1.4;
      transition: border-color var(--transition-normal);
    }

    .input:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }

    .input:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .input::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }

    /* Input sizes */
    .input--sm {
      padding: 0.35rem 0.5rem;
      font-size: var(--font-sm);
    }

    .input--lg {
      padding: 0.6rem 0.85rem;
      font-size: var(--font-lg);
    }

    /* ========================================
       Select Dropdown
       ======================================== */
    .select {
      width: 100%;
      background-color: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border, var(--color-border));
      border-radius: var(--radius-sm);
      padding: 0.5rem 0.75rem;
      font-family: inherit;
      font-size: var(--font-md);
      line-height: 1.4;
      cursor: pointer;
      transition: border-color var(--transition-normal);
      appearance: none;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M2 4l4 4 4-4'/%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 0.75rem center;
      padding-right: 2rem;
    }

    .select:focus {
      outline: none;
      border-color: var(--vscode-focusBorder);
    }

    .select:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    /* ========================================
       Settings Row (horizontal form layout)
       ======================================== */
    .settings-row {
      display: flex;
      gap: var(--space-lg);
      flex-wrap: wrap;
    }

    .settings-row .form-group {
      flex: 1;
    }

    /* ========================================
       Setting Card (styled form group)
       ======================================== */
    .setting-card {
      background-color: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: 0.75rem 1rem;
    }

    .setting-card .form-group__label {
      margin-bottom: var(--space-sm);
    }
  `;
}

/**
 * Creates a text input HTML element.
 *
 * @param options - Input configuration
 * @returns HTML string for the input
 *
 * @example
 * ```typescript
 * createInput({
 *   id: 'public-id',
 *   label: 'Public ID',
 *   placeholder: 'Enter custom ID',
 *   hint: 'Leave empty for auto-generated'
 * })
 * ```
 */
export function createInput(options: InputOptions): string {
  const {
    id,
    name,
    type = "text",
    placeholder,
    value,
    label,
    hint,
    required = false,
    disabled = false,
    className = "",
    onChange,
    onInput,
    onKeypress,
  } = options;

  const inputClasses = ["input", className].filter(Boolean).join(" ");

  const attributes: string[] = [
    `id="${escapeHtml(id)}"`,
    `type="${type}"`,
    `class="${inputClasses}"`,
  ];

  if (name) {attributes.push(`name="${escapeHtml(name)}"`);}
  if (placeholder) {attributes.push(`placeholder="${escapeHtml(placeholder)}"`);}
  if (value !== undefined) {attributes.push(`value="${escapeHtml(value)}"`);}
  if (required) {attributes.push("required");}
  if (disabled) {attributes.push("disabled");}
  if (onChange) {attributes.push(`onchange="${onChange}"`);}
  if (onInput) {attributes.push(`oninput="${onInput}"`);}
  if (onKeypress) {attributes.push(`onkeypress="${onKeypress}"`);}

  const inputHtml = `<input ${attributes.join(" ")} />`;

  if (!label && !hint) {
    return inputHtml;
  }

  return createFormGroup({
    content: inputHtml,
    label,
    htmlFor: id,
    hint,
  });
}

/**
 * Creates a select dropdown HTML element.
 *
 * @param options - Select configuration
 * @returns HTML string for the select
 *
 * @example
 * ```typescript
 * createSelect({
 *   id: 'folder-select',
 *   label: 'Destination Folder',
 *   options: [
 *     { value: '', label: '/ (root)' },
 *     { value: 'images', label: 'images' },
 *   ],
 *   value: ''
 * })
 * ```
 */
export function createSelect(options: SelectOptions): string {
  const {
    id,
    name,
    options: selectOptions,
    label,
    hint,
    value,
    required = false,
    disabled = false,
    className = "",
    onChange,
  } = options;

  const selectClasses = ["select", className].filter(Boolean).join(" ");

  const attributes: string[] = [
    `id="${escapeHtml(id)}"`,
    `class="${selectClasses}"`,
  ];

  if (name) {attributes.push(`name="${escapeHtml(name)}"`);}
  if (required) {attributes.push("required");}
  if (disabled) {attributes.push("disabled");}
  if (onChange) {attributes.push(`onchange="${onChange}"`);}

  const optionsHtml = selectOptions
    .map((opt) => {
      const selected = value !== undefined && opt.value === value ? "selected" : "";
      const disabledAttr = opt.disabled ? "disabled" : "";
      return `<option value="${escapeHtml(opt.value)}" ${selected} ${disabledAttr}>${escapeHtml(opt.label)}</option>`;
    })
    .join("");

  const selectHtml = `<select ${attributes.join(" ")}>${optionsHtml}</select>`;

  if (!label && !hint) {
    return selectHtml;
  }

  return createFormGroup({
    content: selectHtml,
    label,
    htmlFor: id,
    hint,
  });
}

/**
 * Creates a form group container.
 *
 * @param options - Form group configuration
 * @returns HTML string for the form group
 */
export function createFormGroup(options: FormGroupOptions & { hint?: string }): string {
  const {
    content,
    label,
    htmlFor,
    fullWidth = false,
    className = "",
    hint,
  } = options;

  const groupClasses = [
    "form-group",
    fullWidth ? "form-group--full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const labelHtml = label
    ? `<label class="form-group__label" ${htmlFor ? `for="${escapeHtml(htmlFor)}"` : ""}>${escapeHtml(label)}</label>`
    : "";

  const hintHtml = hint
    ? `<div class="form-group__hint">${escapeHtml(hint)}</div>`
    : "";

  return `
    <div class="${groupClasses}">
      ${labelHtml}
      ${content}
      ${hintHtml}
    </div>
  `;
}

/**
 * Creates a horizontal settings row container.
 *
 * @param content - Row content (multiple form groups)
 * @returns HTML string for the settings row
 */
export function createSettingsRow(content: string): string {
  return `<div class="settings-row">${content}</div>`;
}

/**
 * Creates a styled setting card container.
 *
 * @param content - Card content
 * @returns HTML string for the setting card
 */
export function createSettingCard(content: string): string {
  return `<div class="setting-card">${content}</div>`;
}

