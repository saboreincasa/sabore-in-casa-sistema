import { html, useState, useEffect, useMemo } from "../lib.js";
import { supabase } from "../supabaseClient.js";
import { useAppData, insertRow } from "../store.js";
import { Modal, Badge, ImgThumb, EmptyState, LoadingState } from "../components/ui.js";
import { dataHora, dataCurta, brl, hojeISO } from "../format.js";

const NOME_TIPO = { bebida: "Bebida", lanche: "Lanche", tabacaria: "Tabacaria", insumo: "Insumo" };

function statusDe(atual, minimo) {
  if (atual <= 0) return { tone: "red", label: "Crítico" };
  if (atual <= minimo) return { tone: "gold", label: "Baixo" };
  return { tone: "green", label: "Saudável" };
}

function TabelaEstoque({ titulo, itens, idField, onAjustar }) {
  return html`
    <div class="card">
      <h3 style="margin:0 0 16px;font-size:16px;">${titulo}</h3>
      ${itens.length === 0 ? html`<${EmptyState}>Nenhum produto cadastrado.<//>` : html`
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Produto</th><th>Estoque atual</th><th>Mínimo</th><th>Status</th><th></th></tr></thead>
            <tbody>
              ${itens.map((e) => {
                const s = statusDe(Number(e.estoque_atual), Number(e.estoque_minimo));
                return html`
                  <tr key=${e[idField]}>
                    <td><div class="cell-product"><${ImgThumb} src=${e.imagem_url} alt=${e.nome} /><div class="cell-title">${e.nome}</div></div></td>
                    <td class="bold">${e.estoque_atual}</td>
                    <td class="cell-sub">${e.estoque_minimo}</td>
                    <td><${Badge} tone=${s.tone}>${s.label}<//></td>
                    <td class="actions-cell">
                      <button class="btn btn-secondary btn-sm" onClick=${() => onAjustar(e)}>Ajustar</button>
                    </td>
                  </tr>
                `;
              })}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;
}

