import { html, useState } from "../lib.js";
import { useAppData, insertRow, updateRow, deleteRow } from "../store.js";
import { Modal, useConfirm, EmptyState } from "../components/ui.js";

export function FornecedoresPage() {
  const { fornecedores, toast, refreshFornecedores } = useAppData();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, confirmNode] = useConfirm();

  function handleSaved() { setModalOpen(false); refreshFornecedores(); }
  function handleDelete(f) {
    confirm(`Excluir o fornecedor "${f.nome}"? Compras antigas mantêm o histórico.`, async () => {
      try {
        await deleteRow("fornecedores", f.id);
        toast("Fornecedor excluído.", "success");
        refreshFornecedores();
      } catch (e) {
        toast(`Erro ao excluir: ${e.message}`, "error");
      }
    });
  }

  return html`
    <div class="stack-6">
      <div class="row-between">
        <div><h1 class="h2" style="font-size:26px;">Fornecedores</h1><p class="muted-text" style="margin:4px 0 0;">Quem abastece o seu estoque.</p></div>
        <button class="btn btn-primary" onClick=${() => { setEditing(null); setModalOpen(true); }}>+ Novo Fornecedor</button>
      </div>

      <div class="card">
        ${fornecedores.length === 0 ? html`<${EmptyState}>Nenhum fornecedor cadastrado.<//>` : html`
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Nome</th><th>Categoria</th><th>Contato</th><th>Telefone</th><th></th></tr></thead>
              <tbody>
                ${fornecedores.map((f) => html`
                  <tr key=${f.id}>
                    <td class="cell-title">${f.nome}</td>
                    <td class="cell-sub">${f.categoria || "—"}</td>
                    <td class="cell-sub">${f.contato || "—"}</td>
                    <td class="cell-sub">${f.telefone || "—"}</td>
                    <td class="actions-cell">
                      <button class="icon-btn" title="Editar" onClick=${() => { setEditing(f); setModalOpen(true); }}>✏️</button>
                      <button class="icon-btn" title="Excluir" onClick=${() => handleDelete(f)}>🗑️</button>
                    </td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>
        `}
      </div>

      ${modalOpen ? html`<${FornecedorModal} editing=${editing} onClose=${() => setModalOpen(false)} onSaved=${handleSaved} />` : null}
      ${confirmNode}
    </div>
  `;
}

function FornecedorModal({ editing, onClose, onSaved }) {
  const { toast } = useAppData();
  const [nome, setNome] = useState(editing?.nome || "");
  const [categoria, setCategoria] = useState(editing?.categoria || "");
  const [contato, setContato] = useState(editing?.contato || "");
  const [telefone, setTelefone] = useState(editing?.telefone || "");
  const [observacoes, setObservacoes] = useState(editing?.observacoes || "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nome.trim()) { toast("Informe o nome do fornecedor.", "error"); return; }
    setSaving(true);
    try {
      const payload = { nome: nome.trim(), categoria: categoria || null, contato: contato || null, telefone: telefone || null, observacoes: observacoes || null };
      if (editing) {
        await updateRow("fornecedores", editing.id, payload);
        toast("Fornecedor atualizado.", "success");
      } else {
        await insertRow("fornecedores", payload);
        toast("Fornecedor cadastrado.", "success");
      }
      onSaved();
    } catch (e) {
      toast(`Erro ao salvar: ${e.message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  return html`
    <${Modal} title=${editing ? "Editar Fornecedor" : "Novo Fornecedor"} onClose=${onClose}>
      <form onSubmit=${handleSubmit} class="stack-4">
        <div class="field"><label>Nome</label><input class="input" value=${nome} onInput=${(e) => setNome(e.target.value)} required /></div>
        <div class="form-grid cols-2">
          <div class="field"><label>Categoria</label><input class="input" value=${categoria} onInput=${(e) => setCategoria(e.target.value)} placeholder="Ex: Bebidas, Insumos" /></div>
          <div class="field"><label>Telefone</label><input class="input" value=${telefone} onInput=${(e) => setTelefone(e.target.value)} /></div>
        </div>
        <div class="field"><label>Contato (pessoa/e-mail)</label><input class="input" value=${contato} onInput=${(e) => setContato(e.target.value)} /></div>
        <div class="field"><label>Observações</label><input class="input" value=${observacoes} onInput=${(e) => setObservacoes(e.target.value)} placeholder="Opcional" /></div>
        <div class="row-between" style="justify-content:flex-end;gap:8px;">
          <button type="button" class="btn btn-secondary" onClick=${onClose}>Cancelar</button>
          <button type="submit" class="btn btn-primary" disabled=${saving}>${saving ? "Salvando…" : "Salvar"}</button>
        </div>
      </form>
    <//>
  `;
}
