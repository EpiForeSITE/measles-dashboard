import { LitElement, css, html, nothing } from "lit";
import { bundledSchools, parseSchoolCSV, searchSchools, uploadedSchools, UPLOAD_LIMITS } from "../data.js";
import { controls, tokens } from "../styles/theme.js";

const STATE_KEY = "measles-dashboard:state";

function remembered() {
  try { return localStorage.getItem(STATE_KEY) || ""; } catch { return ""; }
}
function remember(state) {
  try { localStorage.setItem(STATE_KEY, state); } catch { /* storage unavailable */ }
}

let uid = 0;

/**
 * Finds a school to take its vaccination coverage from: pick a state, then
 * type part of the school's name (optionally filtered by county). Works on
 * the bundled data or an uploaded CSV (same columns as epiworldRShiny).
 *
 * Implements the ARIA combobox pattern (arrow keys, Enter, Escape).
 *
 * @fires md-school-selected - detail: {school}
 * @fires md-school-cleared
 */
export class SchoolSelector extends LitElement {
  static properties = {
    defaultState: { type: String, attribute: "default-state" },
    _states: { state: true },
    _counties: { state: true },
    _schools: { state: true },
    _state: { state: true },
    _county: { state: true },
    _query: { state: true },
    _open: { state: true },
    _active: { state: true },
    _selected: { state: true },
    _message: { state: true },
    _error: { state: true },
    _uploaded: { state: true },
    _loading: { state: true },
  };

  static styles = [tokens, controls, css`
    :host { display: block; }
    .filters { display: grid; grid-template-columns: 5.5rem 1fr; gap: 0.5rem; margin-bottom: 0.5rem; }
    .combo { position: relative; }
    .combo input { padding-left: 2rem; }
    .combo .icon { position: absolute; left: 0.7rem; top: 50%; transform: translateY(-50%); color: var(--_muted); pointer-events: none; }
    [role="listbox"] {
      position: absolute; left: 0; right: 0; top: calc(100% + 4px); z-index: 20;
      max-height: 18rem; overflow-y: auto; margin: 0; padding: 0.25rem; list-style: none;
      background: var(--_surface); border: 1px solid var(--_border); border-radius: 10px;
      box-shadow: 0 8px 24px rgba(16, 24, 40, 0.12);
    }
    [role="option"] {
      display: grid; grid-template-columns: 1fr auto; gap: 0.1rem 0.6rem; padding: 0.4rem 0.55rem; border-radius: 6px; cursor: pointer;
    }
    [role="option"] .name { font-weight: 500; }
    [role="option"] .county { color: var(--_muted); font-size: 0.82em; grid-column: 1; }
    [role="option"] .rate { grid-row: 1 / span 2; grid-column: 2; align-self: center; font-variant-numeric: tabular-nums; color: var(--_muted); font-size: 0.9em; }
    [role="option"][aria-selected="true"], [role="option"]:hover { background: var(--_surface-alt); }
    .empty { padding: 0.5rem; color: var(--_muted); font-size: 0.9em; }
    .chip {
      display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 0.5rem;
      padding: 0.55rem 0.7rem; border: 1px solid var(--_border); border-radius: 10px; background: var(--_surface-alt);
    }
    .chip .name { font-weight: 600; line-height: 1.3; }
    .chip .meta { color: var(--_muted); font-size: 0.82em; }
    .upload { margin-top: 0.6rem; }
    .upload summary { cursor: pointer; color: var(--_muted); font-size: 0.85em; list-style: none; }
    .upload summary::-webkit-details-marker { display: none; }
    .upload summary:hover { color: var(--_text); }
    .upload input[type="file"] { font-size: 0.85em; width: 100%; margin: 0.4rem 0; }
    .status { margin: 0.4rem 0 0; }
  `];