export function EstoquePage() {
  const { estoque, estoqueLanches, estoqueTabacaria, estoqueInsumos, analiseEstoque, toast,
    refreshEstoque, refreshEstoqueLanches, refreshEstoqueTabacaria, refreshEstoqueInsumos, refreshAnaliseEstoque } = useAppData();
  const [modalOpen, setModalOpen] = useState(false);
  const [produtoAjuste, setProdutoAjuste] = useState(null);
  const [abaCategoria, setAbaCategoria] = useState("bebida");
  const [historico, setHistorico] = useState([]);
  const [loadingHist, setLoadingHist] = useState(true);
  const [reposicoes, setReposicoes] = useState([]);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [filtroProduto, setFiltroProduto] = useState("");
  const [filtroDe, setFiltroDe] = useState("");
  const [filtroAte, setFiltroAte] = useState("");

  async function loadHistorico() {
    setLoadingHist(true);
    try {
      const { data, error } = await supabase
        .from("ajustes_estoque")
        .select("*, bebida:bebidas(nome), lanche:lanches(nome), tabacaria:tabacaria(nome), insumo:insumos_pizza(nome)")
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

  async function loadReposicoes() {
    setLoadingRepos(true);
    try {
      const temFiltro = !!(filtroProduto || filtroDe || filtroAte);
      let q = supabase
        .from("movimentacoes_estoque")
        .select("*, bebida:bebidas(nome, unidades_por_caixa), lanche:lanches(nome, unidades_por_caixa), tabacaria:tabacaria(nome, unidades_por_caixa), insumo:insumos_pizza(nome), fornecedor:fornecedores(nome), responsavel:profiles(nome)")
        .eq("origem", "compra")
        .order("criado_em", { ascending: false })
        .limit(temFiltro ? 500 : 30);
      if (filtroDe) q = q.gte("criado_em", `${filtroDe}T00:00:00`);
      if (filtroAte) q = q.lte("criado_em", `${filtroAte}T23:59:59`);
      const { data, error } = await q;
      if (error) throw error;
      let rows = data || [];
      if (filtroProduto) {
        const [tipo, id] = filtroProduto.split(":");
        rows = rows.filter((r) => r.tipo_produto === tipo && (r.bebida_id || r.lanche_id || r.tabacaria_id || r.insumo_id) === id);
      }
      setReposicoes(rows);
    } catch (e) {
      toast(`Erro ao carregar histórico de reposição: ${e.message}`, "error");
    } finally {
      setLoadingRepos(false);
    }
  }

  useEffect(() => { loadHistorico(); }, []);
  useEffect(() => { loadReposicoes(); }, [filtroProduto, filtroDe, filtroAte]);

  function handleSaved() {
    setModalOpen(false);
    refreshEstoque();
    refreshEstoqueLanches();
    refreshEstoqueTabacaria();
    refreshEstoqueInsumos();
    refreshAnaliseEstoque();
    loadHistorico();
    loadReposicoes();
  }

  const media = useMemo(() => {
    const agora = Date.now();
    return [...analiseEstoque]
      .map((p) => {
        const inicio = p.primeira_venda_em ? new Date(p.primeira_venda_em).getTime() : null;
        const dias = inicio ? Math.max(1, (agora - inicio) / 86400000) : null;
        const mediaDiaria = dias ? Number(p.total_vendido) / dias : 0;
        return { ...p, mediaDiaria, diasParaAcabar: mediaDiaria > 0 ? Number(p.estoque_atual) / mediaDiaria : null };
      })
      .sort((a, b) => b.mediaDiaria - a.mediaDiaria);
  }, [analiseEstoque]);

  const abas = [
    { id: "bebida", titulo: "Bebidas", itens: estoque, idField: "bebida_id" },
    { id: "lanche", titulo: "Lanches", itens: estoqueLanches, idField: "lanche_id" },
    { id: "tabacaria", titulo: "Tabacaria", itens: estoqueTabacaria, idField: "tabacaria_id" },
    { id: "insumo", titulo: "Insumos (pizza)", itens: estoqueInsumos, idField: "insumo_id" },
  ];
  const abaAtiva = abas.find((a) => a.id === abaCategoria) || abas[0];

  return html`
    <div class="stack-6">
      <div><h1 class="h2" style="font-size:26px;">Estoque</h1><p class="muted-text" style="margin:4px 0 0;">Reposições, níveis atuais e ajustes manuais (perdas, quebras, contagens).</p></div>

      <div class="card">
        <div class="row-between" style="flex-wrap:wrap;gap:12px;">
          <div><h3 style="margin:0 0 4px;font-size:16px;">Histórico de reposição</h3>
          <p class="muted-text small" style="margin:0;">Cada compra registrada, com o estoque antes e depois da entrada — para reconstruir exatamente como chegamos ao saldo atual. As mais recentes aparecem primeiro.</p></div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
            <select class="input" value=${filtroProduto} onChange=${(e) => setFiltroProduto(e.target.value)}>
              <option value="">Todos os produtos</option>
              ${[...analiseEstoque].sort((a, b) => a.nome.localeCompare(b.nome)).map((p) => html`<option key=${`${p.tipo_produto}:${p.produto_id}`} value=${`${p.tipo_produto}:${p.produto_id}`}>${p.nome}</option>`)}
            </select>
            <input class="input" type="date" value=${filtroDe} onInput=${(e) => setFiltroDe(e.target.value)} />
            <span class="muted-text small">até</span>
            <input class="input" type="date" value=${filtroAte} onInput=${(e) => setFiltroAte(e.target.value)} />
            ${(filtroProduto || filtroDe || filtroAte) ? html`<button type="button" class="btn btn-secondary btn-sm" onClick=${() => { setFiltroProduto(""); setFiltroDe(""); setFiltroAte(""); }}>Limpar</button>` : null}
          </div>
        </div>
        <div style="height:16px;"></div>
        ${loadingRepos ? html`<${LoadingState} />` : reposicoes.length === 0 ? html`<${EmptyState}>Nenhuma reposição encontrada.<//>` : html`
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Data</th><th>Produto</th><th>Antes</th><th>Entrada</th><th>Depois</th><th>Fornecedor</th><th>Custo total</th><th>Responsável</th><th>Obs.</th></tr></thead>
              <tbody>
                ${reposicoes.map((r) => {
                  const upc = r.bebida?.unidades_por_caixa || r.lanche?.unidades_por_caixa || r.tabacaria?.unidades_por_caixa || null;
                  const qtd = Number(r.quantidade);
                  const emCaixas = upc && qtd % Number(upc) === 0 ? `${qtd} un (${qtd / Number(upc)} cx)` : `${qtd}`;
                  return html`
                  <tr key=${r.id}>
                    <td class="cell-sub">${dataHora(r.criado_em)}</td>
                    <td class="cell-title">${r.bebida?.nome || r.lanche?.nome || r.tabacaria?.nome || r.insumo?.nome}</td>
                    <td>${r.estoque_antes}</td>
                    <td class="text-green bold">+${emCaixas}</td>
                    <td class="bold">${r.estoque_depois}</td>
                    <td class="cell-sub">${r.fornecedor?.nome || "—"}</td>
                    <td>${r.custo_unitario != null ? brl(r.custo_unitario * r.quantidade) : "—"}</td>
                    <td class="cell-sub">${r.responsavel?.nome || "—"}</td>
                    <td class="cell-sub">${r.observacoes || "—"}</td>
                  </tr>
                `;})}
              </tbody>
            </table>
          </div>
        `}
      </div>

      <div class="card">
        <h3 style="margin:0 0 4px;font-size:16px;">Média de consumo por produto</h3>
        <p class="muted-text small" style="margin:0 0 16px;">Calculada a partir do histórico real de vendas desde a primeira venda registrada de cada produto. Quanto menos dias de histórico, menos confiável a média.</p>
        ${media.length === 0 ? html`<${EmptyState}>Sem dados suficientes ainda.<//>` : html`
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Produto</th><th>Tipo</th><th>Status</th><th>Comprado</th><th>Vendido</th><th>Estoque atual</th><th>Média/dia</th><th>Média/semana</th><th>Dias p/ acabar</th><th>Última reposição</th></tr></thead>
              <tbody>
                ${media.map((p) => {
                  const semVendas = Number(p.total_vendido) === 0;
                  const repoLogo = !semVendas && p.diasParaAcabar !== null && p.diasParaAcabar < 7;
                  const status = semVendas ? { tone: "neutral", label: "Sem vendas" } : repoLogo ? { tone: "red", label: "Repor logo" } : { tone: "green", label: "OK" };
                  return html`
                  <tr key=${`${p.tipo_produto}-${p.produto_id}`}>
                    <td class="cell-title">${p.nome}</td>
                    <td><span class="badge badge-neutral">${NOME_TIPO[p.tipo_produto]}</span></td>
                    <td><${Badge} tone=${status.tone}>${status.label}<//></td>
                    <td>${Number(p.total_comprado)}</td>
                    <td>${Number(p.total_vendido)}</td>
                    <td class="bold">${Number(p.estoque_atual)}</td>
                    <td>${p.mediaDiaria.toFixed(2)}</td>
                    <td>${(p.mediaDiaria * 7).toFixed(1)}</td>
                    <td class=${repoLogo ? "text-red bold" : ""}>${p.diasParaAcabar !== null ? Math.round(p.diasParaAcabar) : "—"}</td>
                    <td class="cell-sub">${p.ultima_reposicao_em ? dataCurta(p.ultima_reposicao_em) : "—"}</td>
                  </tr>
                `;})}
              </tbody>
            </table>
          </div>
        `}
      </div>

      <div>
        <div class="pill-toggle" style="margin-bottom:12px;">
          ${abas.map((a) => html`<button key=${a.id} type="button" class=${a.id === abaCategoria ? "active" : ""} onClick=${() => setAbaCategoria(a.id)}>${a.titulo}</button>`)}
        </div>
        <${TabelaEstoque} titulo=${`Níveis atuais — ${abaAtiva.titulo}`} itens=${abaAtiva.itens} idField=${abaAtiva.idField} onAjustar=${(e) => { setProdutoAjuste({ ...e, tipoItem: abaAtiva.id }); setModalOpen(true); }} />
        <p class="hint">Pizzas são produzidas sob demanda e não entram no controle de estoque. Vendas de combo no delivery baixam automaticamente as bebidas/lanches inclusos.</p>
      </div>

      <div class="card">
        <h3 style="margin:0 0 16px;font-size:16px;">Últimos ajustes manuais</h3>
        ${loadingHist ? html`<${LoadingState} />` : historico.length === 0 ? html`<${EmptyState}>Nenhum ajuste registrado.<//>` : html`
          ${historico.map((h) => html`
            <div key=${h.id} class="ledger-row">
              <div><div class="bold" style="font-size:12.5px;">${h.bebida?.nome || h.lanche?.nome || h.tabacaria?.nome || h.insumo?.nome}</div><div class="muted-text small">${h.motivo || "Sem motivo informado"} · ${dataHora(h.criado_em)}</div></div>
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
      const payload = { tipo, quantidade: Number(quantidade), motivo: motivo || null };
      if (produto.tipoItem === "lanche") payload.lanche_id = produto.lanche_id;
      else if (produto.tipoItem === "tabacaria") payload.tabacaria_id = produto.tabacaria_id;
      else if (produto.tipoItem === "insumo") payload.insumo_id = produto.insumo_id;
      else payload.bebida_id = produto.bebida_id;
      await insertRow("ajustes_estoque", payload);
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
