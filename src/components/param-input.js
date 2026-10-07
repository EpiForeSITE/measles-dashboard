import { LitElement, css, html, nothing } from "lit";
import { controls, tokens } from "../styles/theme.js";

let uid = 0;

/**
 * One labeled input (number or slider) with an info tooltip.
 *
 * @fires md-input - detail: {key, value}; value is a number, or null when empty.
 */
export class ParamInput extends LitElement {
  static properties = {
    def: { attribute: false },
    value: { attribute: false },
  };

  static styles = [tokens, controls, css`
    :host { display: block; margin-bottom: 0.8rem; }
    .label-row { display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.2rem; }
    label { font-weight: 500; }
    .slider-row { display: flex; align-items: center; gap: 0.5rem; }
    .slider-row output { min-width: 3.2em; text-align: right; font-variant-numeric: tabular-nums; }
    .info { position: relative; display: inline-flex; }
    .info button {
      border: none; background: none; padding: 0 0.15rem; color: var(--_muted);
      font-size: 0.9em; line-height: 1; cursor: help;
    }
    .tip {
      display: none; position: absolute; left: 1.4rem; top: -0.3rem; z-index: 10;
      width: min(260px, 70vw); padding: 0.5rem 0.65rem;
      background: var(--md-tooltip-bg, #212529); color: var(--md-tooltip-text, #fff);
      border-radius: 6px; font-size: 0.82em; font-weight: 400; line-height: 1.35;
    }
    .info:hover .tip, .info:focus-within .tip { display: block; }
  `];

  constructor() {
    super();
    this._id = `md-input-${++uid}`;
  }

  _emit(raw) {
    const value = raw === "" ? null : Number(raw);
    this.dispatchEvent(new CustomEvent("md-input", {
      detail: { key: this.def.key, value }, bubbles: true, composed: true,
    }));
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
    const value = this.value ?? "";
    return html`
      <div class="label-row"><label for=${this._id}>${d.label}</label>${info}</div>
      ${d.type === "slider"
        ? html`<div class="slider-row">
            <input id=${this._id} type="range" min=${d.min} max=${d.max} step=${d.step ?? 0.01}
              .value=${String(value)} @input=${(e) => this._emit(e.target.value)} />
            <output for=${this._id}>${typeof value === "number" ? value.toFixed(2) : value}</output>
          </div>`
        : html`<input id=${this._id} type="number" min=${d.min ?? nothing} max=${d.max ?? nothing}
            step=${d.step ?? "any"} .value=${String(value)} placeholder=${d.optional ? "random" : ""}
            @change=${(e) => this._emit(e.target.value)} />`}
      <slot></slot>
    `;
  }
}

customElements.define("md-param-input", ParamInput);
