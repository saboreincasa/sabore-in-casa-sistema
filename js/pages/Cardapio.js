import { html, useState } from "../lib.js";
import { useAppData, insertRow, updateRow, deleteRow } from "../store.js";
import { Modal, useConfirm, EmptyState, Badge } from "../components/ui.js";
import { brl, precoSugerido } from "../format.js";
import { ImageUploadField } from "../components/ImageUpload.js";

const TAMANHOS = [{ key: "P", label: "Pequena" }, { key: "M", label: "Média" }, { key: "G", label: "Grande" }];

// Padrão comum a todos os sabores (Manual de Produção Sabore In Casa)
const PADRAO_PRODUCAO = [
  ["Massa", "P 250 g · M 330 g · G 420 g", "Com borda recheada: 290 · 390 · 500 g"],
  ["Forno", "300 °C · P 4–5 min · M 5–6 min · G 6–8 min", "GIRAR na metade · borda recheada +1 a 2 min"],
  ["Corte", "P em 6 · M e G em 8 fatias", "Nunca cortar em cima da tela"],
];

function fmtQtd(v, un) {
  if (v === null || v === undefined || v === "") return "—";
  const n = Number(v);
  let txt = String(v);
  if (!Number.isNaN(n)) {
    const inteiro = Math.floor(n);
    const frac = n - inteiro;
    txt = frac === 0.5 ? (inteiro ? `${inteiro} e ½` : "½") : String(n).replace(".", ",");
  }
  return un ? `${txt} ${un}` : txt;
}

function ordenarSabores(lista) {
  return [...lista].sort((a, b) => (Number(!!b.destaque) - Number(!!a.destaque)) || a.nome.localeCompare(b.nome, "pt-BR"));
}

