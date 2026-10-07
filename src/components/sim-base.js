import { LitElement, css, html, nothing } from "lit";
import { summarizeScenario } from "../analysis.js";
import { configure, resolveAsset } from "../config.js";
import { runAll } from "../engine.js";
import { defaults, validate } from "../params.js";
import { controls, layout, tokens } from "../styles/theme.js";
import "./param-input.js";
import "./results-panel.js";

/** Debounce between an input change and the run it triggers. */
const DEBOUNCE_MS = 350;
/** Runs costlier than this (agents × simulations × days) first show a quick preview. */
const PREVIEW_COST = 5e7;
const PREVIEW_SIMS = 40;

const cost = (spec) => (spec.n ?? spec.population.sizes.reduce((a, b) => a + b, 0)) * spec.nsims * Math.max(1, spec.ndays);

/**
 * What the school and community simulators share: input state, the sidebar
 * sections, running the with/without-quarantine pair and the results.
 * Subclasses provide `inputs`, `buildSpecs(values)`, and the content hooks.
 *
 * Results update automatically (debounced) as inputs change; costly runs
 * first show a preview with fewer simulations (the same first simulations
 * as the full run, since seeds are drawn per simulation). With the `manual`
 * attribute, a Run button starts runs instead.
 *
 * @fires md-run-start - detail: {specs, preview}
 * @fires md-run-complete - detail: {results, specs, ms, preview}
 * @fires md-run-error - detail: {error}
 */
export class SimBase extends LitElement {
  static properties = {
    baseUrl: { type: String, attribute: "base-url" },
    engineUrl: { type: String, attribute: "engine-url" },
    nsims: { type: Number },
    manual: { type: Boolean },
    hideAcknowledgements: { type: Boolean, attribute: "hide-acknowledgements" },
    hideDescription: { type: Boolean, attribute: "hide-description" },
    values: { state: true },
    _results: { state: true },
    _resultsN: { state: true },
    _running: { state: true },
    _refining: { state: true },
    _dirty: { state: true },
    _error: { state: true },
    _elapsed: { state: true },
  };

