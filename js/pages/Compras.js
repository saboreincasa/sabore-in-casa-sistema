import { html, useState, useEffect } from "../lib.js";
import { supabase } from "../supabaseClient.js";
import { useAppData, insertRow, updateRow, deleteRow } from "../store.js";
import { Modal, useConfirm, LoadingState, EmptyState, ImgThumb } from "../components/ui.js";
import { brl, dataCurta, dataHora, hojeISO } from "../format.js";

export function ComprasPage() {
  const { bebidas, lanches, tabacaria, fornecedores, toast, isAdmin, refreshEstoque, refreshEstoqueLanches, refreshEstoqueTabacaria } = useAppData();
  const [compras, setCompras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, confirmNode] = useConfirm();

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("compras")
        .select("*, bebida:bebidas(nome, imagem_url, embalagem), lanche:lanches(nome, imagem_url), tabacaria:tabacaria(nome, imagem_url), fornecedor:fornecedores(nome)")
        .order("criado_em", { ascending: false })
        .limit(200);
      if (error) throw error;
      setCompras(data || []);
    } catch (e) {
      toast(`Erro ao carregar compras: ${e.message}`, "error");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  function handleSaved() {
    setModalOpen(false);
    load();
    refreshEstoque();
    refreshEstoqueLanches();
    refreshEstoqueTabacaria();
  }

  function handleDelete(row) {
    const nome = row.bebida?.nome || row.lanche?.nome || row.tabacaria?.nome;
    confirm(`Excluir a compra de "${nome}"? O estoque será ajustado automaticamente.`, async () => {
      try {
        await deleteRow("compras", row.id);
        toast("Compra excluída.", "success");
        load();
        refreshEstoque();
        refreshEstoqueLanches();
        refreshEstoqueTabacaria();
      } catch (e) {
        toast(`Erro ao excluir: ${e.message}`, "error");
      }
    });
  }

  return html`
    <div class="stack-6">
      <div class="row-between">
        <div><h1 class="h2" style="font-size:26px;">Compras</h1><p class="muted-text" style="margin:4px 0 0;">Registre entradas de insumos e reponha o estoque.</p></div>
        <button class="btn btn-primary" disabled=${bebidas.length === 0 && lanches.length === 0 && tabacaria.length === 0} onClick=${() => { setEditing(null); setModalOpen(true); }}>+ Registrar Compra</button>
      </div>

      <div class="card">
        <h3 style="margin:0 0 16px;font-size:16px;">Histórico de compras</h3>
        ${loading ? html`<${LoadingState} />` : compras.length === 0 ? html`<${EmptyState}>Nenhuma compra registrada ainda.<//>` : html`
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Produto</th><th>Fornecedor</th><th>Qtd.</th><th>Custo Unit.</th><th>Total</th><th>Data</th><th></th></tr></thead>
              <tbody>
                ${compras.map((c) => {
                  const item = c.bebida || c.lanche || c.tabacaria;
                  return html`
                  <tr key=${c.id}>
                    <td><div class="cell-product"><${ImgThumb} src=${item?.imagem_url} alt=${item?.nome} /><div><div class="cell-title">${item?.nome}</div><div class="cell-sub">${c.bebida?.embalagem || ""}</div></div></div></td>
                    <td>${c.fornecedor?.nome || "—"}</td>
                    <td>${c.quantidade}</td>
                    <td>${brl(c.custo_unitario)}</td>
                    <td class="bold">${brl(c.custo_unitario * c.quantidade)}</td>
                    <td class="cell-sub">${dataCurta(c.data)}</td>
                    <td class="actions-cell">
                      <button class="icon-btn" title="Editar" onClick=${() => { setEditing(c); setModalOpen(true); }}>✏️</button>
                      ${isAdmin ? html`<button class="icon-btn" title="Excluir" onClick=${() => handleDelete(c)}>🗑️</button>` : null}
                    </td>
                  </tr>
                `;})}
              </tbody>
            </table>
          </div>
        `}
      </div>

      ${modalOpen ? html`<${CompraModal} editing=${editing} onClose=${() => setModalOpen(false)} onSaved=${handleSaved} />` : null}
      ${confirmNode}
    </div>
  `;
}

