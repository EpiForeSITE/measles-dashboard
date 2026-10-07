import { css, html, nothing } from "lit";
import { SCHOOL_INPUTS } from "../params.js";
import { effectiveR, herdImmunityThreshold, schoolContactRate } from "../r0.js";
import { schoolSpec } from "../specs.js";
import { SimBase } from "./sim-base.js";
import "./school-selector.js";

const DEFAULT_SCHOOL_SIZE = 500;
const MAX_CONTACT_RATE = 100; // epiworldjs's limit for "Contact rate"

/**
 * Measles outbreaks in a single school (MeaslesSchool), with and without
 * quarantine. The rebuild of epiworldRShiny's "Measles in Schools" app.
 *
 * @element measles-school-sim
 * @attr default-state - Two-letter state preselected in the school selector.
 */
export class SchoolSim extends SimBase {
  static properties = {
    ...SimBase.properties,
    defaultState: { type: String, attribute: "default-state" },
    _school: { state: true },
  };

  static styles = [...SimBase.styles, css`
    .note { font-size: 0.82em; color: var(--_muted); margin: -0.4rem 0 0.8rem; }
  `];

  get inputs() { return SCHOOL_INPUTS; }

  buildSpecs(v) {
    return { without: schoolSpec(v, { quarantine: false }), with: schoolSpec(v, { quarantine: true }) };
  }

  extraErrors() {
    const v = this.values;
    const errors = [];
    if (v.initialCases > v.populationSize) errors.push("Initial cases cannot exceed the population size.");
    const rate = schoolContactRate(v.r0, v.transmissionRate, v.prodromalPeriod);
    if (rate > MAX_CONTACT_RATE)
      errors.push(`R0 ${v.r0} needs ${rate.toFixed(0)} contacts per day (max ${MAX_CONTACT_RATE}); raise the transmission probability or prodromal period.`);
    return errors;
  }

  _onSchool(e) {
    const { school } = e.detail;
    this._school = school;
    const values = { ...this.values, propVaccinated: Math.round(school.rate * 100) / 100 };
    if (school.size) values.populationSize = school.size;
    this.values = values;
  }

  onValueChanged(key) {
    if (key === "propVaccinated" && this._school) {
      this._school = undefined;
      this.renderRoot.querySelector("md-school-selector")?.clear();
    }
  }

  inputExtra(key) {
    const v = this.values;
    if (key === "populationSize" && this._school && !this._school.size) {
      return html`<p class="note">Vaccination rate loaded for <strong>${this._school.name}</strong>; enrollment data is not available, so ${v.populationSize === DEFAULT_SCHOOL_SIZE ? html`the default school size of ${DEFAULT_SCHOOL_SIZE} students is used` : "the school size entered above is used"}.</p>`;
    }
    if (key === "propVaccinated" && this._school) {
      return html`<p class="note">From ${this._school.name} (${this._school.county}, ${this._school.state}).</p>`;
    }
    if (key === "r0" && [v.r0, v.transmissionRate, v.prodromalPeriod].every(Number.isFinite)) {
      const rate = schoolContactRate(v.r0, v.transmissionRate, v.prodromalPeriod);
      const reff = effectiveR(v.r0, v.propVaccinated, v.vaxEfficacy);
      return html`<p class="note">
        Contact rate used: <strong>${rate.toFixed(2)}</strong>/day
        (R0 ÷ transmission probability ÷ prodromal days).
        Effective R at start: <strong>${reff.toFixed(2)}</strong>;
        herd-immunity threshold: ${(herdImmunityThreshold(v.r0) * 100).toFixed(0)}% immune.</p>`;
    }
    return nothing;
  }

  renderSidebarTop() {
    return html`
      <details class="accordion" part="accordion" @md-school-selected=${this._onSchool}>
        <summary>School Selector</summary>
        <div class="accordion-body"><md-school-selector default-state=${this.defaultState ?? ""}></md-school-selector></div>
      </details>`;
  }

  renderDescription() {
    return html`
      <div class="alert-warning" role="note">
        <strong>Warning:</strong> This is work in progress. The model does not include post-exposure prophylaxis or
        community transmission. School vaccination data was obtained from epiENGAGE's simulator
        <a href="https://github.com/TACC/measles-dashboard" target="_blank" rel="noopener">here</a>.
      </div>
      <section class="card" part="card description">
        <div class="card-body">
          <h2>Modeling Measles in Schools</h2>
          <p>This model simulates measles outbreaks in schools and compares <strong>how many fewer cases a quarantine procedure yields</strong>.
            You can specify the number of people in the school (population size), the number of students initially infected with measles
            (initial cases), the proportion of students who are vaccinated before the outbreak, and the simulation duration in days.</p>
          <p>Note that the model only simulates outbreaks among students within a single school. It does not include transmissions from the
            students to people in other locations (e.g., other schools, households, the community, etc.) and does not include measles
            introductions to the school after the initial cases. Learn more about the model at
            <a href="https://github.com/EpiForeSITE/epiworld-measles" target="_blank" rel="noopener">github.com/EpiForeSITE/epiworld-measles</a>.</p>
        </div>
      </section>`;
  }

  takeHome() {
    const v = this._ranWith ?? this.values;
    const k = v.initialCases;
    return `When ${k} ${k === 1 ? "case" : "cases"} of measles ${k === 1 ? "is" : "are"} introduced into a school with ${v.populationSize.toLocaleString()} students, we expect the following outbreak sizes and number of hospitalizations based on whether quarantine procedures were implemented:`;
  }

  get filename() { return "measles-school-simulations.csv"; }
}

customElements.define("measles-school-sim", SchoolSim);
