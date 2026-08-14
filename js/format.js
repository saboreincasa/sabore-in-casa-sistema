export function brl(v) {
  const n = Number(v || 0);
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function pct(v, casas = 1) {
  return `${Number(v || 0).toFixed(casas)}%`;
}

export function dataCurta(v) {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v.length <= 10 ? `${v}T00:00:00` : v) : v;
  return d.toLocaleDateString("pt-BR");
}

export function dataHora(v) {
  if (!v) return "";
  const d = typeof v === "string" ? new Date(v) : v;
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function hojeISO() {
  const d = new Date();
  const tz = d.getTimezoneOffset() * 60000;
  return new Date(d - tz).toISOString().slice(0, 10);
}

function arredondaCima(v) {
  return Math.ceil(v * 10) / 10;
}

// Preço sugerido para atingir a margem desejada após comissão + taxa de pagamento do canal.
// custo / ((1 - margem%) * (1 - (comissao% + taxaPagamento%)))
export function precoSugerido(custo, margemPct, comissaoPct, taxaPagamentoPct) {
  const l = 1 - margemPct / 100;
  const o = 1 - (comissaoPct + taxaPagamentoPct) / 100;
  if (l <= 0.01 || o <= 0.01) return null;
  return arredondaCima(custo / (l * o));
}

export function margemRealizada(preco, custo) {
  if (!preco) return 0;
  return ((preco - custo) / preco) * 100;
}

export function initials(nome) {
  if (!nome) return "?";
  const parts = nome.trim().split(/\s+/);
  return (parts[0][0] + (parts[1]?.[0] || "")).toUpperCase();
}