  static styles = [tokens, controls, layout, css`
    :host { display: block; }
    .run { margin-bottom: 0.9rem; }
    .note { font-size: 0.8em; color: var(--_muted); line-height: 1.45; }
    .note strong { color: var(--_text); font-weight: 600; }
    .errors { margin: 0 0 0.75rem; padding: 0.5rem 0.75rem 0.5rem 1.6rem; background: color-mix(in srgb, var(--_error) 7%, transparent); border-radius: 8px; }
    .intro { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; flex-wrap: wrap; margin: 0.1rem 0 0.75rem; }
    .intro h2 { font-size: 1.35em; margin: 0 0 0.25rem; letter-spacing: -0.01em; }
    .lede { margin: 0; color: var(--_muted); max-width: 62ch; }
    .lede strong { color: var(--_text); }
    .status {
      display: inline-flex; align-items: center; gap: 0.45rem; white-space: nowrap;
      font-size: 0.82em; color: var(--_muted); padding: 0.3rem 0.7rem; border: 1px solid var(--_border);
      border-radius: 999px; background: var(--_surface);
    }
    .status .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--_good); }
    .status.busy .dot { background: var(--_primary); animation: pulse 1s ease-in-out infinite; }
    .status.invalid .dot { background: var(--_error); }
    .status.dirty .dot { background: var(--_muted); }
    @keyframes pulse { 50% { opacity: 0.25; } }
    .progress { height: 2px; border-radius: 2px; overflow: hidden; margin: -0.4rem 0 0.75rem; background: transparent; }
    .progress.on { background: color-mix(in srgb, var(--_primary) 15%, transparent); }
    .progress.on::after {
      content: ""; display: block; height: 100%; width: 35%; background: var(--_primary); border-radius: 2px;
      animation: slide 1.1s ease-in-out infinite;
    }
    @keyframes slide { from { transform: translateX(-100%); } to { transform: translateX(300%); } }
    details.about { margin-bottom: 1rem; }
    details.about > summary { cursor: pointer; color: var(--_primary); font-size: 0.9em; width: fit-content; list-style: none; }
    details.about > summary::-webkit-details-marker { display: none; }
    details.about > summary::before { content: "ⓘ "; }
    details.about .card-body p:last-child { margin-bottom: 0; }
    .ack { display: flex; align-items: center; gap: 1.5rem; flex-wrap: wrap; font-size: 0.82em; color: var(--_muted); margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--_border); }
    .ack img { height: 40px; width: auto; }
    .ack p { margin: 0; flex: 1 1 18rem; }
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

  firstUpdated() {
    this.requestRun({ immediate: true });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    clearTimeout(this._timer);
  }

  setValue(key, value) {
    this.values = { ...this.values, [key]: value };
    this.requestRun();
  }

  _onInput(e) {
    e.stopPropagation();
    this.setValue(e.detail.key, e.detail.value);
    this.onValueChanged?.(e.detail.key);
  }

  /**
   * Asks for a run after the inputs settle (or marks results out of date
   * in manual mode).
   */
  requestRun({ immediate = false } = {}) {
    if (this.manual && !immediate) {
      this._dirty = true;
      return;
    }
    clearTimeout(this._timer);
    this._timer = setTimeout(() => this.run(), immediate ? 0 : DEBOUNCE_MS);
  }

  /** Extra validation of subclasses. @returns {string[]} */
  extraErrors() { return []; }

  get errors() {
    return [...validate(this.inputs, this.values), ...this.extraErrors()];
  }

  _emit(type, detail) {
    this.dispatchEvent(new CustomEvent(type, { detail, bubbles: true, composed: true }));
  }

  /**
   * Runs both scenarios now. Public so host pages can trigger a run. A run
   * requested while another is in progress starts when it finishes.
   */
  async run() {
    clearTimeout(this._timer);
    if (this.errors.length) return;
    if (this._running) {
      this._pending = true;
      return;
    }
    // Both scenarios share one seed, as in the Shiny app
    const values = { ...this.values, seed: this.values.seed ?? Math.floor(Math.random() * 2 ** 31) };
    const specs = this.buildSpecs(values);
    this._running = true;
    this._dirty = false;
    this._error = "";
    try {
      if (cost(specs.with) > PREVIEW_COST && values.nsims > PREVIEW_SIMS) {
        await this._execute(this.buildSpecs({ ...values, nsims: PREVIEW_SIMS }), true);
        if (this._pending) return;
        // The preview is on screen while the full run completes
        this._refining = true;
      }
      await this._execute(specs, false);
    } catch (error) {
      this._error = error.message;
      this._emit("md-run-error", { error });
    } finally {
      this._running = false;
      this._refining = false;
      if (this._pending) {
        this._pending = false;
        this.run();
      }
    }
  }

  async _execute(specs, preview) {
    this._emit("md-run-start", { specs, preview });
    const start = performance.now();
    const [without, withQ] = await runAll([specs.without, specs.with]);
    const results = { without: summarizeScenario(without), with: summarizeScenario(withQ) };
    this._results = results;
    this._resultsN = specs.with.n ?? specs.with.population.sizes.reduce((a, b) => a + b, 0);
    this._elapsed = performance.now() - start;
    this._emit("md-run-complete", {
      specs, preview, ms: this._elapsed,
      results: {
        without: { meanCases: results.without.outbreak.mean, meanHospitalizations: results.without.hosp.mean },
        with: { meanCases: results.with.outbreak.mean, meanHospitalizations: results.with.hosp.mean },
      },
    });
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
        ${this.manual ? html`
          <button type="button" class="primary block run" part="run-button"
            ?disabled=${this._running || errors.length > 0} @click=${() => this.run()}>
            ${this._running ? "Running…" : "Run simulation"}
          </button>` : nothing}
        ${errors.length ? html`<ul class="errors small error" role="alert">${errors.map((e) => html`<li>${e}</li>`)}</ul>` : nothing}
        ${this.renderSidebarTop()}
        <h3>Scenario</h3>
        ${this.renderSection("main")}
        <details class="section" part="accordion">
          <summary>Quarantine &amp; isolation</summary>
          <div class="section-body">${this.renderSection("quarantine")}</div>
        </details>
        <details class="section" part="accordion">
          <summary>Disease &amp; simulation</summary>
          <div class="section-body">${this.renderSection("advanced")}</div>
        </details>
      </aside>`;
  }

