import { React, ReactDOM, html, useState, useEffect } from "./lib.js";
import { supabase } from "./supabaseClient.js";
import { AppDataProvider, useAppData, fetchAll } from "./store.js";
import { Sidebar, MobileNav, Topbar } from "./components/Layout.js";
import { LoginPage } from "./pages/Login.js";
import { LoadingState } from "./components/ui.js";

import { DashboardPage } from "./pages/Dashboard.js";
import { CaixaPage } from "./pages/Caixa.js";
import { ComprasPage } from "./pages/Compras.js";
import { ProdutosPage } from "./pages/Produtos.js";
import { CardapioPage } from "./pages/Cardapio.js";
import { VendasPage } from "./pages/Vendas.js";
import { ClientesPage } from "./pages/Clientes.js";
import { EstoquePage } from "./pages/Estoque.js";
import { FornecedoresPage } from "./pages/Fornecedores.js";
import { RelatoriosPage } from "./pages/Relatorios.js";
import { MetasPage } from "./pages/Metas.js";
import { FinanceiroPage } from "./pages/Financeiro.js";
import { ConfiguracoesPage } from "./pages/Configuracoes.js";
import { BackupPage } from "./pages/Backup.js";

const PAGES = {
  dashboard: DashboardPage,
  caixa: CaixaPage,
  compras: ComprasPage,
  produtos: ProdutosPage,
  cardapio: CardapioPage,
  vendas: VendasPage,
  clientes: ClientesPage,
  estoque: EstoquePage,
  fornecedores: FornecedoresPage,
  relatorios: RelatoriosPage,
  metas: MetasPage,
  financeiro: FinanceiroPage,
  config: ConfiguracoesPage,
  backup: BackupPage,
};

function AuthGate() {
  const [session, setSession] = useState(undefined); // undefined = loading, null = logged out
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) { setProfile(null); return; }
    let cancelled = false;
    fetchAll("profiles").then((rows) => {
      if (cancelled) return;
      const mine = rows.find((r) => r.id === session.user.id) || null;
      setProfile(mine);
    });
    return () => { cancelled = true; };
  }, [session]);

  if (session === undefined) {
    return html`<div class="login-page"><${LoadingState}>Carregando Sabore In Casa…<//></div>`;
  }
  if (!session) return html`<${LoginPage} />`;
  if (!profile) {
    return html`<div class="login-page"><${LoadingState}>Preparando seu acesso…<//></div>`;
  }

  return html`<${AppDataProvider} session=${session} profile=${profile}><${MainApp} /><//>`;
}

function MainApp() {
  const [page, setPage] = useState("dashboard");
  const { loading } = useAppData();
  const Page = PAGES[page] || DashboardPage;

  return html`
    <div class="app-shell">
      <${Sidebar} page=${page} setPage=${setPage} />
      <div class="main-col">
        <${MobileNav} page=${page} setPage=${setPage} />
        <div class="content">
          ${loading ? html`<${LoadingState}>Carregando dados…<//>` : html`<${Page} setPage=${setPage} />`}
        </div>
        <div class="footer-note">
          <span>🍕 Sabor que você sente, qualidade que você confia.</span>
          <span><span class="status-dot"></span>Sistema online — dados em nuvem</span>
        </div>
      </div>
    </div>
  `;
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(html`<${AuthGate} />`);
