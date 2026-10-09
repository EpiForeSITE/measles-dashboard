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
    .school { margin-bottom: 1rem; }
  `];

  get inputs() { return SCHOOL_INPUTS; }

  get heading() { return "Measles in a school"; }

  get parametersModel() { return "school"; }

  buildSpecs(v) {
    return { without: schoolSpec(v, { quarantine: false }), with: schoolSpec(v, { quarantine: true }) };
  }

  extraErrors() {
    const v = this.values;
    const errors = [];
    if (v.initialCases > v.populationSize) errors.push("Initial cases cannot exceed the number of students.");
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
    this.requestRun();
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
      return html`<div class="note">Enrollment isn't available for this school, so ${v.populationSize === DEFAULT_SCHOOL_SIZE
        ? html`a typical size of ${DEFAULT_SCHOOL_SIZE} is used. Enter the real number if you know it.`
        : "the number above is used."}</div>`;
    }
    if (key === "r0" && [v.r0, v.transmissionRate, v.prodromalPeriod].every(Number.isFinite)) {
      const rate = schoolContactRate(v.r0, v.transmissionRate, v.prodromalPeriod);
      const reff = effectiveR(v.r0, v.propVaccinated, v.vaxEfficacy);
      return html`<div class="note">
        Each student has <strong>${rate.toFixed(1)}</strong> contacts per day.
        At this coverage, one case infects <strong>${reff.toFixed(1)}</strong> others on average
        (herd immunity needs ${(herdImmunityThreshold(v.r0) * 100).toFixed(0)}% immune).</div>`;
    }
    return nothing;
  }

  renderSidebarTop() {
    return html`
      <div class="school" @md-school-selected=${this._onSchool}>
        <h3>School</h3>
        <md-school-selector exportparts="school-chip" default-state=${this.defaultState ?? ""}></md-school-selector>
      </div>`;
  }

  lede() {
    const v = this.values;
    const k = v.initialCases;
    const where = this._school ? html`<strong>${this._school.name}</strong> (${v.populationSize?.toLocaleString()} students)` : html`a school of <strong>${v.populationSize?.toLocaleString()}</strong> students`;
    return html`${k} ${k === 1 ? "case" : "cases"} of measles introduced into ${where} with
      <strong>${Math.round((v.propVaccinated ?? 0) * 100)}%</strong> vaccinated: expected outbreak with and without a
      ${v.quarantineDays}-day quarantine of exposed students.`;
  }

  renderAbout() {
    return html`
      <p>This model simulates measles outbreaks in a school and compares <strong>how many fewer cases a quarantine procedure yields</strong>.
        You set the school size, the number of students initially infected, the proportion vaccinated, and how quarantine and isolation work.</p>
      <p>It only simulates spread among students within a single school: it does not include transmission to other places (other schools,
        households, the community) or new introductions after the initial cases, and it does not include post-exposure prophylaxis.
        For spread across a larger population, use the community model.</p>
      <p class="small muted">School vaccination data: <a href="https://github.com/TACC/measles-dashboard" target="_blank" rel="noopener">epiENGAGE</a>
        and Utah DHHS. Parameter sources: <a href="https://github.com/UofUEpiBio/measles/blob/main/inst/extdata/measles_parameters.csv" target="_blank" rel="noopener">measles package reference table</a>.
        This is work in progress; feedback is welcome.</p>`;
  }

  get filename() { return "measles-school-simulations.csv"; }
}

customElements.define("measles-school-sim", SchoolSim);
