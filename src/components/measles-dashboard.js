import { LitElement, css, html, nothing } from "lit";
import { configure } from "../config.js";
import { engineVersion } from "../engine.js";
import { controls, tokens } from "../styles/theme.js";
import "./mixing-sim.js";
import "./school-sim.js";

const TABS = {
  school: { label: "School", tag: (d) => html`<measles-school-sim default-state=${d.defaultState ?? ""} ?hide-acknowledgements=${d.hideAcknowledgements} ?hide-description=${d.hideDescription}></measles-school-sim>` },
  mixing: { label: "Community", tag: (d) => html`<measles-mixing-sim preset=${d.preset ?? "default-3group"} ?hide-acknowledgements=${d.hideAcknowledgements} ?hide-description=${d.hideDescription}></measles-mixing-sim>` },
};

/**
 * The full dashboard: a tab per simulator.
 *
 * @element measles-dashboard
 * @attr tabs - Comma-separated tabs to show, in order: "school,mixing" (default).
 * @attr base-url - Folder with data/ and assets/ (default: next to the script).
 * @attr engine-url - URL of epiworldjs's src/index.js.
 * @attr default-state - State preselected in the school selector.
 * @attr preset - Population preset of the community tab.
 * @attr hide-acknowledgements, hide-description, hide-footer
 */
export class MeaslesDashboard extends LitElement {
  static properties = {
    tabs: { type: String },
    baseUrl: { type: String, attribute: "base-url" },
    engineUrl: { type: String, attribute: "engine-url" },
    defaultState: { type: String, attribute: "default-state" },
    preset: { type: String },
    hideAcknowledgements: { type: Boolean, attribute: "hide-acknowledgements" },
    hideDescription: { type: Boolean, attribute: "hide-description" },
    hideFooter: { type: Boolean, attribute: "hide-footer" },
    _active: { state: true },
    _version: { state: true },
  };

  static styles = [tokens, controls, css`
    :host { display: block; }
    [role="tablist"] {
      display: inline-flex; gap: 0.25rem; padding: 0.25rem; margin-bottom: 1.1rem;
      background: var(--_surface-alt); border: 1px solid var(--_border); border-radius: 10px;
    }
    [role="tab"] { border: none; background: none; padding: 0.4rem 1rem; color: var(--_muted); border-radius: 7px; font-weight: 500; }
    [role="tab"]:hover { color: var(--_text); background: transparent; }
    [role="tab"][aria-selected="true"] { color: var(--_text); background: var(--_surface); box-shadow: var(--_shadow); }
    footer { text-align: center; font-size: 0.78em; color: var(--_muted); margin-top: 1.5rem; }
  `];

  constructor() {
    super();
    this.tabs = "school,mixing";
    // Tabs mount on first visit (and stay mounted), so a hidden simulator
    // does not run until someone opens it
    this._visited = new Set();
  }

  updated() {
    const tabs = this._tabs;
    this._visited.add(tabs.includes(this._active) ? this._active : tabs[0]);
  }

  willUpdate(changed) {
    if (changed.has("baseUrl") || changed.has("engineUrl"))
      configure({ baseUrl: this.baseUrl, engineUrl: this.engineUrl });
  }

  connectedCallback() {
    super.connectedCallback();
    if (!this.hideFooter) engineVersion().then((v) => { this._version = v; }).catch(() => {});
  }

  get _tabs() {
    return this.tabs.split(",").map((t) => t.trim()).filter((t) => t in TABS);
  }

  _keydown(e) {
    const tabs = this._tabs;
    const i = tabs.indexOf(this._active ?? tabs[0]);
    const next = e.key === "ArrowRight" ? (i + 1) % tabs.length : e.key === "ArrowLeft" ? (i - 1 + tabs.length) % tabs.length : -1;
    if (next < 0) return;
    this._active = tabs[next];
    this.updateComplete.then(() => this.renderRoot.querySelector(`#tab-${tabs[next]}`)?.focus());
  }

  render() {
    const tabs = this._tabs;
    const active = tabs.includes(this._active) ? this._active : tabs[0];
    return html`
      ${tabs.length > 1 ? html`
        <div role="tablist" part="tabs" @keydown=${this._keydown}>
          ${tabs.map((t) => html`<button type="button" role="tab" id="tab-${t}" part="tab" aria-controls="panel-${t}"
            aria-selected=${t === active ? "true" : "false"} tabindex=${t === active ? 0 : -1}
            @click=${() => { this._active = t; }}>${TABS[t].label}</button>`)}
        </div>` : nothing}
      ${tabs.map((t) => html`<div role="tabpanel" id="panel-${t}" aria-labelledby="tab-${t}" ?hidden=${t !== active}>
        ${this._visited.has(t) || t === active ? TABS[t].tag(this) : nothing}</div>`)}
      ${this.hideFooter ? nothing : html`<footer part="footer">
        Measles dashboard${this._version ? html` | epiworld ${this._version.epiworld} | measles ${this._version.measles}` : nothing}
        | <a href="https://github.com/UofUEpiBio/epiworldjs" target="_blank" rel="noopener">epiworldjs</a>
        <br /><strong>The University of Utah</strong>
      </footer>`}
    `;
  }
}

customElements.define("measles-dashboard", MeaslesDashboard);
