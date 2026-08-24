import { html, useState } from "../lib.js";
import { supabase } from "../supabaseClient.js";
import { useAppData, insertRow, updateRow, deleteRow } from "../store.js";
import { Modal, useConfirm, EmptyState, ImgThumb, Badge } from "../components/ui.js";
import { brl, precoBebidaSugerido } from "../format.js";
import { uploadProdutoImagem, ImageUploadField } from "../components/ImageUpload.js";

export function ProdutosPage() {
  const { bebidas, canais, config, isAdmin, toast, refreshBebidas, refreshEstoque } = useAppData();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, confirmNode] = useConfirm();

  function handleSaved() {
    setModalOpen(false);
    refreshBebidas();
    refreshEstoque();
  }

  function handleDelete(b) {
    confirm(`Excluir o produto "${b.nome}"? Compras e vendas antigas continuarão no histórico.`, async () => {
      try {
        await deleteRow("bebidas", b.id);
        toast("Produto excluído.", "success");
        refreshBebidas();
      } catch (e) {
        toast(`Não foi possível excluir: ${e.message}`, "error");
      }
    });
  }

  return html`
    <div class="stack-6">
      <div class="row-between">
        <div><h1 class="h2" style="font-size:26px;">Produtos</h1><p class="muted-text" style="margin:4px 0 0;">Bebidas e outros produtos vendidos (fora o cardápio de pizzas).</p></div>
        ${isAdmin ? html`<button class="btn btn-primary" onClick=${() => { setEditing(null); setModalOpen(true); }}>+ Novo Produto</button>` : null}
      </div>

      <div class="card">
        <h3 style="margin:0 0 16px;font-size:16px;">Catálogo e precificação</h3>
        ${bebidas.length === 0 ? html`<${EmptyState}>Nenhum produto cadastrado.<//>` : html`
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Produto</th><th>Custo</th>
                  ${canais.map((c) => html`<th key=${c.id}>${c.nome}</th>`)}
                  <th>Estoque mín.</th><th></th>
                </tr>
              </thead>
              <tbody>
                ${bebidas.map((b) => html`
                  <tr key=${b.id}>
                    <td>
                      <div class="cell-product">
                        <${ImgThumb} src=${b.imagem_url} alt=${b.nome} />
                        <div><div class="cell-title">${b.nome}</div><div class="cell-sub">${b.embalagem || ""}</div></div>
                      </div>
                    </td>
                    <td>${brl(b.custo)}</td>
                    ${canais.map((c) => html`<td key=${c.id}>${brl(precoBebidaSugerido(b, config.margem_recomendada, c.comissao_pct, c.taxa_pagamento_pct))}</td>`)}
                    <td>${b.estoque_minimo}</td>
                    <td class="actions-cell">
                      ${!b.ativo ? html`<${Badge} tone="neutral">Inativo<//>` : null}
                      ${isAdmin ? html`
                        <button class="icon-btn" title="Editar" onClick=${() => { setEditing(b); setModalOpen(true); }}>✏️</button>
                        <button class="icon-btn" title="Excluir" onClick=${() => handleDelete(b)}>🗑️</button>
                      ` : null}
                    </td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>
        `}
        <p class="hint" style="margin-top:14px;">Bebida com preço fixo definido usa esse valor como base (só repassando a comissão de cada canal); sem preço fixo, cai na margem recomendada (${config.margem_recomendada}%) menos comissão e taxa de pagamento. Ajuste em Configurações.</p>
      </div>

      ${modalOpen ? html`<${ProdutoModal} editing=${editing} onClose=${() => setModalOpen(false)} onSaved=${handleSaved} />` : null}
      ${confirmNode}
    </div>
  `;
}

function ProdutoModal({ editing, onClose, onSaved }) {
  const { toast } = useAppData();
  const [nome, setNome] = useState(editing?.nome || "");
  const [embalagem, setEmbalagem] = useState(editing?.embalagem || "");
  const [custo, setCusto] = useState(editing?.custo ?? "");
  const [estoqueMinimo, setEstoqueMinimo] = useState(editing?.estoque_minimo ?? 12);
  const [ativo, setAtivo] = useState(editing?.ativo ?? true);
  const [imagemUrl, setImagemUrl] = useState(editing?.imagem_url || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nome.trim()) { toast("Informe o nome do produto.", "error"); return; }
    if (custo === "" || Number(custo) < 0) { toast("Informe o custo.", "error"); return; }
    setSaving(true);
    try {
      const payload = { nome: nome.trim(), embalagem: embalagem || null, custo: Number(custo), estoque_minimo: Number(estoqueMinimo) || 0, ativo, imagem_url: imagemUrl || null };
      if (editing) {
        await updateRow("bebidas", editing.id, payload);
        toast("Produto atualizado.", "success");
      } else {
        await insertRow("bebidas", payload);
        toast("Produto cadastrado.", "success");
      }
      onSaved();
    } catch (e) {
      toast(`Erro ao salvar: ${e.message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  return html`
    <${Modal} title=${editing ? "Editar Produto" : "Novo Produto"} onClose=${onClose}>
      <form onSubmit=${handleSubmit} class="stack-4">
        <${ImageUploadField} imagemUrl=${imagemUrl} setImagemUrl=${setImagemUrl} pasta="bebidas" uploading=${uploading} setUploading=${setUploading} />
        <div class="field">
          <label>Nome</label>
          <input class="input" value=${nome} onInput=${(e) => setNome(e.target.value)} required />
        </div>
        <div class="form-grid cols-2">
          <div class="field">
            <label>Embalagem</label>
            <input class="input" value=${embalagem} onInput=${(e) => setEmbalagem(e.target.value)} placeholder="Ex: Lata, Garrafa" />
          </div>
          <div class="field">
            <label>Custo (R$)</label>
            <input class="input" type="number" min="0" step="0.01" value=${custo} onInput=${(e) => setCusto(e.target.value)} required />
          </div>
        </div>
        <div class="form-grid cols-2">
          <div class="field">
            <label>Estoque mínimo</label>
            <input class="input" type="number" min="0" step="1" value=${estoqueMinimo} onInput=${(e) => setEstoqueMinimo(e.target.value)} />
          </div>
          <div class="field">
            <label>Status</label>
            <select class="input" value=${ativo ? "1" : "0"} onChange=${(e) => setAtivo(e.target.value === "1")}>
              <option value="1">Ativo</option>
              <option value="0">Inativo</option>
            </select>
          </div>
        </div>
        <div class="row-between" style="justify-content:flex-end;gap:8px;">
          <button type="button" class="btn btn-secondary" onClick=${onClose}>Cancelar</button>
          <button type="submit" class="btn btn-primary" disabled=${saving || uploading}>${saving ? "Salvando…" : "Salvar"}</button>
        </div>
      </form>
    <//>
  `;
}
