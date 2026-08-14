import { html, useState, useEffect } from "../lib.js";
import { supabase } from "../supabaseClient.js";
import { useAppData, insertRow } from "../store.js";
import { Modal, Badge, ImgThumb, EmptyState, LoadingState } from "../components/ui.js";
import { dataHora } from "../format.js";

function statusDe(atual, minimo) {
  if (atual <= 0) return { tone: "red", label: "Crítico" };
  if (atual <= minimo) return { tone: "gold", label: "Baixo" };
  return { tone: "green", label: "Saudável" };
}

export function EstoquePage() {
  const { estoque, toast, refreshEstoque } = useAppData();
  const [modalOpen, setModalOpen] = useState(false);
  const [produtoAjuste, setProdutoAjuste] = useState(null);
  const [historico, setHistorico] = useState([]);
  const [loadingHist, setLoadingHist] = useState(true);

  async function loadHistorico() {
    setLoadingHist(true);
    try {
      const { data, error } = await supabase
        .from("ajustes_estoque")
        .select("*, bebida:bebidas(nome)")
        .order("criado_em", { ascending: false })
        .limit(20);
      if (error) throw error;
      setHistorico(data || []);
    } catch (e) {
      toast(`Erro ao carregar histórico: ${e.message}`, "error");
    } finally {
      setLoadingHist(false);
    }
  }
  useEffect(() => { loadHistorico(); }, []);

  function handleSaved() {
    setModalOpen(false);
    refreshEstoque();
    loadHistorico();
  }

  return html`
    <div class="stack-6">
      <div><h1 class="h2" style="font-size:26px;">Estoque</h1><p class="muted-text" style="margin:4px 0 0;">Níveis atuais e ajustes manuais (perdas, quebras, contagens).</p></div>

      <div class="card">
        <h3 style="margin:0 0 16px;font-size:16px;">Situação atual</h3>
        ${estoque.length === 0 ? html`<${EmptyState}>Nenhum produto cadastrado.<//>` : html`
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Produto</th><th>Estoque atual</th><th>Mínimo</th><th>Status</th><th></th></tr></thead>
              <tbody>
                ${estoque.map((e) => {
                  const s = statusDe(Number(e.estoque_atual), Number(e.estoque_minimo));
                  return html`
                    <tr key=${e.bebida_id}>
                      <td><div class="cell-product"><${ImgThumb} src=${e.imagem_url} alt=${e.nome} /><div class="cell-title">${e.nome}</div></div></td>
                      <td class="bold">${e.estoque_atual}</td>
                      <td class="cell-sub">${e.estoque_minimo}</td>
                      <td><${Badge} tone=${s.tone}>${s.label}<//></td>
                      <td class="actions-cell">
                        <button class="btn btn-secondary btn-sm" onClick=${() => { setProdutoAjuste(e); setModalOpen(true); }}>Ajustar</button>
                      </td>
                    </tr>
                  `;
                })}
              </tbody>
            </table>
          </div>
        `}
        <p class="hint" style="margin-top:14px;">Pizzas são produzidas sob demanda e não entram no controle de estoque.</p>
      </div>

      <div class="card">
        <h3 style="margin:0 0 16px;font-size:16px;">Últimos ajustes manuais</h3>
        ${loadingHist ? html`<${LoadingState} />` : historico.length === 0 ? html`<${EmptyState}>Nenhum ajuste registrado.<//>` : html`
          ${historico.map((h) => html`
            <div key=${h.id} class="ledger-row">
              <div><div class="bold" style="font-size:12.5px;">${h.bebida?.nome}</div><div class="muted-text small">${h.motivo || "Sem motivo informado"} · ${dataHora(h.criado_em)}</div></div>
              <span class=${h.tipo === "entrada" ? "text-green bold" : "text-red bold"}>${h.tipo === "entrada" ? "+" : "-"}${h.quantidade}</span>
            </div>
          `)}
        `}
      </div>

      ${modalOpen ? html`<${AjusteModal} produto=${produtoAjuste} onClose=${() => setModalOpen(false)} onSaved=${handleSaved} />` : null}
    </div>
  `;
}

function AjusteModal({ produto, onClose, onSaved }) {
  const { toast } = useAppData();
  const [tipo, setTipo] = useState("entrada");
  const [quantidade, setQuantidade] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!quantidade || Number(quantidade) <= 0) { toast("Informe uma quantidade válida.", "error"); return; }
    setSaving(true);
    try {
      await insertRow("ajustes_estoque", { bebida_id: produto.bebida_id, tipo, quantidade: Number(quantidade), motivo: motivo || null });
      toast("Ajuste registrado.", "success");
      onSaved();
    } catch (e) {
      toast(`Erro ao salvar: ${e.message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  return html`
    <${Modal} title=${`Ajustar estoque — ${produto.nome}`} onClose=${onClose}>
      <form onSubmit=${handleSubmit} class="stack-4">
        <p class="muted-text small" style="margin:0;">Estoque atual: <strong>${produto.estoque_atual}</strong></p>
        <div class="pill-toggle">
          <button type="button" class=${tipo === "entrada" ? "active" : ""} onClick=${() => setTipo("entrada")}>Entrada</button>
          <button type="button" class=${tipo === "saida" ? "active" : ""} onClick=${() => setTipo("saida")}>Saída</button>
        </div>
        <div class="field"><label>Quantidade</label><input class="input" type="number" min="0.01" step="0.01" value=${quantidade} onInput=${(e) => setQuantidade(e.target.value)} required /></div>
        <div class="field"><label>Motivo</label><input class="input" value=${motivo} onInput=${(e) => setMotivo(e.target.value)} placeholder="Ex: quebra, contagem, perda de validade" /></div>
        <div class="row-between" style="justify-content:flex-end;gap:8px;">
          <button type="button" class="btn btn-secondary" onClick=${onClose}>Cancelar</button>
          <button type="submit" class="btn btn-primary" disabled=${saving}>${saving ? "Salvando…" : "Salvar"}</button>
        </div>
      </form>
    <//>
  `;
}
