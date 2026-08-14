import { html } from "../lib.js";
import { supabase } from "../supabaseClient.js";

export async function uploadProdutoImagem(file, pasta) {
  const ext = file.name.split(".").pop();
  const nomeArquivo = `${pasta}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("produtos").upload(nomeArquivo, file, {
    contentType: file.type, upsert: false,
  });
  if (error) throw error;
  const { data } = supabase.storage.from("produtos").getPublicUrl(nomeArquivo);
  return data.publicUrl;
}

export function ImageUploadField({ imagemUrl, setImagemUrl, pasta, uploading, setUploading }) {
  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadProdutoImagem(file, pasta);
      setImagemUrl(url);
    } catch (err) {
      alert(`Erro ao enviar imagem: ${err.message}`);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return html`
    <div class="field">
      <label>Foto do produto</label>
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="width:64px;height:64px;border-radius:10px;background:var(--bg2);overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;">
          ${imagemUrl ? html`<img src=${imagemUrl} alt="" style="width:100%;height:100%;object-fit:cover;" />` : html`<span style="font-size:22px;">📷</span>`}
        </div>
        <div class="stack-2" style="flex:1;">
          <input class="input" type="file" accept="image/*" onChange=${handleFile} disabled=${uploading} />
          ${uploading ? html`<span class="muted-text small">Enviando…</span>` : imagemUrl ? html`<button type="button" class="link-btn" onClick=${() => setImagemUrl("")}>Remover foto</button>` : null}
        </div>
      </div>
    </div>
  `;
}
