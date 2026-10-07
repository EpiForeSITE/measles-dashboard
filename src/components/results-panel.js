import { LitElement, css, html, nothing } from "lit";
import { exceedanceProbabilities, formatProbability } from "../analysis.js";
import { toCSV } from "../csv.js";
import { controls, tokens } from "../styles/theme.js";
import "./animated-number.js";
import "./epicurve-chart.js";
import "./exceedance-chart.js";

const whole = (x) => Math.round(x).toLocaleString();
const SERIES = [
  { key: "without", label: "Without quarantine", color: "--_no-quarantine" },
  { key: "with", label: "With quarantine", color: "--_quarantine" },
];

/**
 * Results of a with/without-quarantine comparison: three number tiles
 * (each scenario and the difference quarantine makes), the epidemic curve,
 * and the chance of reaching each outbreak size (chart, or table with
 * editable thresholds). Holds the previous results, dimmed, while a new run
 * is in progress.
 */
export class ResultsPanel extends LitElement {
  static properties = {
    /** {without, with}: outputs of analysis.summarizeScenario(). */
    results: { attribute: false },
    thresholds: { attribute: false },
    population: { type: Number },
    filename: { type: String },
    running: { type: Boolean },
    _table: { state: true },
  };

  static styles = [tokens, controls, css`
    :host { display: block; }
    .wrap { transition: opacity 0.25s; }
    .wrap.stale { opacity: 0.55; }
    .tiles { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 0.75rem; margin-bottom: 1rem; }
    .tile {
      position: relative; overflow: hidden;
      background: var(--_surface); border: 1px solid var(--_border); border-radius: var(--_radius);
      box-shadow: var(--_shadow); padding: 0.9rem 1rem 0.85rem 1.15rem;
    }
    .tile::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--accent); }
    .tile .label { display: flex; align-items: center; gap: 0.45rem; font-size: 0.85em; color: var(--_muted); font-weight: 500; }
    .tile .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--accent); }
    .tile .big { font-size: 2.1em; font-weight: 700; line-height: 1.15; margin-top: 0.2rem; letter-spacing: -0.01em; }
    .tile .big small { font-size: 0.45em; font-weight: 500; color: var(--_muted); margin-left: 0.3rem; letter-spacing: 0; }
    .tile .sub { font-size: 0.9em; }
    .tile .range { font-size: 0.78em; color: var(--_muted); margin-top: 0.15rem; }
    .charts { display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 1rem; }
    .charts .card { margin-bottom: 0; }
    table { border-collapse: collapse; width: 100%; font-variant-numeric: tabular-nums; font-size: 0.92em; }
    th, td { padding: 0.45rem 0.5rem; border-bottom: 1px solid var(--_border); text-align: right; }
    th:first-child, td:first-child { text-align: left; }
    thead th { font-weight: 600; color: var(--_muted); font-size: 0.85em; }
    .thresholds { display: flex; gap: 0.5rem; align-items: center; margin-top: 0.6rem; }
    .thresholds input { max-width: 14rem; }
    .footer { display: flex; justify-content: flex-end; margin-top: 0.75rem; }
    .empty { padding: 2.5rem 1rem; text-align: center; color: var(--_muted); }
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

  _scenarioTile(key, title, color, r) {
    return html`
      <div class="tile" part="tile tile-${key}" style="--accent: var(${color})">
        <div class="label"><span class="dot"></span>${title}</div>
        <div class="big"><md-number .value=${r.outbreak.mean}></md-number><small>cases</small></div>
        <div class="sub"><md-number .value=${r.hosp.mean}></md-number> ${Math.round(r.hosp.mean) === 1 ? "hospitalization" : "hospitalizations"}</div>
        <div class="range">95% of simulations: ${whole(r.outbreak.lower)}–${whole(r.outbreak.upper)} cases</div>
      </div>`;
  }

  _impactTile(r) {
    const fewer = r.without.outbreak.mean - r.with.outbreak.mean;
    const relative = r.without.outbreak.mean > 0 ? fewer / r.without.outbreak.mean : 0;
    const fewerHosp = r.without.hosp.mean - r.with.hosp.mean;
    const helps = fewer >= 0.5;
    return html`
      <div class="tile" part="tile tile-impact" style="--accent: var(--_good)">
        <div class="label"><span class="dot"></span>Quarantine prevents</div>
        <div class="big">${helps
          ? html`<md-number .value=${relative * 100} .format=${(x) => `${Math.round(x)}%`}></md-number><small>of cases</small>`
          : html`–`}</div>
        <div class="sub">${helps
          ? html`<md-number .value=${fewer}></md-number> fewer cases · <md-number .value=${Math.max(0, fewerHosp)}></md-number> fewer hospitalizations`
          : "No meaningful difference in this scenario"}</div>
        <div class="range">Difference in the average outbreak</div>
      </div>`;
  }

  render() {
    const r = this.results;
    if (!r) {
      return html`<div class="card" part="card"><div class="empty">${this.running ? "Running simulations…" : "Results appear here."}</div></div>`;
    }
    const series = SERIES.map((s) => ({ ...s, curve: r[s.key].curve, exceedance: r[s.key].exceedance }));
    const thresholds = this.thresholds ?? [2, 10, 25, 50, 80];
    const pWithout = exceedanceProbabilities(r.without.sizes, thresholds);
    const pWith = exceedanceProbabilities(r.with.sizes, thresholds);
    return html`
      <div class="wrap ${this.running ? "stale" : ""}" aria-busy=${this.running ? "true" : "false"}>
        <div class="tiles">
          ${this._scenarioTile("without", "Without quarantine", "--_no-quarantine", r.without)}
          ${this._scenarioTile("with", "With quarantine", "--_quarantine", r.with)}
          ${this._impactTile(r)}
        </div>

        <div class="charts">
          <section class="card" part="card">
            <div class="card-header"><h3>How the outbreak unfolds</h3><span class="hint">Active cases per day</span></div>
            <div class="card-body"><md-epicurve-chart .series=${series}></md-epicurve-chart></div>
          </section>
          <section class="card" part="card">
            <div class="card-header">
              <h3>How big could it get?</h3>
              <button type="button" class="ghost small" aria-pressed=${this._table ? "true" : "false"}
                @click=${() => { this._table = !this._table; }}>${this._table ? "Show chart" : "Show table"}</button>
            </div>
            <div class="card-body">
              ${this._table ? html`
                <table>
                  <caption class="visually-hidden">Probability of reaching each outbreak size</caption>
                  <thead><tr><th scope="col">Outbreak size</th><th scope="col">Without quarantine</th><th scope="col">With quarantine</th></tr></thead>
                  <tbody>
                    ${thresholds.map((t, i) => html`<tr>
                      <th scope="row">≥ ${t.toLocaleString()} cases</th>
                      <td>${formatProbability(pWithout[i])}</td>
                      <td>${formatProbability(pWith[i])}</td>
                    </tr>`)}
                  </tbody>
                </table>
                <div class="thresholds small">
                  <label for="thresholds">Sizes:</label>
                  <input id="thresholds" type="text" .value=${thresholds.join(", ")} @change=${(e) => this._setThresholds(e.target.value)} />
                </div>` : html`
                <md-exceedance-chart .series=${series} .population=${this.population}></md-exceedance-chart>`}
            </div>
          </section>
        </div>

        <div class="footer">
          <button type="button" class="small" part="download-button" @click=${this._download}>Download simulations (CSV)</button>
        </div>
      </div>
    `;
  }
}

customElements.define("md-results-panel", ResultsPanel);
