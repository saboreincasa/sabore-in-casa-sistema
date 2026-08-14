import { html, useState, useEffect } from "../lib.js";
import { supabase } from "../supabaseClient.js";
import { useAppData, updateRow, deleteRow } from "../store.js";
import { Modal, useConfirm, LoadingState, EmptyState } from "../components/ui.js";
import { brl, pct, dataCurta, hojeISO } from "../format.js";

function primeiroDiaMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export function MetasPage() {
  const { isAdmin, toast } = useAppData();
  const [metas, setMetas] = useState([]);
  const [vendasHojeTotal, setVendasHojeTotal] = useState(0);
  const [vendasMesTotal, setVendasMesTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, confirmNode] = useConfirm();

  async function load() {
    setLoading(true);
    try {
      const hoje = hojeISO();
      const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
      const inicioMes = primeiroDiaMes();
      const [metasRes, vHojeRes, vMesRes] = await Promise.all([
        supabase.from("metas").select("*").order("referencia", { ascending: false }).limit(30),
        supabase.from("vendas").select("preco_unitario, quantidade").gte("criado_em", `${hoje}T00:00:00`).lt("criado_em", `${amanha}T00:00:00`),
        supabase.from("vendas").select("preco_unitario, quantidade").gte("criado_em", `${inicioMes}T00:00:00`),
      ]);
      if (metasRes.error) throw metasRes.error;
      setMetas(metasRes.data || []);
      setVendasHojeTotal((vHojeRes.data || []).reduce((s, v) => s + v.preco_unitario * v.quantidade, 0));
      setVendasMesTotal((vMesRes.data || []).reduce((s, v) => s + v.preco_unitario * v.quantidade, 0));
    } catch (e) {
      toast(`Erro ao carregar metas: ${e.message}`, "error");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const metaDiaria = metas.find((m) => m.tipo === "diaria" && m.referencia === hojeISO());
  const metaMensal = metas.find((m) => m.tipo === "mensal" && m.referencia === primeiroDiaMes());

  function handleSaved() { setModalOpen(false); load(); }
  function handleDelete(m) {
    confirm("Excluir esta meta?", async () => {
      try {
        await deleteRow("metas", m.id);
        toast("Meta excluída.", "success");
        load();
      } catch (e) {
        toast(`Erro ao excluir: ${e.message}`, "error");
      }
    });
  }

  if (loading) return html`<${LoadingState}>Carregando metas…<//>`;

  return html`
    <div class="stack-6">
      <div class="row-between">
        <div><h1 class="h2" style="font-size:26px;">Metas e Lucros</h1><p class="muted-text" style="margin:4px 0 0;">Acompanhe suas metas diárias e mensais.</p></div>
        ${isAdmin ? html`<button class="btn btn-primary" onClick=${() => { setEditing(null); setModalOpen(true); }}>+ Definir Meta</button>` : null}
      </div>

      <div class="grid-2">
        <${MetaCard} titulo="Meta diária" meta=${metaDiaria} realizado=${vendasHojeTotal} onEditar=${isAdmin ? () => { setEditing(metaDiaria || { tipo: "diaria", referencia: hojeISO() }); setModalOpen(true); } : null} />
        <${MetaCard} titulo="Meta mensal" meta=${metaMensal} realizado=${vendasMesTotal} onEditar=${isAdmin ? () => { setEditing(metaMensal || { tipo: "mensal", referencia: primeiroDiaMes() }); setModalOpen(true); } : null} />
      </div>

      <div class="card">
        <h3 style="margin:0 0 16px;font-size:16px;">Histórico de metas</h3>
        ${metas.length === 0 ? html`<${EmptyState}>Nenhuma meta cadastrada ainda.<//>` : html`
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Tipo</th><th>Referência</th><th>Valor da meta</th><th></th></tr></thead>
              <tbody>
                ${metas.map((m) => html`
                  <tr key=${m.id}>
                    <td class="cell-title">${m.tipo === "diaria" ? "Diária" : "Mensal"}</td>
                    <td class="cell-sub">${dataCurta(m.referencia)}</td>
                    <td class="bold">${brl(m.valor_meta)}</td>
                    <td class="actions-cell">
                      ${isAdmin ? html`
                        <button class="icon-btn" title="Editar" onClick=${() => { setEditing(m); setModalOpen(true); }}>✏️</button>
                        <button class="icon-btn" title="Excluir" onClick=${() => handleDelete(m)}>🗑️</button>
                      ` : null}
                    </td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>
        `}
      </div>

      ${modalOpen ? html`<${MetaModal} editing=${editing} onClose=${() => setModalOpen(false)} onSaved=${handleSaved} />` : null}
      ${confirmNode}
    </div>
  `;
}

function MetaCard({ titulo, meta, realizado, onEditar }) {
  const valor = Number(meta?.valor_meta || 0);
  const percent = valor > 0 ? Math.min(100, (realizado / valor) * 100) : 0;
  return html`
    <div class="card">
      <div class="row-between" style="margin-bottom:12px;">
        <h3 style="margin:0;font-size:16px;">${titulo}</h3>
        ${onEditar ? html`<button class="link-btn" onClick=${onEditar}>${meta ? "Editar" : "Definir"}</button>` : null}
      </div>
      ${valor > 0 ? html`
        <div class="kpi-value" style="font-size:26px;">${brl(realizado)}</div>
        <div class="muted-text small" style="margin-bottom:10px;">de ${brl(valor)} (${pct(percent)})</div>
        <div style="height:10px;border-radius:999px;background:var(--bg2);overflow:hidden;">
          <div style="height:100%;background:${percent >= 100 ? "var(--green)" : "var(--olive)"};width:${percent}%;"></div>
        </div>
      ` : html`<${EmptyState}>Nenhuma meta definida.<//>`}
    </div>
  `;
}

function MetaModal({ editing, onClose, onSaved }) {
  const { toast } = useAppData();
  const [tipo, setTipo] = useState(editing?.tipo || "diaria");
  const [referencia, setReferencia] = useState(editing?.referencia || hojeISO());
  const [valorMeta, setValorMeta] = useState(editing?.valor_meta ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!valorMeta || Number(valorMeta) <= 0) { toast("Informe um valor de meta válido.", "error"); return; }
    setSaving(true);
    try {
      const payload = { tipo, referencia: tipo === "mensal" ? referencia.slice(0, 8) + "01" : referencia, valor_meta: Number(valorMeta) };
      if (editing?.id) {
        await updateRow("metas", editing.id, payload);
      } else {
        const { error } = await supabase.from("metas").upsert(payload, { onConflict: "tipo,referencia" });
        if (error) throw error;
      }
      toast("Meta salva.", "success");
      onSaved();
    } catch (e) {
      toast(`Erro ao salvar: ${e.message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  return html`
    <${Modal} title=${editing?.id ? "Editar Meta" : "Definir Meta"} onClose=${onClose}>
      <form onSubmit=${handleSubmit} class="stack-4">
        <div class="pill-toggle">
          <button type="button" class=${tipo === "diaria" ? "active" : ""} onClick=${() => setTipo("diaria")}>Diária</button>
          <button type="button" class=${tipo === "mensal" ? "active" : ""} onClick=${() => setTipo("mensal")}>Mensal</button>
        </div>
        <div class="field">
          <label>${tipo === "diaria" ? "Dia" : "Mês (qualquer dia dele)"}</label>
          <input class="input" type="date" value=${referencia} onInput=${(e) => setReferencia(e.target.value)} required />
        </div>
        <div class="field"><label>Valor da meta (R$)</label><input class="input" type="number" min="0.01" step="0.01" value=${valorMeta} onInput=${(e) => setValorMeta(e.target.value)} required /></div>
        <div class="row-between" style="justify-content:flex-end;gap:8px;">
          <button type="button" class="btn btn-secondary" onClick=${onClose}>Cancelar</button>
          <button type="submit" class="btn btn-primary" disabled=${saving}>${saving ? "Salvando…" : "Salvar"}</button>
        </div>
      </form>
    <//>
  `;
}
