import { LitElement, css, html, nothing } from "lit";
import { loadParameters } from "../data.js";
import { tokens } from "../styles/theme.js";

/**
 * "Model assumptions & references": a disclosure, closed by default, with
 * every parameter of a model, its value and its source (the citation followed
 * by the row's notes). The table (data/parameters.json) is loaded when first
 * opened.
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
    td.value { min-width: 6rem; }
    td.source { min-width: 16rem; }
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
          <thead><tr><th>Parameter</th><th>Value used</th><th>Source</th></tr></thead>
          <tbody>${rows.map((r) => html`<tr>
            <td class="param">${r.parameter}${r.input ? html` <span class="tag">(input)</span>` : nothing}</td>
            <td class="value">${r.value[this.model]}</td>
            <td class="source">${r.url ? html`<a href=${r.url} target="_blank" rel="noopener">${r.source}</a>` : r.source}${r.notes ? `${/[.!?]$/.test(r.source) ? "" : "."} ${r.notes}` : nothing}</td>
          </tr>`)}</tbody>
        </table>
      </div>
      <p>For inputs, the value is the dashboard's default; runs use the values you set.
        Sources come from the
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
