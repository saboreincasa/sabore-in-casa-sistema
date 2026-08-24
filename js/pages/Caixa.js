import { html, useState, useEffect, useMemo } from "../lib.js";
import { supabase } from "../supabaseClient.js";
import { useAppData, insertRow, updateRow, deleteRow } from "../store.js";
import { Kpi, Modal, useConfirm, LoadingState, EmptyState } from "../components/ui.js";
import { brl, dataCurta, dataHora, hojeISO } from "../format.js";

const CATEGORIAS_MANUAL = ["Sangria", "Recebimento", "Aporte", "Despesa avulsa", "Pagamento de conta", "Outro"];

export function CaixaPage() {
  const { toast, isAdmin } = useAppData();
  const [ledger, setLedger] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [comandasAbertas, setComandasAbertas] = useState({ qtd: 0, pendente: 0 });
  const [confirm, confirmNode] = useConfirm();

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("v_caixa").select("*").order("criado_em", { ascending: false }).limit(200);
      if (error) throw error;
      setLedger(data || []);

      const { data: abertas, error: cErr } = await supabase.from("comandas").select("id").eq("status", "aberta");
      if (cErr) throw cErr;
      const ids = (abertas || []).map((c) => c.id);
      let pendente = 0;
      if (ids.length) {
        const { data: itens, error: iErr } = await supabase.from("vendas").select("preco_unitario, quantidade").in("comanda_id", ids);
        if (iErr) throw iErr;
        pendente = (itens || []).reduce((s, v) => s + Number(v.preco_unitario) * Number(v.quantidade), 0);
      }
      setComandasAbertas({ qtd: ids.length, pendente });
    } catch (e) {
      toast(`Erro ao carregar caixa: ${e.message}`, "error");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const saldo = useMemo(() => ledger.reduce((s, r) => s + (r.tipo === "entrada" ? Number(r.valor) : -Number(r.valor)), 0), [ledger]);
  const entradas = useMemo(() => ledger.filter((r) => r.tipo === "entrada").reduce((s, r) => s + Number(r.valor), 0), [ledger]);
  const saidas = useMemo(() => ledger.filter((r) => r.tipo === "saida").reduce((s, r) => s + Number(r.valor), 0), [ledger]);

  async function handleDelete(row) {
    confirm(`Excluir o lançamento "${row.categoria}" de ${brl(row.valor)}?`, async () => {
      try {
        await deleteRow("lancamentos_caixa", row.id);
        toast("Lançamento excluído.", "success");
        load();
      } catch (e) {
        toast(`Erro ao excluir: ${e.message}`, "error");
      }
    });
  }

  return html`
    <div class="stack-6">
      <div class="row-between">
        <div><h1 class="h2" style="font-size:26px;">Caixa</h1><p class="muted-text" style="margin:4px 0 0;">Movimentações financeiras do negócio.</p></div>
        <button class="btn btn-primary" onClick=${() => { setEditing(null); setModalOpen(true); }}>+ Novo Lançamento</button>
      </div>

      <div class="kpi-row">
        <div class="card kpi"><${Kpi} icon="💰" label="Saldo atual" value=${brl(saldo)} tone="olive" /></div>
        <div class="card kpi"><${Kpi} icon="📈" label="Entradas" value=${brl(entradas)} tone="green" /></div>
        <div class="card kpi"><${Kpi} icon="📉" label="Saídas" value=${brl(saidas)} tone="red" /></div>
        <div class="card kpi"><${Kpi} icon="🧾" label="Comandas em aberto" value=${String(comandasAbertas.qtd)} sub=${comandasAbertas.qtd ? `${brl(comandasAbertas.pendente)} pendente — não entra no saldo` : "Nada pendente"} tone="gold" /></div>
      </div>

      <div class="card">
        <h3 style="margin:0 0 16px;font-size:16px;">Extrato</h3>
        ${loading ? html`<${LoadingState} />` : ledger.length === 0 ? html`<${EmptyState}>Nenhum lançamento ainda.<//>` : html`
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Data</th><th>Categoria</th><th>Descrição</th><th>Origem</th><th>Valor</th><th></th></tr></thead>
              <tbody>
                ${ledger.map((r) => html`
                  <tr key=${r.id}>
                    <td>${dataCurta(r.data)}</td>
                    <td class="cell-title">${r.categoria}</td>
                    <td class="cell-sub">${r.descricao || "—"}</td>
                    <td><span class="badge badge-neutral">${r.origem === "manual" ? "Manual" : r.origem === "venda" ? "Venda" : "Compra"}</span></td>
                    <td class=${r.tipo === "entrada" ? "text-green bold" : "text-red bold"}>${r.tipo === "entrada" ? "+" : "-"} ${brl(r.valor)}</td>
                    <td class="actions-cell">
                      ${r.origem === "manual" ? html`
                        <button class="icon-btn" title="Editar" onClick=${() => { setEditing(r); setModalOpen(true); }}>✏️</button>
                        ${isAdmin ? html`<button class="icon-btn" title="Excluir" onClick=${() => handleDelete(r)}>🗑️</button>` : null}
                      ` : html`<span class="muted-text small">gerado</span>`}
                    </td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>
        `}
      </div>

      ${modalOpen ? html`<${LancamentoModal} editing=${editing} onClose=${() => setModalOpen(false)} onSaved=${() => { setModalOpen(false); load(); }} />` : null}
      ${confirmNode}
    </div>
  `;
}

function LancamentoModal({ editing, onClose, onSaved }) {
  const { toast } = useAppData();
  const [tipo, setTipo] = useState(editing?.tipo || "entrada");
  const [categoria, setCategoria] = useState(editing?.categoria || CATEGORIAS_MANUAL[0]);
  const [descricao, setDescricao] = useState(editing?.descricao || "");
  const [valor, setValor] = useState(editing?.valor ?? "");
  const [data, setData] = useState(editing?.data || hojeISO());
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!valor || Number(valor) <= 0) { toast("Informe um valor válido.", "error"); return; }
    setSaving(true);
    try {
      const payload = { tipo, categoria, descricao, valor: Number(valor), data };
      if (editing) {
        await updateRow("lancamentos_caixa", editing.id, payload);
        toast("Lançamento atualizado.", "success");
      } else {
        await insertRow("lancamentos_caixa", payload);
        toast("Lançamento registrado.", "success");
      }
      onSaved();
    } catch (e) {
      toast(`Erro ao salvar: ${e.message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  return html`
    <${Modal} title=${editing ? "Editar Lançamento" : "Novo Lançamento"} onClose=${onClose}>
      <form onSubmit=${handleSubmit} class="stack-4">
        <div class="pill-toggle">
          <button type="button" class=${tipo === "entrada" ? "active" : ""} onClick=${() => setTipo("entrada")}>Entrada</button>
          <button type="button" class=${tipo === "saida" ? "active" : ""} onClick=${() => setTipo("saida")}>Saída</button>
        </div>
        <div class="form-grid cols-2">
          <div class="field">
            <label>Categoria</label>
            <select class="input" value=${categoria} onChange=${(e) => setCategoria(e.target.value)}>
              ${CATEGORIAS_MANUAL.map((c) => html`<option key=${c} value=${c}>${c}</option>`)}
            </select>
          </div>
          <div class="field">
            <label>Data</label>
            <input class="input" type="date" value=${data} onInput=${(e) => setData(e.target.value)} required />
          </div>
        </div>
        <div class="field">
          <label>Descrição</label>
          <input class="input" value=${descricao} onInput=${(e) => setDescricao(e.target.value)} placeholder="Opcional" />
        </div>
        <div class="field">
          <label>Valor (R$)</label>
          <input class="input" type="number" min="0.01" step="0.01" value=${valor} onInput=${(e) => setValor(e.target.value)} required />
        </div>
        <div class="row-between" style="justify-content:flex-end;gap:8px;">
          <button type="button" class="btn btn-secondary" onClick=${onClose}>Cancelar</button>
          <button type="submit" class="btn btn-primary" disabled=${saving}>${saving ? "Salvando…" : "Salvar"}</button>
        </div>
      </form>
    <//>
  `;
}