  constructor() {
    super();
    this._source = bundledSchools();
    this._states = [];
    this._counties = [];
    this._schools = [];
    this._state = "";
    this._county = "";
    this._query = "";
    this._open = false;
    this._active = -1;
    this._uploaded = false;
    this._listId = `md-schools-${++uid}`;
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
      this._state = this._county = "";
      const initial = [this.defaultState, remembered()].find((s) => s && this._states.includes(s));
      if (initial) await this._pickState(initial, false);
    });
  }

  _pickState(state, save = true) {
    return this._guard(async () => {
      this._state = state;
      this._county = "";
      this._query = "";
      if (save && state) remember(state);
      this._loading = true;
      try {
        [this._counties, this._schools] = state
          ? await Promise.all([this._source.counties(state), this._source.schools(state)])
          : [[], []];
      } finally {
        this._loading = false;
      }
    });
  }

  get _matches() {
    const pool = this._county ? this._schools.filter((s) => s.county === this._county) : this._schools;
    return searchSchools(pool, this._query, 50);
  }

  _choose(school) {
    if (!school) return;
    if (!Number.isFinite(school.rate)) {
      this._error = `No vaccination rate available for ${school.name}.`;
      return;
    }
    this._error = "";
    this._selected = school;
    this._open = false;
    this._query = "";
    this.dispatchEvent(new CustomEvent("md-school-selected", { detail: { school }, bubbles: true, composed: true }));
  }

  /** Clears the selection (e.g., after the user edits the coverage by hand). */
  clear() {
    if (!this._selected) return;
    this._selected = undefined;
    this.dispatchEvent(new CustomEvent("md-school-cleared", { bubbles: true, composed: true }));
  }

  _keydown(e) {
    const matches = this._matches;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      this._open = true;
      const step = e.key === "ArrowDown" ? 1 : -1;
      this._active = Math.max(0, Math.min(matches.length - 1, this._active + step));
      this.updateComplete.then(() => this.renderRoot.querySelector(`#${this._listId}-${this._active}`)?.scrollIntoView({ block: "nearest" }));
    } else if (e.key === "Enter" && this._open) {
      e.preventDefault();
      this._choose(matches[this._active] ?? (matches.length === 1 ? matches[0] : undefined));
    } else if (e.key === "Escape") {
      this._open = false;
    }
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
      this._message = `Loaded ${rows.length.toLocaleString()} schools from ${file.name}.`;
    });
    event.target.value = "";
  }

  async _reset() {
    this._source = bundledSchools();
    this._uploaded = false;
    this._message = "";
    await this._loadStates();
  }

  _renderSearch() {
    const matches = this._open ? this._matches : [];
    const active = matches[this._active] ? `${this._listId}-${this._active}` : "";
    return html`
      <div class="combo" @focusout=${(e) => { if (!this.renderRoot.contains(e.relatedTarget)) this._open = false; }}>
        <svg class="icon" aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="7" cy="7" r="5"></circle><path d="M11 11l3.5 3.5"></path></svg>
        <input type="search" role="combobox" aria-label="Search schools" aria-autocomplete="list"
          aria-expanded=${this._open ? "true" : "false"} aria-controls=${this._listId} aria-activedescendant=${active}
          placeholder=${this._loading ? "Loading schools…" : this._state ? `Search ${this._schools.length.toLocaleString()} schools…` : "Pick a state first"}
          ?disabled=${!this._state || this._loading} .value=${this._query}
          @input=${(e) => { this._query = e.target.value; this._open = true; this._active = -1; }}
          @focus=${() => { this._open = true; }} @keydown=${this._keydown} />
        ${this._open && this._state ? html`
          <ul role="listbox" id=${this._listId} aria-label="Schools">
            ${matches.length ? matches.map((s, i) => html`
              <li role="option" id="${this._listId}-${i}" aria-selected=${i === this._active ? "true" : "false"} tabindex="-1"
                @mousedown=${(e) => e.preventDefault()} @click=${() => this._choose(s)}>
                <span class="name">${s.name}</span>
                <span class="county">${s.county}</span>
                <span class="rate">${Number.isFinite(s.rate) ? `${Math.round(s.rate * 100)}%` : "n/a"}</span>
              </li>`) : html`<li class="empty">No schools match “${this._query}”.</li>`}
          </ul>` : nothing}
      </div>`;
  }

  render() {
    const s = this._selected;
    return html`
      ${s ? html`
        <div class="chip" part="school-chip">
          <div>
            <div class="name">${s.name}</div>
            <div class="meta">${s.county}, ${s.state} · ${Math.round(s.rate * 100)}% vaccinated</div>
          </div>
          <button type="button" class="ghost small" aria-label="Change school" @click=${() => this.clear()}>Change</button>
        </div>` : html`
        <div class="filters">
          <select aria-label="State" @change=${(e) => this._pickState(e.target.value)}>
            <option value="" ?selected=${!this._state}>State</option>
            ${this._states.map((x) => html`<option value=${x} ?selected=${x === this._state}>${x}</option>`)}
          </select>
          <select aria-label="County (optional)" ?disabled=${!this._state} @change=${(e) => { this._county = e.target.value; }}>
            <option value="" ?selected=${!this._county}>All counties</option>
            ${this._counties.map((c) => html`<option value=${c} ?selected=${c === this._county}>${c}</option>`)}
          </select>
        </div>
        ${this._renderSearch()}`}
      ${this._error ? html`<p class="status small error" role="alert">${this._error}</p>` : nothing}
      ${this._message && !this._error ? html`<p class="status small muted" role="status">${this._message}</p>` : nothing}
      <details class="upload">
        <summary>${this._uploaded ? "Using your CSV · change" : "Use your own school list (CSV)"}</summary>
        <input type="file" accept=".csv,text/csv" aria-label="Upload school CSV" @change=${this._upload} />
        <p class="small muted" style="margin:0 0 0.4rem">Columns: state, county, school_name, school_id, vaccination_rate (0–1), num_students (may be empty).</p>
        ${this._uploaded ? html`<button type="button" class="small" @click=${this._reset}>Back to the built-in data</button>` : nothing}
      </details>
    `;
  }
}

customElements.define("md-school-selector", SchoolSelector);
