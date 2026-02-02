/**
 * Design tokens for the Cloudinary VS Code extension webviews.
 * Based on Cloudinary Brand Guidelines: https://brand-guidelines.cloudinary.com/
 *
 * These tokens integrate Cloudinary brand colors with VS Code's native theming
 * to create a cohesive look that feels native to VS Code while incorporating
 * brand identity through accent colors.
 */

/**
 * Cloudinary brand color palette.
 * Note: Cloudinary Blue (#3448C5) is reserved for the logo per brand guidelines.
 */
export const colors = {
  // Primary brand colors
  brand: {
    /** Cloudinary Blue - Reserved for logo only per brand guidelines */
    cloudinaryBlue: "#3448C5",
    /** Sky Blue - Primary accent color */
    skyBlue: "#0D9AFF",
    /** Grey - Neutral primary */
    grey: "#E3E9EF",
    /** Aegean Blue - Dark primary */
    aegeanBlue: "#23436A",
    /** Cetacean Blue - Darkest primary */
    cetaceanBlue: "#1B295D",
  },

  // Secondary accent colors
  accent: {
    /** Turquoise - Info states */
    turquoise: "#48C4D8",
    /** Pink - Warning/attention states */
    pink: "#FE5981",
    /** Green - Light accent */
    green: "#D5FDA1",
    /** Teal - Success states */
    teal: "#60CFB7",
    /** Purple - Feature highlights */
    purple: "#A15EE4",
  },
} as const;

/**
 * Spacing scale using rem units for consistent sizing.
 */
export const spacing = {
  /** 4px */
  xs: "0.25rem",
  /** 8px */
  sm: "0.5rem",
  /** 12px */
  md: "0.75rem",
  /** 16px */
  lg: "1rem",
  /** 24px */
  xl: "1.5rem",
  /** 32px */
  xxl: "2rem",
} as const;

/**
 * Border radius values for consistent rounding.
 */
export const radius = {
  /** 4px - Buttons, badges */
  sm: "4px",
  /** 6px - Inputs, small cards */
  md: "6px",
  /** 8px - Cards, panels */
  lg: "8px",
  /** 10px - Large panels */
  xl: "10px",
  /** 12px - Hero sections */
  xxl: "12px",
  /** 50% - Circular elements */
  full: "50%",
} as const;

/**
 * Font size scale.
 */
export const fontSize = {
  /** 0.65rem - Micro text */
  xs: "0.65rem",
  /** 0.75rem - Small labels, hints */
  sm: "0.75rem",
  /** 0.85rem - Body text */
  md: "0.85rem",
  /** 1rem - Headings */
  lg: "1rem",
  /** 1.15rem - Section titles */
  xl: "1.15rem",
  /** 1.25rem - Panel titles */
  xxl: "1.25rem",
} as const;

/**
 * Transition durations for animations.
 */
export const transitions = {
  fast: "0.1s",
  normal: "0.15s",
  slow: "0.2s",
  slower: "0.3s",
} as const;

/**
 * Shadow definitions for elevation.
 */
export const shadows = {
  /** Subtle shadow for cards */
  sm: "0 2px 8px rgba(0, 0, 0, 0.15)",
  /** Medium shadow for elevated elements */
  md: "0 4px 12px rgba(0, 0, 0, 0.2)",
  /** Strong shadow for modals */
  lg: "0 4px 20px rgba(0, 0, 0, 0.25)",
} as const;

/**
 * Generates CSS custom properties (CSS variables) for the design system.
 * These variables bridge Cloudinary brand colors with VS Code theming.
 *
 * @returns CSS string containing :root variable definitions
 */
export function getCSSVariables(): string {
  return `
    :root {
      /* ========================================
         Cloudinary Brand Colors
         ======================================== */
      --cld-brand-blue: ${colors.brand.cloudinaryBlue};
      --cld-sky-blue: ${colors.brand.skyBlue};
      --cld-grey: ${colors.brand.grey};
      --cld-aegean: ${colors.brand.aegeanBlue};
      --cld-cetacean: ${colors.brand.cetaceanBlue};

      /* Accent colors */
      --cld-turquoise: ${colors.accent.turquoise};
      --cld-pink: ${colors.accent.pink};
      --cld-green: ${colors.accent.green};
      --cld-teal: ${colors.accent.teal};
      --cld-purple: ${colors.accent.purple};

      /* ========================================
         Semantic Color Mappings
         Maps VS Code variables with Cloudinary fallbacks
         ======================================== */
      
      /* Primary accent - used for links, active states */
      --color-accent: var(--vscode-textLink-foreground, var(--cld-sky-blue));
      --color-accent-hover: var(--vscode-textLink-activeForeground, var(--cld-sky-blue));

      /* Status colors */
      --color-success: var(--vscode-testing-iconPassed, var(--cld-teal));
      --color-error: var(--vscode-testing-iconFailed, var(--cld-pink));
      --color-warning: var(--cld-pink);
      --color-info: var(--cld-turquoise);

      /* Surface colors */
      --color-surface: var(--vscode-editor-background);
      --color-surface-elevated: var(--vscode-editorWidget-background);
      --color-border: var(--vscode-editorWidget-border);

      /* Text colors */
      --color-text: var(--vscode-editor-foreground);
      --color-text-muted: var(--vscode-descriptionForeground);

      /* ========================================
         Spacing Scale
         ======================================== */
      --space-xs: ${spacing.xs};
      --space-sm: ${spacing.sm};
      --space-md: ${spacing.md};
      --space-lg: ${spacing.lg};
      --space-xl: ${spacing.xl};
      --space-xxl: ${spacing.xxl};

      /* ========================================
         Border Radius
         ======================================== */
      --radius-sm: ${radius.sm};
      --radius-md: ${radius.md};
      --radius-lg: ${radius.lg};
      --radius-xl: ${radius.xl};
      --radius-xxl: ${radius.xxl};
      --radius-full: ${radius.full};

      /* ========================================
         Font Sizes
         ======================================== */
      --font-xs: ${fontSize.xs};
      --font-sm: ${fontSize.sm};
      --font-md: ${fontSize.md};
      --font-lg: ${fontSize.lg};
      --font-xl: ${fontSize.xl};
      --font-xxl: ${fontSize.xxl};

      /* ========================================
         Transitions
         ======================================== */
      --transition-fast: ${transitions.fast};
      --transition-normal: ${transitions.normal};
      --transition-slow: ${transitions.slow};

      /* ========================================
         Shadows
         ======================================== */
      --shadow-sm: ${shadows.sm};
      --shadow-md: ${shadows.md};
      --shadow-lg: ${shadows.lg};
    }
  `;
}

/**
 * All design tokens exported as a single object for programmatic access.
 */
export const tokens = {
  colors,
  spacing,
  radius,
  fontSize,
  transitions,
  shadows,
} as const;

export default tokens;
