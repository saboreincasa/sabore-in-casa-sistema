import { html, useState, useEffect, useMemo } from "../lib.js";
import { supabase } from "../supabaseClient.js";
import { useAppData } from "../store.js";
import { Kpi, LoadingState, EmptyState } from "../components/ui.js";
import { brl, pct, hojeISO } from "../format.js";

function primeiroDiaMes() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

export function RelatoriosPage() {
  const { toast } = useAppData();
  const [de, setDe] = useState(primeiroDiaMes());
  const [ate, setAte] = useState(hojeISO());
  const [vendas, setVendas] = useState([]);
  const [compras, setCompras] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const ateFim = `${ate}T23:59:59`;
      const [vRes, cRes] = await Promise.all([
        supabase.from("vendas").select("*, bebida:bebidas(nome), sabor:sabores_pizza(nome), lanche:lanches(nome), combo:combos(nome), canal:canais_venda(nome)").gte("criado_em", `${de}T00:00:00`).lte("criado_em", ateFim),
        supabase.from("compras").select("*, fornecedor:fornecedores(nome)").gte("data", de).lte("data", ate),
      ]);
      if (vRes.error) throw vRes.error;
      if (cRes.error) throw cRes.error;
      setVendas(vRes.data || []);
      setCompras(cRes.data || []);
    } catch (e) {
      toast(`Erro ao gerar relatório: ${e.message}`, "error");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, [de, ate]);

  const totalVendas = useMemo(() => vendas.reduce((s, v) => s + v.preco_unitario * v.quantidade, 0), [vendas]);
  const totalCusto = useMemo(() => vendas.reduce((s, v) => s + v.custo_unitario * v.quantidade, 0), [vendas]);
  const lucro = totalVendas - totalCusto;
  const margem = totalVendas > 0 ? (lucro / totalVendas) * 100 : 0;
  const totalCompras = useMemo(() => compras.reduce((s, c) => s + c.custo_unitario * c.quantidade, 0), [compras]);

  const porCanal = useMemo(() => {
    const map = {};
    for (const v of vendas) {
      const nome = v.canal?.nome || "—";
      map[nome] = map[nome] || { nome, qtd: 0, total: 0 };
      map[nome].qtd += Number(v.quantidade);
      map[nome].total += v.preco_unitario * v.quantidade;
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [vendas]);

  const porProduto = useMemo(() => {
    const map = {};
    for (const v of vendas) {
      const nome = v.tipo === "pizza" ? `${v.sabor?.nome || "?"} (${v.tamanho})`
        : v.tipo === "lanche" ? v.lanche?.nome || "?"
        : v.tipo === "combo" ? v.combo?.nome || "?"
        : v.bebida?.nome || "?";
      map[nome] = map[nome] || { nome, qtd: 0, total: 0 };
      map[nome].qtd += Number(v.quantidade);
      map[nome].total += v.preco_unitario * v.quantidade;
    }
    return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 10);
  }, [vendas]);

  const porFornecedor = useMemo(() => {
    const map = {};
    for (const c of compras) {
      const nome = c.fornecedor?.nome || "Sem fornecedor";
      map[nome] = map[nome] || { nome, total: 0 };
      map[nome].total += c.custo_unitario * c.quantidade;
    }
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [compras]);

  const maxProduto = Math.max(1, ...porProduto.map((p) => p.total));

  return html`
    <div class="stack-6">
      <div class="row-between">
        <div><h1 class="h2" style="font-size:26px;">Relatórios</h1><p class="muted-text" style="margin:4px 0 0;">Desempenho de vendas e compras no período.</p></div>
        <div style="display:flex;gap:8px;align-items:center;">
          <input class="input" type="date" value=${de} onInput=${(e) => setDe(e.target.value)} />
          <span class="muted-text">até</span>
          <input class="input" type="date" value=${ate} onInput=${(e) => setAte(e.target.value)} />
        </div>
      </div>

      ${loading ? html`<${LoadingState} />` : html`
        <div class="kpi-row">
          <div class="card kpi"><${Kpi} icon="🛒" label="Total vendido" value=${brl(totalVendas)} sub=${`${vendas.length} venda(s)`} tone="brown" /></div>
          <div class="card kpi"><${Kpi} icon="📦" label="Custo das vendas" value=${brl(totalCusto)} tone="gold" /></div>
          <div class="card kpi"><${Kpi} icon="📈" label="Lucro bruto" value=${brl(lucro)} sub=${`Margem: ${pct(margem)}`} tone="green" /></div>
          <div class="card kpi"><${Kpi} icon="🚚" label="Total comprado" value=${brl(totalCompras)} tone="red" /></div>
        </div>

        <div class="grid-2">
          <div class="card">
            <h3 style="margin:0 0 16px;font-size:16px;">Vendas por canal</h3>
            ${porCanal.length === 0 ? html`<${EmptyState}>Sem vendas no período.<//>` : html`
              <div class="table-wrap">
                <table class="data-table">
                  <thead><tr><th>Canal</th><th>Qtd.</th><th>Total</th></tr></thead>
                  <tbody>${porCanal.map((c) => html`<tr key=${c.nome}><td class="cell-title">${c.nome}</td><td>${c.qtd}</td><td class="bold">${brl(c.total)}</td></tr>`)}</tbody>
                </table>
              </div>
            `}
          </div>

          <div class="card">
            <h3 style="margin:0 0 16px;font-size:16px;">Compras por fornecedor</h3>
            ${porFornecedor.length === 0 ? html`<${EmptyState}>Sem compras no período.<//>` : html`
              <div class="table-wrap">
                <table class="data-table">
                  <thead><tr><th>Fornecedor</th><th>Total gasto</th></tr></thead>
                  <tbody>${porFornecedor.map((f) => html`<tr key=${f.nome}><td class="cell-title">${f.nome}</td><td class="bold text-red">${brl(f.total)}</td></tr>`)}</tbody>
                </table>
              </div>
            `}
          </div>
        </div>

        <div class="card">
          <h3 style="margin:0 0 16px;font-size:16px;">Top 10 produtos mais vendidos (por valor)</h3>
          ${porProduto.length === 0 ? html`<${EmptyState}>Sem vendas no período.<//>` : html`
            <div class="stack-2">
              ${porProduto.map((p) => html`
                <div key=${p.nome}>
                  <div class="row-between" style="font-size:12.5px;margin-bottom:3px;">
                    <span class="bold">${p.nome} <span class="muted-text">(${p.qtd} un.)</span></span>
                    <span>${brl(p.total)}</span>
                  </div>
                  <div style="height:8px;border-radius:999px;background:var(--bg2);overflow:hidden;">
                    <div style="height:100%;background:var(--olive);width:${(p.total / maxProduto) * 100}%;"></div>
                  </div>
                </div>
              `)}
            </div>
          `}
        </div>
      `}
    </div>
  `;
}
