import { html, useState } from "../lib.js";
import { useAppData, updateRow } from "../store.js";
import { Badge, EmptyState } from "../components/ui.js";
import { pct, dataCurta, initials } from "../format.js";

export function ConfiguracoesPage() {
  const { isAdmin, config, canais, profiles, toast, refreshConfig, refreshCanais, refreshProfiles, session } = useAppData();

  const [margemMinima, setMargemMinima] = useState(config.margem_minima);
  const [margemRecomendada, setMargemRecomendada] = useState(config.margem_recomendada);
  const [savingMargem, setSavingMargem] = useState(false);
  const [canalEdits, setCanalEdits] = useState({});
  const [savingCanal, setSavingCanal] = useState(null);

  async function salvarMargens(e) {
    e.preventDefault();
    setSavingMargem(true);
    try {
      await updateRow("config_precificacao", 1, { margem_minima: Number(margemMinima), margem_recomendada: Number(margemRecomendada) });
      toast("Margens atualizadas.", "success");
      refreshConfig();
    } catch (e) {
      toast(`Erro ao salvar: ${e.message}`, "error");
    } finally {
      setSavingMargem(false);
    }
  }

  function editCanal(c, field, value) {
    setCanalEdits((prev) => ({ ...prev, [c.id]: { comissao_pct: c.comissao_pct, taxa_pagamento_pct: c.taxa_pagamento_pct, ...prev[c.id], [field]: value } }));
  }

  async function salvarCanal(c) {
    const edit = canalEdits[c.id];
    if (!edit) return;
    setSavingCanal(c.id);
    try {
      await updateRow("canais_venda", c.id, { comissao_pct: Number(edit.comissao_pct), taxa_pagamento_pct: Number(edit.taxa_pagamento_pct) });
      toast(`${c.nome} atualizado.`, "success");
      refreshCanais();
      setCanalEdits((prev) => { const n = { ...prev }; delete n[c.id]; return n; });
    } catch (e) {
      toast(`Erro ao salvar: ${e.message}`, "error");
    } finally {
      setSavingCanal(null);
    }
  }

  async function alternarRole(p) {
    try {
      await updateRow("profiles", p.id, { role: p.role === "admin" ? "funcionario" : "admin" });
      toast("Perfil atualizado.", "success");
      refreshProfiles();
    } catch (e) {
      toast(`Erro ao atualizar: ${e.message}`, "error");
    }
  }

  async function alternarAtivo(p) {
    try {
      await updateRow("profiles", p.id, { ativo: !p.ativo });
      toast("Status atualizado.", "success");
      refreshProfiles();
    } catch (e) {
      toast(`Erro ao atualizar: ${e.message}`, "error");
    }
  }

  return html`
    <div class="stack-6">
      <div><h1 class="h2" style="font-size:26px;">Configurações</h1><p class="muted-text" style="margin:4px 0 0;">Margens, canais de venda e equipe.</p></div>

      <div class="card">
        <h3 style="margin:0 0 16px;font-size:16px;">Precificação</h3>
        ${isAdmin ? html`
          <form onSubmit=${salvarMargens} class="form-row">
            <div class="field"><label>Margem mínima (%)</label><input class="input" type="number" min="0" max="99" step="0.1" value=${margemMinima} onInput=${(e) => setMargemMinima(e.target.value)} /></div>
            <div class="field"><label>Margem recomendada (%)</label><input class="input" type="number" min="0" max="99" step="0.1" value=${margemRecomendada} onInput=${(e) => setMargemRecomendada(e.target.value)} /></div>
            <button type="submit" class="btn btn-primary" disabled=${savingMargem}>${savingMargem ? "Salvando…" : "Salvar"}</button>
          </form>
        ` : html`
          <div class="kpi-row">
            <div class="kpi"><span class="label-muted">Margem mínima</span><span class="kpi-value">${pct(config.margem_minima)}</span></div>
            <div class="kpi"><span class="label-muted">Margem recomendada</span><span class="kpi-value">${pct(config.margem_recomendada)}</span></div>
          </div>
        `}
        <p class="hint" style="margin-top:12px;">Usada para calcular o preço sugerido de venda em Produtos, Cardápio e Vendas.</p>
      </div>

      <div class="card">
        <h3 style="margin:0 0 16px;font-size:16px;">Canais de venda</h3>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Canal</th><th>Comissão (%)</th><th>Taxa de pagamento (%)</th>${isAdmin ? html`<th></th>` : null}</tr></thead>
            <tbody>
              ${canais.map((c) => {
                const edit = canalEdits[c.id];
                const dirty = !!edit;
                return html`
                  <tr key=${c.id}>
                    <td class="cell-title">${c.nome}</td>
                    <td>${isAdmin ? html`<input class="input" style="width:90px;" type="number" min="0" max="100" step="0.1" value=${edit?.comissao_pct ?? c.comissao_pct} onInput=${(e) => editCanal(c, "comissao_pct", e.target.value)} />` : pct(c.comissao_pct)}</td>
                    <td>${isAdmin ? html`<input class="input" style="width:90px;" type="number" min="0" max="100" step="0.1" value=${edit?.taxa_pagamento_pct ?? c.taxa_pagamento_pct} onInput=${(e) => editCanal(c, "taxa_pagamento_pct", e.target.value)} />` : pct(c.taxa_pagamento_pct)}</td>
                    ${isAdmin ? html`<td>${dirty ? html`<button class="btn btn-secondary btn-sm" disabled=${savingCanal === c.id} onClick=${() => salvarCanal(c)}>${savingCanal === c.id ? "Salvando…" : "Salvar"}</button>` : null}</td>` : null}
                  </tr>
                `;
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <h3 style="margin:0 0 16px;font-size:16px;">Equipe</h3>
        ${profiles.length === 0 ? html`<${EmptyState}>Nenhum usuário encontrado.<//>` : html`
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th></th><th>Nome</th><th>Papel</th><th>Status</th><th>Desde</th>${isAdmin ? html`<th></th>` : null}</tr></thead>
              <tbody>
                ${profiles.map((p) => html`
                  <tr key=${p.id}>
                    <td><div class="user-avatar" style="width:30px;height:30px;font-size:11px;">${initials(p.nome)}</div></td>
                    <td class="cell-title">${p.nome} ${p.id === session?.user?.id ? html`<span class="muted-text small">(você)</span>` : null}</td>
                    <td><${Badge} tone=${p.role === "admin" ? "gold" : "neutral"}>${p.role === "admin" ? "Administrador" : "Funcionário"}<//></td>
                    <td><${Badge} tone=${p.ativo ? "green" : "red"}>${p.ativo ? "Ativo" : "Inativo"}<//></td>
                    <td class="cell-sub">${dataCurta(p.criado_em)}</td>
                    ${isAdmin ? html`
                      <td class="actions-cell">
                        ${p.id !== session?.user?.id ? html`
                          <button class="btn btn-secondary btn-sm" onClick=${() => alternarRole(p)}>${p.role === "admin" ? "Tornar funcionário" : "Tornar admin"}</button>
                          <button class="btn btn-secondary btn-sm" onClick=${() => alternarAtivo(p)}>${p.ativo ? "Desativar" : "Ativar"}</button>
                        ` : null}
                      </td>
                    ` : null}
                  </tr>
                `)}
              </tbody>
            </table>
          </div>
        `}
        <p class="hint" style="margin-top:14px;">Novas pessoas podem se cadastrar na tela de login — elas entram como Funcionário automaticamente.</p>
      </div>
    </div>
  `;
}
