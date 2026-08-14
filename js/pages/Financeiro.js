import { html, useState, useEffect, useMemo } from "../lib.js";
import { supabase } from "../supabaseClient.js";
import { useAppData, fetchAll, insertRow, updateRow, deleteRow } from "../store.js";
import { Modal, useConfirm, LoadingState, EmptyState, Badge } from "../components/ui.js";
import { brl, pct } from "../format.js";

function primeiroDiaMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export function FinanceiroPage() {
  const { isAdmin, toast } = useAppData();
  const [despesas, setDespesas] = useState([]);
  const [receitaMes, setReceitaMes] = useState(0);
  const [custoInsumosMes, setCustoInsumosMes] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, confirmNode] = useConfirm();

  const [pctMarketing, setPctMarketing] = useState(8);
  const [pctCrescimento, setPctCrescimento] = useState(10);
  const [pctCapitalGiro, setPctCapitalGiro] = useState(10);

  async function load() {
    setLoading(true);
    try {
      const inicioMes = primeiroDiaMes();
      const [despesasData, vendasRes] = await Promise.all([
        fetchAll("despesas_fixas", { order: "nome", ascending: true }),
        supabase.from("vendas").select("preco_unitario, quantidade, custo_unitario").gte("criado_em", `${inicioMes}T00:00:00`),
      ]);
      if (vendasRes.error) throw vendasRes.error;
      setDespesas(despesasData);
      const vendas = vendasRes.data || [];
      setReceitaMes(vendas.reduce((s, v) => s + v.preco_unitario * v.quantidade, 0));
      setCustoInsumosMes(vendas.reduce((s, v) => s + v.custo_unitario * v.quantidade, 0));
    } catch (e) {
      toast(`Erro ao carregar dados financeiros: ${e.message}`, "error");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const despesasFixasMes = useMemo(() => despesas.filter((d) => d.ativo && d.recorrente).reduce((s, d) => s + Number(d.valor), 0), [despesas]);
  const lucroOperacional = receitaMes - custoInsumosMes - despesasFixasMes;
  const valMarketing = Math.max(0, lucroOperacional * (pctMarketing / 100));
  const valCrescimento = Math.max(0, lucroOperacional * (pctCrescimento / 100));
  const valCapital = Math.max(0, lucroOperacional * (pctCapitalGiro / 100));
  const lucroDono = lucroOperacional - valMarketing - valCrescimento - valCapital;

  function handleSaved() { setModalOpen(false); load(); }
  function handleDelete(d) {
    confirm(`Excluir a despesa "${d.nome}"?`, async () => {
      try {
        await deleteRow("despesas_fixas", d.id);
        toast("Despesa excluída.", "success");
        load();
      } catch (e) {
        toast(`Erro ao excluir: ${e.message}`, "error");
      }
    });
  }

  const barras = [
    { label: "Insumos", valor: custoInsumosMes, cor: "var(--gold)" },
    { label: "Despesas fixas", valor: despesasFixasMes, cor: "var(--red)" },
    { label: "Marketing", valor: valMarketing, cor: "#7A9E5B" },
    { label: "Reserva de crescimento", valor: valCrescimento, cor: "#A8763E" },
    { label: "Capital de giro", valor: valCapital, cor: "var(--brown)" },
    { label: "Lucro do dono", valor: lucroDono, cor: "var(--green)" },
  ];

  if (loading) return html`<${LoadingState}>Carregando financeiro…<//>`;

  return html`
    <div class="stack-6">
      <div><h1 class="h2" style="font-size:26px;">Financeiro</h1><p class="muted-text" style="margin:4px 0 0;">Despesas fixas e alocação da receita do mês atual.</p></div>

      <div class="card">
        <div class="row-between" style="margin-bottom:8px;">
          <h3 style="margin:0;font-size:16px;">Alocação de Receita — mês atual</h3>
        </div>
        <div class="kpi-row" style="margin-bottom:20px;">
          <div class="kpi"><span class="label-muted">Receita do mês</span><span class="kpi-value">${brl(receitaMes)}</span></div>
          <div class="kpi"><span class="label-muted">Custo de insumos (real)</span><span class="kpi-value">${brl(custoInsumosMes)}</span></div>
          <div class="kpi"><span class="label-muted">Despesas fixas (real)</span><span class="kpi-value">${brl(despesasFixasMes)}</span></div>
          <div class="kpi"><span class="label-muted">Lucro operacional</span><span class="kpi-value">${brl(lucroOperacional)}</span></div>
        </div>

        <div class="form-grid cols-3" style="margin-bottom:18px;">
          <div class="field"><label>Marketing (%)</label><input class="input" type="number" min="0" max="100" value=${pctMarketing} onInput=${(e) => setPctMarketing(Number(e.target.value))} /></div>
          <div class="field"><label>Reserva de crescimento (%)</label><input class="input" type="number" min="0" max="100" value=${pctCrescimento} onInput=${(e) => setPctCrescimento(Number(e.target.value))} /></div>
          <div class="field"><label>Capital de giro (%)</label><input class="input" type="number" min="0" max="100" value=${pctCapitalGiro} onInput=${(e) => setPctCapitalGiro(Number(e.target.value))} /></div>
        </div>
        <p class="hint" style="margin-top:-8px;margin-bottom:16px;">Percentuais aplicados sobre o lucro operacional (receita − insumos reais − despesas fixas reais). Ajuste livremente para simular.</p>

        <div style="display:flex;height:14px;border-radius:999px;overflow:hidden;margin-bottom:16px;">
          ${barras.map((b) => html`<div key=${b.label} style="width:${receitaMes > 0 ? Math.max(0, (b.valor / receitaMes) * 100) : 0}%;background:${b.cor};" title=${b.label}></div>`)}
        </div>
        <div class="grid-3">
          ${barras.map((b) => html`
            <div key=${b.label} class="row-between" style="font-size:12.5px;">
              <span><span style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${b.cor};margin-right:6px;"></span>${b.label}</span>
              <span class="bold">${brl(b.valor)}</span>
            </div>
          `)}
        </div>
      </div>

      <div class="card">
        <div class="row-between" style="margin-bottom:16px;">
          <h3 style="margin:0;font-size:16px;">Despesas fixas</h3>
          ${isAdmin ? html`<button class="btn btn-primary btn-sm" onClick=${() => { setEditing(null); setModalOpen(true); }}>+ Nova Despesa</button>` : null}
        </div>
        ${despesas.length === 0 ? html`<${EmptyState}>Nenhuma despesa cadastrada.<//>` : html`
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Nome</th><th>Categoria</th><th>Valor</th><th>Recorrente</th><th></th></tr></thead>
              <tbody>
                ${despesas.map((d) => html`
                  <tr key=${d.id}>
                    <td class="cell-title">${d.nome}</td>
                    <td class="cell-sub">${d.categoria || "—"}</td>
                    <td class="bold">${brl(d.valor)}</td>
                    <td>${d.recorrente ? html`<${Badge} tone="green">Mensal<//>` : html`<${Badge} tone="neutral">Avulsa<//>`}</td>
                    <td class="actions-cell">
                      ${isAdmin ? html`
                        <button class="icon-btn" title="Editar" onClick=${() => { setEditing(d); setModalOpen(true); }}>✏️</button>
                        <button class="icon-btn" title="Excluir" onClick=${() => handleDelete(d)}>🗑️</button>
                      ` : null}
                    </td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>
        `}
      </div>

      ${modalOpen ? html`<${DespesaModal} editing=${editing} onClose=${() => setModalOpen(false)} onSaved=${handleSaved} />` : null}
      ${confirmNode}
    </div>
  `;
}

function DespesaModal({ editing, onClose, onSaved }) {
  const { toast } = useAppData();
  const [nome, setNome] = useState(editing?.nome || "");
  const [valor, setValor] = useState(editing?.valor ?? "");
  const [categoria, setCategoria] = useState(editing?.categoria || "");
  const [recorrente, setRecorrente] = useState(editing?.recorrente ?? true);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nome.trim()) { toast("Informe o nome da despesa.", "error"); return; }
    if (!valor || Number(valor) <= 0) { toast("Informe um valor válido.", "error"); return; }
    setSaving(true);
    try {
      const payload = { nome: nome.trim(), valor: Number(valor), categoria: categoria || null, recorrente, ativo: true };
      if (editing) {
        await updateRow("despesas_fixas", editing.id, payload);
        toast("Despesa atualizada.", "success");
      } else {
        await insertRow("despesas_fixas", payload);
        toast("Despesa cadastrada.", "success");
      }
      onSaved();
    } catch (e) {
      toast(`Erro ao salvar: ${e.message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  return html`
    <${Modal} title=${editing ? "Editar Despesa" : "Nova Despesa Fixa"} onClose=${onClose}>
      <form onSubmit=${handleSubmit} class="stack-4">
        <div class="field"><label>Nome</label><input class="input" value=${nome} onInput=${(e) => setNome(e.target.value)} placeholder="Ex: Aluguel, Energia, Internet" required /></div>
        <div class="form-grid cols-2">
          <div class="field"><label>Valor mensal (R$)</label><input class="input" type="number" min="0.01" step="0.01" value=${valor} onInput=${(e) => setValor(e.target.value)} required /></div>
          <div class="field"><label>Categoria</label><input class="input" value=${categoria} onInput=${(e) => setCategoria(e.target.value)} placeholder="Opcional" /></div>
        </div>
        <div class="field">
          <label>Recorrência</label>
          <select class="input" value=${recorrente ? "1" : "0"} onChange=${(e) => setRecorrente(e.target.value === "1")}>
            <option value="1">Mensal (recorrente)</option>
            <option value="0">Avulsa (não entra na alocação)</option>
          </select>
        </div>
        <div class="row-between" style="justify-content:flex-end;gap:8px;">
          <button type="button" class="btn btn-secondary" onClick=${onClose}>Cancelar</button>
          <button type="submit" class="btn btn-primary" disabled=${saving}>${saving ? "Salvando…" : "Salvar"}</button>
        </div>
      </form>
    <//>
  `;
}
