// Leitura de NF-e (nota fiscal eletronica) a partir do arquivo XML oficial.
// Zero IA, zero custo: o XML da NF-e ja traz os dados estruturados (produto,
// quantidade, preco) em campos padronizados pelo governo. Os campos "Trib"
// (qTrib/uTrib/vUnTrib) sao a quantidade/preco ja na unidade tributavel —
// para bebidas compradas em caixa, isso normalmente ja vem em unidades
// soltas, dispensando conversao manual de caixa->unidade.

export function parseNFeXML(xmlText) {
  const doc = new DOMParser().parseFromString(xmlText, "application/xml");
  if (doc.querySelector("parsererror")) throw new Error("Arquivo XML inválido ou corrompido.");
  const infNFe = doc.querySelector("infNFe");
  if (!infNFe) throw new Error("Este arquivo não parece ser um XML de NF-e (tag <infNFe> não encontrada).");

  const chave = (infNFe.getAttribute("Id") || "").replace(/^NFe/, "");
  const numero = doc.querySelector("ide > nNF")?.textContent || "";
  const serie = doc.querySelector("ide > serie")?.textContent || "";
  const emitNome = doc.querySelector("emit > xNome")?.textContent || doc.querySelector("emit > xFant")?.textContent || "";
  const emitCnpj = doc.querySelector("emit > CNPJ")?.textContent || "";
  const dhEmi = doc.querySelector("ide > dhEmi")?.textContent || doc.querySelector("ide > dEmi")?.textContent || "";
  const data = dhEmi ? dhEmi.slice(0, 10) : "";

  const itens = [...doc.querySelectorAll("det")].map((det) => {
    const prod = det.querySelector("prod");
    const txt = (sel) => prod?.querySelector(sel)?.textContent ?? null;
    const qCom = Number(txt("qCom") || 0);
    const uCom = txt("uCom") || "";
    const vUnCom = Number(txt("vUnCom") || 0);
    const qTribTxt = txt("qTrib");
    const vUnTribTxt = txt("vUnTrib");
    return {
      nItem: det.getAttribute("nItem"),
      cProd: txt("cProd") || "",
      xProd: txt("xProd") || "",
      qCom, uCom, vUnCom,
      qTrib: qTribTxt != null ? Number(qTribTxt) : qCom,
      uTrib: txt("uTrib") || uCom,
      vUnTrib: vUnTribTxt != null ? Number(vUnTribTxt) : vUnCom,
      vProd: Number(txt("vProd") || 0),
    };
  });

  if (itens.length === 0) throw new Error("Nenhum item (<det>) encontrado nesse XML.");

  return { chave, numero, serie, fornecedor: { nome: emitNome, cnpj: emitCnpj }, data, itens };
}

function tokenizar(s) {
  return (s || "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// Casa a descricao da nota (ex: "SPATEN N LT 473ML CX CARTAO C/12") contra o
// catalogo (ex: "Cerveja Spaten Munich 473ml") por sobreposicao de palavras.
// Sem IA: e so contagem de tokens em comum, nada probabilistico.
export function sugerirProduto(xProd, catalogo) {
  const tokensNota = new Set(tokenizar(xProd));
  let melhor = null;
  let melhorPct = 0;
  for (const item of catalogo) {
    const tokensCat = tokenizar(item.nome);
    if (tokensCat.length === 0) continue;
    const acertos = tokensCat.filter((t) => tokensNota.has(t)).length;
    const pct = acertos / tokensCat.length;
    if (pct > melhorPct) { melhorPct = pct; melhor = item; }
  }
  return melhorPct >= 0.5 ? melhor : null;
}
