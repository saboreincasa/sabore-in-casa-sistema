import { html, useState } from "../lib.js";
import { brl } from "../format.js";

export function Modal({ title, onClose, children, wide = false }) {
  return html`
    <div class="modal-overlay" onClick=${(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div class="modal" style=${wide ? "max-width:720px" : ""}>
        <div class="row-between" style="margin-bottom:16px;">
          <h3 class="modal-title" style="margin:0;">${title}</h3>
          <button class="icon-btn" onClick=${onClose} aria-label="Fechar">✕</button>
        </div>
        ${children}
      </div>
    </div>
  `;
}

export function ConfirmDialog({ title = "Confirmar", message, confirmLabel = "Confirmar", danger = true, onConfirm, onCancel }) {
  return html`
    <${Modal} title=${title} onClose=${onCancel}>
      <p class="muted-text" style="margin-top:0;">${message}</p>
      <div class="row-between" style="justify-content:flex-end; gap:8px; margin-top:20px;">
        <button class="btn btn-secondary" onClick=${onCancel}>Cancelar</button>
        <button class=${`btn ${danger ? "btn-danger" : "btn-primary"}`} onClick=${onConfirm}>${confirmLabel}</button>
      </div>
    <//>
  `;
}

export function useConfirm() {
  const [state, setState] = useState(null); // { message, onConfirm }
  const ask = (message, onConfirm, opts = {}) => setState({ message, onConfirm, ...opts });
  const node = state
    ? html`<${ConfirmDialog}
        title=${state.title}
        message=${state.message}
        confirmLabel=${state.confirmLabel}
        danger=${state.danger !== false}
        onCancel=${() => setState(null)}
        onConfirm=${async () => { await state.onConfirm(); setState(null); }}
      />`
    : null;
  return [ask, node];
}

export function Kpi({ icon, label, value, sub, tone = "brown" }) {
  const bg = {
    brown: "rgba(90,53,29,0.10)", olive: "rgba(79,111,50,0.14)",
    gold: "rgba(181,138,74,0.16)", green: "rgba(47,125,50,0.12)", red: "rgba(179,38,30,0.10)",
  }[tone];
  return html`
    <div class="kpi">
      <div class="row-between">
        <span class="label-muted">${label}</span>
        <span class="icon-circle" style="background:${bg}">${icon}</span>
      </div>
      <span class="kpi-value">${value}</span>
      ${sub ? html`<span class="kpi-sub">${sub}</span>` : null}
    </div>
  `;
}

export function Badge({ tone = "neutral", children }) {
  return html`<span class="badge badge-${tone}">${children}</span>`;
}

export function ImgThumb({ src, alt, round = false, size = 36 }) {
  return html`<img class="thumb ${round ? "round" : ""}" style="width:${size}px;height:${size}px" src=${src} alt=${alt} loading="lazy" onError=${(e) => { e.target.style.visibility = "hidden"; }} />`;
}

export function EmptyState({ children }) {
  return html`<div class="empty-state">${children}</div>`;
}

export function LoadingState({ children = "Carregando…" }) {
  return html`<div class="loading-state">${children}</div>`;
}

export function Money({ value, tone }) {
  const cls = tone === "green" ? "text-green" : tone === "red" ? "text-red" : "";
  return html`<span class=${cls}>${brl(value)}</span>`;
}
