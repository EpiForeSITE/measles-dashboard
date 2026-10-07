import * as Plot from "@observablehq/plot";
import { LitElement, css, html } from "lit";
import { tokens } from "../styles/theme.js";

/**
 * Active cases per day for the two scenarios: median line and 95% band,
 * with a crosshair tooltip that lists both scenarios at the hovered day.
 *
 * series: [{key, label, color (CSS var name), curve: [{day, median, lower, upper}]}]
 */
export class EpicurveChart extends LitElement {
  static properties = {
    series: { attribute: false },
  };

  static styles = [tokens, css`
    :host { display: block; }
    .legend { display: flex; flex-wrap: wrap; gap: 1rem; margin-bottom: 0.4rem; font-size: 0.875em; color: var(--_muted); }
    .key { display: inline-flex; align-items: center; gap: 0.4rem; }
    .swatch { width: 18px; height: 0; border-top: 2px solid; position: relative; }
    .swatch::after { content: ""; position: absolute; left: 0; right: 0; top: -6px; height: 10px; opacity: 0.25; background: currentColor; }
    .plot { position: relative; }
    .plot svg { display: block; max-width: 100%; height: auto; overflow: visible; }
    .crosshair { position: absolute; top: 0; width: 0; border-left: 1px solid var(--_muted); pointer-events: none; display: none; }
    .tooltip {
      position: absolute; pointer-events: none; display: none; z-index: 5;
      background: var(--_surface); border: 1px solid var(--_border); border-radius: 6px;
      box-shadow: var(--_shadow); padding: 0.4rem 0.6rem; font-size: 0.82em; white-space: nowrap;
    }
    .tooltip .day { color: var(--_muted); margin-bottom: 0.15rem; }
    .tooltip .row { display: flex; align-items: center; gap: 0.4rem; }
    .tooltip .row strong { font-variant-numeric: tabular-nums; }
    .tooltip .row span.key-line { width: 12px; border-top: 2px solid; }
    .tooltip .row .label { color: var(--_muted); }
  `];

  constructor() {
    super();
    this._resize = new ResizeObserver(() => this._draw());
  }

  connectedCallback() {
    super.connectedCallback();
    this._resize.observe(this);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._resize.disconnect();
  }

  updated() {
    this._draw();
  }

  _color(variable) {
    return getComputedStyle(this).getPropertyValue(variable).trim() || "#888";
  }

  _draw() {
    const container = this.renderRoot.querySelector(".plot");
    if (!container || !this.series?.length) return;
    const width = Math.max(280, container.clientWidth || 600);
    if (width === this._lastWidth && this.series === this._lastSeries) return;
    this._lastWidth = width;
    this._lastSeries = this.series;

    const rows = this.series.flatMap((s) => s.curve.map((p) => ({ ...p, key: s.key, label: s.label })));
    const colors = this.series.map((s) => this._color(s.color));
    const text = this._color("--_muted");
    const grid = this._color("--_border");

    const chart = Plot.plot({
      width,
      height: Math.round(Math.min(380, Math.max(240, width * 0.45))),
      marginLeft: 48,
      marginBottom: 40,
      style: { background: "transparent", color: text, fontFamily: "inherit", fontSize: "12px" },
      x: { label: "Day", labelAnchor: "center", labelArrow: "none", nice: true },
      y: { label: "Active cases", labelArrow: "none", grid: true, nice: true, zero: true },
      color: { domain: this.series.map((s) => s.key), range: colors },
      marks: [
        Plot.areaY(rows, { x: "day", y1: "lower", y2: "upper", fill: "key", fillOpacity: 0.2, curve: "step-after" }),
        Plot.lineY(rows, { x: "day", y: "median", stroke: "key", strokeWidth: 2, curve: "step-after" }),
        Plot.ruleY([0], { stroke: grid }),
      ],
    });
    chart.setAttribute("role", "img");
    chart.setAttribute("aria-label",
      `Active cases per day, median and 95% interval, for ${this.series.map((s) => s.label).join(" and ")}.`);

    container.querySelector("svg")?.remove();
    container.prepend(chart);
    this._attachHover(container, chart);
  }

  _attachHover(container, chart) {
    const x = chart.scale("x");
    const y = chart.scale("y");
    const crosshair = container.querySelector(".crosshair");
    const tooltip = container.querySelector(".tooltip");
    const top = y.range[1], bottom = y.range[0];
    const maxDay = this.series[0].curve.length - 1;

    const hide = () => { crosshair.style.display = tooltip.style.display = "none"; };
    const show = (day) => {
      const px = x.apply(day);
      const scale = chart.getBoundingClientRect().width / chart.viewBox.baseVal.width || 1;
      crosshair.style.display = "block";
      crosshair.style.left = `${px * scale}px`;
      crosshair.style.top = `${top * scale}px`;
      crosshair.style.height = `${(bottom - top) * scale}px`;

      tooltip.replaceChildren();
      const head = document.createElement("div");
      head.className = "day";
      head.textContent = `Day ${day}`;
      tooltip.append(head);
      for (const s of this.series) {
        const p = s.curve[day];
        const row = document.createElement("div");
        row.className = "row";
        const key = document.createElement("span");
        key.className = "key-line";
        key.style.borderColor = this._color(s.color);
        const value = document.createElement("strong");
        value.textContent = p ? `${Math.round(p.median)}` : "–";
        const label = document.createElement("span");
        label.className = "label";
        label.textContent = p ? `${s.label} (95%: ${Math.round(p.lower)}–${Math.round(p.upper)})` : s.label;
        row.append(key, value, label);
        tooltip.append(row);
      }
      tooltip.style.display = "block";
      const w = tooltip.offsetWidth;
      const left = px * scale + 12 + w > container.clientWidth ? px * scale - 12 - w : px * scale + 12;
      tooltip.style.left = `${Math.max(0, left)}px`;
      tooltip.style.top = `${top * scale + 4}px`;
    };

    const dayAt = (clientX) => {
      const rect = chart.getBoundingClientRect();
      const scale = rect.width / chart.viewBox.baseVal.width || 1;
      const day = Math.round(x.invert((clientX - rect.left) / scale));
      return Math.min(maxDay, Math.max(0, day));
    };

    chart.addEventListener("pointermove", (e) => show(dayAt(e.clientX)));
    chart.addEventListener("pointerleave", hide);
    chart.setAttribute("tabindex", "0");
    let focusDay = 0;
    chart.addEventListener("focus", () => show(focusDay));
    chart.addEventListener("blur", hide);
    chart.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        focusDay = Math.min(maxDay, Math.max(0, focusDay + (e.key === "ArrowRight" ? 1 : -1)));
        show(focusDay);
        e.preventDefault();
      }
    });
  }

  render() {
    return html`
      <div class="legend" aria-hidden="true">
        ${(this.series ?? []).map((s) => html`<span class="key"><span class="swatch" style="color: var(${s.color}); border-color: var(${s.color})"></span>${s.label}</span>`)}
        <span class="key muted">Line: median · band: 95% of simulations</span>
      </div>
      <div class="plot"><div class="crosshair"></div><div class="tooltip" role="status"></div></div>
    `;
  }
}

customElements.define("md-epicurve-chart", EpicurveChart);
