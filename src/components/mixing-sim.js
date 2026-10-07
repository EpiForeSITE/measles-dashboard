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

  get heading() { return "Measles in a community"; }

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
    this.requestRun({ immediate: !this._results && !this._running });
  }

  _onSchool(e) {
    this.values = { ...this.values, propVaccinated: Math.round(e.detail.school.rate * 100) / 100 };
    this.requestRun();
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
    return html`<div class="note">
      ${this._calibrate
        ? html`Contacts are scaled so that R0 = <strong>${v.r0}</strong> (infectious for ${this._period().toFixed(1)} days on average).`
        : html`<strong>Scaling off:</strong> the matrix as entered implies R0 = <strong>${r0.toFixed(1)}</strong>; this input is ignored.`}
      At this coverage, one case infects <strong>${reff.toFixed(1)}</strong> others on average
      (herd immunity needs ${(herdImmunityThreshold(r0) * 100).toFixed(0)}% immune).</div>`;
  }

  renderSidebarTop() {
    return html`
      <details class="section" part="accordion" @md-school-selected=${this._onSchool} style="border-top:none">
        <summary>Use a school's vaccination rate</summary>
        <div class="section-body"><md-school-selector></md-school-selector></div>
      </details>`;
  }

  lede() {
    const v = this.values;
    const k = v.initialCases;
    const n = this._n;
    const g = this._population?.groups.length ?? 0;
    return html`${k} ${k === 1 ? "case" : "cases"} of measles introduced into a community of <strong>${n.toLocaleString()}</strong>
      people in ${g} ${g === 1 ? "group" : "groups"} with <strong>${Math.round((v.propVaccinated ?? 0) * 100)}%</strong> vaccinated:
      expected outbreak with and without quarantine of traced contacts.`;
  }

  renderAbout() {
    return html`
      <p>This model simulates measles in a larger population split into <strong>groups</strong> (for example schools, age groups or
        neighborhoods) that mix with each other at different rates. Detected cases are isolated, and their recent contacts are traced and
        asked to quarantine; the comparison is with and without that quarantine.</p>
      <p>The contact matrix sets <em>who mixes with whom</em>. By default it is rescaled so the model has the chosen basic reproductive
        number (R0), which keeps the mixing pattern while making transmission easy to interpret. Vaccination coverage applies to
        everyone, and results are for the whole population.</p>`;
  }

  renderBeforeResults() {
    return html`
      <section class="card" part="card population">
        <div class="card-header"><h3>Population &amp; contacts</h3><span class="hint">Edit groups and daily contacts; results update automatically</span></div>
        <div class="card-body">
          <md-group-editor preset=${this.preset ?? "default-3group"} .scaled=${this._scaled()} @md-population=${this._onPopulation}></md-group-editor>
          <label class="calibrate small">
            <input type="checkbox" .checked=${this._calibrate} @change=${(e) => { this._calibrate = e.target.checked; this.requestRun(); }} />
            Scale contacts to match R0 (recommended)
          </label>
        </div>
      </section>`;
  }

  thresholds() {
    return defaultThresholds(this._resultsN ?? this._n);
  }

  get filename() { return "measles-community-simulations.csv"; }
}

customElements.define("measles-mixing-sim", MixingSim);
