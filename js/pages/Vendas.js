import { html, useState, useEffect, useMemo } from "../lib.js";
import { supabase } from "../supabaseClient.js";
import { useAppData, insertRow, updateRow, deleteRow } from "../store.js";
import { Modal, useConfirm, LoadingState, EmptyState, ImgThumb } from "../components/ui.js";
import { brl, dataHora, precoSugerido } from "../format.js";

export function VendasPage() {
  const { toast, isAdmin, refreshEstoque } = useAppData();
  const [vendas, setVendas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, confirmNode] = useConfirm();

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("vendas")
        .select("*, bebida:bebidas(nome, imagem_url), sabor:sabores_pizza(nome, imagem_url), canal:canais_venda(nome), cliente:clientes(nome)")
        .order("criado_em", { ascending: false })
        .limit(200);
      if (error) throw error;
      setVendas(data || []);
    } catch (e) {
      toast(`Erro ao carregar vendas: ${e.message}`, "error");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  function handleSaved() { setModalOpen(false); load(); refreshEstoque(); }
  function handleDelete(v) {
    confirm("Excluir esta venda? O estoque e o caixa serão ajustados automaticamente.", async () => {
      try {
        await deleteRow("vendas", v.id);
        toast("Venda excluída.", "success");
        load(); refreshEstoque();
      } catch (e) {
        toast(`Erro ao excluir: ${e.message}`, "error");
      }
    });
  }

  return html`
    <div class="stack-6">
      <div class="row-between">
        <div><h1 class="h2" style="font-size:26px;">Vendas</h1><p class="muted-text" style="margin:4px 0 0;">Registre pedidos e acompanhe o histórico.</p></div>
        <button class="btn btn-primary" onClick=${() => { setEditing(null); setModalOpen(true); }}>+ Nova Venda</button>
      </div>

      <div class="card">
        <h3 style="margin:0 0 16px;font-size:16px;">Histórico de vendas</h3>
        ${loading ? html`<${LoadingState} />` : vendas.length === 0 ? html`<${EmptyState}>Nenhuma venda registrada ainda.<//>` : html`
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Produto</th><th>Canal</th><th>Cliente</th><th>Qtd.</th><th>Preço</th><th>Total</th><th>Data</th><th></th></tr></thead>
              <tbody>
                ${vendas.map((v) => {
                  const nome = v.tipo === "pizza" ? `${v.sabor?.nome} (${v.tamanho})` : v.bebida?.nome;
                  const img = v.tipo === "pizza" ? v.sabor?.imagem_url : v.bebida?.imagem_url;
                  return html`
                    <tr key=${v.id}>
                      <td><div class="cell-product"><${ImgThumb} src=${img} alt=${nome} /><div class="cell-title">${nome}</div></div></td>
                      <td><span class="badge badge-neutral">${v.canal?.nome}</span></td>
                      <td class="cell-sub">${v.cliente?.nome || "—"}</td>
                      <td>${v.quantidade}</td>
                      <td>${brl(v.preco_unitario)}</td>
                      <td class="bold text-green">${brl(v.preco_unitario * v.quantidade)}</td>
                      <td class="cell-sub">${dataHora(v.criado_em)}</td>
                      <td class="actions-cell">
                        <button class="icon-btn" title="Editar" onClick=${() => { setEditing(v); setModalOpen(true); }}>✏️</button>
                        ${isAdmin ? html`<button class="icon-btn" title="Excluir" onClick=${() => handleDelete(v)}>🗑️</button>` : null}
                      </td>
                    </tr>
                  `;
                })}
              </tbody>
            </table>
          </div>
        `}
      </div>

      ${modalOpen ? html`<${VendaModal} editing=${editing} onClose=${() => setModalOpen(false)} onSaved=${handleSaved} />` : null}
      ${confirmNode}
    </div>
  `;
}

