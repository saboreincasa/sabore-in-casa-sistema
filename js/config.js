export const SUPABASE_URL = "https://hzkmhtfwulxvysorvcjb.supabase.co";
export const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh6a21odGZ3dWx4dnlzb3J2Y2piIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2OTk2MDksImV4cCI6MjEwMjI3NTYwOX0.TgB3ePpPMCHTvHiK56pZFAY--YPw625HidVRnHaFfZ4";

export const PALETTE = {
  bg: "#F7F0E3",
  bg2: "#EFE2CC",
  card: "#FFFDF8",
  brown: "#5A351D",
  brownDark: "#3B2417",
  olive: "#4F6F32",
  green: "#2F7D32",
  gold: "#B58A4A",
  red: "#B3261E",
  textMuted: "#8A7860",
};

export const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: "🏠" },
  { key: "caixa", label: "Caixa", icon: "💰" },
  { key: "compras", label: "Compras", icon: "📦" },
  { key: "produtos", label: "Produtos", icon: "🛍️" },
  { key: "tabacaria", label: "Tabacaria", icon: "🚬" },
  { key: "lanches", label: "Lanches", icon: "🍟" },
  { key: "combos", label: "Combos", icon: "🎁" },
  { key: "cardapio", label: "Cardápio (Pizzas)", icon: "🍕" },
  { key: "vendas", label: "Vendas", icon: "🛒" },
  { key: "comandas", label: "Comandas", icon: "🧾" },
  { key: "pedidosOnline", label: "Pedidos Online", icon: "📱" },
  { key: "clientes", label: "Clientes", icon: "👥" },
  { key: "estoque", label: "Estoque", icon: "🗃️" },
  { key: "fornecedores", label: "Fornecedores", icon: "🚚" },
  { key: "relatorios", label: "Relatórios", icon: "📊" },
  { key: "metas", label: "Metas e Lucros", icon: "📈" },
  { key: "financeiro", label: "Financeiro", icon: "🐷" },
  { key: "config", label: "Configurações", icon: "⚙️" },
  { key: "backup", label: "Backup e Dados", icon: "🗄️" },
];

export const BUCKET_URL = `${SUPABASE_URL}/storage/v1/object/public/produtos/`;
