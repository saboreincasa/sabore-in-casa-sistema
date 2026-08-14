import { html, useState } from "../lib.js";
import { fetchAll, useAppData } from "../store.js";

const TABELAS_BACKUP = [
  "profiles", "fornecedores", "clientes", "bebidas", "sabores_pizza", "canais_venda",
  "config_precificacao", "despesas_fixas", "metas", "compras", "vendas", "ajustes_estoque", "lancamentos_caixa",
];

function baixarArquivo(nome, conteudo, tipo) {
  const blob = new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function paraCsv(linhas) {
  if (linhas.length === 0) return "";
  const colunas = Object.keys(linhas[0]);
  const escape = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const cabecalho = colunas.map(escape).join(",");
  const corpo = linhas.map((l) => colunas.map((c) => escape(l[c])).join(",")).join("\n");
  return `${cabecalho}\n${corpo}`;
}

export function BackupPage() {
  const { toast } = useAppData();
  const [gerandoJson, setGerandoJson] = useState(false);
  const [gerandoCsv, setGerandoCsv] = useState(false);

  async function baixarBackupCompleto() {
    setGerandoJson(true);
    try {
      const dados = {};
      for (const tabela of TABELAS_BACKUP) {
        dados[tabela] = await fetchAll(tabela);
      }
      const conteudo = JSON.stringify({ gerado_em: new Date().toISOString(), dados }, null, 2);
      baixarArquivo(`sabore-in-casa-backup-${new Date().toISOString().slice(0, 10)}.json`, conteudo, "application/json");
      toast("Backup baixado com sucesso.", "success");
    } catch (e) {
      toast(`Erro ao gerar backup: ${e.message}`, "error");
    } finally {
      setGerandoJson(false);
    }
  }

  async function baixarVendasCsv() {
    setGerandoCsv(true);
    try {
      const vendas = await fetchAll("vendas", { order: "criado_em", ascending: false });
      baixarArquivo(`sabore-in-casa-vendas-${new Date().toISOString().slice(0, 10)}.csv`, paraCsv(vendas), "text/csv");
      toast("CSV de vendas baixado.", "success");
    } catch (e) {
      toast(`Erro ao gerar CSV: ${e.message}`, "error");
    } finally {
      setGerandoCsv(false);
    }
  }

  return html`
    <div class="stack-6">
      <div><h1 class="h2" style="font-size:26px;">Backup e Dados</h1><p class="muted-text" style="margin:4px 0 0;">Seus dados ficam salvos na nuvem — aqui você pode exportar cópias.</p></div>

      <div class="card">
        <div class="row-between">
          <div>
            <h3 style="margin:0 0 6px;font-size:16px;">🗄️ Onde seus dados estão salvos</h3>
            <p class="muted-text" style="margin:0;max-width:520px;">
              Todo o sistema roda em um banco de dados na nuvem (Supabase). Isso significa que os dados não dependem
              deste computador — se o dispositivo quebrar ou for perdido, nada é perdido. Vários funcionários podem
              acessar ao mesmo tempo, de qualquer lugar.
            </p>
          </div>
          <span class="badge badge-green" style="white-space:nowrap;"><span class="status-dot"></span>Sincronizado</span>
        </div>
      </div>

      <div class="grid-2">
        <div class="card">
          <h3 style="margin:0 0 8px;font-size:16px;">Backup completo (JSON)</h3>
          <p class="muted-text small" style="margin:0 0 16px;">Baixa uma cópia de todos os cadastros e movimentações do sistema em um único arquivo.</p>
          <button class="btn btn-primary" disabled=${gerandoJson} onClick=${baixarBackupCompleto}>${gerandoJson ? "Gerando…" : "⬇️ Baixar backup completo"}</button>
        </div>
        <div class="card">
          <h3 style="margin:0 0 8px;font-size:16px;">Exportar vendas (CSV)</h3>
          <p class="muted-text small" style="margin:0 0 16px;">Baixa o histórico de vendas em planilha, pronto para abrir no Excel ou Google Sheets.</p>
          <button class="btn btn-secondary" disabled=${gerandoCsv} onClick=${baixarVendasCsv}>${gerandoCsv ? "Gerando…" : "⬇️ Baixar CSV de vendas"}</button>
        </div>
      </div>

      <p class="hint">Recomendação: baixe um backup completo periodicamente (ex: toda semana) e guarde em outro lugar (e-mail, Google Drive) como segurança extra.</p>
    </div>
  `;
}
