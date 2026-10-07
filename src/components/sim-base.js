import { LitElement, css, html, nothing } from "lit";
import { summarizeScenario } from "../analysis.js";
import { configure, resolveAsset } from "../config.js";
import { runAll } from "../engine.js";
import { defaults, validate } from "../params.js";
import { controls, layout, tokens } from "../styles/theme.js";
import "./param-input.js";
import "./results-panel.js";

/**
 * What the school and community simulators share: input state, the sidebar
 * sections, running the with/without-quarantine pair and the result cards.
 * Subclasses provide `inputs`, `buildSpecs(values)`, and the content hooks.
 *
 * @fires md-run-start - detail: {specs}
 * @fires md-run-complete - detail: {results, specs, ms}
 * @fires md-run-error - detail: {error}
 */
export class SimBase extends LitElement {
  static properties = {
    baseUrl: { type: String, attribute: "base-url" },
    engineUrl: { type: String, attribute: "engine-url" },
    nsims: { type: Number },
    hideAcknowledgements: { type: Boolean, attribute: "hide-acknowledgements" },
    hideDescription: { type: Boolean, attribute: "hide-description" },
    values: { state: true },
    _results: { state: true },
    _running: { state: true },
    _error: { state: true },
    _elapsed: { state: true },
  };

  static styles = [tokens, controls, layout, css`
    :host { display: block; }
    .run { margin-bottom: 0.75rem; }
    .info { font-size: 0.82em; color: var(--_muted); margin: -0.4rem 0 0.8rem; }
    .info strong { color: var(--_text); font-weight: 600; }
    .errors { margin: 0 0 0.75rem; padding-left: 1.1rem; }
    .ack { display: flex; align-items: center; gap: 2rem; flex-wrap: wrap; }
    .ack img { width: 150px; height: auto; }
    .meta { text-align: right; }
    h2 { font-size: 1.4em; margin: 0.25rem 0 0.5rem; }
  `];

  /** @type {import("../params.js").InputDef[]} */
  get inputs() { return []; }

  constructor() {
    super();
    this.values = defaults(this.inputs);
  }

  willUpdate(changed) {
    if (changed.has("baseUrl") || changed.has("engineUrl"))
      configure({ baseUrl: this.baseUrl, engineUrl: this.engineUrl });
    if (changed.has("nsims") && Number.isInteger(this.nsims))
      this.values = { ...this.values, nsims: this.nsims };
  }

  setValue(key, value) {
    this.values = { ...this.values, [key]: value };
  }

  _onInput(e) {
    e.stopPropagation();
    this.setValue(e.detail.key, e.detail.value);
    this.onValueChanged?.(e.detail.key);
  }

  /** Extra validation of subclasses. @returns {string[]} */
  extraErrors() { return []; }

  get errors() {
    return [...validate(this.inputs, this.values), ...this.extraErrors()];
  }

  _emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  /** Runs both scenarios. Public so host pages can trigger a run. */
  async run() {
    if (this._running || this.errors.length) return;
    // Both scenarios share one seed, as in the Shiny app
    const values = { ...this.values, seed: this.values.seed ?? Math.floor(Math.random() * 2 ** 31) };
    const specs = this.buildSpecs(values);
    this._running = true;
    this._error = "";
    this._emit("md-run-start", { specs });
    const start = performance.now();
    try {
      const [without, withQ] = await runAll([specs.without, specs.with]);
      const results = { without: summarizeScenario(without), with: summarizeScenario(withQ) };
      this._results = results;
      this._ranWith = values;
      this._elapsed = performance.now() - start;
      this._emit("md-run-complete", {
        specs, ms: this._elapsed,
        results: {
          without: { meanCases: results.without.outbreak.mean, meanHospitalizations: results.without.hosp.mean },
          with: { meanCases: results.with.outbreak.mean, meanHospitalizations: results.with.hosp.mean },
        },
      });
    } catch (error) {
      this._error = error.message;
      this._emit("md-run-error", { error });
    } finally {
      this._running = false;
    }
  }

  renderInput(key, extra = nothing) {
    const def = this.inputs.find((d) => d.key === key);
    if (!def) return nothing;
    return html`<md-param-input .def=${def} .value=${this.values[key]}>${extra}</md-param-input>`;
  }

  renderSection(section) {
    return this.inputs.filter((d) => d.section === section).map((d) => this.renderInput(d.key, this.inputExtra(d.key)));
  }

  /** Content shown under an input (e.g., R0 information). */
  inputExtra() { return nothing; }

  renderSidebar() {
    const errors = this.errors;
    return html`
      <aside class="sidebar" part="sidebar" @md-input=${this._onInput}>
        <button type="button" class="primary block run" part="run-button"
          ?disabled=${this._running || errors.length > 0} @click=${() => this.run()}>
          ${this._running ? "Running…" : "Run Simulation"}
        </button>
        ${errors.length ? html`<ul class="errors small error" role="alert">${errors.map((e) => html`<li>${e}</li>`)}</ul>` : nothing}
        ${this.renderSidebarTop()}
        ${this.renderSection("main")}
        <details class="accordion" part="accordion">
          <summary>Quarantine &amp; isolation</summary>
          <div class="accordion-body">${this.renderSection("quarantine")}</div>
        </details>
        <details class="accordion" part="accordion">
          <summary>Advanced parameters</summary>
          <div class="accordion-body">
            <p class="small">The below parameters are advanced and control disease dynamics.</p>
            ${this.renderSection("advanced")}
          </div>
        </details>
      </aside>`;
  }

  renderSidebarTop() { return nothing; }
  renderDescription() { return nothing; }
  renderBeforeResults() { return nothing; }
  takeHome() { return ""; }
  thresholds() { return undefined; }
  get filename() { return "measles-simulations.csv"; }

  renderAcknowledgements() {
    if (this.hideAcknowledgements) return nothing;
    const asset = (p) => resolveAsset(`assets/${p}`);
    return html`
      <section class="card" part="card acknowledgements">
        <div class="card-header">Acknowledgements</div>
        <div class="card-body">
          <p>Made in collaboration with Utah DHHS and ForeSITE. Simulations run in your browser with
            <a href="https://github.com/UofUEpiBio/epiworldjs" target="_blank" rel="noopener">epiworldjs</a>
            (WebAssembly build of <a href="https://github.com/UofUEpiBio/epiworld" target="_blank" rel="noopener">epiworld</a>
            and <a href="https://github.com/UofUEpiBio/measles" target="_blank" rel="noopener">measles</a>).</p>
          <div class="ack">
            <img src=${asset("udhhs-logo.png")} alt="Utah Department of Health and Human Services" />
            <img src=${asset("foresite-logo.png")} alt="ForeSITE" />
          </div>
        </div>
      </section>`;
  }

  render() {
    return html`
      <div class="layout">
        ${this.renderSidebar()}
        <div class="main">
          ${this.hideDescription ? nothing : this.renderDescription()}
          ${this.renderBeforeResults()}
          ${this._error ? html`<div class="alert-warning" role="alert"><strong>Error:</strong> ${this._error}</div>` : nothing}
          <md-results-panel .results=${this._results} .takeHome=${this.takeHome()} .thresholds=${this.thresholds()}
            ?running=${this._running} filename=${this.filename}></md-results-panel>
          ${this._elapsed ? html`<p class="small muted meta">Ran 2 × ${this._results.with.nsims.toLocaleString()} simulations in ${(this._elapsed / 1000).toFixed(1)} s.</p>` : nothing}
          ${this.renderAcknowledgements()}
        </div>
      </div>`;
  }
}
