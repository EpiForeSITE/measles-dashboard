import { LitElement, css, html, nothing } from "lit";
import { loadPopulation, populationIndex, validatePopulation } from "../data.js";
import { controls, tokens } from "../styles/theme.js";

const clone = (p) => JSON.parse(JSON.stringify(p));

/**
 * Editor for the mixing model's population: groups (name, size) and their
 * contact matrix, starting from a preset in data/populations/.
 *
 * @fires md-population - detail: {population, errors}
 */
export class GroupEditor extends LitElement {
  static properties = {
    /** Matrix actually used (calibrated), shown next to the entered one. */
    scaled: { attribute: false },
    preset: { type: String },
    _presets: { state: true },
    _population: { state: true },
    _error: { state: true },
  };

  static styles = [tokens, controls, css`
    :host { display: block; }
    .row { display: flex; gap: 0.5rem; align-items: end; flex-wrap: wrap; margin-bottom: 0.75rem; }
    .row > label { flex: 1 1 14rem; }
    label { font-weight: 500; }
    .scroll { overflow-x: auto; }
    table { border-collapse: collapse; font-variant-numeric: tabular-nums; }
    th, td { padding: 0.25rem; text-align: center; }
    thead th { font-weight: 600; font-size: 0.85em; color: var(--_muted); }
    tbody th { text-align: left; font-weight: 500; }
    td input[type="number"] { width: 5.5rem; text-align: right; padding: 0.25rem 0.35rem; }
    th input[type="text"] { width: 8rem; }
    .remove { border: none; background: none; color: var(--_muted); padding: 0 0.3rem; }
    .scaled { color: var(--_muted); font-size: 0.78em; display: block; }
    .notes { margin: 0.5rem 0 0; }
  `];

  constructor() {
    super();
    this._presets = [];
    this.preset = "default-3group";
  }

  connectedCallback() {
    super.connectedCallback();
    this._init();
  }

  async _init() {
    try {
      this._presets = await populationIndex();
      const first = this._presets.find((p) => p.id === this.preset) ?? this._presets[0];
      if (first) await this._load(first);
    } catch (error) {
      this._error = error.message;
    }
  }

  async _load(entry) {
    try {
      this._error = "";
      this.preset = entry.id;
      this._population = clone(await loadPopulation(entry.file));
      this._emit();
    } catch (error) {
      this._error = error.message;
    }
  }

  /** The population as currently edited. */
  get population() {
    return this._population;
  }

  _emit() {
    this.requestUpdate();
    const population = clone(this._population);
    this.dispatchEvent(new CustomEvent("md-population", {
      detail: { population, errors: validatePopulation(population) }, bubbles: true, composed: true,
    }));
  }

  _setSize(i, value) {
    this._population.groups[i].size = value === "" ? NaN : Number(value);
    this._emit();
  }

  _setName(i, value) {
    this._population.groups[i].name = value;
    this._emit();
  }

  _setCell(i, j, value) {
    this._population.contact_matrix[i][j] = value === "" ? NaN : Number(value);
    this._emit();
  }

  _addGroup() {
    const p = this._population;
    const g = p.groups.length;
    p.groups.push({ name: `Group ${g + 1}`, size: 1000 });
    p.contact_matrix.forEach((row) => row.push(0.5));
    p.contact_matrix.push([...new Array(g).fill(0.5), 10]);
    this._emit();
  }

  _removeGroup(i) {
    const p = this._population;
    if (p.groups.length <= 1) return;
    p.groups.splice(i, 1);
    p.contact_matrix.splice(i, 1);
    p.contact_matrix.forEach((row) => row.splice(i, 1));
    this._emit();
  }

  render() {
    const p = this._population;
    const total = p ? p.groups.reduce((a, g) => a + (Number.isFinite(g.size) ? g.size : 0), 0) : 0;
    const preset = this._presets.find((x) => x.id === this.preset);
    return html`
      <div class="row">
        <label>Population preset
          <select @change=${(e) => this._load(this._presets.find((x) => x.id === e.target.value))}>
            ${this._presets.map((x) => html`<option value=${x.id} ?selected=${x.id === this.preset}>${x.name}</option>`)}
          </select>
        </label>
        <button type="button" @click=${() => preset && this._load(preset)}>Reset</button>
        <button type="button" @click=${this._addGroup} ?disabled=${!p}>+ Add group</button>
      </div>
      ${this._error ? html`<p class="error small" role="alert">${this._error}</p>` : nothing}
      ${p ? html`
        <div class="scroll">
          <table>
            <caption class="visually-hidden">Groups and daily contacts between them</caption>
            <thead>
              <tr>
                <th scope="col">Group</th>
                <th scope="col">Size</th>
                ${p.groups.map((g) => html`<th scope="col">Contacts with ${g.name}</th>`)}
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${p.groups.map((g, i) => html`<tr>
                <th scope="row"><input type="text" aria-label="Name of group ${i + 1}" .value=${g.name}
                  @change=${(e) => this._setName(i, e.target.value)} /></th>
                <td><input type="number" min="1" step="1" aria-label="Size of ${g.name}" .value=${String(g.size)}
                  @change=${(e) => this._setSize(i, e.target.value)} /></td>
                ${p.contact_matrix[i].map((x, j) => html`<td>
                  <input type="number" min="0" step="0.1" aria-label="Daily contacts of ${g.name} with ${p.groups[j].name}"
                    .value=${String(x)} @change=${(e) => this._setCell(i, j, e.target.value)} />
                  ${this.scaled?.[i]?.[j] !== undefined ? html`<span class="scaled" title="Value used after calibrating to R0">→ ${this.scaled[i][j].toFixed(2)}</span>` : nothing}
                </td>`)}
                <td><button type="button" class="remove" aria-label="Remove ${g.name}" title="Remove group"
                  ?disabled=${p.groups.length <= 1} @click=${() => this._removeGroup(i)}>✕</button></td>
              </tr>`)}
            </tbody>
          </table>
        </div>
        <p class="small muted notes">
          Total population: <strong>${total.toLocaleString()}</strong>.
          Row <em>i</em>, column <em>j</em> is the average number of daily contacts a person in group <em>i</em> has with people in group <em>j</em>.
          ${p.source ? html`<br />Source: ${p.source}` : nothing}
        </p>` : nothing}
    `;
  }
}

customElements.define("md-group-editor", GroupEditor);
