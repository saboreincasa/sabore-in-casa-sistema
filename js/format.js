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

export function arredondaCima(v) {
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

// Bebidas são item de custo conhecido (commodity), não artesanal como a pizza — a margem
// alta da pizza não se aplica. Se a bebida já tem preço fixo calibrado (bebidas.preco_fixo),
// esse é o preço real de venda local/whatsapp; em canais com comissão (iFood/99Food), só
// repassa a comissão em cima desse preço fixo, sem aplicar a margem da pizza por cima.
// Sem preco_fixo definido, cai no cálculo padrão (fallback) até alguém precificar à mão.
export function precoBebidaSugerido(bebida, margemPct, comissaoPct, taxaPagamentoPct) {
  if (bebida?.preco_fixo != null && bebida.preco_fixo !== "") {
    const o = 1 - comissaoPct / 100;
    if (o <= 0.01) return null;
    return arredondaCima(Number(bebida.preco_fixo) / o);
  }
  return precoSugerido(Number(bebida?.custo || 0), margemPct, comissaoPct, taxaPagamentoPct);
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
