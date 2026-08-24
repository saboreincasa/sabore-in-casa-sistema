import { html, useState, useEffect } from "../lib.js";
import { supabase } from "../supabaseClient.js";
import { useAppData, updateRow } from "../store.js";
import { LoadingState, EmptyState } from "../components/ui.js";
import { brl, dataHora } from "../format.js";

const STATUS_INFO = {
  aguardando_pagamento: { label: "Aguardando pagamento", tone: "badge-gold" },
  pago: { label: "Pago", tone: "badge-green" },
  pagamento_recusado: { label: "Pagamento recusado", tone: "badge-red" },
  em_preparo: { label: "Em preparo", tone: "badge-neutral" },
  saiu_entrega: { label: "Saiu para entrega", tone: "badge-neutral" },
  entregue: { label: "Entregue", tone: "badge-green" },
  cancelado: { label: "Cancelado", tone: "badge-red" },
};

const PROXIMO_STATUS = {
  pago: [["em_preparo", "Marcar em preparo"]],
  em_preparo: [["saiu_entrega", "Marcar saiu p/ entrega"]],
  saiu_entrega: [["entregue", "Marcar entregue"]],
};

function nomeDoItem(item, { bebidas, sabores, lanches, combos }) {
  if (item.tipo === "pizza") return `${sabores.find((s) => s.id === item.sabor_id)?.nome || "Pizza"} (${item.tamanho})`;
  if (item.tipo === "bebida") return bebidas.find((b) => b.id === item.bebida_id)?.nome || "Bebida";
  if (item.tipo === "lanche") return lanches.find((l) => l.id === item.lanche_id)?.nome || "Lanche";
  if (item.tipo === "combo") return combos.find((c) => c.id === item.combo_id)?.nome || "Combo";
  return item.nome || "Item";
}

export function PedidosOnlinePage() {
  const { toast, bebidas, sabores, lanches, combos } = useAppData();
  const [pedidos, setPedidos] = useState([]);
  const [loading, setLoading] = useState(true);
  const catalogo = { bebidas, sabores, lanches, combos };

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase.from("pedidos").select("*").order("criado_em", { ascending: false }).limit(100);
      if (error) throw error;
      setPedidos(data || []);
    } catch (e) {
      toast(`Erro ao carregar pedidos: ${e.message}`, "error");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  async function avancarStatus(pedido, novoStatus) {
    try {
      await updateRow("pedidos", pedido.id, { status: novoStatus });
      toast("Status atualizado.", "success");
      load();
    } catch (e) {
      toast(`Erro ao atualizar: ${e.message}`, "error");
    }
  }

  const pendentesAtencao = pedidos.filter((p) => p.status === "aguardando_pagamento" || p.status === "pago" || p.status === "em_preparo" || p.status === "saiu_entrega");
  const historico = pedidos.filter((p) => !pendentesAtencao.includes(p)).slice(0, 30);

  function Cartao(p) {
    const itens = Array.isArray(p.itens) ? p.itens : [];
    const info = STATUS_INFO[p.status] || { label: p.status, tone: "badge-neutral" };
    const proximos = PROXIMO_STATUS[p.status] || [];
    return html`
      <div key=${p.id} class="card tight" style="background:var(--bg2);">
        <div class="row-between">
          <div>
            <div class="bold">${p.cliente_nome}</div>
            <div class="muted-text small">${p.cliente_telefone || "sem telefone"} · ${dataHora(p.criado_em)}</div>
          </div>
          <span class="badge ${info.tone}">${info.label}</span>
        </div>
        ${p.cliente_endereco ? html`<div class="muted-text small" style="margin-top:6px;">📍 ${p.cliente_endereco}</div>` : null}
        <ul style="margin:10px 0;padding-left:18px;font-size:13px;line-height:1.6;">
          ${itens.length === 0
            ? html`<li class="muted-text">Sem detalhe de itens (pedido antigo)</li>`
            : itens.map((it, i) => html`<li key=${i}>${it.quantidade || it.qtd || 1}x ${nomeDoItem(it, catalogo)}</li>`)}
        </ul>
        <div class="row-between">
          <span class="muted-text small">Total · ${p.forma_pagamento ? p.forma_pagamento.toUpperCase() : "—"}</span>
          <span class="bold text-green">${brl(p.total)}</span>
        </div>
        ${proximos.length
          ? html`<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap;">
              ${proximos.map(([status, label]) => html`<button key=${status} class="btn btn-secondary btn-sm" onClick=${() => avancarStatus(p, status)}>${label}</button>`)}
            </div>`
          : null}
      </div>
    `;
  }

  return html`
    <div class="stack-6">
      <div class="row-between">
        <div>
          <h1 class="h2" style="font-size:26px;">Pedidos Online</h1>
          <p class="muted-text" style="margin:4px 0 0;">Pedidos pagos por Pix/cartão no site — pago vira venda sozinho, aqui você acompanha o preparo e a entrega.</p>
        </div>
      </div>

      <div class="card">
        <h3 style="margin:0 0 16px;font-size:16px;">Precisam de atenção (${pendentesAtencao.length})</h3>
        ${loading
          ? html`<${LoadingState} />`
          : pendentesAtencao.length === 0
          ? html`<${EmptyState}>Nenhum pedido em andamento.<//>`
          : html`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;">${pendentesAtencao.map(Cartao)}</div>`}
      </div>

      <div class="card">
        <h3 style="margin:0 0 16px;font-size:16px;">Histórico recente</h3>
        ${historico.length === 0
          ? html`<${EmptyState}>Nada por aqui ainda.<//>`
          : html`<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;">${historico.map(Cartao)}</div>`}
      </div>
    </div>
  `;
}