export function CardapioPage() {
  const { sabores, canais, config, isAdmin, toast, refreshSabores } = useAppData();
  const [tamanho, setTamanho] = useState("M");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [fichaDe, setFichaDe] = useState(null);
  const [confirm, confirmNode] = useConfirm();
  const saboresOrdenados = ordenarSabores(sabores);
  const canalLocal = canais.find((c) => c.id === "local");

  function handleSaved() { setModalOpen(false); refreshSabores(); }
  function handleDelete(s) {
    confirm(`Excluir o sabor "${s.nome}" do cardápio?`, async () => {
      try {
        await deleteRow("sabores_pizza", s.id);
        toast("Sabor excluído.", "success");
        refreshSabores();
      } catch (e) {
        toast(`Não foi possível excluir: ${e.message}`, "error");
      }
    });
  }

  return html`
    <div class="stack-6">
      <div class="row-between">
        <div><h1 class="h2" style="font-size:26px;">Cardápio (Pizzas)</h1><p class="muted-text" style="margin:4px 0 0;">Sabores, ficha técnica de montagem, custo de produção e preço sugerido por canal.</p></div>
        ${isAdmin ? html`<button class="btn btn-primary" onClick=${() => { setEditing(null); setModalOpen(true); }}>+ Novo Sabor</button>` : null}
      </div>

      <div class="row-between">
        <div class="pill-toggle">
          ${TAMANHOS.map((t) => html`<button key=${t.key} class=${tamanho === t.key ? "active" : ""} onClick=${() => setTamanho(t.key)}>${t.label}</button>`)}
        </div>
      </div>

      ${sabores.length === 0 ? html`<div class="card"><${EmptyState}>Nenhuma pizza cadastrada ainda.<//></div>` : html`
        <div class="product-grid">
          ${saboresOrdenados.map((s) => {
            const custo = Number(s[`custo_${tamanho.toLowerCase()}`] || 0);
            const preco = canalLocal ? precoSugerido(custo, config.margem_recomendada, canalLocal.comissao_pct, canalLocal.taxa_pagamento_pct) : null;
            return html`
              <div key=${s.id} class="product-card">
                <img class="product-card-img" src=${s.imagem_url} alt=${s.nome} loading="lazy" />
                <div class="product-card-body">
                  <div class="row-between">
                    <div class="product-card-title">${s.destaque ? "★ " : ""}${s.nome}</div>
                    ${!s.ativo ? html`<${Badge} tone="neutral">Inativo<//>` : null}
                  </div>
                  ${s.selo ? html`<span class="sabor-selo">${s.selo}</span>` : null}
                  ${s.descricao ? html`<div class="muted-text small sabor-desc">${s.descricao}</div>` : null}
                  <div class="muted-text small">Custo (${tamanho}): ${brl(custo)}</div>
                  <div class="product-card-price-row">
                    <span class="product-card-price">${preco ? brl(preco) : "—"}</span>
                    <div style="display:flex;gap:4px;">
                      <button class="icon-btn" title="Ficha técnica" onClick=${() => setFichaDe(s)}>📋</button>
                    ${isAdmin ? html`
                        <button class="icon-btn" title="Editar" onClick=${() => { setEditing(s); setModalOpen(true); }}>✏️</button>
                        <button class="icon-btn" title="Excluir" onClick=${() => handleDelete(s)}>🗑️</button>
                    ` : null}
                    </div>
                  </div>
                </div>
              </div>
            `;
          })}
        </div>
      `}

      <div class="card">
        <h3 style="margin:0 0 16px;font-size:16px;">Preços por canal (${TAMANHOS.find((t) => t.key === tamanho).label})</h3>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Sabor</th><th>Custo</th>${canais.map((c) => html`<th key=${c.id}>${c.nome}</th>`)}</tr></thead>
            <tbody>
              ${saboresOrdenados.map((s) => {
                const custo = Number(s[`custo_${tamanho.toLowerCase()}`] || 0);
                return html`
                  <tr key=${s.id}>
                    <td class="cell-title">${s.nome}</td>
                    <td>${brl(custo)}</td>
                    ${canais.map((c) => html`<td key=${c.id}>${brl(precoSugerido(custo, config.margem_recomendada, c.comissao_pct, c.taxa_pagamento_pct))}</td>`)}
                  </tr>
                `;
              })}
            </tbody>
          </table>
        </div>
      </div>

      ${fichaDe ? html`<${FichaModal} sabor=${fichaDe} onClose=${() => setFichaDe(null)} />` : null}
      ${modalOpen ? html`<${SaborModal} editing=${editing} onClose=${() => setModalOpen(false)} onSaved=${handleSaved} />` : null}
      ${confirmNode}
    </div>
  `;
}

function SaborModal({ editing, onClose, onSaved }) {
  const { toast } = useAppData();
  const [nome, setNome] = useState(editing?.nome || "");
  const [custoP, setCustoP] = useState(editing?.custo_p ?? "");
  const [custoM, setCustoM] = useState(editing?.custo_m ?? "");
  const [custoG, setCustoG] = useState(editing?.custo_g ?? "");
  const [ativo, setAtivo] = useState(editing?.ativo ?? true);
  const [imagemUrl, setImagemUrl] = useState(editing?.imagem_url || "");
  const [descricao, setDescricao] = useState(editing?.descricao || "");
  const [selo, setSelo] = useState(editing?.selo || "");
  const [destaque, setDestaque] = useState(!!editing?.destaque);
  const fichaIni = editing?.ficha || {};
  const [ingredientes, setIngredientes] = useState(
    (fichaIni.ingredientes && fichaIni.ingredientes.length ? fichaIni.ingredientes : [{ nome: "Molho", un: "g", p: 70, m: 100, g: 130 }])
      .map((i) => ({ nome: i.nome || "", un: i.un || "g", p: i.p ?? "", m: i.m ?? "", g: i.g ?? "" }))
  );
  const [ordem, setOrdem] = useState((fichaIni.ordem || []).join(" > "));
  const [cuidado, setCuidado] = useState(fichaIni.cuidado || "");
  const [segredo, setSegredo] = useState(fichaIni.segredo || "");

  function setIng(idx, campo, valor) {
    setIngredientes((lista) => lista.map((i, k) => (k === idx ? { ...i, [campo]: valor } : i)));
  }
  const num = (v) => (v === "" || v === null ? null : Number(String(v).replace(",", ".")));
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!nome.trim()) { toast("Informe o nome do sabor.", "error"); return; }
    setSaving(true);
    try {
      const payload = {
        nome: nome.trim(), custo_p: Number(custoP) || 0, custo_m: Number(custoM) || 0, custo_g: Number(custoG) || 0,
        ativo, imagem_url: imagemUrl || null,
        descricao: descricao.trim() || null, selo: selo.trim() || null, destaque,
        ficha: {
          ingredientes: ingredientes.filter((i) => i.nome.trim()).map((i) => ({ nome: i.nome.trim(), un: i.un || "g", p: num(i.p), m: num(i.m), g: num(i.g) })),
          ordem: ordem.split(">").map((x) => x.trim()).filter(Boolean),
          cuidado: cuidado.trim(), segredo: segredo.trim(),
        },
      };
      if (editing) {
        await updateRow("sabores_pizza", editing.id, payload);
        toast("Sabor atualizado.", "success");
      } else {
        await insertRow("sabores_pizza", payload);
        toast("Sabor cadastrado.", "success");
      }
      onSaved();
    } catch (e) {
      toast(`Erro ao salvar: ${e.message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  return html`
    <${Modal} title=${editing ? "Editar Sabor" : "Novo Sabor de Pizza"} onClose=${onClose} wide=${true}>
      <form onSubmit=${handleSubmit} class="stack-4">
        <${ImageUploadField} imagemUrl=${imagemUrl} setImagemUrl=${setImagemUrl} pasta="pizzas" uploading=${uploading} setUploading=${setUploading} />
        <div class="field">
          <label>Nome do sabor</label>
          <input class="input" value=${nome} onInput=${(e) => setNome(e.target.value)} required />
        </div>
        <div class="field">
          <label>Descrição no cardápio (app/site)</label>
          <textarea class="input" rows="2" value=${descricao} onInput=${(e) => setDescricao(e.target.value)} placeholder="Ex.: Molho, mussarela, calabresa, cebola." />
          <span class="muted-text small">O app já coloca "Massa 100% integral." na frente.</span>
        </div>
        <div class="form-grid cols-2">
          <div class="field"><label>Selo</label><input class="input" value=${selo} onInput=${(e) => setSelo(e.target.value)} placeholder="Ex.: Clássica, Picante" /></div>
          <div class="field"><label>Destaque</label>
            <label style="display:flex;align-items:center;gap:8px;min-height:40px;"><input type="checkbox" checked=${destaque} onChange=${(e) => setDestaque(e.target.checked)} /> Pizza assinatura (aparece primeiro)</label>
          </div>
        </div>

        <div class="field">
          <label>Ficha técnica · gramatura por tamanho</label>
          <div class="table-wrap">
            <table class="data-table ficha-edit">
              <thead><tr><th>Ingrediente</th><th>Un.</th><th>P · 25</th><th>M · 30</th><th>G · 35</th><th></th></tr></thead>
              <tbody>
                ${ingredientes.map((i, idx) => html`
                  <tr key=${idx}>
                    <td><input class="input" value=${i.nome} onInput=${(e) => setIng(idx, "nome", e.target.value)} /></td>
                    <td><select class="input" value=${i.un} onChange=${(e) => setIng(idx, "un", e.target.value)}><option value="g">g</option><option value="un">un</option><option value="folhas">folhas</option></select></td>
                    <td><input class="input" inputmode="decimal" value=${i.p} onInput=${(e) => setIng(idx, "p", e.target.value)} /></td>
                    <td><input class="input" inputmode="decimal" value=${i.m} onInput=${(e) => setIng(idx, "m", e.target.value)} /></td>
                    <td><input class="input" inputmode="decimal" value=${i.g} onInput=${(e) => setIng(idx, "g", e.target.value)} /></td>
                    <td><button type="button" class="icon-btn" title="Remover" onClick=${() => setIngredientes((l) => l.filter((_, k) => k !== idx))}>✕</button></td>
                  </tr>
                `)}
              </tbody>
            </table>
          </div>
          <button type="button" class="btn btn-secondary" style="align-self:flex-start;margin-top:6px;" onClick=${() => setIngredientes((l) => [...l, { nome: "", un: "g", p: "", m: "", g: "" }])}>+ Ingrediente</button>
        </div>
        <div class="field">
          <label>Ordem de montagem (separe com ">")</label>
          <input class="input" value=${ordem} onInput=${(e) => setOrdem(e.target.value)} placeholder="Molho > Mussarela > Calabresa > Cebola > Orégano" />
        </div>
        <div class="form-grid cols-2">
          <div class="field"><label>⚠ Cuidado</label><textarea class="input" rows="2" value=${cuidado} onInput=${(e) => setCuidado(e.target.value)} /></div>
          <div class="field"><label>✓ Segredo do sabor</label><textarea class="input" rows="2" value=${segredo} onInput=${(e) => setSegredo(e.target.value)} /></div>
        </div>

        <div class="form-grid cols-3">
          <div class="field"><label>Custo Pequena</label><input class="input" type="number" min="0" step="0.01" value=${custoP} onInput=${(e) => setCustoP(e.target.value)} /></div>
          <div class="field"><label>Custo Média</label><input class="input" type="number" min="0" step="0.01" value=${custoM} onInput=${(e) => setCustoM(e.target.value)} /></div>
          <div class="field"><label>Custo Grande</label><input class="input" type="number" min="0" step="0.01" value=${custoG} onInput=${(e) => setCustoG(e.target.value)} /></div>
        </div>
        <div class="field">
          <label>Status</label>
          <select class="input" value=${ativo ? "1" : "0"} onChange=${(e) => setAtivo(e.target.value === "1")}>
            <option value="1">Ativo</option>
            <option value="0">Inativo</option>
          </select>
        </div>
        <div class="row-between" style="justify-content:flex-end;gap:8px;">
          <button type="button" class="btn btn-secondary" onClick=${onClose}>Cancelar</button>
          <button type="submit" class="btn btn-primary" disabled=${saving || uploading}>${saving ? "Salvando…" : "Salvar"}</button>
        </div>
      </form>
    <//>
  `;
}

function FichaModal({ sabor, onClose }) {
  const f = sabor.ficha || {};
  const ings = f.ingredientes || [];
  return html`
    <${Modal} title=${`Ficha de montagem · ${sabor.nome}`} onClose=${onClose} wide=${true}>
      <div class="stack-4 ficha">
        ${sabor.selo ? html`<span class="sabor-selo">${sabor.selo}</span>` : null}
        ${sabor.descricao ? html`<p class="muted-text" style="margin:0;font-style:italic;">No cardápio: “Massa 100% integral. ${sabor.descricao}”</p>` : null}
        ${ings.length === 0 ? html`<${EmptyState}>Este sabor ainda não tem ficha técnica. Edite o sabor para cadastrar.<//>` : html`
          <div class="table-wrap">
            <table class="data-table">
              <thead><tr><th>Ingrediente</th><th>P · 25 cm</th><th>M · 30 cm</th><th>G · 35 cm</th></tr></thead>
              <tbody>
                ${ings.map((i, idx) => html`<tr key=${idx}><td class="cell-title">${i.nome}</td><td>${fmtQtd(i.p, i.un)}</td><td>${fmtQtd(i.m, i.un)}</td><td>${fmtQtd(i.g, i.un)}</td></tr>`)}
              </tbody>
            </table>
          </div>
        `}
        <div class="ficha-padrao">
          ${PADRAO_PRODUCAO.map(([t, v, obs]) => html`<div key=${t}><strong>${t}</strong> ${v}<br /><span class="muted-text small">${obs}</span></div>`)}
        </div>
        ${f.ordem && f.ordem.length ? html`
          <div>
            <h4 style="margin:0 0 8px;">Ordem de montagem</h4>
            <div class="ficha-ordem">
              ${f.ordem.map((o, idx) => html`<span key=${idx} class=${`ficha-passo${/^forno$/i.test(o) ? " ficha-passo-forno" : ""}`}><b>${idx + 1}</b> ${o}</span>`)}
            </div>
          </div>
        ` : null}
        <div class="form-grid cols-2">
          ${f.cuidado ? html`<div class="ficha-box ficha-cuidado"><strong>⚠ Cuidado</strong><p>${f.cuidado}</p></div>` : null}
          ${f.segredo ? html`<div class="ficha-box ficha-segredo"><strong>✓ Segredo do sabor</strong><p>${f.segredo}</p></div>` : null}
        </div>
        <p class="muted-text small" style="margin:0;">Antes de fechar a caixa: borda dourada e firme · queijo derretido e borbulhando · base firme, sem centro mole · recheio em todas as fatias.</p>
      </div>
    <//>
  `;
}
