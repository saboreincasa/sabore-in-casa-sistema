import { React, html, useState, useEffect, useCallback, createContext, useContext } from "./lib.js";
import { supabase } from "./supabaseClient.js";

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
