import { LitElement, css, html } from "lit";
import { tokens } from "../styles/theme.js";

/**
 * Shared machinery of the result charts: redraw on resize, a legend with
 * line keys, and a crosshair tooltip (pointer and keyboard) that lists every
 * series at the hovered x. Subclasses implement `plot(width)` (returns an
 * Observable Plot figure), `snap(x)` and `readout(x)`.
 *
 * series: [{key, label, color: CSS custom property name}]
 */
export class ChartBase extends LitElement {
  static properties = {
    series: { attribute: false },
  };

  static styles = [tokens, css`
    :host { display: block; }
    .legend { display: flex; flex-wrap: wrap; gap: 0.4rem 1rem; margin-bottom: 0.35rem; font-size: 0.82em; color: var(--_muted); }
    .key { display: inline-flex; align-items: center; gap: 0.4rem; }
    .swatch { width: 16px; height: 0; border-top: 2px solid; }
    .plot { position: relative; }
    .plot svg { display: block; max-width: 100%; height: auto; overflow: visible; border-radius: 4px; }
    .crosshair { position: absolute; top: 0; width: 0; border-left: 1px dashed var(--_muted); pointer-events: none; display: none; }
    .tooltip {
      position: absolute; pointer-events: none; display: none; z-index: 5;
      background: var(--_surface); border: 1px solid var(--_border); border-radius: 8px;
      box-shadow: 0 6px 20px rgba(16, 24, 40, 0.12); padding: 0.45rem 0.65rem; font-size: 0.82em; white-space: nowrap;
    }
    .tooltip .head { color: var(--_muted); margin-bottom: 0.2rem; }
    .tooltip .row { display: flex; align-items: center; gap: 0.45rem; line-height: 1.6; }
    .tooltip .row strong { font-variant-numeric: tabular-nums; min-width: 2.5em; }
    .tooltip .row .key-line { width: 12px; border-top: 2px solid; }
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
    this._draw(true);
  }

  color(variable) {
    return getComputedStyle(this).getPropertyValue(variable).trim() || "#888";
  }

  /** Common Plot options: transparent background, inherited font, muted ink. */
  baseOptions(width) {
    return {
      width,
      height: Math.round(Math.min(320, Math.max(220, width * 0.5))),
      marginLeft: 46,
      marginBottom: 38,
      marginTop: 18,
      style: { background: "transparent", color: this.color("--_muted"), fontFamily: "inherit", fontSize: "11.5px" },
    };
  }

  /** @abstract @returns {SVGSVGElement} */
  plot() { throw new Error("not implemented"); }
  /** @abstract Nearest data x to a scale value. */
  snap(x) { return x; }
  /** @abstract @returns {{head: string, rows: {value: string, label: string}[]}} one row per series */
  readout() { return { head: "", rows: [] }; }
  /** Keyboard steps through these x values. @returns {number[]} */
  steps() { return []; }

  _draw(force = false) {
    const container = this.renderRoot.querySelector(".plot");
    if (!container || !this.series?.length) return;
    const width = Math.max(260, container.clientWidth || 600);
    if (!force && width === this._lastWidth) return;
    this._lastWidth = width;
    const chart = this.plot(width);
    chart.setAttribute("role", "img");
    chart.setAttribute("aria-label", this.ariaLabel ?? "");
    container.querySelector("svg")?.remove();
    container.prepend(chart);
    this._attachHover(container, chart);
  }

  _attachHover(container, chart) {
    const x = chart.scale("x");
    const y = chart.scale("y");
    const crosshair = container.querySelector(".crosshair");
    const tooltip = container.querySelector(".tooltip");
    const [bottom, top] = y.range;
    const scaleOf = () => chart.getBoundingClientRect().width / chart.viewBox.baseVal.width || 1;

    const hide = () => { crosshair.style.display = tooltip.style.display = "none"; };
    const show = (value) => {
      const px = x.apply(value);
      const k = scaleOf();
      crosshair.style.display = "block";
      crosshair.style.left = `${px * k}px`;
      crosshair.style.top = `${top * k}px`;
      crosshair.style.height = `${(bottom - top) * k}px`;

      const { head, rows } = this.readout(value);
      tooltip.replaceChildren();
      const h = document.createElement("div");
      h.className = "head";
      h.textContent = head;
      tooltip.append(h);
      rows.forEach((r, i) => {
        const row = document.createElement("div");
        row.className = "row";
        const keyLine = document.createElement("span");
        keyLine.className = "key-line";
        keyLine.style.borderColor = this.color(this.series[i].color);
        const strong = document.createElement("strong");
        strong.textContent = r.value;
        const label = document.createElement("span");
        label.className = "label";
        label.textContent = r.label;
        row.append(keyLine, strong, label);
        tooltip.append(row);
      });
      tooltip.style.display = "block";
      const w = tooltip.offsetWidth;
      const left = px * k + 12 + w > container.clientWidth ? px * k - 12 - w : px * k + 12;
      tooltip.style.left = `${Math.max(0, left)}px`;
      tooltip.style.top = `${top * k + 4}px`;
    };

    const valueAt = (clientX) => {
      const rect = chart.getBoundingClientRect();
      const [r0, r1] = x.range;
      const px = Math.min(r1, Math.max(r0, (clientX - rect.left) / scaleOf()));
      return this.snap(x.invert(px));
    };

    chart.addEventListener("pointermove", (e) => show(valueAt(e.clientX)));
    chart.addEventListener("pointerleave", hide);
    chart.setAttribute("tabindex", "0");
    const steps = this.steps();
    let i = 0;
    chart.addEventListener("focus", () => steps.length && show(steps[i]));
    chart.addEventListener("blur", hide);
    chart.addEventListener("keydown", (e) => {
      if (!steps.length || (e.key !== "ArrowRight" && e.key !== "ArrowLeft")) return;
      i = Math.min(steps.length - 1, Math.max(0, i + (e.key === "ArrowRight" ? 1 : -1)));
      show(steps[i]);
      e.preventDefault();
    });
  }

  legendExtra() { return ""; }

  render() {
    return html`
      <div class="legend" aria-hidden="true">
        ${(this.series ?? []).map((s) => html`<span class="key"><span class="swatch" style="border-color: var(${s.color})"></span>${s.label}</span>`)}
        <span class="key">${this.legendExtra()}</span>
      </div>
      <div class="plot"><div class="crosshair"></div><div class="tooltip" role="status" aria-live="off"></div></div>
    `;
  }
}
