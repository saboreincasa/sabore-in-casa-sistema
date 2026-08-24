import { html, useState, useMemo, useEffect } from "../lib.js";
import { supabase } from "../supabaseClient.js";
import { useAppData, insertRow, updateRow, deleteRow } from "../store.js";
import { Modal, useConfirm, EmptyState } from "../components/ui.js";
import { dataCurta, initials } from "../format.js";

export function ClientesPage() {
  const { clientes, toast, refreshClientes } = useAppData();
  const [busca, setBusca] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [aniversariantes, setAniversariantes] = useState([]);
  const [confirm, confirmNode] = useConfirm();

  useEffect(() => {
    supabase.from("v_aniversariantes_proximos").select("*").then(({ data, error }) => {
      if (!error) setAniversariantes(data || []);
    });
  }, [clientes]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return clientes;
    return clientes.filter((c) => c.nome.toLowerCase().includes(q) || (c.telefone || "").includes(q));
  }, [clientes, busca]);

  function handleSaved() { setModalOpen(false); refreshClientes(); }
  function handleDelete(c) {
    confirm(`Excluir o cliente "${c.nome}"?`, async () => {
      try {
        await deleteRow("clientes", c.id);
        toast("Cliente excluído.", "success");
        refreshClientes();
      } catch (e) {
        if (e.code === "23503") {
          toast(`"${c.nome}" tem vendas no histórico — não dá pra excluir sem apagar o histórico junto. Se for engano/teste, apague as vendas dele em Vendas primeiro.`, "error");
        } else {
          toast(`Erro ao excluir: ${e.message}`, "error");
        }
      }
    });
  }

  return html`
    <div class="stack-6">
      <div class="row-between">
        <div><h1 class="h2" style="font-size:26px;">Clientes</h1><p class="muted-text" style="margin:4px 0 0;">Cadastro de clientes para vincular às vendas.</p></div>
        <button class="btn btn-primary" onClick=${() => { setEditing(null); setModalOpen(true); }}>+ Novo Cliente</button>
      </div>

      ${aniversariantes.length > 0 ? html`
        <div class="card" style="background:var(--bg2);">
          <h3 style="margin:0 0 14px;font-size:16px;">🎂 Aniversariantes da semana</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px;">
            ${aniversariantes.map((a) => html`
              <div key=${a.id} class="card tight">
                <div class="bold">${a.nome}</div>
                <div class="muted-text small">${a.telefone || "sem telefone"}</div>
                <div class="muted-text small" style="margin-top:4px;">
                  ${a.dias_faltando === 0 ? "🎉 Hoje!" : a.dias_faltando === 1 ? "Amanhã" : `Em ${a.dias_faltando} dias`}
                  · ${dataCurta(a.proximo_aniversario)}
                </div>
                ${a.telefone ? html`<a href="https://wa.me/55${a.telefone.replace(/\D/g,"")}?text=${encodeURIComponent(`Parabéns, ${a.nome.split(" ")[0]}! 🎉 A Sabore In Casa preparou um mimo pra você: frete grátis no seu pedido esta semana. Bora comemorar com uma pizza?`)}" target="_blank" class="btn btn-secondary btn-sm" style="margin-top:8px;display:inline-block;text-decoration:none;">Mandar parabéns</a>` : null}
              </div>
            `)}
          </div>
        </div>
      ` : null}

      <div class="card">
        <div class="row-between" style="margin-bottom:16px;">
          <h3 style="margin:0;font-size:16px;">Todos os clientes</h3>
          <input class="input" style="max-width:240px;" placeholder="Buscar por nome ou telefone" value=${busca} onInput=${(e) => setBusca(e.target.value)} />
        </div>
        ${filtrados.length === 0 ? html`<${EmptyState}>Nenhum cliente encontrado.<//>` : html`
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th></th><th>Nome</th><th>Telefone</th><th>Endereço</th><th>Aniversário</th><th>Cadastrado em</th><th></th></tr></thead>
              <tbody>
                ${filtrados.map((c) => html`
                  <tr key=${c.id}>
                    <td><div class="user-avatar" style="width:30px;height:30px;font-size:11px;">${initials(c.nome)}</div></td>
                    <td class="cell-title">${c.nome}</td>
                    <td>${c.telefone || "—"}</td>
                    <td class="cell-sub">${c.endereco || "—"}</td>
                    <td class="cell-sub">${c.aniversario ? dataCurta(c.aniversario) : "—"}</td>
                    <td class="cell-sub">${dataCurta(c.criado_em)}</td>
                    <td class="actions-cell">
                      <button class="icon-btn" title="Editar" onClick=${() => { setEditing(c); setModalOpen(true); }}>✏️</button>
                      <button class="icon-btn" title="Excluir" onClick=${() => handleDelete(c)}>🗑️</button>
                    </td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>
        `}
      </div>

      ${modalOpen ? html`<${ClienteModal} editing=${editing} onClose=${() => setModalOpen(false)} onSaved=${handleSaved} />` : null}
      ${confirmNode}
    </div>
  `;
}

function ClienteModal({ editing, onClose, onSaved }) {
  const { toast } = useAppData();
  const [nome, setNome] = useState(editing?.nome || "");
  const [telefone, setTelefone] = useState(editing?.telefone || "");
  const [endereco, setEndereco] = useState(editing?.endereco || "");
  const [aniversario, setAniversario] = useState(editing?.aniversario || "");
  const [observacoes, setObservacoes] = useState(editing?.observacoes || "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nome.trim()) { toast("Informe o nome do cliente.", "error"); return; }
    setSaving(true);
    try {
      const payload = { nome: nome.trim(), telefone: telefone || null, endereco: endereco || null, aniversario: aniversario || null, observacoes: observacoes || null };
      if (editing) {
        await updateRow("clientes", editing.id, payload);
        toast("Cliente atualizado.", "success");
      } else {
        await insertRow("clientes", payload);
        toast("Cliente cadastrado.", "success");
      }
      onSaved();
    } catch (e) {
      toast(`Erro ao salvar: ${e.message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  return html`
    <${Modal} title=${editing ? "Editar Cliente" : "Novo Cliente"} onClose=${onClose}>
      <form onSubmit=${handleSubmit} class="stack-4">
        <div class="field"><label>Nome</label><input class="input" value=${nome} onInput=${(e) => setNome(e.target.value)} required /></div>
        <div class="field"><label>Telefone / WhatsApp</label><input class="input" value=${telefone} onInput=${(e) => setTelefone(e.target.value)} placeholder="(31) 9xxxx-xxxx" /></div>
        <div class="field"><label>Endereço</label><textarea class="input" value=${endereco} onInput=${(e) => setEndereco(e.target.value)} placeholder="Rua, número, bairro, referência" /></div>
        <div class="field"><label>Aniversário</label><input class="input" type="date" value=${aniversario} onInput=${(e) => setAniversario(e.target.value)} /></div>
        <div class="field"><label>Observações</label><input class="input" value=${observacoes} onInput=${(e) => setObservacoes(e.target.value)} placeholder="Opcional" /></div>
        <div class="row-between" style="justify-content:flex-end;gap:8px;">
          <button type="button" class="btn btn-secondary" onClick=${onClose}>Cancelar</button>
          <button type="submit" class="btn btn-primary" disabled=${saving}>${saving ? "Salvando…" : "Salvar"}</button>
        </div>
      </form>
    <//>
  `;
}