  renderSidebarTop() { return nothing; }
  /** Title of the simulator. */
  get heading() { return ""; }
  /** One-sentence summary of the current scenario (may contain markup). */
  lede() { return ""; }
  /** Body of the "About this model" disclosure. */
  renderAbout() { return nothing; }
  renderBeforeResults() { return nothing; }
  thresholds() { return undefined; }
  get filename() { return "measles-simulations.csv"; }

  _renderStatus() {
    const n = this._results?.with.nsims;
    if (this.errors.length) return html`<span class="status invalid" role="status"><span class="dot"></span>Check the inputs</span>`;
    if (this._running) {
      return html`<span class="status busy" role="status"><span class="dot"></span>${this._refining
        ? `Showing a quick preview (${PREVIEW_SIMS} runs), refining…`
        : "Updating…"}</span>`;
    }
    if (this._error) return html`<span class="status invalid" role="status"><span class="dot"></span>Run failed</span>`;
    if (this._dirty) return html`<span class="status dirty" role="status"><span class="dot"></span>Inputs changed · press Run</span>`;
    if (!this._results) return html`<span class="status busy" role="status"><span class="dot"></span>Loading…</span>`;
    return html`<span class="status" role="status" title="Both scenarios, ${n} simulations each"><span class="dot"></span>
      ${(2 * n).toLocaleString()} simulations · ${(this._elapsed / 1000).toFixed(1)} s</span>`;
  }

  renderAcknowledgements() {
    if (this.hideAcknowledgements) return nothing;
    return html`
      <footer class="ack" part="acknowledgements">
        <img src=${resolveAsset("assets/udhhs-logo.png")} alt="Utah Department of Health and Human Services" />
        <img src=${resolveAsset("assets/foresite-logo.png")} alt="ForeSITE" />
        <p>Made in collaboration with Utah DHHS and ForeSITE. Simulations run in your browser with
          <a href="https://github.com/UofUEpiBio/epiworldjs" target="_blank" rel="noopener">epiworldjs</a>,
          the WebAssembly build of <a href="https://github.com/UofUEpiBio/epiworld" target="_blank" rel="noopener">epiworld</a>
          and <a href="https://github.com/UofUEpiBio/measles" target="_blank" rel="noopener">measles</a>.</p>
      </footer>`;
  }

  render() {
    return html`
      <div class="layout">
        ${this.renderSidebar()}
        <div class="main">
          <header class="intro" part="intro">
            <div>
              <h2>${this.heading}</h2>
              <p class="lede">${this.lede()}</p>
            </div>
            ${this._renderStatus()}
          </header>
          <div class="progress ${this._running ? "on" : ""}" aria-hidden="true"></div>
          ${this.hideDescription ? nothing : html`
            <details class="about" part="about">
              <summary>About this model</summary>
              <div class="card" part="card description" style="margin-top:0.5rem"><div class="card-body">${this.renderAbout()}</div></div>
            </details>`}
          ${this.renderBeforeResults()}
          ${this._error ? html`<div class="alert-warning" role="alert"><strong>Error:</strong> ${this._error}</div>` : nothing}
          <md-results-panel exportparts="card, tile, tile-without, tile-with, tile-impact, download-button" .results=${this._results} .thresholds=${this.thresholds()} .population=${this._resultsN}
            ?running=${this._running} filename=${this.filename}></md-results-panel>
          ${this.renderAcknowledgements()}
        </div>
      </div>`;
  }
}