function VendaModal({ editing, onClose, onSaved }) {
  const { bebidas, sabores, canais, clientes, config, estoque, toast } = useAppData();
  const [tipo, setTipo] = useState(editing?.tipo || "bebida");
  const [bebidaId, setBebidaId] = useState(editing?.bebida_id || bebidas[0]?.id || "");
  const [saborId, setSaborId] = useState(editing?.sabor_id || sabores[0]?.id || "");
  const [tamanho, setTamanho] = useState(editing?.tamanho || "M");
  const [canalId, setCanalId] = useState(editing?.canal_id || canais[0]?.id || "");
  const [quantidade, setQuantidade] = useState(editing?.quantidade ?? 1);
  const [clienteId, setClienteId] = useState(editing?.cliente_id || "");
  const [precoManual, setPrecoManual] = useState(editing ? String(editing.preco_unitario) : "");
  const [observacoes, setObservacoes] = useState(editing?.observacoes || "");
  const [saving, setSaving] = useState(false);

  const canal = canais.find((c) => c.id === canalId);
  const bebida = bebidas.find((b) => b.id === bebidaId);
  const sabor = sabores.find((s) => s.id === saborId);
  const custoUnitario = tipo === "bebida" ? Number(bebida?.custo || 0) : Number(sabor?.[`custo_${tamanho.toLowerCase()}`] || 0);
  const precoSugeridoCalc = canal ? precoSugerido(custoUnitario, config.margem_recomendada, canal.comissao_pct, canal.taxa_pagamento_pct) : null;
  const precoFinal = precoManual !== "" ? Number(precoManual) : precoSugeridoCalc;

  const estoqueDisponivel = useMemo(() => {
    if (tipo !== "bebida") return null;
    const linha = estoque.find((e) => e.bebida_id === bebidaId);
    const jaContado = editing && editing.tipo === "bebida" && editing.bebida_id === bebidaId ? Number(editing.quantidade) : 0;
    return linha ? Number(linha.estoque_atual) + jaContado : 0;
  }, [tipo, bebidaId, estoque, editing]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (tipo === "bebida" && !bebidaId) { toast("Selecione uma bebida.", "error"); return; }
    if (tipo === "pizza" && !saborId) { toast("Selecione um sabor.", "error"); return; }
    if (!canalId) { toast("Selecione o canal de venda.", "error"); return; }
    if (!quantidade || Number(quantidade) <= 0) { toast("Informe uma quantidade válida.", "error"); return; }
    if (precoFinal === null || precoFinal <= 0) { toast("Não foi possível calcular o preço. Revise a margem em Configurações.", "error"); return; }
    if (tipo === "bebida" && estoqueDisponivel !== null && Number(quantidade) > estoqueDisponivel) {
      toast(`Estoque insuficiente: disponível ${estoqueDisponivel}.`, "error");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        tipo,
        bebida_id: tipo === "bebida" ? bebidaId : null,
        sabor_id: tipo === "pizza" ? saborId : null,
        tamanho: tipo === "pizza" ? tamanho : null,
        canal_id: canalId,
        quantidade: Number(quantidade),
        preco_unitario: Number(precoFinal),
        custo_unitario: custoUnitario,
        cliente_id: clienteId || null,
        observacoes: observacoes || null,
      };
      if (editing) {
        await updateRow("vendas", editing.id, payload);
        toast("Venda atualizada.", "success");
      } else {
        await insertRow("vendas", payload);
        toast("Venda registrada.", "success");
      }
      onSaved();
    } catch (e) {
      toast(`Erro ao salvar: ${e.message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  return html`
    <${Modal} title=${editing ? "Editar Venda" : "Nova Venda"} onClose=${onClose}>
      <form onSubmit=${handleSubmit} class="stack-4">
        <div class="pill-toggle">
          <button type="button" class=${tipo === "bebida" ? "active" : ""} onClick=${() => setTipo("bebida")}>Bebida</button>
          <button type="button" class=${tipo === "pizza" ? "active" : ""} onClick=${() => setTipo("pizza")}>Pizza</button>
        </div>

        ${tipo === "bebida" ? html`
          <div class="field">
            <label>Produto</label>
            <select class="input" value=${bebidaId} onChange=${(e) => setBebidaId(e.target.value)}>
              ${bebidas.map((b) => html`<option key=${b.id} value=${b.id}>${b.nome}</option>`)}
            </select>
            ${estoqueDisponivel !== null ? html`<span class="hint">Disponível em estoque: ${estoqueDisponivel}</span>` : null}
          </div>
        ` : html`
          <div class="form-grid cols-2">
            <div class="field">
              <label>Sabor</label>
              <select class="input" value=${saborId} onChange=${(e) => setSaborId(e.target.value)}>
                ${sabores.map((s) => html`<option key=${s.id} value=${s.id}>${s.nome}</option>`)}
              </select>
            </div>
            <div class="field">
              <label>Tamanho</label>
              <select class="input" value=${tamanho} onChange=${(e) => setTamanho(e.target.value)}>
                <option value="P">Pequena</option><option value="M">Média</option><option value="G">Grande</option>
              </select>
            </div>
          </div>
        `}

        <div class="form-grid cols-2">
          <div class="field">
            <label>Canal de venda</label>
            <select class="input" value=${canalId} onChange=${(e) => setCanalId(e.target.value)}>
              ${canais.map((c) => html`<option key=${c.id} value=${c.id}>${c.nome}</option>`)}
            </select>
          </div>
          <div class="field">
            <label>Quantidade</label>
            <input class="input" type="number" min="1" step="1" value=${quantidade} onInput=${(e) => setQuantidade(e.target.value)} required />
          </div>
        </div>

        <div class="form-grid cols-2">
          <div class="field">
            <label>Cliente (opcional)</label>
            <select class="input" value=${clienteId} onChange=${(e) => setClienteId(e.target.value)}>
              <option value="">Não informado</option>
              ${clientes.map((c) => html`<option key=${c.id} value=${c.id}>${c.nome}</option>`)}
            </select>
          </div>
          <div class="field">
            <label>Preço unitário (R$)</label>
            <input class="input" type="number" min="0" step="0.01" placeholder=${precoSugeridoCalc ? `Sugerido: ${brl(precoSugeridoCalc)}` : "—"} value=${precoManual} onInput=${(e) => setPrecoManual(e.target.value)} />
          </div>
        </div>

        <div class="card tight" style="background:var(--bg2);">
          <div class="row-between"><span class="muted-text small">Custo unitário</span><span class="bold">${brl(custoUnitario)}</span></div>
          <div class="row-between"><span class="muted-text small">Total da venda</span><span class="bold text-green">${brl((precoFinal || 0) * Number(quantidade || 0))}</span></div>
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
