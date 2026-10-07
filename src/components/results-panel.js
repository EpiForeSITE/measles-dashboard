import { LitElement, css, html, nothing } from "lit";
import { exceedanceProbabilities, formatProbability } from "../analysis.js";
import { toCSV } from "../csv.js";
import { controls, tokens } from "../styles/theme.js";
import "./epicurve-chart.js";

const fmt = (x) => Math.round(x).toLocaleString();

/**
 * Results of a with/without-quarantine comparison: take-home sentence,
 * value boxes, epidemic curve, outbreak-size probabilities and a CSV export.
 * Mirrors the cards of epiworldRShiny's measles app.
 */
export class ResultsPanel extends LitElement {
  static properties = {
    /** {without, with}: outputs of analysis.summarizeScenario(). */
    results: { attribute: false },
    /** Sentence introducing the value boxes. */
    takeHome: { attribute: false },
    thresholds: { attribute: false },
    /** Name of the downloaded CSV. */
    filename: { type: String },
    running: { type: Boolean },
  };

  static styles = [tokens, controls, css`
    :host { display: block; }
    .boxes { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; }
    .value-box {
      border-radius: var(--_radius); padding: 1rem 1.2rem; color: #fff;
    }
    .value-box.without { background: var(--_no-quarantine); }
    .value-box.with { background: var(--_quarantine); }
    .value-box .title { font-size: 0.85em; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.9; }
    .value-box .value { font-size: 2em; font-weight: 700; line-height: 1.2; font-variant-numeric: tabular-nums; }
    .value-box .sub { opacity: 0.95; }
    .value-box .ci { font-size: 0.8em; opacity: 0.85; margin-top: 0.25rem; }
    table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; }
    th, td { padding: 0.45rem 0.6rem; border-bottom: 1px solid var(--_border); text-align: right; }
    th:first-child, td:first-child { text-align: left; }
    thead th { font-weight: 600; border-bottom-width: 2px; }
    .thresholds { display: flex; gap: 0.5rem; align-items: center; margin-top: 0.75rem; flex-wrap: wrap; }
    .thresholds input { max-width: 16rem; }
    .actions { display: flex; justify-content: flex-end; }
    .stale { opacity: 0.55; transition: opacity 0.2s; }
  `];

  _download() {
    const rows = [];
    for (const [quarantine, r] of [[false, this.results.without], [true, this.results.with]])
      r.sizes.forEach((size, sim) => rows.push([sim + 1, quarantine ? "TRUE" : "FALSE", size, r.hospitalizations[sim]]));
    const blob = new Blob([toCSV(["sim_num", "quarantine", "outbreak_size", "hospitalizations"], rows)], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = this.filename || "measles-simulations.csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  _setThresholds(text) {
    const values = text.split(/[,\s]+/).map(Number).filter((x) => Number.isFinite(x) && x > 0);
    if (values.length) this.thresholds = [...new Set(values)].sort((a, b) => a - b);
  }

  _box(kind, title, r) {
    return html`
      <div class="value-box ${kind}" part="value-box value-box-${kind}">
        <div class="title">${title}</div>
        <div class="value">${fmt(r.outbreak.mean)} cases</div>
        <div class="sub">${fmt(r.hosp.mean)} hospitalizations</div>
        <div class="ci">95% of simulations: ${fmt(r.outbreak.lower)}–${fmt(r.outbreak.upper)} cases</div>
      </div>`;
  }

  render() {
    const r = this.results;
    if (!r) {
      return html`<div class="card" part="card"><div class="card-body muted">
        ${this.running ? "Running simulations…" : html`Press <strong>Run Simulation</strong> to see results.`}
      </div></div>`;
    }
    const thresholds = this.thresholds ?? [2, 10, 25, 50, 80];
    const pWithout = exceedanceProbabilities(r.without.sizes, thresholds);
    const pWith = exceedanceProbabilities(r.with.sizes, thresholds);
    return html`
      <div class=${this.running ? "stale" : ""} aria-busy=${this.running ? "true" : "false"}>
        <section class="card" part="card">
          <div class="card-header">Summary</div>
          <div class="card-body">
            <p>${this.takeHome}</p>
            <div class="boxes">
              ${this._box("without", "Without quarantine", r.without)}
              ${this._box("with", "With quarantine", r.with)}
            </div>
            <p class="small muted" style="margin-bottom:0">Values are averages across ${r.with.nsims.toLocaleString()} simulations per scenario; outbreak size includes the initial cases.</p>
          </div>
        </section>

        <section class="card" part="card">
          <div class="card-header">Epidemic Curve</div>
          <div class="card-body">
            <p>The figure shows the potential outbreak sizes after running ${r.with.nsims.toLocaleString()} simulations. The solid line represents the 50% quantile (median) of active cases and the shaded band the central 95% of simulations.</p>
            <md-epicurve-chart .series=${[
              { key: "without", label: "Without quarantine", color: "--_no-quarantine", curve: r.without.curve },
              { key: "with", label: "With quarantine", color: "--_quarantine", curve: r.with.curve },
            ]}></md-epicurve-chart>
          </div>
        </section>

        <section class="card" part="card">
          <div class="card-header">Outbreak Size</div>
          <div class="card-body">
            <p>The table below shows the probability of seeing outbreak sizes above a given threshold WITH and WITHOUT quarantine.</p>
            <table>
              <thead><tr><th scope="col">Outbreak Size</th><th scope="col">Probability WITHOUT Quarantine</th><th scope="col">Probability WITH Quarantine</th></tr></thead>
              <tbody>
                ${thresholds.map((t, i) => html`<tr>
                  <th scope="row">≥ ${t.toLocaleString()} cases</th>
                  <td>${formatProbability(pWithout[i])}</td>
                  <td>${formatProbability(pWith[i])}</td>
                </tr>`)}
              </tbody>
            </table>
            <div class="thresholds small">
              <label for="thresholds">Thresholds:</label>
              <input id="thresholds" type="text" .value=${thresholds.join(", ")}
                @change=${(e) => this._setThresholds(e.target.value)} />
            </div>
          </div>
        </section>

        <div class="actions">
          <button type="button" part="download-button" @click=${this._download}>⬇ Download Data (CSV)</button>
        </div>
      </div>
      ${nothing}
    `;
  }
}

customElements.define("md-results-panel", ResultsPanel);
