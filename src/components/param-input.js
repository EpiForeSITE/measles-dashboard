import { LitElement, css, html, nothing } from "lit";
import { controls, tokens } from "../styles/theme.js";

let uid = 0;

const asPercent = (v) => `${Math.round(v * 100)}%`;

/**
 * One labeled input (number or slider) with an info tooltip, optional unit
 * or percentage display, and a reset button once it differs from its
 * default.
 *
 * @fires md-input - detail: {key, value}; value is a number, or null when empty.
 */
export class ParamInput extends LitElement {
  static properties = {
    def: { attribute: false },
    value: { attribute: false },
  };

  static styles = [tokens, controls, css`
    :host { display: block; margin-bottom: 0.9rem; }
    .label-row { display: flex; align-items: center; gap: 0.3rem; margin-bottom: 0.3rem; min-height: 1.6em; }
    label { font-weight: 500; font-size: 0.92em; }
    .spacer { flex: 1; }
    .reset {
      border: none; background: none; color: var(--_muted); font-size: 0.78em; padding: 0.1rem 0.35rem; border-radius: 6px;
    }
    .reset:hover { color: var(--_primary); background: var(--_surface-alt); }
    .slider-row { display: grid; grid-template-columns: 1fr 4.2rem; align-items: center; gap: 0.6rem; }
    .slider-row input[type="number"] { text-align: right; padding: 0.25rem 0.4rem; font-variant-numeric: tabular-nums; }
    .with-unit { position: relative; }
    .with-unit input { padding-right: 3.2rem; }
    .with-unit .unit { position: absolute; right: 0.65rem; top: 50%; transform: translateY(-50%); color: var(--_muted); font-size: 0.85em; pointer-events: none; }
    .info { position: relative; display: inline-flex; }
    .info button {
      border: none; background: none; padding: 0 0.15rem; color: var(--_muted);
      font-size: 0.85em; line-height: 1; cursor: help;
    }
    .tip {
      display: none; position: absolute; left: 1.4rem; top: -0.3rem; z-index: 10;
      width: min(260px, 70vw); padding: 0.5rem 0.65rem;
      background: var(--md-tooltip-bg, #1d2433); color: var(--md-tooltip-text, #fff);
      border-radius: 8px; font-size: 0.82em; font-weight: 400; line-height: 1.4;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
    }
    .info:hover .tip, .info:focus-within .tip { display: block; }
    ::slotted(*) { margin-top: 0.35rem; }
  `];

  constructor() {
    super();
    this._id = `md-input-${++uid}`;
  }

  _emit(value) {
    this.dispatchEvent(new CustomEvent("md-input", {
      detail: { key: this.def.key, value }, bubbles: true, composed: true,
    }));
  }

  _fromText(raw) {
    if (raw === "") return null;
    const x = Number(raw);
    return this.def.format === "percent" ? x / 100 : x;
  }

  render() {
    const d = this.def;
    if (!d) return nothing;
    const tipId = `${this._id}-tip`;
    const info = d.tooltip ? html`
      <span class="info">
        <button type="button" aria-label="About ${d.label}" aria-describedby=${tipId}>ⓘ</button>
        <span class="tip" role="tooltip" id=${tipId}>${d.tooltip}</span>
      </span>` : nothing;
    const value = this.value;
    const changed = value !== d.value && !(value === null && d.optional && d.value === null);
    const reset = changed
      ? html`<button type="button" class="reset" title="Reset to ${d.format === "percent" ? asPercent(d.value) : d.value}"
          aria-label="Reset ${d.label} to default" @click=${() => this._emit(d.value)}>↺ reset</button>`
      : nothing;
    const percent = d.format === "percent";
    const shown = value === null || value === undefined ? "" : percent ? String(Math.round(value * 100)) : String(value);

    let control;
    if (d.type === "slider") {
      control = html`<div class="slider-row">
        <input id=${this._id} type="range" min=${d.min} max=${d.max} step=${d.step ?? 0.01}
          .value=${String(value ?? d.value)} @input=${(e) => this._emit(Number(e.target.value))} />
        <div class="with-unit">
          <input type="number" aria-label="${d.label}${percent ? " (%)" : ""}" min=${percent ? d.min * 100 : d.min} max=${percent ? d.max * 100 : d.max}
            step=${percent ? 1 : d.step} .value=${shown} style="padding-right:${percent ? "1.4rem" : "0.4rem"}"
            @change=${(e) => this._emit(this._fromText(e.target.value))} />
          ${percent ? html`<span class="unit" style="right:0.45rem">%</span>` : nothing}
        </div>
      </div>`;
    } else {
      const input = html`<input id=${this._id} type="number" min=${d.min ?? nothing} max=${d.max ?? nothing}
        step=${d.step ?? "any"} .value=${shown} placeholder=${d.optional ? "random" : ""}
        @change=${(e) => this._emit(this._fromText(e.target.value))} />`;
      control = d.unit ? html`<div class="with-unit">${input}<span class="unit">${d.unit}</span></div>` : input;
    }

    return html`
      <div class="label-row"><label for=${this._id}>${d.label}</label>${info}<span class="spacer"></span>${reset}</div>
      ${control}
      <slot></slot>
    `;
  }
}

customElements.define("md-param-input", ParamInput);
