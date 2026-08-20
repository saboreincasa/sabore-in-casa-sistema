import { html, useState } from "../lib.js";
import { useAppData, insertRow, updateRow, deleteRow } from "../store.js";
import { Modal, useConfirm, EmptyState, ImgThumb, Badge } from "../components/ui.js";
import { brl } from "../format.js";
import { ImageUploadField } from "../components/ImageUpload.js";

export function CombosPage() {
  const { combos, isAdmin, toast, refreshCombos } = useAppData();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, confirmNode] = useConfirm();

  function handleSaved() {
    setModalOpen(false);
    refreshCombos();
  }

  function handleDelete(c) {
    confirm(`Excluir o combo "${c.nome}"? Vendas antigas continuarão no histórico.`, async () => {
      try {
        await deleteRow("combos", c.id);
        toast("Combo excluído.", "success");
        refreshCombos();
      } catch (e) {
        toast(`Não foi possível excluir: ${e.message}`, "error");
      }
    });
  }

  return html`
    <div class="stack-6">
      <div class="row-between">
        <div><h1 class="h2" style="font-size:26px;">Combos</h1><p class="muted-text" style="margin:4px 0 0;">Pacotes com preço fechado (pizza + bebida etc.) vendidos no delivery.</p></div>
        ${isAdmin ? html`<button class="btn btn-primary" onClick=${() => { setEditing(null); setModalOpen(true); }}>+ Novo Combo</button>` : null}
      </div>

      <div class="card">
        <h3 style="margin:0 0 16px;font-size:16px;">Catálogo de combos</h3>
        ${combos.length === 0 ? html`<${EmptyState}>Nenhum combo cadastrado.<//>` : html`
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Combo</th><th>Descrição</th><th>Preço</th><th></th></tr></thead>
              <tbody>
                ${combos.map((c) => html`
                  <tr key=${c.id}>
                    <td>
                      <div class="cell-product">
                        <${ImgThumb} src=${c.imagem_url} alt=${c.nome} />
                        <div class="cell-title">${c.nome}</div>
                      </div>
                    </td>
                    <td class="cell-sub">${c.descricao || "—"}</td>
                    <td class="bold">${brl(c.preco)}</td>
                    <td class="actions-cell">
                      ${!c.ativo ? html`<${Badge} tone="neutral">Inativo<//>` : null}
                      ${isAdmin ? html`
                        <button class="icon-btn" title="Editar" onClick=${() => { setEditing(c); setModalOpen(true); }}>✏️</button>
                        <button class="icon-btn" title="Excluir" onClick=${() => handleDelete(c)}>🗑️</button>
                      ` : null}
                    </td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>
        `}
        <p class="hint" style="margin-top:14px;">O preço do combo é fixo (não calculado por margem). Quando um combo é vendido pelo site de delivery, as bebidas/lanches inclusos baixam do estoque automaticamente.</p>
      </div>

      ${modalOpen ? html`<${ComboModal} editing=${editing} onClose=${() => setModalOpen(false)} onSaved=${handleSaved} />` : null}
      ${confirmNode}
    </div>
  `;
}

function ComboModal({ editing, onClose, onSaved }) {
  const { toast } = useAppData();
  const [nome, setNome] = useState(editing?.nome || "");
  const [preco, setPreco] = useState(editing?.preco ?? "");
  const [descricao, setDescricao] = useState(editing?.descricao || "");
  const [ativo, setAtivo] = useState(editing?.ativo ?? true);
  const [imagemUrl, setImagemUrl] = useState(editing?.imagem_url || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nome.trim()) { toast("Informe o nome do combo.", "error"); return; }
    if (preco === "" || Number(preco) < 0) { toast("Informe o preço.", "error"); return; }
    setSaving(true);
    try {
      const payload = { nome: nome.trim(), preco: Number(preco), descricao: descricao || null, ativo, imagem_url: imagemUrl || null };
      if (editing) {
        await updateRow("combos", editing.id, payload);
        toast("Combo atualizado.", "success");
      } else {
        await insertRow("combos", payload);
        toast("Combo cadastrado.", "success");
      }
      onSaved();
    } catch (e) {
      toast(`Erro ao salvar: ${e.message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  return html`
    <${Modal} title=${editing ? "Editar Combo" : "Novo Combo"} onClose=${onClose}>
      <form onSubmit=${handleSubmit} class="stack-4">
        <${ImageUploadField} imagemUrl=${imagemUrl} setImagemUrl=${setImagemUrl} pasta="combos" uploading=${uploading} setUploading=${setUploading} />
        <div class="field">
          <label>Nome</label>
          <input class="input" value=${nome} onInput=${(e) => setNome(e.target.value)} required />
        </div>
        <div class="form-grid cols-2">
          <div class="field">
            <label>Preço (R$)</label>
            <input class="input" type="number" min="0" step="0.01" value=${preco} onInput=${(e) => setPreco(e.target.value)} required />
          </div>
          <div class="field">
            <label>Status</label>
            <select class="input" value=${ativo ? "1" : "0"} onChange=${(e) => setAtivo(e.target.value === "1")}>
              <option value="1">Ativo</option>
              <option value="0">Inativo</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label>Descrição</label>
          <input class="input" value=${descricao} onInput=${(e) => setDescricao(e.target.value)} placeholder="Ex: 2 Pizzas Gigantes 35cm + 2 Refrigerantes 2L" />
        </div>
        <div class="row-between" style="justify-content:flex-end;gap:8px;">
          <button type="button" class="btn btn-secondary" onClick=${onClose}>Cancelar</button>
          <button type="submit" class="btn btn-primary" disabled=${saving || uploading}>${saving ? "Salvando…" : "Salvar"}</button>
        </div>
      </form>
    <//>
  `;
}
