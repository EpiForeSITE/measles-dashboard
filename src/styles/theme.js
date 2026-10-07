import { css } from "lit";

/**
 * Design tokens. Every visual choice reads one of these custom properties,
 * so a host page can restyle the dashboard from outside, e.g.
 *
 *   measles-dashboard { --md-primary: #00629b; --md-font-family: "Inter", sans-serif; }
 *
 * Custom properties inherit through shadow roots; parts (`::part(card)`,
 * `::part(sidebar)`, `::part(run-button)`, ...) allow finer overrides.
 */
export const tokens = css`
  :host {
    --_primary: var(--md-primary, #2f5fd0);
    --_on-primary: var(--md-on-primary, #ffffff);
    --_bg: var(--md-background, #f6f7f9);
    --_surface: var(--md-surface, #ffffff);
    --_surface-alt: var(--md-surface-alt, #f1f3f6);
    --_text: var(--md-text, #1d2433);
    --_muted: var(--md-text-muted, #5f6b7a);
    --_border: var(--md-border, #e3e6eb);
    --_radius: var(--md-radius, 12px);
    --_font: var(--md-font-family, ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif);
    --_font-size: var(--md-font-size, 15px);
    --_quarantine: var(--md-color-quarantine, #307bc2);
    --_no-quarantine: var(--md-color-no-quarantine, #c11a01);
    --_good: var(--md-color-good, #1b7f4a);
    --_warning-bg: var(--md-warning-bg, #fff8e6);
    --_warning-text: var(--md-warning-text, #6b4e00);
    --_warning-border: var(--md-warning-border, #f5e2a8);
    --_error: var(--md-error, #b02a37);
    --_sidebar-width: var(--md-sidebar-width, 320px);
    --_shadow: var(--md-shadow, 0 1px 2px rgba(16, 24, 40, 0.04), 0 1px 3px rgba(16, 24, 40, 0.06));
    --_focus: color-mix(in srgb, var(--_primary) 35%, transparent);

    font-family: var(--_font);
    font-size: var(--_font-size);
    line-height: 1.5;
    color: var(--_text);
  }
  :host, *, *::before, *::after { box-sizing: border-box; }
  a { color: var(--_primary); text-underline-offset: 2px; }
`;

/** Shared controls: buttons, inputs, cards, disclosures (native <details>). */
export const controls = css`
  .card {
    background: var(--_surface);
    border: 1px solid var(--_border);
    border-radius: var(--_radius);
    box-shadow: var(--_shadow);
    margin-bottom: 1rem;
  }
  .card-header {
    padding: 0.85rem 1.1rem 0;
    display: flex; align-items: baseline; justify-content: space-between; gap: 1rem; flex-wrap: wrap;
  }
  .card-header h3 { margin: 0; font-size: 1em; font-weight: 600; }
  .card-header .hint { color: var(--_muted); font-size: 0.85em; }
  .card-body { padding: 0.85rem 1.1rem 1.1rem; }

  button, .button {
    font: inherit;
    cursor: pointer;
    border-radius: 8px;
    border: 1px solid var(--_border);
    background: var(--_surface);
    color: var(--_text);
    padding: 0.4rem 0.8rem;
    transition: background-color 0.15s, border-color 0.15s, box-shadow 0.15s;
  }
  button:hover:not(:disabled) { background: var(--_surface-alt); }
  button:disabled { opacity: 0.55; cursor: not-allowed; }
  button.primary {
    background: var(--_primary);
    border-color: var(--_primary);
    color: var(--_on-primary);
    font-weight: 600;
  }
  button.primary:hover:not(:disabled) { background: color-mix(in srgb, var(--_primary) 88%, black); }
  button.ghost { border-color: transparent; background: transparent; color: var(--_muted); }
  button.ghost:hover:not(:disabled) { color: var(--_text); background: var(--_surface-alt); }
  button.small { font-size: 0.85em; padding: 0.25rem 0.6rem; }
  button.block { width: 100%; }
  :focus-visible { outline: none; box-shadow: 0 0 0 3px var(--_focus); }

  input[type="number"], input[type="text"], input[type="search"], select {
    font: inherit;
    width: 100%;
    padding: 0.4rem 0.6rem;
    border: 1px solid var(--_border);
    border-radius: 8px;
    background: var(--_surface);
    color: var(--_text);
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  input:focus, select:focus { border-color: var(--_primary); }
  input[type="range"] { width: 100%; accent-color: var(--_primary); margin: 0; }

  details.section { border-top: 1px solid var(--_border); }
  details.section > summary {
    cursor: pointer;
    padding: 0.75rem 0;
    font-weight: 600;
    list-style: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-radius: 6px;
  }
  details.section > summary::-webkit-details-marker { display: none; }
  details.section > summary::after {
    content: ""; width: 0.5em; height: 0.5em; margin-right: 0.25em;
    border-right: 2px solid var(--_muted); border-bottom: 2px solid var(--_muted);
    transform: rotate(-45deg); transition: transform 0.15s;
  }
  details.section[open] > summary::after { transform: rotate(45deg); }
  details.section > .section-body { padding-bottom: 0.5rem; }

  .muted { color: var(--_muted); }
  .small { font-size: 0.875em; }
  .error { color: var(--_error); }
  .alert-warning {
    background: var(--_warning-bg);
    color: var(--_warning-text);
    border: 1px solid var(--_warning-border);
    border-radius: 8px;
    padding: 0.6rem 0.8rem;
    margin: 0 0 0.75rem;
    font-size: 0.9em;
  }
  .visually-hidden {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
  }
  @media (prefers-reduced-motion: reduce) {
    * { transition: none !important; animation: none !important; }
  }
`;

/** Sidebar + main layout of a simulator; stacks on narrow screens. */
export const layout = css`
  .layout {
    display: grid;
    grid-template-columns: var(--_sidebar-width) minmax(0, 1fr);
    gap: 1.25rem;
    align-items: start;
  }
  .sidebar {
    background: var(--_surface);
    border: 1px solid var(--_border);
    border-radius: var(--_radius);
    box-shadow: var(--_shadow);
    padding: 1rem 1.1rem 0.5rem;
    position: sticky;
    top: 0.75rem;
    max-height: calc(100vh - 1.5rem);
    overflow-y: auto;
    scrollbar-width: thin;
  }
  .sidebar h3 { font-size: 0.78em; text-transform: uppercase; letter-spacing: 0.06em; color: var(--_muted); margin: 0.25rem 0 0.6rem; font-weight: 600; }
  .main { min-width: 0; }
  @media (max-width: 860px) {
    .layout { grid-template-columns: minmax(0, 1fr); }
    .sidebar { position: static; max-height: none; }
  }
`;
