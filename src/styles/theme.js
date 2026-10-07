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
    --_primary: var(--md-primary, #0d6efd);
    --_on-primary: var(--md-on-primary, #ffffff);
    --_bg: var(--md-background, #ffffff);
    --_surface: var(--md-surface, #ffffff);
    --_surface-alt: var(--md-surface-alt, #f6f7f9);
    --_text: var(--md-text, #212529);
    --_muted: var(--md-text-muted, #6c757d);
    --_border: var(--md-border, #dee2e6);
    --_radius: var(--md-radius, 8px);
    --_font: var(--md-font-family, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif);
    --_font-size: var(--md-font-size, 15px);
    --_quarantine: var(--md-color-quarantine, #307bc2);
    --_no-quarantine: var(--md-color-no-quarantine, #c11a01);
    --_warning-bg: var(--md-warning-bg, #fff3cd);
    --_warning-text: var(--md-warning-text, #664d03);
    --_warning-border: var(--md-warning-border, #ffecb5);
    --_error: var(--md-error, #b02a37);
    --_sidebar-width: var(--md-sidebar-width, 300px);
    --_shadow: var(--md-shadow, 0 1px 2px rgba(0, 0, 0, 0.06), 0 1px 3px rgba(0, 0, 0, 0.08));

    font-family: var(--_font);
    font-size: var(--_font-size);
    line-height: 1.5;
    color: var(--_text);
  }
  :host, *, *::before, *::after { box-sizing: border-box; }
  a { color: var(--_primary); }
`;

/** Shared controls: buttons, inputs, cards, accordions (native <details>). */
export const controls = css`
  .card {
    background: var(--_surface);
    border: 1px solid var(--_border);
    border-radius: var(--_radius);
    box-shadow: var(--_shadow);
    margin-bottom: 1rem;
    overflow: hidden;
  }
  .card-header {
    padding: 0.6rem 1rem;
    border-bottom: 1px solid var(--_border);
    background: var(--_surface-alt);
    font-weight: 600;
  }
  .card-body { padding: 1rem; }

  button, .button {
    font: inherit;
    cursor: pointer;
    border-radius: calc(var(--_radius) * 0.75);
    border: 1px solid var(--_border);
    background: var(--_surface);
    color: var(--_text);
    padding: 0.4rem 0.8rem;
  }
  button:hover:not(:disabled) { filter: brightness(0.96); }
  button:disabled { opacity: 0.6; cursor: progress; }
  button.primary {
    background: var(--_primary);
    border-color: var(--_primary);
    color: var(--_on-primary);
    font-weight: 600;
  }
  button.block { width: 100%; }
  :focus-visible { outline: 2px solid var(--_primary); outline-offset: 2px; }

  input[type="number"], input[type="text"], select {
    font: inherit;
    width: 100%;
    padding: 0.35rem 0.5rem;
    border: 1px solid var(--_border);
    border-radius: calc(var(--_radius) * 0.75);
    background: var(--_bg);
    color: var(--_text);
  }
  input[type="range"] { width: 100%; accent-color: var(--_primary); }

  details.accordion {
    border: 1px solid var(--_border);
    border-radius: var(--_radius);
    margin: 0.75rem 0;
    background: var(--_surface);
  }
  details.accordion > summary {
    cursor: pointer;
    padding: 0.55rem 0.8rem;
    font-weight: 600;
    list-style: none;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  details.accordion > summary::-webkit-details-marker { display: none; }
  details.accordion > summary::after { content: "▸"; transition: transform 0.15s; color: var(--_muted); }
  details.accordion[open] > summary::after { transform: rotate(90deg); }
  details.accordion > .accordion-body { padding: 0 0.8rem 0.8rem; }

  .muted { color: var(--_muted); }
  .small { font-size: 0.875em; }
  .error { color: var(--_error); }
  .alert-warning {
    background: var(--_warning-bg);
    color: var(--_warning-text);
    border: 1px solid var(--_warning-border);
    border-radius: var(--_radius);
    padding: 0.75rem 1rem;
    margin-bottom: 1rem;
  }
  .visually-hidden {
    position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;
  }
`;

/** Sidebar + main layout of a simulator; stacks on narrow screens. */
export const layout = css`
  .layout {
    display: grid;
    grid-template-columns: var(--_sidebar-width) minmax(0, 1fr);
    gap: 1rem;
    align-items: start;
  }
  .sidebar {
    background: var(--_surface-alt);
    border: 1px solid var(--_border);
    border-radius: var(--_radius);
    padding: 1rem;
    position: sticky;
    top: 0.5rem;
    max-height: calc(100vh - 1rem);
    overflow-y: auto;
  }
  .main { min-width: 0; }
  @media (max-width: 760px) {
    .layout { grid-template-columns: minmax(0, 1fr); }
    .sidebar { position: static; max-height: none; }
  }
`;
