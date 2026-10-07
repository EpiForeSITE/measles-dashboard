import { LitElement, css, html, nothing } from "lit";
import { bundledSchools, parseSchoolCSV, uploadedSchools, UPLOAD_LIMITS } from "../data.js";
import { controls, tokens } from "../styles/theme.js";

/**
 * State → county → school cascade over the bundled school data, or over an
 * uploaded CSV (same columns as epiworldRShiny's school selector).
 *
 * @fires md-school-selected - detail: {school}; bubbles out of the shadow DOM.
 */
export class SchoolSelector extends LitElement {
  static properties = {
    defaultState: { type: String, attribute: "default-state" },
    _states: { state: true },
    _counties: { state: true },
    _schools: { state: true },
    _state: { state: true },
    _county: { state: true },
    _schoolId: { state: true },
    _message: { state: true },
    _error: { state: true },
    _uploaded: { state: true },
  };

  static styles = [tokens, controls, css`
    :host { display: block; }
    label { display: block; font-weight: 500; margin: 0.6rem 0 0.2rem; }
    hr { border: none; border-top: 1px solid var(--_border); margin: 0.9rem 0; }
    input[type="file"] { font-size: 0.85em; width: 100%; }
    .status { margin-top: 0.5rem; }
  `];

  constructor() {
    super();
    this._source = bundledSchools();
    this._states = [];
    this._counties = [];
    this._schools = [];
    this._state = "";
    this._county = "";
    this._schoolId = "";
    this._uploaded = false;
  }

  connectedCallback() {
    super.connectedCallback();
    this._loadStates();
  }

  async _guard(fn) {
    try {
      this._error = "";
      await fn();
    } catch (error) {
      this._error = error.message;
    }
  }

  _loadStates() {
    return this._guard(async () => {
      this._states = await this._source.states();
      this._counties = [];
      this._schools = [];
      this._state = this._county = this._schoolId = "";
      if (this.defaultState && this._states.includes(this.defaultState)) await this._pickState(this.defaultState);
    });
  }

  _pickState(state) {
    return this._guard(async () => {
      this._state = state;
      this._county = this._schoolId = "";
      this._schools = [];
      this._counties = state ? await this._source.counties(state) : [];
    });
  }

  _pickCounty(county) {
    return this._guard(async () => {
      this._county = county;
      this._schoolId = "";
      this._schools = county ? await this._source.schools(this._state, county) : [];
    });
  }

  _pickSchool(id) {
    this._schoolId = id;
    const school = this._schools.find((s) => s.id === id);
    if (!school) return;
    if (!Number.isFinite(school.rate)) {
      this._error = `No vaccination rate available for ${school.name}.`;
      return;
    }
    this._error = "";
    this.dispatchEvent(new CustomEvent("md-school-selected", {
      detail: { school }, bubbles: true, composed: true,
    }));
  }

  async _upload(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    await this._guard(async () => {
      if (!/\.csv$/i.test(file.name)) throw new Error("Invalid file type. Please upload a file with a .csv extension.");
      if (file.size > UPLOAD_LIMITS.maxBytes) throw new Error(`CSV file size must be less than ${UPLOAD_LIMITS.maxBytes / 1024 / 1024}MB`);
      const rows = parseSchoolCSV(await file.text());
      this._source = uploadedSchools(rows);
      this._uploaded = true;
      await this._loadStates();
      this._message = `School data loaded successfully! (${rows.length} schools)`;
    });
    event.target.value = "";
  }

  async _reset() {
    this._source = bundledSchools();
    this._uploaded = false;
    this._message = "";
    await this._loadStates();
  }

  /** Clears the selection (e.g., after the user edits the coverage by hand). */
  clear() {
    this._schoolId = "";
  }

  render() {
    const option = (value, label, selected) => html`<option value=${value} ?selected=${selected}>${label}</option>`;
    return html`
      <p class="small">Select a school from the database to populate vaccination rate. You can also upload a custom CSV file with school data.</p>
      <label for="state">Select State</label>
      <select id="state" @change=${(e) => this._pickState(e.target.value)}>
        ${option("", "Select...", !this._state)}
        ${this._states.map((s) => option(s, s, s === this._state))}
      </select>
      <label for="county">Select County</label>
      <select id="county" ?disabled=${!this._state} @change=${(e) => this._pickCounty(e.target.value)}>
        ${option("", "Select...", !this._county)}
        ${this._counties.map((c) => option(c, c, c === this._county))}
      </select>
      <label for="school">Select School</label>
      <select id="school" ?disabled=${!this._county} @change=${(e) => this._pickSchool(e.target.value)}>
        ${option("", "Select...", !this._schoolId)}
        ${this._schools.map((s) => option(s.id, `${s.name} (${Number.isFinite(s.rate) ? Math.round(s.rate * 100) + "%" : "n/a"})`, s.id === this._schoolId))}
      </select>
      <hr />
      <label for="csv">Upload Custom School Data (Optional)</label>
      <input id="csv" type="file" accept=".csv,text/csv" @change=${this._upload}
        title="CSV with columns: state, county, school_name, school_id, vaccination_rate, num_students" />
      <p class="small muted">Columns: state, county, school_name, school_id, vaccination_rate (0–1), num_students (may be empty).</p>
      <button type="button" class="block" ?disabled=${!this._uploaded} @click=${this._reset}>Reset to Default Data</button>
      ${this._error ? html`<p class="status small error" role="alert">${this._error}</p>` : nothing}
      ${this._message && !this._error ? html`<p class="status small muted" role="status">${this._message}</p>` : nothing}
    `;
  }
}

customElements.define("md-school-selector", SchoolSelector);
