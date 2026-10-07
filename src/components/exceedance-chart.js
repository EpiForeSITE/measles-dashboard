import * as Plot from "@observablehq/plot";
import { exceedanceAt } from "../analysis.js";
import { ChartBase } from "./chart-base.js";

const pct = (p) => (p <= 0.01 && p > 0 ? "< 1%" : `${Math.round(p * 100)}%`);

/**
 * Chance that the outbreak reaches at least x cases, per scenario: a
 * decreasing step line read as "1 in N simulations got this big". The x
 * axis is logarithmic for large populations.
 *
 * series: [{key, label, color, exceedance: [{x, p}]}]
 * population: number (sets the axis range)
 */
export class ExceedanceChart extends ChartBase {
  static properties = {
    ...ChartBase.properties,
    population: { type: Number },
  };

  get ariaLabel() {
    return `Probability that the outbreak reaches at least a given number of cases, for ${this.series.map((s) => s.label).join(" and ")}.`;
  }

  get _log() { return (this.population ?? 0) > 1000; }

  get _max() {
    const largest = Math.max(...this.series.map((s) => s.exceedance.at(-1)?.x ?? 1));
    return Math.max(10, Math.min(this.population ?? largest, largest));
  }

  plot(width) {
    const max = this._max;
    const rows = this.series.flatMap((s) => {
      // Extend each step function to the end of the axis
      const pts = s.exceedance.filter((p) => p.x <= max);
      const last = pts.at(-1);
      return [...pts, { x: max, p: last ? last.p : 0 }].map((p) => ({ ...p, key: s.key }));
    });
    return Plot.plot({
      ...this.baseOptions(width),
      x: { type: this._log ? "log" : "linear", domain: [1, max], label: "Outbreak size (cases, at least)", labelAnchor: "right", labelArrow: "none" },
      y: { domain: [0, 1], label: "Chance", labelArrow: "none", grid: true, tickFormat: (d) => `${Math.round(d * 100)}%` },
      color: { domain: this.series.map((s) => s.key), range: this.series.map((s) => this.color(s.color)) },
      marks: [
        Plot.lineY(rows, { x: "x", y: "p", stroke: "key", strokeWidth: 2, curve: "step-after" }),
        Plot.ruleY([0], { stroke: this.color("--_border") }),
      ],
    });
  }

  snap(x) {
    return Math.max(1, Math.round(x));
  }

  steps() {
    const max = this._max;
    const out = [];
    for (let x = 1; x <= max; x = this._log ? Math.ceil(x * 1.25) : x + Math.max(1, Math.round(max / 60))) out.push(x);
    return out;
  }

  readout(x) {
    return {
      head: `At least ${x.toLocaleString()} ${x === 1 ? "case" : "cases"}`,
      rows: this.series.map((s) => ({ value: pct(exceedanceAt(s.exceedance, x)), label: s.label })),
    };
  }
}

customElements.define("md-exceedance-chart", ExceedanceChart);
