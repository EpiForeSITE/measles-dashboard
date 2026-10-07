const reduceMotion = () => globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/**
 * A number that eases from its previous value to the new one, so results
 * change smoothly instead of jumping. Set `.value` (and optionally
 * `.format`, a function from number to string).
 */
export class AnimatedNumber extends HTMLElement {
  constructor() {
    super();
    this._value = undefined;
    this._shown = undefined;
    this._format = (x) => Math.round(x).toLocaleString();
  }

  get format() { return this._format; }
  set format(fn) {
    this._format = fn;
    if (this._shown !== undefined) this.textContent = fn(this._shown);
  }

  get value() { return this._value; }
  set value(to) {
    this._value = to;
    if (!Number.isFinite(to)) {
      this.textContent = "–";
      return;
    }
    const from = this._shown;
    cancelAnimationFrame(this._frame);
    if (from === undefined || !Number.isFinite(from) || from === to || reduceMotion() || !this.isConnected) {
      this._set(to);
      return;
    }
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / 450);
      this._set(from + (to - from) * (1 - (1 - t) ** 3));
      if (t < 1) this._frame = requestAnimationFrame(tick);
    };
    this._frame = requestAnimationFrame(tick);
  }

  _set(x) {
    this._shown = x;
    this.textContent = this._format(x);
  }

  disconnectedCallback() {
    cancelAnimationFrame(this._frame);
  }
}

customElements.define("md-number", AnimatedNumber);
