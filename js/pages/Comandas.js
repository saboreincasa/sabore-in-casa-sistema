import { html, useState, useEffect } from "../lib.js";
import { supabase } from "../supabaseClient.js";
import { useAppData, insertRow, updateRow, deleteRow } from "../store.js";
import { Modal, useConfirm, LoadingState, EmptyState } from "../components/ui.js";
import { brl, dataHora, precoSugerido, precoBebidaSugerido } from "../format.js";

export const FORMAS_PAGAMENTO = [
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao", label: "Cartão" },
  { value: "pix", label: "Pix" },
];

function nomeDoItem(v) {
  if (v.tipo === "pizza") return `${v.sabor?.nome || "?"} (${v.tamanho})`;
  if (v.tipo === "lanche") return v.lanche?.nome || "?";
  if (v.tipo === "combo") return v.combo?.nome || "?";
  return v.bebida?.nome || "?";
}

export function ComandasPage() {
  const { toast, isAdmin, canais, refreshEstoque, refreshEstoqueLanches } = useAppData();
  const [comandas, setComandas] = useState([]);
  const [itensPorComanda, setItensPorComanda] = useState({});
  const [loading, setLoading] = useState(true);
  const [novaOpen, setNovaOpen] = useState(false);
  const [ativa, setAtiva] = useState(null);
  const [fechando, setFechando] = useState(null);
  const [confirm, confirmNode] = useConfirm();

  async function load() {
    setLoading(true);
    try {
      const { data: comandasData, error } = await supabase
        .from("comandas")
        .select("*, cliente:clientes(nome)")
        .order("aberta_em", { ascending: false })
        .limit(100);
      if (error) throw error;
      setComandas(comandasData || []);

      const { data: vendasData, error: vErr } = await supabase
        .from("vendas")
        .select("*, bebida:bebidas(nome), sabor:sabores_pizza(nome), lanche:lanches(nome), combo:combos(nome)")
        .not("comanda_id", "is", null)
        .order("criado_em", { ascending: true });
      if (vErr) throw vErr;
      const grouped = {};
      (vendasData || []).forEach((v) => {
        (grouped[v.comanda_id] ||= []).push(v);
      });
      setItensPorComanda(grouped);
    } catch (e) {
      toast(`Erro ao carregar comandas: ${e.message}`, "error");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const abertas = comandas.filter((c) => c.status === "aberta");
  const fechadasRecentes = comandas.filter((c) => c.status !== "aberta").slice(0, 15);

  function totalDaComanda(id) {
    return (itensPorComanda[id] || []).reduce((s, v) => s + Number(v.preco_unitario) * Number(v.quantidade), 0);
  }

  async function handleAbrir(identificador, clienteId) {
    try {
      await insertRow("comandas", { identificador, cliente_id: clienteId || null });
      toast("Comanda aberta.", "success");
      setNovaOpen(false);
      load();
    } catch (e) {
      toast(`Erro ao abrir comanda: ${e.message}`, "error");
    }
  }

  async function handleFechar(comanda, formaPagamento) {
    try {
      await updateRow("comandas", comanda.id, {
        status: "fechada",
        fechada_em: new Date().toISOString(),
        forma_pagamento: formaPagamento,
      });
      toast("Comanda fechada e lançada no caixa.", "success");
      setFechando(null);
      load();
    } catch (e) {
      toast(`Erro ao fechar comanda: ${e.message}`, "error");
    }
  }

  function handleCancelar(comanda) {
    confirm(
      `Cancelar a comanda "${comanda.identificador}"? Os itens já lançados continuam baixados do estoque, mas não entram no caixa.`,
      async () => {
        try {
          await updateRow("comandas", comanda.id, { status: "cancelada", fechada_em: new Date().toISOString() });
          toast("Comanda cancelada.", "success");
          load();
        } catch (e) {
          toast(`Erro ao cancelar: ${e.message}`, "error");
        }
      },
      { danger: true, title: "Cancelar comanda" }
    );
  }

  function handleItemSaved() {
    load();
    refreshEstoque();
    refreshEstoqueLanches();
  }

  function handleExcluir(comanda) {
    confirm(
      `Excluir a comanda "${comanda.identificador}" e todos os seus itens? Isso apaga o histórico e devolve os itens pro estoque — use só pra testes ou erro de lançamento, não pra desfazer uma venda real.`,
      async () => {
        try {
          const itens = itensPorComanda[comanda.id] || [];
          for (const item of itens) {
            await deleteRow("vendas", item.id);
          }
          await deleteRow("comandas", comanda.id);
          toast("Comanda excluída.", "success");
          load();
          refreshEstoque();
          refreshEstoqueLanches();
        } catch (e) {
          toast(`Erro ao excluir: ${e.message}`, "error");
        }
      },
      { danger: true, title: "Excluir comanda" }
    );
  }

  return html`
    <div class="stack-6">
      <div class="row-between">
        <div>
          <h1 class="h2" style="font-size:26px;">Comandas</h1>
          <p class="muted-text" style="margin:4px 0 0;">Abra uma comanda quando o cliente for pedindo aos poucos — só entra no caixa quando fechar e pagar.</p>
        </div>
        <button class="btn btn-primary" onClick=${() => setNovaOpen(true)}>+ Nova Comanda</button>
      </div>

      <div class="card">
        <h3 style="margin:0 0 16px;font-size:16px;">Abertas (${abertas.length})</h3>
        ${loading
          ? html`<${LoadingState} />`
          : abertas.length === 0
          ? html`<${EmptyState}>Nenhuma comanda aberta.<//>`
          : html`
              <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;">
                ${abertas.map(
                  (c) => html`
                    <div key=${c.id} class="card tight" style="background:var(--bg2);">
                      <div class="row-between">
                        <div>
                          <div class="bold">${c.identificador}</div>
                          <div class="muted-text small">${c.cliente?.nome || "Sem cliente"} · aberta ${dataHora(c.aberta_em)}</div>
                        </div>
                        <span class="badge badge-gold">aberta</span>
                      </div>
                      <div style="margin:10px 0;">
                        ${(itensPorComanda[c.id] || []).length === 0
                          ? html`<span class="muted-text small">Nenhum item ainda</span>`
                          : html`<ul style="margin:0;padding-left:18px;font-size:13px;line-height:1.6;">
                              ${(itensPorComanda[c.id] || []).map(
                                (v) => html`<li key=${v.id}>${v.quantidade}x ${nomeDoItem(v)} — ${brl(v.preco_unitario * v.quantidade)}</li>`
                              )}
                            </ul>`}
                      </div>
                      <div class="row-between" style="margin-bottom:10px;">
                        <span class="muted-text small">Total</span>
                        <span class="bold text-green">${brl(totalDaComanda(c.id))}</span>
                      </div>
                      <div class="row-between" style="gap:8px;">
                        <button class="btn btn-secondary btn-sm" onClick=${() => setAtiva(c)}>+ Item</button>
                        <button class="btn btn-primary btn-sm" onClick=${() => setFechando(c)}>Fechar</button>
                        ${isAdmin ? html`<button class="icon-btn" title="Cancelar comanda" onClick=${() => handleCancelar(c)}>🗑️</button>` : null}
                      </div>
                    </div>
                  `
                )}
              </div>
            `}
      </div>

      <div class="card">
        <h3 style="margin:0 0 16px;font-size:16px;">Fechadas recentemente</h3>
        ${fechadasRecentes.length === 0
          ? html`<${EmptyState}>Nenhuma comanda fechada ainda.<//>`
          : html`
              <div class="table-wrap">
                <table class="data-table">
                  <thead><tr><th>Comanda</th><th>Cliente</th><th>Itens</th><th>Total</th><th>Situação</th><th>Fechada em</th><th></th></tr></thead>
                  <tbody>
                    ${fechadasRecentes.map(
                      (c) => html`
                        <tr key=${c.id}>
                          <td>${c.identificador}</td>
                          <td class="cell-sub">${c.cliente?.nome || "—"}</td>
                          <td class="cell-sub">${(itensPorComanda[c.id] || []).length}</td>
                          <td class="bold">${brl(totalDaComanda(c.id))}</td>
                          <td>
                            <span class="badge ${c.status === "cancelada" ? "badge-red" : "badge-neutral"}">
                              ${c.status === "cancelada" ? "Cancelada" : FORMAS_PAGAMENTO.find((f) => f.value === c.forma_pagamento)?.label || "—"}
                            </span>
                          </td>
                          <td class="cell-sub">${dataHora(c.fechada_em)}</td>
                          <td class="actions-cell">
                            ${isAdmin ? html`<button class="icon-btn" title="Excluir comanda" onClick=${() => handleExcluir(c)}>🗑️</button>` : null}
                          </td>
                        </tr>
                      `
                    )}
                  </tbody>
                </table>
              </div>
            `}
      </div>

      ${novaOpen ? html`<${NovaComandaModal} onClose=${() => setNovaOpen(false)} onSave=${handleAbrir} />` : null}
      ${ativa ? html`<${ItemComandaModal} comanda=${ativa} canais=${canais} onClose=${() => setAtiva(null)} onSaved=${handleItemSaved} />` : null}
      ${fechando
        ? html`<${FecharComandaModal} comanda=${fechando} total=${totalDaComanda(fechando.id)} onClose=${() => setFechando(null)} onConfirm=${(fp) => handleFechar(fechando, fp)} />`
        : null}
      ${confirmNode}
    </div>
  `;
}

function NovaComandaModal({ onClose, onSave }) {
  const { clientes } = useAppData();
  const [identificador, setIdentificador] = useState("");
  const [clienteId, setClienteId] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!identificador.trim()) return;
    setSaving(true);
    await onSave(identificador.trim(), clienteId);
    setSaving(false);
  }

  return html`
    <${Modal} title="Nova Comanda" onClose=${onClose}>
      <form onSubmit=${handleSubmit} class="stack-4">
        <div class="field">
          <label>Identificação (mesa, nome, comanda nº...)</label>
          <input class="input" value=${identificador} onInput=${(e) => setIdentificador(e.target.value)} placeholder="Ex: Mesa 3, João" required autoFocus />
        </div>
        <div class="field">
          <label>Cliente cadastrado (opcional)</label>
          <select class="input" value=${clienteId} onChange=${(e) => setClienteId(e.target.value)}>
            <option value="">Não informado</option>
            ${clientes.map((c) => html`<option key=${c.id} value=${c.id}>${c.nome}</option>`)}
          </select>
        </div>
        <div class="row-between" style="justify-content:flex-end;gap:8px;">
          <button type="button" class="btn btn-secondary" onClick=${onClose}>Cancelar</button>
          <button type="submit" class="btn btn-primary" disabled=${saving}>${saving ? "Abrindo…" : "Abrir comanda"}</button>
        </div>
      </form>
    <//>
  `;
}

function ItemComandaModal({ comanda, canais, onClose, onSaved }) {
  const { bebidas, sabores, lanches, combos, config, estoque, estoqueLanches, toast } = useAppData();
  const [tipo, setTipo] = useState("bebida");
  const [bebidaId, setBebidaId] = useState(bebidas[0]?.id || "");
  const [saborId, setSaborId] = useState(sabores[0]?.id || "");
  const [tamanho, setTamanho] = useState("M");
  const [lancheId, setLancheId] = useState(lanches[0]?.id || "");
  const [comboId, setComboId] = useState(combos[0]?.id || "");
  const [quantidade, setQuantidade] = useState(1);
  const [saving, setSaving] = useState(false);

  const canalLocal = canais.find((c) => c.id === "local") || canais[0];
  const bebida = bebidas.find((b) => b.id === bebidaId);
  const sabor = sabores.find((s) => s.id === saborId);
  const lanche = lanches.find((l) => l.id === lancheId);
  const combo = combos.find((c) => c.id === comboId);

  const custoUnitario =
    tipo === "bebida" ? Number(bebida?.custo || 0)
    : tipo === "pizza" ? Number(sabor?.[`custo_${tamanho.toLowerCase()}`] || 0)
    : tipo === "lanche" ? Number(lanche?.custo || 0)
    : 0;

  const precoCalc =
    tipo === "combo" ? Number(combo?.preco || 0)
    : tipo === "bebida" ? (canalLocal ? precoBebidaSugerido(bebida, config.margem_recomendada, canalLocal.comissao_pct, canalLocal.taxa_pagamento_pct) : null)
    : tipo === "lanche" ? (canalLocal ? precoBebidaSugerido(lanche, config.margem_recomendada, canalLocal.comissao_pct, canalLocal.taxa_pagamento_pct) : null)
    : canalLocal ? precoSugerido(custoUnitario, config.margem_recomendada, canalLocal.comissao_pct, canalLocal.taxa_pagamento_pct)
    : null;

  const estoqueDisponivel =
    tipo === "bebida" ? Number(estoque.find((e) => e.bebida_id === bebidaId)?.estoque_atual || 0)
    : tipo === "lanche" ? Number(estoqueLanches.find((e) => e.lanche_id === lancheId)?.estoque_atual || 0)
    : null;

  async function handleSubmit(e) {
    e.preventDefault();
    if (tipo === "bebida" && !bebidaId) { toast("Selecione uma bebida.", "error"); return; }
    if (tipo === "pizza" && !saborId) { toast("Selecione um sabor.", "error"); return; }
    if (tipo === "lanche" && !lancheId) { toast("Selecione um lanche.", "error"); return; }
    if (tipo === "combo" && !comboId) { toast("Selecione um combo.", "error"); return; }
    if (!quantidade || Number(quantidade) <= 0) { toast("Informe uma quantidade válida.", "error"); return; }
    if (estoqueDisponivel !== null && Number(quantidade) > estoqueDisponivel) {
      toast(`Estoque insuficiente: disponível ${estoqueDisponivel}.`, "error");
      return;
    }
    if (!precoCalc) { toast("Não foi possível calcular o preço. Revise a margem em Configurações.", "error"); return; }
    setSaving(true);
    try {
      await insertRow("vendas", {
        tipo,
        bebida_id: tipo === "bebida" ? bebidaId : null,
        sabor_id: tipo === "pizza" ? saborId : null,
        tamanho: tipo === "pizza" ? tamanho : null,
        lanche_id: tipo === "lanche" ? lancheId : null,
        combo_id: tipo === "combo" ? comboId : null,
        canal_id: canalLocal.id,
        quantidade: Number(quantidade),
        preco_unitario: Number(precoCalc),
        custo_unitario: custoUnitario,
        comanda_id: comanda.id,
      });
      toast("Item adicionado à comanda.", "success");
      onSaved();
      onClose();
    } catch (e) {
      toast(`Erro ao adicionar item: ${e.message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  return html`
    <${Modal} title=${`Adicionar item — ${comanda.identificador}`} onClose=${onClose}>
      <form onSubmit=${handleSubmit} class="stack-4">
        <div class="pill-toggle">
          <button type="button" class=${tipo === "bebida" ? "active" : ""} onClick=${() => setTipo("bebida")}>Bebida</button>
          <button type="button" class=${tipo === "pizza" ? "active" : ""} onClick=${() => setTipo("pizza")}>Pizza</button>
          <button type="button" class=${tipo === "lanche" ? "active" : ""} onClick=${() => setTipo("lanche")}>Lanche</button>
          <button type="button" class=${tipo === "combo" ? "active" : ""} onClick=${() => setTipo("combo")}>Combo</button>
        </div>

        ${tipo === "bebida"
          ? html`
              <div class="field">
                <label>Produto</label>
                <select class="input" value=${bebidaId} onChange=${(e) => setBebidaId(e.target.value)}>
                  ${bebidas.map((b) => html`<option key=${b.id} value=${b.id}>${b.nome}</option>`)}
                </select>
                ${estoqueDisponivel !== null ? html`<span class="hint">Disponível em estoque: ${estoqueDisponivel}</span>` : null}
              </div>
            `
          : tipo === "pizza"
          ? html`
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
            `
          : tipo === "lanche"
          ? html`
              <div class="field">
                <label>Lanche</label>
                <select class="input" value=${lancheId} onChange=${(e) => setLancheId(e.target.value)}>
                  ${lanches.map((l) => html`<option key=${l.id} value=${l.id}>${l.nome}</option>`)}
                </select>
                ${estoqueDisponivel !== null ? html`<span class="hint">Disponível em estoque: ${estoqueDisponivel}</span>` : null}
              </div>
            `
          : html`
              <div class="field">
                <label>Combo</label>
                <select class="input" value=${comboId} onChange=${(e) => setComboId(e.target.value)}>
                  ${combos.map((c) => html`<option key=${c.id} value=${c.id}>${c.nome}</option>`)}
                </select>
                <span class="hint">Não baixa automaticamente o estoque das bebidas/lanches inclusos — ajuste o Estoque manualmente se for o caso.</span>
              </div>
            `}

        <div class="field">
          <label>Quantidade</label>
          <input class="input" type="number" min="1" step="1" value=${quantidade} onInput=${(e) => setQuantidade(e.target.value)} required />
        </div>

        <div class="card tight" style="background:var(--bg2);">
          <div class="row-between"><span class="muted-text small">Preço unitário</span><span class="bold">${brl(precoCalc || 0)}</span></div>
          <div class="row-between"><span class="muted-text small">Total do item</span><span class="bold text-green">${brl((precoCalc || 0) * Number(quantidade || 0))}</span></div>
        </div>

        <div class="row-between" style="justify-content:flex-end;gap:8px;">
          <button type="button" class="btn btn-secondary" onClick=${onClose}>Cancelar</button>
          <button type="submit" class="btn btn-primary" disabled=${saving}>${saving ? "Adicionando…" : "Adicionar à comanda"}</button>
        </div>
      </form>
    <//>
  `;
}

function FecharComandaModal({ comanda, total, onClose, onConfirm }) {
  const [forma, setForma] = useState("dinheiro");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    await onConfirm(forma);
    setSaving(false);
  }

  return html`
    <${Modal} title=${`Fechar comanda — ${comanda.identificador}`} onClose=${onClose}>
      <form onSubmit=${handleSubmit} class="stack-4">
        <div class="card tight" style="background:var(--bg2);">
          <div class="row-between"><span class="muted-text small">Total a pagar</span><span class="bold text-green" style="font-size:20px;">${brl(total)}</span></div>
        </div>
        <div class="field">
          <label>Forma de pagamento</label>
          <div class="pill-toggle">
            ${FORMAS_PAGAMENTO.map(
              (f) => html`<button type="button" key=${f.value} class=${forma === f.value ? "active" : ""} onClick=${() => setForma(f.value)}>${f.label}</button>`
            )}
          </div>
        </div>
        <div class="row-between" style="justify-content:flex-end;gap:8px;">
          <button type="button" class="btn btn-secondary" onClick=${onClose}>Cancelar</button>
          <button type="submit" class="btn btn-primary" disabled=${saving}>${saving ? "Fechando…" : "Confirmar pagamento"}</button>
        </div>
      </form>
    <//>
  `;
}
