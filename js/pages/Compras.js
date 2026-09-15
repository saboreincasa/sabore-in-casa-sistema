import { html, useState, useEffect, useMemo } from "../lib.js";
import { supabase } from "../supabaseClient.js";
import { useAppData, insertRow, updateRow, deleteRow } from "../store.js";
import { Modal, useConfirm, LoadingState, EmptyState, ImgThumb } from "../components/ui.js";
import { brl, dataCurta, dataHora, hojeISO } from "../format.js";
import { parseNFeXML, sugerirProduto } from "../nfeParser.js";

export function ComprasPage() {
  const { bebidas, lanches, tabacaria, insumos, fornecedores, toast, isAdmin, refreshEstoque, refreshEstoqueLanches, refreshEstoqueTabacaria, refreshEstoqueInsumos, refreshAnaliseEstoque } = useAppData();
  const [compras, setCompras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [confirm, confirmNode] = useConfirm();

  async function load() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("compras")
        .select("*, bebida:bebidas(nome, imagem_url, embalagem), lanche:lanches(nome, imagem_url), tabacaria:tabacaria(nome, imagem_url), insumo:insumos_pizza(nome, imagem_url, unidade), fornecedor:fornecedores(nome)")
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
    refreshEstoqueInsumos();
    refreshAnaliseEstoque();
  }

  function handleDelete(row) {
    const nome = row.bebida?.nome || row.lanche?.nome || row.tabacaria?.nome || row.insumo?.nome;
    confirm(`Excluir a compra de "${nome}"? O estoque será ajustado automaticamente.`, async () => {
      try {
        await deleteRow("compras", row.id);
        toast("Compra excluída.", "success");
        load();
        refreshEstoque();
        refreshEstoqueLanches();
        refreshEstoqueTabacaria();
        refreshEstoqueInsumos();
        refreshAnaliseEstoque();
      } catch (e) {
        toast(`Erro ao excluir: ${e.message}`, "error");
      }
    });
  }

  return html`
    <div class="stack-6">
      <div class="row-between" style="flex-wrap:wrap;gap:10px;">
        <div><h1 class="h2" style="font-size:26px;">Compras</h1><p class="muted-text" style="margin:4px 0 0;">Registre entradas de insumos e reponha o estoque.</p></div>
        <div style="display:flex;gap:8px;">
          <button class="btn btn-secondary" onClick=${() => setImportOpen(true)}>📄 Importar NF-e (XML)</button>
          <button class="btn btn-primary" disabled=${bebidas.length === 0 && lanches.length === 0 && tabacaria.length === 0 && insumos.length === 0} onClick=${() => { setEditing(null); setModalOpen(true); }}>+ Registrar Compra</button>
        </div>
      </div>

      <div class="card">
        <h3 style="margin:0 0 16px;font-size:16px;">Histórico de compras</h3>
        ${loading ? html`<${LoadingState} />` : compras.length === 0 ? html`<${EmptyState}>Nenhuma compra registrada ainda.<//>` : html`
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Produto</th><th>Fornecedor</th><th>Qtd.</th><th>Custo Unit.</th><th>Total</th><th>Data</th><th></th></tr></thead>
              <tbody>
                ${compras.map((c) => {
                  const item = c.bebida || c.lanche || c.tabacaria || c.insumo;
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
      ${importOpen ? html`<${ImportarNotaModal} onClose=${() => setImportOpen(false)} onSaved=${() => { setImportOpen(false); handleSaved(); }} />` : null}
      ${confirmNode}
    </div>
  `;
}

function ImportarNotaModal({ onClose, onSaved }) {
  const { bebidas, lanches, tabacaria, insumos, fornecedores, toast } = useAppData();
  const [notaInfo, setNotaInfo] = useState(null);
  const [linhas, setLinhas] = useState([]);
  const [fornecedorId, setFornecedorId] = useState("");
  const [dataCompra, setDataCompra] = useState(hojeISO());
  const [erro, setErro] = useState("");
  const [importando, setImportando] = useState(false);

  const catalogo = useMemo(() => [
    ...bebidas.map((b) => ({ tipo: "bebida", id: b.id, nome: b.nome })),
    ...lanches.map((l) => ({ tipo: "lanche", id: l.id, nome: l.nome })),
    ...tabacaria.map((t) => ({ tipo: "tabacaria", id: t.id, nome: t.nome })),
    ...insumos.map((i) => ({ tipo: "insumo", id: i.id, nome: i.nome })),
  ], [bebidas, lanches, tabacaria, insumos]);

  const opcoesPorTipo = { bebida: bebidas, lanche: lanches, tabacaria: tabacaria, insumo: insumos };

  async function handleArquivo(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErro("");
    try {
      const texto = await file.text();
      const nota = parseNFeXML(texto);
      setNotaInfo(nota);
      if (nota.data) setDataCompra(nota.data);

      const forneceMatch = fornecedores.find((f) => {
        const nomeXml = (nota.fornecedor.nome || "").toUpperCase();
        return nomeXml.includes(f.nome.toUpperCase()) || f.nome.toUpperCase().includes(nomeXml.split(" ")[0] || "\0");
      });
      setFornecedorId(forneceMatch?.id || "");

      setLinhas(nota.itens.map((item) => {
        const sugestao = sugerirProduto(item.xProd, catalogo);
        return {
          key: item.nItem,
          xProd: item.xProd,
          incluir: !!sugestao,
          tipo: sugestao?.tipo || "",
          produtoId: sugestao?.id || "",
          quantidade: item.qTrib,
          custoUnitario: item.vUnTrib,
        };
      }));
    } catch (err) {
      setErro(err.message);
      setNotaInfo(null);
      setLinhas([]);
    }
  }

  function atualizarLinha(key, patch) {
    setLinhas((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  const selecionadas = linhas.filter((l) => l.incluir && l.tipo && l.produtoId && Number(l.quantidade) > 0);
  const totalSelecionado = selecionadas.reduce((s, l) => s + Number(l.quantidade) * Number(l.custoUnitario), 0);

  async function handleImportar() {
    if (selecionadas.length === 0) { toast("Selecione ao menos um item válido para lançar.", "error"); return; }
    setImportando(true);
    try {
      const obs = `NF-e ${notaInfo.numero}/${notaInfo.serie} (${notaInfo.fornecedor.nome || "fornecedor não identificado"})`;
      for (const l of selecionadas) {
        await insertRow("compras", {
          [`${l.tipo}_id`]: l.produtoId,
          quantidade: Number(l.quantidade),
          custo_unitario: Number(l.custoUnitario),
          fornecedor_id: fornecedorId || null,
          data: dataCompra,
          observacoes: obs,
        });
      }
      toast(`${selecionadas.length} compra(s) lançada(s) a partir da NF-e.`, "success");
      onSaved();
    } catch (e) {
      toast(`Erro ao importar: ${e.message}`, "error");
    } finally {
      setImportando(false);
    }
  }

  return html`
    <${Modal} title="Importar NF-e (XML)" onClose=${onClose} wide=${true}>
      <div class="stack-4">
        ${!notaInfo ? html`
          <div class="field">
            <label>Arquivo XML da nota fiscal</label>
            <input class="input" type="file" accept=".xml,text/xml" onChange=${handleArquivo} />
            <p class="hint" style="margin:8px 0 0;">Não é a foto/PDF — é o arquivo .xml da NF-e (baixe no portal do fornecedor, ex: BEES da Ambev, ou peça por email). O sistema lê os campos oficiais de quantidade e preço, sem IA e sem custo.</p>
          </div>
          ${erro ? html`<p class="text-red small">${erro}</p>` : null}
        ` : html`
          <div class="card tight" style="background:var(--bg2);">
            <div class="row-between"><span class="muted-text small">Fornecedor (na nota)</span><span class="bold">${notaInfo.fornecedor.nome || "—"}</span></div>
            <div class="row-between"><span class="muted-text small">NF-e</span><span>${notaInfo.numero}/${notaInfo.serie}</span></div>
            <div class="row-between"><span class="muted-text small">Chave de acesso</span><span class="cell-sub">${notaInfo.chave || "—"}</span></div>
          </div>

          <div class="form-grid cols-2">
            <div class="field">
              <label>Lançar como fornecedor</label>
              <select class="input" value=${fornecedorId} onChange=${(e) => setFornecedorId(e.target.value)}>
                <option value="">Não informado</option>
                ${fornecedores.map((f) => html`<option key=${f.id} value=${f.id}>${f.nome}</option>`)}
              </select>
            </div>
            <div class="field">
              <label>Data da compra</label>
              <input class="input" type="date" value=${dataCompra} onInput=${(e) => setDataCompra(e.target.value)} required />
            </div>
          </div>

          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th></th><th>Descrição na nota</th><th>Categoria</th><th>Produto no catálogo</th><th>Qtd.</th><th>Custo unit.</th></tr></thead>
              <tbody>
                ${linhas.map((l) => html`
                  <tr key=${l.key}>
                    <td><input type="checkbox" checked=${l.incluir} onChange=${(e) => atualizarLinha(l.key, { incluir: e.target.checked })} /></td>
                    <td class="cell-sub" style="max-width:220px;">${l.xProd}</td>
                    <td>
                      <select class="input" value=${l.tipo} onChange=${(e) => atualizarLinha(l.key, { tipo: e.target.value, produtoId: "" })}>
                        <option value="">— nenhuma —</option>
                        <option value="bebida">Bebida</option>
                        <option value="lanche">Lanche</option>
                        <option value="tabacaria">Tabacaria</option>
                        <option value="insumo">Insumo</option>
                      </select>
                    </td>
                    <td>
                      <select class="input" value=${l.produtoId} onChange=${(e) => atualizarLinha(l.key, { produtoId: e.target.value })} disabled=${!l.tipo}>
                        <option value="">Selecione…</option>
                        ${(opcoesPorTipo[l.tipo] || []).map((p) => html`<option key=${p.id} value=${p.id}>${p.nome}</option>`)}
                      </select>
                    </td>
                    <td><input class="input" type="number" min="0" step="0.01" value=${l.quantidade} onInput=${(e) => atualizarLinha(l.key, { quantidade: e.target.value })} style="width:80px;" /></td>
                    <td><input class="input" type="number" min="0" step="0.0001" value=${l.custoUnitario} onInput=${(e) => atualizarLinha(l.key, { custoUnitario: e.target.value })} style="width:90px;" /></td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>
          <p class="hint">Itens sem produto correspondente no catálogo ficam desmarcados — escolha manualmente ou deixe de fora. Nada é lançado sem você conferir.</p>
        `}

        <div class="row-between" style="justify-content:flex-end;gap:8px;align-items:center;">
          ${notaInfo ? html`<span class="muted-text small" style="margin-right:auto;">${selecionadas.length} de ${linhas.length} selecionados · ${brl(totalSelecionado)}</span>` : null}
          <button type="button" class="btn btn-secondary" onClick=${onClose}>Cancelar</button>
          ${notaInfo ? html`<button type="button" class="btn btn-primary" disabled=${importando || selecionadas.length === 0} onClick=${handleImportar}>${importando ? "Lançando…" : `Lançar ${selecionadas.length} compra(s)`}</button>` : null}
        </div>
      </div>
    <//>
  `;
}

function CompraModal({ editing, onClose, onSaved }) {
  const { bebidas, lanches, tabacaria, insumos, fornecedores, toast } = useAppData();
  const [tipo, setTipo] = useState(editing?.lanche_id ? "lanche" : editing?.tabacaria_id ? "tabacaria" : editing?.insumo_id ? "insumo" : "bebida");
  const [bebidaId, setBebidaId] = useState(editing?.bebida_id || bebidas[0]?.id || "");
  const [lancheId, setLancheId] = useState(editing?.lanche_id || lanches[0]?.id || "");
  const [tabacariaId, setTabacariaId] = useState(editing?.tabacaria_id || tabacaria[0]?.id || "");
  const [insumoId, setInsumoId] = useState(editing?.insumo_id || insumos[0]?.id || "");
  const [quantidade, setQuantidade] = useState(editing?.quantidade ?? "");
  const [custoUnitario, setCustoUnitario] = useState(editing?.custo_unitario ?? "");
  const [numCaixas, setNumCaixas] = useState("");
  const [valorCaixa, setValorCaixa] = useState("");
  const [fornecedorId, setFornecedorId] = useState(editing?.fornecedor_id || "");
  const [data, setData] = useState(editing?.data || hojeISO());
  const [observacoes, setObservacoes] = useState(editing?.observacoes || "");
  const [saving, setSaving] = useState(false);

  const produtoSelecionado = tipo === "bebida" ? bebidas.find((b) => b.id === bebidaId)
    : tipo === "lanche" ? lanches.find((l) => l.id === lancheId)
    : tipo === "tabacaria" ? tabacaria.find((t) => t.id === tabacariaId)
    : insumos.find((i) => i.id === insumoId);
  const unidadesPorCaixa = produtoSelecionado?.unidades_por_caixa ? Number(produtoSelecionado.unidades_por_caixa) : null;

  useEffect(() => {
    if (!unidadesPorCaixa) return;
    if (numCaixas !== "") setQuantidade(String(Number(numCaixas) * unidadesPorCaixa));
    if (valorCaixa !== "") setCustoUnitario((Number(valorCaixa) / unidadesPorCaixa).toFixed(4));
  }, [numCaixas, valorCaixa, unidadesPorCaixa]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (tipo === "bebida" && !bebidaId) { toast("Selecione um produto.", "error"); return; }
    if (tipo === "lanche" && !lancheId) { toast("Selecione um lanche.", "error"); return; }
    if (tipo === "tabacaria" && !tabacariaId) { toast("Selecione um produto.", "error"); return; }
    if (tipo === "insumo" && !insumoId) { toast("Selecione um insumo.", "error"); return; }
    if (!quantidade || Number(quantidade) <= 0) { toast("Informe uma quantidade válida.", "error"); return; }
    if (custoUnitario === "" || Number(custoUnitario) < 0) { toast("Informe o custo unitário.", "error"); return; }
    setSaving(true);
    try {
      const payload = {
        bebida_id: tipo === "bebida" ? bebidaId : null,
        lanche_id: tipo === "lanche" ? lancheId : null,
        tabacaria_id: tipo === "tabacaria" ? tabacariaId : null,
        insumo_id: tipo === "insumo" ? insumoId : null,
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
          <button type="button" class=${tipo === "insumo" ? "active" : ""} onClick=${() => setTipo("insumo")}>Insumo</button>
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
        ` : tipo === "tabacaria" ? html`
        <div class="field">
          <label>Produto (Tabacaria)</label>
          <select class="input" value=${tabacariaId} onChange=${(e) => setTabacariaId(e.target.value)} required>
            ${tabacaria.map((t) => html`<option key=${t.id} value=${t.id}>${t.nome}</option>`)}
          </select>
        </div>
        ` : html`
        <div class="field">
          <label>Insumo</label>
          <select class="input" value=${insumoId} onChange=${(e) => setInsumoId(e.target.value)} required>
            ${insumos.map((i) => html`<option key=${i.id} value=${i.id}>${i.nome}</option>`)}
          </select>
        </div>
        `}
        ${unidadesPorCaixa ? html`
        <div class="field">
          <label>Comprado em caixa (opcional) — 1 caixa = ${unidadesPorCaixa} un.</label>
          <div class="form-grid cols-2">
            <input class="input" type="number" min="0" step="1" placeholder="Nº de caixas" value=${numCaixas} onInput=${(e) => setNumCaixas(e.target.value)} />
            <input class="input" type="number" min="0" step="0.01" placeholder="Valor pago pela caixa (R$)" value=${valorCaixa} onInput=${(e) => setValorCaixa(e.target.value)} />
          </div>
          <p class="hint" style="margin:4px 0 0;">Preenche quantidade e custo unitário abaixo automaticamente.</p>
        </div>
        ` : null}
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
