import * as Plot from "@observablehq/plot";
import { ChartBase } from "./chart-base.js";

/**
 * Active cases per day for each scenario: the median line over the band
 * holding the middle 50% of simulations. The tooltip adds the 95% range.
 *
 * series: [{key, label, color, curve: [{day, median, q25, q75, lower, upper}]}]
 */
export class EpicurveChart extends ChartBase {
  get ariaLabel() {
    return `Active cases per day: median and middle 50% of simulations, for ${this.series.map((s) => s.label).join(" and ")}.`;
  }

  legendExtra() { return "Line: median · band: middle 50% of simulations"; }

  plot(width) {
    const rows = this.series.flatMap((s) => s.curve.map((p) => ({ ...p, key: s.key })));
    return Plot.plot({
      ...this.baseOptions(width),
      x: { label: "Day", labelAnchor: "right", labelArrow: "none" },
      y: { label: "Active cases", labelArrow: "none", grid: true, nice: true, zero: true },
      color: { domain: this.series.map((s) => s.key), range: this.series.map((s) => this.color(s.color)) },
      marks: [
        Plot.areaY(rows, { x: "day", y1: "q25", y2: "q75", fill: "key", fillOpacity: 0.16, curve: "monotone-x" }),
        Plot.lineY(rows, { x: "day", y: "median", stroke: "key", strokeWidth: 2, curve: "monotone-x" }),
        Plot.ruleY([0], { stroke: this.color("--_border") }),
      ],
    });
  }

  snap(x) {
    return Math.min(this.series[0].curve.length - 1, Math.max(0, Math.round(x)));
  }

  steps() {
    return this.series[0].curve.map((p) => p.day);
  }

  readout(day) {
    return {
      head: `Day ${day} · active cases`,
      rows: this.series.map((s) => {
        const p = s.curve[day];
        return p
          ? { value: `${Math.round(p.median)}`, label: `${s.label} (95%: ${Math.round(p.lower)}–${Math.round(p.upper)})` }
          : { value: "–", label: s.label };
      }),
    };
  }
}

customElements.define("md-epicurve-chart", EpicurveChart);