function CompraModal({ editing, onClose, onSaved }) {
  const { bebidas, lanches, tabacaria, fornecedores, toast } = useAppData();
  const [tipo, setTipo] = useState(editing?.lanche_id ? "lanche" : editing?.tabacaria_id ? "tabacaria" : "bebida");
  const [bebidaId, setBebidaId] = useState(editing?.bebida_id || bebidas[0]?.id || "");
  const [lancheId, setLancheId] = useState(editing?.lanche_id || lanches[0]?.id || "");
  const [tabacariaId, setTabacariaId] = useState(editing?.tabacaria_id || tabacaria[0]?.id || "");
  const [quantidade, setQuantidade] = useState(editing?.quantidade ?? "");
  const [custoUnitario, setCustoUnitario] = useState(editing?.custo_unitario ?? "");
  const [fornecedorId, setFornecedorId] = useState(editing?.fornecedor_id || "");
  const [data, setData] = useState(editing?.data || hojeISO());
  const [observacoes, setObservacoes] = useState(editing?.observacoes || "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (tipo === "bebida" && !bebidaId) { toast("Selecione um produto.", "error"); return; }
    if (tipo === "lanche" && !lancheId) { toast("Selecione um lanche.", "error"); return; }
    if (tipo === "tabacaria" && !tabacariaId) { toast("Selecione um produto.", "error"); return; }
    if (!quantidade || Number(quantidade) <= 0) { toast("Informe uma quantidade válida.", "error"); return; }
    if (custoUnitario === "" || Number(custoUnitario) < 0) { toast("Informe o custo unitário.", "error"); return; }
    setSaving(true);
    try {
      const payload = {
        bebida_id: tipo === "bebida" ? bebidaId : null,
        lanche_id: tipo === "lanche" ? lancheId : null,
        tabacaria_id: tipo === "tabacaria" ? tabacariaId : null,
        quantidade: Number(quantidade), custo_unitario: Number(custoUnitario),
        fornecedor_id: fornecedorId || null, data, observacoes: observacoes || null,
      };
      if (editing) {
        await updateRow("compras", editing.id, payload);
        toast("Compra atualizada.", "success");
      } else {
        await insertRow("compras", payload);
        toast("Compra registrada.", "success");
      }
      onSaved();
    } catch (e) {
      toast(`Erro ao salvar: ${e.message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  return html`
    <${Modal} title=${editing ? "Editar Compra" : "Registrar Compra"} onClose=${onClose}>
      <form onSubmit=${handleSubmit} class="stack-4">
        <div class="pill-toggle">
          <button type="button" class=${tipo === "bebida" ? "active" : ""} onClick=${() => setTipo("bebida")}>Bebida</button>
          <button type="button" class=${tipo === "lanche" ? "active" : ""} onClick=${() => setTipo("lanche")}>Lanche</button>
          <button type="button" class=${tipo === "tabacaria" ? "active" : ""} onClick=${() => setTipo("tabacaria")}>Tabacaria</button>
        </div>
        ${tipo === "bebida" ? html`
        <div class="field">
          <label>Produto</label>
          <select class="input" value=${bebidaId} onChange=${(e) => setBebidaId(e.target.value)} required>
            ${bebidas.map((b) => html`<option key=${b.id} value=${b.id}>${b.nome}</option>`)}
          </select>
        </div>
        ` : tipo === "lanche" ? html`
        <div class="field">
          <label>Lanche</label>
          <select class="input" value=${lancheId} onChange=${(e) => setLancheId(e.target.value)} required>
            ${lanches.map((l) => html`<option key=${l.id} value=${l.id}>${l.nome}</option>`)}
          </select>
        </div>
        ` : html`
        <div class="field">
          <label>Produto (Tabacaria)</label>
          <select class="input" value=${tabacariaId} onChange=${(e) => setTabacariaId(e.target.value)} required>
            ${tabacaria.map((t) => html`<option key=${t.id} value=${t.id}>${t.nome}</option>`)}
          </select>
        </div>
        `}
        <div class="form-grid cols-2">
          <div class="field">
            <label>Quantidade</label>
            <input class="input" type="number" min="0.01" step="0.01" value=${quantidade} onInput=${(e) => setQuantidade(e.target.value)} required />
          </div>
          <div class="field">
            <label>Custo unitário (R$)</label>
            <input class="input" type="number" min="0" step="0.01" value=${custoUnitario} onInput=${(e) => setCustoUnitario(e.target.value)} required />
          </div>
        </div>
        <div class="form-grid cols-2">
          <div class="field">
            <label>Fornecedor</label>
            <select class="input" value=${fornecedorId} onChange=${(e) => setFornecedorId(e.target.value)}>
              <option value="">Não informado</option>
              ${fornecedores.map((f) => html`<option key=${f.id} value=${f.id}>${f.nome}</option>`)}
            </select>
          </div>
          <div class="field">
            <label>Data</label>
            <input class="input" type="date" value=${data} onInput=${(e) => setData(e.target.value)} required />
          </div>
        </div>
        <div class="field">
          <label>Observações</label>
          <input class="input" value=${observacoes} onInput=${(e) => setObservacoes(e.target.value)} placeholder="Opcional" />
        </div>
        <div class="row-between" style="justify-content:flex-end;gap:8px;">
          <button type="button" class="btn btn-secondary" onClick=${onClose}>Cancelar</button>
          <button type="submit" class="btn btn-primary" disabled=${saving}>${saving ? "Salvando…" : "Salvar"}</button>
        </div>
      </form>
    <//>
  `;
}
