import { html, useState } from "../lib.js";
import { useAppData, insertRow, updateRow, deleteRow } from "../store.js";
import { Modal, useConfirm, EmptyState, Badge } from "../components/ui.js";
import { brl, precoSugerido } from "../format.js";
import { ImageUploadField } from "../components/ImageUpload.js";

const TAMANHOS = [{ key: "P", label: "Pequena" }, { key: "M", label: "Média" }, { key: "G", label: "Grande" }];

export function CardapioPage() {
  const { sabores, canais, config, isAdmin, toast, refreshSabores } = useAppData();
  const [tamanho, setTamanho] = useState("M");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [confirm, confirmNode] = useConfirm();
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
        <div><h1 class="h2" style="font-size:26px;">Cardápio (Pizzas)</h1><p class="muted-text" style="margin:4px 0 0;">Sabores, custo de produção e preço sugerido por canal.</p></div>
        ${isAdmin ? html`<button class="btn btn-primary" onClick=${() => { setEditing(null); setModalOpen(true); }}>+ Novo Sabor</button>` : null}
      </div>

      <div class="row-between">
        <div class="pill-toggle">
          ${TAMANHOS.map((t) => html`<button key=${t.key} class=${tamanho === t.key ? "active" : ""} onClick=${() => setTamanho(t.key)}>${t.label}</button>`)}
        </div>
      </div>

      ${sabores.length === 0 ? html`<div class="card"><${EmptyState}>Nenhuma pizza cadastrada ainda.<//></div>` : html`
        <div class="product-grid">
          ${sabores.map((s) => {
            const custo = Number(s[`custo_${tamanho.toLowerCase()}`] || 0);
            const preco = canalLocal ? precoSugerido(custo, config.margem_recomendada, canalLocal.comissao_pct, canalLocal.taxa_pagamento_pct) : null;
            return html`
              <div key=${s.id} class="product-card">
                <img class="product-card-img" src=${s.imagem_url} alt=${s.nome} loading="lazy" />
                <div class="product-card-body">
                  <div class="row-between">
                    <div class="product-card-title">${s.nome}</div>
                    ${!s.ativo ? html`<${Badge} tone="neutral">Inativo<//>` : null}
                  </div>
                  <div class="muted-text small">Custo (${tamanho}): ${brl(custo)}</div>
                  <div class="product-card-price-row">
                    <span class="product-card-price">${preco ? brl(preco) : "—"}</span>
                    ${isAdmin ? html`
                      <div style="display:flex;gap:4px;">
                        <button class="icon-btn" title="Editar" onClick=${() => { setEditing(s); setModalOpen(true); }}>✏️</button>
                        <button class="icon-btn" title="Excluir" onClick=${() => handleDelete(s)}>🗑️</button>
                      </div>
                    ` : null}
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
              ${sabores.map((s) => {
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
    <${Modal} title=${editing ? "Editar Sabor" : "Novo Sabor de Pizza"} onClose=${onClose}>
      <form onSubmit=${handleSubmit} class="stack-4">
        <${ImageUploadField} imagemUrl=${imagemUrl} setImagemUrl=${setImagemUrl} pasta="pizzas" uploading=${uploading} setUploading=${setUploading} />
        <div class="field">
          <label>Nome do sabor</label>
          <input class="input" value=${nome} onInput=${(e) => setNome(e.target.value)} required />
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
