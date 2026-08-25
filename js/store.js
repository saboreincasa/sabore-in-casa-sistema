import { React, html, useState, useEffect, useCallback, useRef, createContext, useContext } from "./lib.js";
import { supabase } from "./supabaseClient.js";

const MINUTOS_ALERTA_PAGAMENTO = 5;
const STATUS_PRECISA_ATENCAO = ["aguardando_pagamento", "pago", "em_preparo", "saiu_entrega"];

// ---------- Generic CRUD helpers ----------
export async function fetchAll(table, { order = null, ascending = false, select = "*" } = {}) {
  let q = supabase.from(table).select(select);
  if (order) q = q.order(order, { ascending });
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function insertRow(table, payload) {
  const { data, error } = await supabase.from(table).insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function updateRow(table, id, payload) {
  const { data, error } = await supabase.from(table).update(payload).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteRow(table, id) {
  const { error } = await supabase.from(table).delete().eq("id", id);
  if (error) throw error;
}

// ---------- Toast ----------
let toastId = 0;

// ---------- App-wide data context ----------
const AppDataContext = createContext(null);

export function useAppData() {
  return useContext(AppDataContext);
}

export function AppDataProvider({ session, profile, children }) {
  const [bebidas, setBebidas] = useState([]);
  const [sabores, setSabores] = useState([]);
  const [lanches, setLanches] = useState([]);
  const [combos, setCombos] = useState([]);
  const [canais, setCanais] = useState([]);
  const [config, setConfig] = useState({ margem_minima: 35, margem_recomendada: 50 });
  const [clientes, setClientes] = useState([]);
  const [fornecedores, setFornecedores] = useState([]);
  const [estoque, setEstoque] = useState([]);
  const [estoqueLanches, setEstoqueLanches] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [toasts, setToasts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [promptInstalacao, setPromptInstalacao] = useState(null);
  const [pedidosPrecisandoAtencao, setPedidosPrecisandoAtencao] = useState(0);
  const jaAlertados = useRef(new Set());

  const ativarAlertasPedido = useCallback(async () => {
    if (!("Notification" in window)) return "indisponivel";
    if (Notification.permission === "granted") return "concedida";
    return await Notification.requestPermission();
  }, []);

  // Fica de olho em pedidos parados esperando pagamento - manda uma notificacao
  // do navegador (funciona com o app aberto, mesmo minimizado ou em outra aba;
  // nao funciona com o app totalmente fechado, isso exigiria a API paga do
  // WhatsApp/push server) quando um pedido passa de 5 min sem pagar, e mantem
  // a contagem de "precisam de atencao" pro badge no menu.
  useEffect(() => {
    async function verificarPedidos() {
      try {
        const { data, error } = await supabase
          .from("pedidos")
          .select("id, cliente_nome, cliente_telefone, status, criado_em")
          .in("status", STATUS_PRECISA_ATENCAO)
          .order("criado_em", { ascending: false })
          .limit(100);
        if (error) throw error;
        const lista = data || [];
        setPedidosPrecisandoAtencao(lista.length);

        if (Notification.permission === "granted") {
          const agora = Date.now();
          lista.forEach((p) => {
            if (p.status !== "aguardando_pagamento" || jaAlertados.current.has(p.id)) return;
            const minutos = (agora - new Date(p.criado_em).getTime()) / 60000;
            if (minutos >= MINUTOS_ALERTA_PAGAMENTO) {
              jaAlertados.current.add(p.id);
              new Notification("Pedido esperando pagamento", {
                body: `${p.cliente_nome} está há ${Math.floor(minutos)} min sem pagar. Bora mandar um lembrete?`,
                tag: `pedido-${p.id}`,
              });
            }
          });
        }
      } catch (e) {
        console.error("Erro ao checar pedidos pendentes:", e);
      }
    }
    verificarPedidos();
    const id = setInterval(verificarPedidos, 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onBeforeInstall = (e) => { e.preventDefault(); setPromptInstalacao(e); };
    const onInstalled = () => setPromptInstalacao(null);
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const instalarApp = useCallback(async () => {
    if (!promptInstalacao) return;
    promptInstalacao.prompt();
    await promptInstalacao.userChoice;
    setPromptInstalacao(null);
  }, [promptInstalacao]);

  const toast = useCallback((message, type = "info") => {
    const id = ++toastId;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3800);
  }, []);

  const refreshBebidas = useCallback(async () => {
    setBebidas(await fetchAll("bebidas", { order: "nome", ascending: true }));
  }, []);
  const refreshSabores = useCallback(async () => {
    setSabores(await fetchAll("sabores_pizza", { order: "nome", ascending: true }));
  }, []);
  const refreshLanches = useCallback(async () => {
    setLanches(await fetchAll("lanches", { order: "nome", ascending: true }));
  }, []);
  const refreshCombos = useCallback(async () => {
    setCombos(await fetchAll("combos", { order: "nome", ascending: true }));
  }, []);
  const refreshCanais = useCallback(async () => {
    setCanais(await fetchAll("canais_venda", { order: "nome", ascending: true }));
  }, []);
  const refreshConfig = useCallback(async () => {
    const rows = await fetchAll("config_precificacao");
    if (rows[0]) setConfig(rows[0]);
  }, []);
  const refreshClientes = useCallback(async () => {
    setClientes(await fetchAll("clientes", { order: "nome", ascending: true }));
  }, []);
  const refreshFornecedores = useCallback(async () => {
    setFornecedores(await fetchAll("fornecedores", { order: "nome", ascending: true }));
  }, []);
  const refreshEstoque = useCallback(async () => {
    setEstoque(await fetchAll("v_estoque_atual", { order: "nome", ascending: true }));
  }, []);
  const refreshEstoqueLanches = useCallback(async () => {
    setEstoqueLanches(await fetchAll("v_estoque_lanches", { order: "nome", ascending: true }));
  }, []);
  const refreshProfiles = useCallback(async () => {
    setProfiles(await fetchAll("profiles", { order: "criado_em", ascending: true }));
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      await Promise.all([
        refreshBebidas(), refreshSabores(), refreshLanches(), refreshCombos(), refreshCanais(), refreshConfig(),
        refreshClientes(), refreshFornecedores(), refreshEstoque(), refreshEstoqueLanches(), refreshProfiles(),
      ]);
    } catch (e) {
      console.error(e);
      toast(`Erro ao carregar dados: ${e.message}`, "error");
    } finally {
      setLoading(false);
    }
  }, [refreshBebidas, refreshSabores, refreshLanches, refreshCombos, refreshCanais, refreshConfig, refreshClientes, refreshFornecedores, refreshEstoque, refreshEstoqueLanches, refreshProfiles, toast]);

  useEffect(() => { refreshAll(); }, [refreshAll]);

  const value = {
    session, profile, isAdmin: profile?.role === "admin",
    bebidas, sabores, lanches, combos, canais, config, clientes, fornecedores, estoque, estoqueLanches, profiles, loading,
    refreshBebidas, refreshSabores, refreshLanches, refreshCombos, refreshCanais, refreshConfig, refreshClientes,
    refreshFornecedores, refreshEstoque, refreshEstoqueLanches, refreshProfiles, refreshAll,
    toast,
    podeInstalar: !!promptInstalacao, instalarApp,
    pedidosPrecisandoAtencao, ativarAlertasPedido,
    signOut: () => supabase.auth.signOut(),
  };

  return html`
    <${AppDataContext.Provider} value=${value}>
      ${children}
      <div class="toast-container">
        ${toasts.map((t) => html`<div key=${t.id} class="toast ${t.type}">${t.message}</div>`)}
      </div>
    <//>
  `;
}
