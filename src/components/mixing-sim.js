import { css, html, nothing } from "lit";
import { defaultThresholds } from "../analysis.js";
import { MIXING_INPUTS } from "../params.js";
import { effectiveR, herdImmunityThreshold, mixingInfectiousPeriod, mixingR0 } from "../r0.js";
import { mixingMatrix, mixingSpec } from "../specs.js";
import { SimBase } from "./sim-base.js";
import "./group-editor.js";
import "./school-selector.js";

/**
 * Measles in a larger population of interacting groups (MeaslesMixing),
 * with and without quarantine. Groups and their contact matrix come from a
 * preset in data/populations/ and can be edited; the matrix is rescaled so
 * the model has the chosen R0.
 *
 * @element measles-mixing-sim
 * @attr preset - Id of the population preset to start from.
 */
export class MixingSim extends SimBase {
  static properties = {
    ...SimBase.properties,
    preset: { type: String },
    _population: { state: true },
    _populationErrors: { state: true },
    _calibrate: { state: true },
  };

  static styles = [...SimBase.styles, css`
    .note { font-size: 0.82em; color: var(--_muted); margin: -0.4rem 0 0.8rem; }
    .calibrate { display: flex; gap: 0.4rem; align-items: center; margin-top: 0.5rem; }
  `];

  constructor() {
    super();
    this._calibrate = true;
    this._populationErrors = [];
  }

  get inputs() { return MIXING_INPUTS; }

  get _n() {
    return this._population?.groups.reduce((a, g) => a + g.size, 0) ?? 0;
  }

  buildSpecs(v) {
    const options = { calibrate: this._calibrate };
    return {
      without: mixingSpec(v, this._population, { ...options, quarantine: false }),
      with: mixingSpec(v, this._population, { ...options, quarantine: true }),
    };
  }

  extraErrors() {
    if (!this._population) return ["Loading population…"];
    const errors = [...this._populationErrors];
    if (!errors.length && this.values.initialCases > this._n) errors.push("Initial cases cannot exceed the population size.");
    return errors;
  }

  _scaled() {
    if (!this._population || this._populationErrors.length || !this._calibrate) return undefined;
    try {
      return mixingMatrix(this.values, this._population, true);
    } catch {
      return undefined;
    }
  }

  _onPopulation(e) {
    e.stopPropagation();
    this._population = e.detail.population;
    this._populationErrors = e.detail.errors;
  }

  _onSchool(e) {
    this.values = { ...this.values, propVaccinated: Math.round(e.detail.school.rate * 100) / 100 };
  }

  _period() {
    const v = this.values;
    return mixingInfectiousPeriod(v.prodromalPeriod, v.rashPeriod, v.rashContactReduction, v.hospitalizationRate);
  }

  _impliedR0() {
    if (!this._population || this._populationErrors.length) return NaN;
    return mixingR0(this._population.contact_matrix, this.values.transmissionRate, this._period());
  }

  inputExtra(key) {
    const v = this.values;
    if (key !== "r0" || !this._population || this._populationErrors.length) return nothing;
    const r0 = this._calibrate ? v.r0 : this._impliedR0();
    const reff = effectiveR(r0, v.propVaccinated, v.vaxEfficacy);
    return html`<p class="note">
      ${this._calibrate
        ? html`Contact matrix rescaled to R0 = <strong>${v.r0}</strong> (mean infectious period ${this._period().toFixed(2)} days).`
        : html`<strong>Calibration off:</strong> the entered matrix implies R0 = <strong>${r0.toFixed(2)}</strong>; this input is ignored.`}
      Effective R at start: <strong>${reff.toFixed(2)}</strong>;
      herd-immunity threshold: ${(herdImmunityThreshold(r0) * 100).toFixed(0)}% immune.</p>`;
  }

  renderSidebarTop() {
    return html`
      <details class="accordion" part="accordion" @md-school-selected=${this._onSchool}>
        <summary>Vaccination from a school</summary>
        <div class="accordion-body"><md-school-selector></md-school-selector></div>
      </details>`;
  }

  renderDescription() {
    return html`
      <section class="card" part="card description">
        <div class="card-body">
          <h2>Modeling Measles in a Community</h2>
          <p>This model simulates measles in a larger population split into <strong>groups</strong> (for example schools, age groups, or
            neighborhoods) that mix with each other at different rates, and compares outbreaks with and without quarantine of traced contacts.
            Each detected case is isolated, and its recent contacts are traced and asked to quarantine.</p>
          <p>The contact matrix sets <em>who mixes with whom</em>. By default it is rescaled so that the model has the chosen basic
            reproductive number (R0), which keeps the mixing pattern while making the transmission intensity easy to interpret.
            Vaccination coverage applies to everyone. Results are for the whole population.</p>
        </div>
      </section>`;
  }

  renderBeforeResults() {
    return html`
      <section class="card" part="card population">
        <div class="card-header">Population &amp; contacts</div>
        <div class="card-body">
          <md-group-editor preset=${this.preset ?? "default-3group"} .scaled=${this._scaled()} @md-population=${this._onPopulation}></md-group-editor>
          <label class="calibrate small">
            <input type="checkbox" .checked=${this._calibrate} @change=${(e) => { this._calibrate = e.target.checked; }} />
            Rescale the contact matrix to match R0 (recommended)
          </label>
        </div>
      </section>`;
  }

  takeHome() {
    const v = this._ranWith ?? this.values;
    const k = v.initialCases;
    const n = this._ranN ?? this._n;
    return `When ${k} ${k === 1 ? "case" : "cases"} of measles ${k === 1 ? "is" : "are"} introduced into a community of ${n.toLocaleString()} people, we expect the following outbreak sizes and number of hospitalizations based on whether quarantine procedures were implemented:`;
  }

  async run() {
    this._ranN = this._n;
    return super.run();
  }

  thresholds() {
    return defaultThresholds(this._ranN ?? this._n);
  }

  get filename() { return "measles-community-simulations.csv"; }
}

customElements.define("measles-mixing-sim", MixingSim);
