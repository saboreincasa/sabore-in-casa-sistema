import { html, useState } from "../lib.js";
import { useAppData, insertRow, updateRow, deleteRow } from "../store.js";
import { Modal, useConfirm, EmptyState, ImgThumb, Badge } from "../components/ui.js";
import { brl, precoSugerido } from "../format.js";
import { ImageUploadField } from "../components/ImageUpload.js";

export function LanchesPage() {
  const { lanches, canais, config, isAdmin, toast, refreshLanches, refreshEstoqueLanches } = useAppData();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, confirmNode] = useConfirm();

  function handleSaved() {
    setModalOpen(false);
    refreshLanches();
    refreshEstoqueLanches();
  }

  function handleDelete(l) {
    confirm(`Excluir o lanche "${l.nome}"? Compras e vendas antigas continuarão no histórico.`, async () => {
      try {
        await deleteRow("lanches", l.id);
        toast("Lanche excluído.", "success");
        refreshLanches();
      } catch (e) {
        toast(`Não foi possível excluir: ${e.message}`, "error");
      }
    });
  }

  return html`
    <div class="stack-6">
      <div class="row-between">
        <div><h1 class="h2" style="font-size:26px;">Lanches</h1><p class="muted-text" style="margin:4px 0 0;">Snacks e porções (batata, nuggets, doces) — com estoque e custo, igual às bebidas.</p></div>
        ${isAdmin ? html`<button class="btn btn-primary" onClick=${() => { setEditing(null); setModalOpen(true); }}>+ Novo Lanche</button>` : null}
      </div>

      <div class="card">
        <h3 style="margin:0 0 16px;font-size:16px;">Catálogo e precificação</h3>
        ${lanches.length === 0 ? html`<${EmptyState}>Nenhum lanche cadastrado.<//>` : html`
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Lanche</th><th>Custo</th>
                  ${canais.map((c) => html`<th key=${c.id}>${c.nome}</th>`)}
                  <th>Estoque mín.</th><th></th>
                </tr>
              </thead>
              <tbody>
                ${lanches.map((l) => html`
                  <tr key=${l.id}>
                    <td>
                      <div class="cell-product">
                        <${ImgThumb} src=${l.imagem_url} alt=${l.nome} />
                        <div><div class="cell-title">${l.nome}</div></div>
                      </div>
                    </td>
                    <td>${brl(l.custo)}</td>
                    ${canais.map((c) => html`<td key=${c.id}>${brl(precoSugerido(l.custo, config.margem_recomendada, c.comissao_pct, c.taxa_pagamento_pct))}</td>`)}
                    <td>${l.estoque_minimo}</td>
                    <td class="actions-cell">
                      ${!l.ativo ? html`<${Badge} tone="neutral">Inativo<//>` : null}
                      ${isAdmin ? html`
                        <button class="icon-btn" title="Editar" onClick=${() => { setEditing(l); setModalOpen(true); }}>✏️</button>
                        <button class="icon-btn" title="Excluir" onClick=${() => handleDelete(l)}>🗑️</button>
                      ` : null}
                    </td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>
        `}
        <p class="hint" style="margin-top:14px;">Preços calculados automaticamente pela margem recomendada (${config.margem_recomendada}%) menos comissão e taxa de pagamento de cada canal. Ajuste em Configurações.</p>
      </div>

      ${modalOpen ? html`<${LancheModal} editing=${editing} onClose=${() => setModalOpen(false)} onSaved=${handleSaved} />` : null}
      ${confirmNode}
    </div>
  `;
}

function LancheModal({ editing, onClose, onSaved }) {
  const { toast } = useAppData();
  const [nome, setNome] = useState(editing?.nome || "");
  const [custo, setCusto] = useState(editing?.custo ?? "");
  const [estoqueMinimo, setEstoqueMinimo] = useState(editing?.estoque_minimo ?? 12);
  const [ativo, setAtivo] = useState(editing?.ativo ?? true);
  const [imagemUrl, setImagemUrl] = useState(editing?.imagem_url || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nome.trim()) { toast("Informe o nome do lanche.", "error"); return; }
    if (custo === "" || Number(custo) < 0) { toast("Informe o custo.", "error"); return; }
    setSaving(true);
    try {
      const payload = { nome: nome.trim(), custo: Number(custo), estoque_minimo: Number(estoqueMinimo) || 0, ativo, imagem_url: imagemUrl || null };
      if (editing) {
        await updateRow("lanches", editing.id, payload);
        toast("Lanche atualizado.", "success");
      } else {
        await insertRow("lanches", payload);
        toast("Lanche cadastrado.", "success");
      }
      onSaved();
    } catch (e) {
      toast(`Erro ao salvar: ${e.message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  return html`
    <${Modal} title=${editing ? "Editar Lanche" : "Novo Lanche"} onClose=${onClose}>
      <form onSubmit=${handleSubmit} class="stack-4">
        <${ImageUploadField} imagemUrl=${imagemUrl} setImagemUrl=${setImagemUrl} pasta="lanches" uploading=${uploading} setUploading=${setUploading} />
        <div class="field">
          <label>Nome</label>
          <input class="input" value=${nome} onInput=${(e) => setNome(e.target.value)} required />
        </div>
        <div class="form-grid cols-2">
          <div class="field">
            <label>Custo (R$)</label>
            <input class="input" type="number" min="0" step="0.01" value=${custo} onInput=${(e) => setCusto(e.target.value)} required />
          </div>
          <div class="field">
            <label>Estoque mínimo</label>
            <input class="input" type="number" min="0" step="1" value=${estoqueMinimo} onInput=${(e) => setEstoqueMinimo(e.target.value)} />
          </div>
        </div>
        <div class="field">
          <label>Status</label>
          <select class="input" value=${ativo ? "1" : "0"} onChange=${(e) => setAtivo(e.target.value === "1")}>
            <option value="1">Ativo</option>
            <option value="0">Inativo</option>
          </select>
        </div>
        <div class="row-between" style="justify-content:flex-end;gap:8px;">
          <button type="button" class="btn btn-secondary" onClick=${onClose}>Cancelar</button>
          <button type="submit" class="btn btn-primary" disabled=${saving || uploading}>${saving ? "Salvando…" : "Salvar"}</button>
        </div>
      </form>
    <//>
  `;
}
