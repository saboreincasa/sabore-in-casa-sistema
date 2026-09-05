import { html, useState } from "../lib.js";
import { useAppData, insertRow, updateRow, deleteRow } from "../store.js";
import { Modal, useConfirm, EmptyState, ImgThumb, Badge } from "../components/ui.js";
import { brl } from "../format.js";
import { ImageUploadField } from "../components/ImageUpload.js";

export function TabacariaPage() {
  const { tabacaria, isAdmin, toast, refreshTabacaria, refreshEstoqueTabacaria } = useAppData();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, confirmNode] = useConfirm();

  function handleSaved() {
    setModalOpen(false);
    refreshTabacaria();
    refreshEstoqueTabacaria();
  }

  function handleDelete(t) {
    confirm(`Excluir o produto "${t.nome}"? Compras e vendas antigas continuarão no histórico.`, async () => {
      try {
        await deleteRow("tabacaria", t.id);
        toast("Produto excluído.", "success");
        refreshTabacaria();
      } catch (e) {
        toast(`Não foi possível excluir: ${e.message}`, "error");
      }
    });
  }

  return html`
    <div class="stack-6">
      <div class="row-between">
        <div><h1 class="h2" style="font-size:26px;">Tabacaria</h1><p class="muted-text" style="margin:4px 0 0;">Isqueiro, seda e cigarros (maço e avulso) — vendidos no balcão, fora do cardápio.</p></div>
        ${isAdmin ? html`<button class="btn btn-primary" onClick=${() => { setEditing(null); setModalOpen(true); }}>+ Novo Produto</button>` : null}
      </div>

      <div class="card">
        <h3 style="margin:0 0 16px;font-size:16px;">Catálogo e precificação</h3>
        ${tabacaria.length === 0 ? html`<${EmptyState}>Nenhum produto cadastrado.<//>` : html`
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Produto</th><th>Custo</th><th>Preço de venda</th><th>Estoque mín.</th><th></th></tr></thead>
              <tbody>
                ${tabacaria.map((t) => html`
                  <tr key=${t.id}>
                    <td>
                      <div class="cell-product">
                        <${ImgThumb} src=${t.imagem_url} alt=${t.nome} />
                        <div><div class="cell-title">${t.nome}</div></div>
                      </div>
                    </td>
                    <td>${brl(t.custo)}</td>
                    <td class="bold">${t.preco_fixo != null ? brl(t.preco_fixo) : "—"}</td>
                    <td>${t.estoque_minimo}</td>
                    <td class="actions-cell">
                      ${!t.ativo ? html`<${Badge} tone="neutral">Inativo<//>` : null}
                      ${isAdmin ? html`
                        <button class="icon-btn" title="Editar" onClick=${() => { setEditing(t); setModalOpen(true); }}>✏️</button>
                        <button class="icon-btn" title="Excluir" onClick=${() => handleDelete(t)}>🗑️</button>
                      ` : null}
                    </td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>
        `}
        <p class="hint" style="margin-top:14px;">Preço de venda fixo, sem repasse de comissão de canal — esses produtos são vendidos só no balcão.</p>
      </div>

      ${modalOpen ? html`<${TabacariaModal} editing=${editing} onClose=${() => setModalOpen(false)} onSaved=${handleSaved} />` : null}
      ${confirmNode}
    </div>
  `;
}

function TabacariaModal({ editing, onClose, onSaved }) {
  const { toast } = useAppData();
  const [nome, setNome] = useState(editing?.nome || "");
  const [custo, setCusto] = useState(editing?.custo ?? "");
  const [precoFixo, setPrecoFixo] = useState(editing?.preco_fixo ?? "");
  const [estoqueMinimo, setEstoqueMinimo] = useState(editing?.estoque_minimo ?? 0);
  const [ativo, setAtivo] = useState(editing?.ativo ?? true);
  const [imagemUrl, setImagemUrl] = useState(editing?.imagem_url || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nome.trim()) { toast("Informe o nome do produto.", "error"); return; }
    if (custo === "" || Number(custo) < 0) { toast("Informe o custo.", "error"); return; }
    if (precoFixo === "" || Number(precoFixo) < 0) { toast("Informe o preço de venda.", "error"); return; }
    setSaving(true);
    try {
      const payload = {
        nome: nome.trim(),
        custo: Number(custo),
        preco_fixo: Number(precoFixo),
        estoque_minimo: Number(estoqueMinimo) || 0,
        ativo,
        imagem_url: imagemUrl || null,
      };
      if (editing) {
        await updateRow("tabacaria", editing.id, payload);
        toast("Produto atualizado.", "success");
      } else {
        await insertRow("tabacaria", payload);
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
        <${ImageUploadField} imagemUrl=${imagemUrl} setImagemUrl=${setImagemUrl} pasta="tabacaria" uploading=${uploading} setUploading=${setUploading} />
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
            <label>Preço de venda (R$)</label>
            <input class="input" type="number" min="0" step="0.01" value=${precoFixo} onInput=${(e) => setPrecoFixo(e.target.value)} required />
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
