import { html, useState, useEffect, useMemo } from "../lib.js";
import { supabase } from "../supabaseClient.js";
import { useAppData } from "../store.js";
import { Kpi, Badge, ImgThumb, LoadingState, EmptyState } from "../components/ui.js";
import { brl, pct, dataHora, hojeISO, precoSugerido, precoBebidaSugerido, margemRealizada } from "../format.js";

export function DashboardPage({ setPage }) {
  const { bebidas, sabores, canais, config, estoque, toast } = useAppData();
  const [vendasHoje, setVendasHoje] = useState([]);
  const [caixaTudo, setCaixaTudo] = useState([]);
  const [ultimasCompras, setUltimasCompras] = useState([]);
  const [ultimosCaixa, setUltimosCaixa] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const hoje = hojeISO();
        const amanha = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
        const [vendasHojeRes, caixaRes, comprasRes, caixaLedgerRes, metaRes] = await Promise.all([
          supabase.from("vendas").select("*").gte("criado_em", `${hoje}T00:00:00`).lt("criado_em", `${amanha}T00:00:00`),
          supabase.from("v_caixa").select("tipo, valor"),
          supabase.from("compras").select("*, bebida:bebidas(nome, imagem_url), lanche:lanches(nome, imagem_url), tabacaria:tabacaria(nome, imagem_url), fornecedor:fornecedores(nome)").order("criado_em", { ascending: false }).limit(5),
          supabase.from("v_caixa").select("*").order("criado_em", { ascending: false }).limit(6),
          supabase.from("metas").select("*").eq("tipo", "diaria").eq("referencia", hoje).maybeSingle(),
        ]);
        if (cancelled) return;
        if (vendasHojeRes.error) throw vendasHojeRes.error;
        if (caixaRes.error) throw caixaRes.error;
        setVendasHoje(vendasHojeRes.data || []);
        setCaixaTudo(caixaRes.data || []);
        setUltimasCompras(comprasRes.data || []);
        setUltimosCaixa(caixaLedgerRes.data || []);
        setMeta(metaRes.data || null);
      } catch (e) {
        toast(`Erro ao carregar dashboard: ${e.message}`, "error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const caixaAtual = useMemo(() => caixaTudo.reduce((s, r) => s + (r.tipo === "entrada" ? Number(r.valor) : -Number(r.valor)), 0), [caixaTudo]);
  const vendasTotalHoje = useMemo(() => vendasHoje.reduce((s, v) => s + Number(v.preco_unitario) * Number(v.quantidade), 0), [vendasHoje]);
  const custoTotalHoje = useMemo(() => vendasHoje.reduce((s, v) => s + Number(v.custo_unitario) * Number(v.quantidade), 0), [vendasHoje]);
  const lucroBrutoHoje = vendasTotalHoje - custoTotalHoje;
  const margemHoje = vendasTotalHoje > 0 ? (lucroBrutoHoje / vendasTotalHoje) * 100 : 0;
  const unidadesEstoque = useMemo(() => estoque.reduce((s, e) => s + Number(e.estoque_atual), 0), [estoque]);
  const estoqueBaixo = useMemo(() => estoque.filter((e) => Number(e.estoque_atual) <= Number(e.estoque_minimo)).sort((a, b) => (a.estoque_atual - a.estoque_minimo) - (b.estoque_atual - b.estoque_minimo)), [estoque]);
  const ticketMedio = vendasHoje.length ? vendasTotalHoje / vendasHoje.length : 0;

  const resumoProdutos = useMemo(() => {
    const canalLocal = canais.find((c) => c.id === "local");
    if (!canalLocal) return [];
    const linhas = [];
    for (const b of bebidas.slice(0, 3)) {
      const preco = precoBebidaSugerido(b, config.margem_recomendada, canalLocal.comissao_pct, canalLocal.taxa_pagamento_pct);
      const lucro = preco ? preco - b.custo : 0;
      linhas.push({ id: b.id, nome: b.nome, sub: b.embalagem, img: b.imagem_url, custo: b.custo, preco, lucro });
    }
    for (const s of sabores.slice(0, 2)) {
      const preco = precoSugerido(s.custo_m, config.margem_recomendada, canalLocal.comissao_pct, canalLocal.taxa_pagamento_pct);
      const lucro = preco ? preco - s.custo_m : 0;
      linhas.push({ id: s.id, nome: s.nome, sub: "Pizza (M)", img: s.imagem_url, custo: s.custo_m, preco, lucro });
    }
    return linhas;
  }, [bebidas, sabores, canais, config]);

  if (loading) return html`<${LoadingState}>Carregando painel…<//>`;

  const metaValor = Number(meta?.valor_meta || 0);
  const metaPct = metaValor > 0 ? Math.min(100, (vendasTotalHoje / metaValor) * 100) : 0;
  const faltam = Math.max(0, metaValor - vendasTotalHoje);

  return html`
    <div class="stack-6">
      <div class="row-between">
        <div>
          <h1 class="h2" style="font-size:26px;">Bem-vindo! 👋</h1>
          <p class="muted-text" style="margin:4px 0 0;">Aqui está o resumo do seu negócio hoje.</p>
        </div>
        <div class="card tight" style="font-size:13px;font-weight:600;">📅 ${new Date().toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}</div>
      </div>

      <div class="kpi-row">
        <div class="card kpi"><${Kpi} icon="💰" label="Caixa atual" value=${brl(caixaAtual)} sub="Disponível em caixa" tone="olive" /></div>
        <div class="card kpi"><${Kpi} icon="🛒" label="Vendas do dia" value=${brl(vendasTotalHoje)} sub=${`${vendasHoje.length} venda(s)`} tone="brown" /></div>
        <div class="card kpi"><${Kpi} icon="📦" label="Custo dos produtos" value=${brl(custoTotalHoje)} sub="Custo das vendas de hoje" tone="gold" /></div>
        <div class="card kpi"><${Kpi} icon="📈" label="Lucro bruto" value=${brl(lucroBrutoHoje)} sub=${`Margem: ${pct(margemHoje)}`} tone="green" /></div>
        <div class="card kpi"><${Kpi} icon="🗃️" label="Produtos em estoque" value=${unidadesEstoque} sub=${`${bebidas.length + sabores.length} itens cadastrados`} tone="brown" /></div>
      </div>

      <div class="grid-2">
        <div class="card">
          <div class="row-between section-title">
            <h3 style="margin:0;font-size:16px;">Resumo de Produtos</h3>
            <button class="link-btn" onClick=${() => setPage("produtos")}>Ver todos</button>
          </div>
          ${resumoProdutos.length === 0 ? html`<${EmptyState}>Cadastre produtos para ver o resumo.<//>` : html`
            <div class="table-wrap">
              <table class="data-table">
                <thead><tr><th>Produto</th><th>Custo</th><th>Preço</th><th>Lucro</th></tr></thead>
                <tbody>
                  ${resumoProdutos.map((p) => html`
                    <tr key=${p.id}>
                      <td><div class="cell-product"><${ImgThumb} src=${p.img} alt=${p.nome} /><div><div class="cell-title">${p.nome}</div><div class="cell-sub">${p.sub}</div></div></div></td>
                      <td>${brl(p.custo)}</td>
                      <td>${p.preco ? brl(p.preco) : "—"}</td>
                      <td class="text-green">${p.lucro ? brl(p.lucro) : "—"}</td>
                    </tr>
                  `)}
                </tbody>
              </table>
            </div>
          `}
        </div>

        <div class="card">
          <h3 style="margin:0 0 16px;font-size:16px;">Meta do dia</h3>
          ${metaValor > 0 ? html`
            <div style="text-align:center;">
              <div style="width:140px;height:140px;margin:0 auto;border-radius:999px;display:flex;align-items:center;justify-content:center;background:conic-gradient(var(--olive) ${metaPct * 3.6}deg, var(--bg2) 0deg);">
                <div style="width:104px;height:104px;border-radius:999px;background:var(--card);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:22px;font-family:'Fraunces',serif;">${metaPct.toFixed(0)}%</div>
              </div>
              <div style="margin-top:12px;font-weight:700;font-size:18px;font-family:'Fraunces',serif;">${brl(vendasTotalHoje)}</div>
              <div class="muted-text small">de ${brl(metaValor)} — meta diária</div>
              <div class="grid-2" style="margin-top:16px;text-align:left;">
                <div class="card tight"><div class="label-muted">Faltam</div><div class="bold">${brl(faltam)}</div></div>
                <div class="card tight"><div class="label-muted">Ticket médio</div><div class="bold">${brl(ticketMedio)}</div></div>
              </div>
            </div>
          ` : html`
            <${EmptyState}>
              Nenhuma meta definida para hoje.
              <div style="margin-top:8px;"><button class="btn btn-secondary btn-sm" onClick=${() => setPage("metas")}>Definir meta</button></div>
            <//>
          `}
        </div>
      </div>

      <div class="grid-3">
        <div class="card">
          <div class="row-between section-title"><h3 style="margin:0;font-size:15px;">Entradas e Saídas</h3><button class="link-btn" onClick=${() => setPage("caixa")}>Ver mais</button></div>
          ${ultimosCaixa.length === 0 ? html`<${EmptyState}>Sem lançamentos ainda.<//>` : ultimosCaixa.map((l) => html`
            <div key=${l.id} class="ledger-row">
              <div><div class="bold" style="font-size:12.5px;">${l.categoria}</div><div class="muted-text small">${dataHora(l.criado_em)}</div></div>
              <span class=${l.tipo === "entrada" ? "text-green bold" : "text-red bold"}>${l.tipo === "entrada" ? "+" : "-"} ${brl(l.valor)}</span>
            </div>
          `)}
        </div>

        <div class="card">
          <div class="row-between section-title"><h3 style="margin:0;font-size:15px;">Últimas Compras</h3><button class="link-btn" onClick=${() => setPage("compras")}>Ver todas</button></div>
          ${ultimasCompras.length === 0 ? html`<${EmptyState}>Nenhuma compra registrada.<//>` : ultimasCompras.map((c) => html`
            <div key=${c.id} class="ledger-row">
              <div><div class="bold" style="font-size:12.5px;">${c.fornecedor?.nome || "Fornecedor"}</div><div class="muted-text small">${c.bebida?.nome || c.lanche?.nome || c.tabacaria?.nome} · ${dataHora(c.criado_em)}</div></div>
              <span class="text-red bold">${brl(c.custo_unitario * c.quantidade)}</span>
            </div>
          `)}
        </div>

        <div class="card">
          <div class="row-between section-title"><h3 style="margin:0;font-size:15px;">Estoque Baixo</h3><button class="link-btn" onClick=${() => setPage("estoque")}>Ver todos</button></div>
          ${estoqueBaixo.length === 0 ? html`<${EmptyState}>Tudo certo por aqui. 🎉<//>` : estoqueBaixo.slice(0, 4).map((e) => html`
            <div key=${e.bebida_id} class="ledger-row">
              <div class="cell-product"><${ImgThumb} src=${e.imagem_url} alt=${e.nome} size=${28} /><div class="bold" style="font-size:12.5px;">${e.nome}</div></div>
              <${Badge} tone=${e.estoque_atual <= 0 ? "red" : "gold"}>Estoque: ${e.estoque_atual}<//>
            </div>
          `)}
        </div>
      </div>
    </div>
  `;
}
