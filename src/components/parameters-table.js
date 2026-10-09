import { LitElement, css, html, nothing } from "lit";
import { loadParameters } from "../data.js";
import { tokens } from "../styles/theme.js";

const STATUS = {
  "✅": "Verified against the cited source",
  "🗣️": "Team assumption or rationale, confirmed by the authors",
  "⚠️": "Pending",
};

const statusTitle = (status) => status.split(/\s+/).map((s) => STATUS[s] ?? s).join("; ");

/**
 * "Model assumptions & references": a disclosure, closed by default, with
 * every parameter of a model, its value, the measles package's default and
 * its source. The table (data/parameters.json) is loaded when first opened.
 *
 * @element md-parameters
 * @attr model - "school" or "community".
 */
export class ParametersTable extends LitElement {
  static properties = {
    model: { type: String },
    _data: { state: true },
    _error: { state: true },
  };

  static styles = [tokens, css`
    :host { display: block; margin-top: 0.75rem; }
    details > summary { cursor: pointer; color: var(--_primary); font-size: 0.9em; width: fit-content; }
    .wrap { overflow-x: auto; margin-top: 0.5rem; }
    table { border-collapse: collapse; width: 100%; font-size: 0.8em; line-height: 1.4; }
    th, td { text-align: left; vertical-align: top; padding: 0.35rem 0.5rem; border-bottom: 1px solid var(--_border); }
    thead th { font-weight: 600; color: var(--_muted); white-space: nowrap; }
    td.param { font-weight: 500; min-width: 9rem; }
    td.value, td.default { min-width: 6rem; }
    td.source { min-width: 12rem; }
    td.notes { min-width: 16rem; color: var(--_muted); }
    td.status { white-space: nowrap; cursor: help; }
    .tag { font-size: 0.85em; font-weight: 400; color: var(--_muted); }
    p { font-size: 0.82em; color: var(--_muted); margin: 0.5rem 0 0; }
  `];

  _onToggle(e) {
    if (!e.target.open || this._data || this._loading) return;
    this._loading = true;
    loadParameters()
      .then((data) => { this._data = data; this._error = ""; })
      .catch((error) => { this._error = error.message; })
      .finally(() => { this._loading = false; });
  }

  _renderTable() {
    if (this._error) return html`<p role="alert">${this._error}</p>`;
    if (!this._data) return html`<p>Loading…</p>`;
    const rows = this._data.parameters.filter((r) => r.value[this.model] !== undefined);
    return html`
      <div class="wrap">
        <table>
          <thead><tr><th>Parameter</th><th>Value used</th><th>Package default</th><th>Source</th><th>Status</th><th>Notes / why different</th></tr></thead>
          <tbody>${rows.map((r) => html`<tr>
            <td class="param">${r.parameter}${r.input ? html` <span class="tag">(input)</span>` : nothing}</td>
            <td class="value">${r.value[this.model]}</td>
            <td class="default">${r.packageDefault || "—"}</td>
            <td class="source">${r.url ? html`<a href=${r.url} target="_blank" rel="noopener">${r.source}</a>` : r.source}</td>
            <td class="status" title=${statusTitle(r.status)}>${r.status}</td>
            <td class="notes">${r.notes}</td>
          </tr>`)}</tbody>
        </table>
      </div>
      <p>For inputs, the value is the dashboard's default; runs use the values you set.
        Status: ✅ verified against the cited source; 🗣️ team assumption or rationale, confirmed by the authors; ⚠️ pending.
        Sources and package defaults come from the
        <a href=${this._data.table} target="_blank" rel="noopener">canonical parameter table</a> of the measles R package
        (see also <a href=${this._data.vignette} target="_blank" rel="noopener">Parameters and literature references</a>).</p>`;
  }

  render() {
    return html`
      <details part="assumptions" @toggle=${this._onToggle}>
        <summary>Model assumptions &amp; references</summary>
        ${this._renderTable()}
      </details>`;
  }
}

customElements.define("md-parameters", ParametersTable);
