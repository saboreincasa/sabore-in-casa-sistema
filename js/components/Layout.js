import { html } from "../lib.js";
import { NAV_ITEMS, BUCKET_URL } from "../config.js";
import { useAppData } from "../store.js";
import { initials } from "../format.js";

export function Sidebar({ page, setPage }) {
  const { profile, signOut, podeInstalar, instalarApp } = useAppData();
  return html`
    <aside class="sidebar">
      <div class="brand">
        <img class="brand-logo" src=${BUCKET_URL + "logo.webp"} alt="Sabore In Casa" />
        <div>
          <div class="brand-name">Sabore In Casa</div>
          <div class="brand-sub">Gestão da Pizzaria</div>
        </div>
      </div>
      ${NAV_ITEMS.map((item) => html`
        <button
          key=${item.key}
          class="nav-btn ${page === item.key ? "active" : ""}"
          onClick=${() => setPage(item.key)}
        >
          <span class="nav-icon">${item.icon}</span>
          <span class="nav-label">${item.label}</span>
        </button>
      `)}
      <div class="nav-footer">
        ${podeInstalar ? html`<button class="btn btn-primary btn-sm" style="width:100%;margin-bottom:10px;" onClick=${instalarApp}>⬇️ Instalar app</button>` : null}
        <div class="user-chip">
          <div class="user-avatar">${initials(profile?.nome)}</div>
          <div>
            <div class="user-name">${profile?.nome || "Usuário"}</div>
            <div class="user-role">${profile?.role === "admin" ? "Administrador" : "Funcionário"}</div>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" onClick=${signOut}>Sair</button>
      </div>
    </aside>
  `;
}

export function MobileNav({ page, setPage }) {
  return html`
    <nav class="mobile-nav">
      ${NAV_ITEMS.map((item) => html`
        <button
          key=${item.key}
          class="mobile-pill ${page === item.key ? "active" : ""}"
          onClick=${() => setPage(item.key)}
        >${item.icon} ${item.label}</button>
      `)}
    </nav>
  `;
}

export function Topbar({ title, subtitle, right }) {
  return html`
    <div class="topbar">
      <div>
        <h1 class="h2" style="font-size:26px;">${title}</h1>
        ${subtitle ? html`<p class="muted-text" style="margin:4px 0 0;">${subtitle}</p>` : null}
      </div>
      ${right ? html`<div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">${right}</div>` : null}
    </div>
  `;
}
