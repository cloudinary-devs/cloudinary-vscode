/**
 * Layout components for Cloudinary VS Code extension webviews.
 * Provides common page layouts, headers, and containers.
 */

/**
 * Returns CSS styles for common layout patterns.
 */
export function getLayoutComponentStyles(): string {
  return `
    /* ========================================
       Page Layouts
       ======================================== */
    
    /* Centered single-column layout */
    .layout-centered {
      display: flex;
      justify-content: center;
      align-items: flex-start;
      min-height: 100vh;
    }

    /* Full-width container with max-width */
    .container {
      width: 100%;
      max-width: 1000px;
      margin: 0 auto;
      padding: var(--space-xxl);
    }

    .container--sm { max-width: 600px; }
    .container--lg { max-width: 1200px; }

    /* ========================================
       Asset Header (for preview panels)
       ======================================== */
    .asset-header {
      display: flex;
      align-items: center;
      gap: var(--space-md);
      margin-bottom: var(--space-lg);
      padding-bottom: var(--space-md);
      border-bottom: 1px solid var(--color-border);
    }

    .asset-header__icon {
      display: flex;
      align-items: center;
      justify-content: center;
      color: var(--color-accent);
      flex-shrink: 0;
    }

    .asset-header__icon svg {
      width: 28px;
      height: 28px;
    }

    .asset-header__content {
      flex: 1;
      min-width: 0;
    }

    .asset-header__title {
      margin: 0;
      font-size: var(--font-lg);
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .asset-header__subtitle {
      font-size: var(--font-sm);
      color: var(--color-text-muted);
      margin-top: 0.2rem;
      display: flex;
      align-items: center;
      gap: var(--space-sm);
    }

    /* ========================================
       Hero Header (for welcome/landing pages)
       ======================================== */
    .hero {
      text-align: center;
      margin-bottom: var(--space-xxl);
      padding: var(--space-xxl);
      background: linear-gradient(135deg, var(--cld-brand-blue) 0%, var(--cld-sky-blue) 100%);
      border-radius: var(--radius-xxl);
      color: white;
    }

    .hero__title {
      margin: 0;
      font-size: 2.5rem;
      font-weight: 700;
      color: white;
    }

    .hero__subtitle {
      margin: var(--space-sm) 0 0 0;
      font-size: 1.1rem;
      opacity: 0.9;
      color: white;
    }

    /* ========================================
       Status Card
       ======================================== */
    .status-card {
      background-color: var(--color-surface-elevated);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: var(--space-xl);
      margin-bottom: var(--space-xxl);
      display: flex;
      align-items: center;
      gap: var(--space-lg);
    }

    .status-card__icon {
      font-size: 1.5rem;
      width: 2.5rem;
      height: 2.5rem;
      border-radius: var(--radius-full);
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      flex-shrink: 0;
    }

    .status-card__icon--success {
      background-color: var(--color-success);
    }

    .status-card__icon--warning {
      background-color: var(--cld-pink);
    }

    .status-card__icon--error {
      background-color: var(--color-error);
    }

    .status-card__icon--info {
      background-color: var(--cld-turquoise);
    }

    .status-card__content {
      flex: 1;
    }

    .status-card__title {
      font-weight: 600;
      margin-bottom: var(--space-xs);
    }

    .status-card__text {
      margin: 0;
      color: var(--color-text-muted);
    }

    /* ========================================
       Step List (for onboarding)
       ======================================== */
    .step-list {
      display: flex;
      flex-direction: column;
      gap: var(--space-xl);
    }

    .step {
      display: flex;
      align-items: flex-start;
      gap: var(--space-lg);
    }

    .step__number {
      background-color: var(--cld-brand-blue);
      color: white;
      border-radius: var(--radius-full);
      width: 2rem;
      height: 2rem;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      flex-shrink: 0;
    }

    .step__content {
      flex: 1;
    }

    .step__title {
      margin: 0 0 var(--space-sm) 0;
      font-size: var(--font-lg);
      font-weight: 600;
    }

    .step__description {
      margin: 0 0 var(--space-sm) 0;
      color: var(--color-text-muted);
    }

    /* ========================================
       Feature Grid
       ======================================== */
    .feature-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: var(--space-xl);
    }

    .feature-item {
      background-color: var(--color-surface-elevated);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-lg);
      padding: var(--space-xl);
      text-align: center;
      transition: transform var(--transition-normal);
    }

    .feature-item:hover {
      transform: translateY(-2px);
    }

    .feature-item__icon {
      font-size: 2rem;
      margin-bottom: var(--space-lg);
    }

    .feature-item__title {
      font-size: var(--font-xl);
      font-weight: 600;
      margin-bottom: var(--space-sm);
    }

    .feature-item__description {
      color: var(--color-text-muted);
      font-size: var(--font-md);
    }

    /* ========================================
       Highlight Box (for MCP/promotional)
       ======================================== */
    .highlight-box {
      background: linear-gradient(135deg, var(--cld-brand-blue) 0%, var(--cld-purple) 100%);
      color: white;
      padding: var(--space-xxl);
      border-radius: var(--radius-xxl);
      margin: var(--space-xxl) 0;
      text-align: center;
    }

    .highlight-box__title {
      margin: 0 0 var(--space-lg) 0;
      font-size: 1.5rem;
      color: white;
    }

    .highlight-box__text {
      margin: 0 0 var(--space-xl) 0;
      opacity: 0.9;
      color: white;
    }

    /* ========================================
       Info/Warning Boxes
       ======================================== */
    .info-box {
      background-color: rgba(72, 196, 216, 0.1);
      border: 1px solid var(--cld-turquoise);
      border-radius: var(--radius-md);
      padding: var(--space-lg);
      margin: var(--space-lg) 0;
    }

    .info-box strong {
      color: var(--cld-turquoise);
    }

    .warning-box {
      background-color: rgba(161, 94, 228, 0.1);
      border: 1px solid var(--cld-purple);
      border-radius: var(--radius-md);
      padding: var(--space-lg);
      margin: var(--space-lg) 0;
    }

    .warning-box strong {
      color: var(--cld-purple);
    }

    .error-box {
      background-color: rgba(254, 89, 129, 0.1);
      border: 1px solid var(--cld-pink);
      border-radius: var(--radius-md);
      padding: var(--space-lg);
      margin: var(--space-lg) 0;
    }

    .error-box strong {
      color: var(--cld-pink);
    }

    /* ========================================
       Code Block
       ======================================== */
    .code-block {
      background-color: var(--color-surface);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-md);
      padding: var(--space-lg);
      margin: var(--space-lg) 0;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: var(--font-sm);
      position: relative;
      overflow-x: auto;
    }

    .code-block pre {
      margin: 0;
      white-space: pre-wrap;
    }

    .code-block__copy {
      position: absolute;
      top: var(--space-sm);
      right: var(--space-sm);
    }

    /* ========================================
       Grid Layouts
       ======================================== */
    .grid-2 {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: var(--space-xl);
    }

    .grid-3 {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--space-xl);
    }

    @media (max-width: 768px) {
      .grid-2,
      .grid-3 {
        grid-template-columns: 1fr;
      }
    }

    /* ========================================
       Preview Container
       ======================================== */
    .preview-container {
      position: relative;
      display: inline-block;
      width: 100%;
      margin-bottom: var(--space-lg);
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      overflow: hidden;
      border: 1px solid var(--color-border);
    }

    .preview-container__media {
      display: block;
      max-width: 100%;
      max-height: 250px;
      width: auto;
      margin: 0 auto;
      border-radius: var(--radius-md);
    }

    .preview-container__enlarge {
      position: absolute;
      top: var(--space-sm);
      right: var(--space-sm);
      background: rgba(0, 0, 0, 0.7);
      border: none;
      border-radius: var(--radius-md);
      padding: var(--space-sm);
      cursor: pointer;
      color: white;
      opacity: 0;
      transition: opacity var(--transition-normal), background var(--transition-normal);
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .preview-container:hover .preview-container__enlarge {
      opacity: 1;
    }

    .preview-container__enlarge:hover {
      background: rgba(0, 0, 0, 0.9);
    }

    /* ========================================
       Raw File Preview
       ======================================== */
    .raw-file-preview {
      text-align: center;
      padding: var(--space-xxl);
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      border: 1px solid var(--color-border);
      margin-bottom: var(--space-lg);
    }

    .raw-file-preview__icon {
      margin-bottom: var(--space-md);
      color: var(--color-text-muted);
    }

    .raw-file-preview__name {
      font-size: var(--font-md);
      color: var(--color-text-muted);
      margin: var(--space-sm) 0;
      word-break: break-all;
    }

    /* ========================================
       Preset Details Toggle
       ======================================== */
    .preset-toggle {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .preset-toggle__btn {
      background: none;
      border: none;
      color: var(--color-accent);
      cursor: pointer;
      padding: 0;
      font-size: var(--font-xs);
      display: flex;
      align-items: center;
      gap: var(--space-xs);
    }

    .preset-toggle__btn::before {
      content: '▶';
      font-size: 0.55rem;
      transition: transform var(--transition-normal);
    }

    .preset-toggle__btn.expanded::before {
      transform: rotate(90deg);
    }

    .preset-details {
      margin-top: var(--space-sm);
      padding: var(--space-sm);
      background-color: var(--color-surface);
      border-radius: var(--radius-sm);
      font-size: var(--font-xs);
      font-family: var(--vscode-editor-font-family, monospace);
      white-space: pre-wrap;
      max-height: 150px;
      overflow-y: auto;
      border: 1px solid var(--color-border);
      display: none;
      color: var(--color-text-muted);
    }

    .preset-details.visible {
      display: block;
    }

    /* ========================================
       URL Input Group
       ======================================== */
    .url-input-group {
      display: flex;
      gap: var(--space-sm);
      margin-bottom: var(--space-md);
    }

    .url-input-group .input {
      flex: 1;
    }

    /* ========================================
       Metadata Section
       ======================================== */
    .meta-section {
      margin-bottom: var(--space-lg);
    }

    .meta-section:last-child {
      margin-bottom: 0;
    }

    .meta-section__title {
      font-size: var(--font-sm);
      font-weight: 600;
      color: var(--color-text-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: var(--space-sm);
    }

    .meta-section__empty {
      color: var(--color-text-muted);
      font-size: var(--font-sm);
      font-style: italic;
    }

    /* ========================================
       Links
       ======================================== */
    .link {
      color: var(--color-accent);
      cursor: pointer;
      text-decoration: none;
      transition: color var(--transition-normal), text-decoration var(--transition-normal);
    }

    .link:hover {
      text-decoration: underline;
    }

    /* ========================================
       Button Groups
       ======================================== */
    .btn-group {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-md);
      margin-top: var(--space-lg);
    }

    .btn-group--center {
      justify-content: center;
    }

    .btn-group--end {
      justify-content: flex-end;
    }

    /* ========================================
       Spacing Utilities
       ======================================== */
    .mt-sm { margin-top: var(--space-sm); }
    .mt-md { margin-top: var(--space-md); }
    .mt-lg { margin-top: var(--space-lg); }
    .mt-xl { margin-top: var(--space-xl); }
    .mt-xxl { margin-top: var(--space-xxl); }

    .mb-sm { margin-bottom: var(--space-sm); }
    .mb-md { margin-bottom: var(--space-md); }
    .mb-lg { margin-bottom: var(--space-lg); }
    .mb-xl { margin-bottom: var(--space-xl); }
    .mb-xxl { margin-bottom: var(--space-xxl); }

    /* ========================================
       Tags Display
       ======================================== */
    .meta-tags {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-sm);
    }

    /* ========================================
       Nested Tabs Fix
       ======================================== */
    .tabs .tabs {
      margin-top: var(--space-lg);
    }

    .tabs .tabs .tabs__nav {
      margin-bottom: var(--space-md);
    }

    /* ========================================
       List Styles
       ======================================== */
    .card ul,
    .card ol {
      margin: var(--space-md) 0;
      padding-left: var(--space-xl);
    }

    .card li {
      margin-bottom: var(--space-sm);
      line-height: 1.5;
    }

    .card li:last-child {
      margin-bottom: 0;
    }

    /* ========================================
       Card Headings
       ======================================== */
    .card h3 {
      margin: 0 0 var(--space-lg) 0;
      font-size: var(--font-xl);
      font-weight: 600;
    }

    .card h4 {
      margin: var(--space-lg) 0 var(--space-md) 0;
      font-size: var(--font-lg);
      font-weight: 600;
    }

    .card h4:first-child {
      margin-top: 0;
    }

    .card p {
      margin: 0 0 var(--space-md) 0;
      line-height: 1.6;
    }

    .card p:last-child {
      margin-bottom: 0;
    }
  `;
}
