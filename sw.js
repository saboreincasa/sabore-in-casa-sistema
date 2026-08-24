// sw.js — existe só pra satisfazer o requisito de instalação do navegador
// (Chrome/Edge só oferece "Instalar app" com um service worker ativo).
// Deliberadamente não guarda cache de nada: preço, estoque e caixa mudam o
// tempo todo, e o sistema sempre precisa do dado mais recente do Supabase -
// nunca de uma versão antiga guardada no aparelho.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {}); // não intercepta - sempre vai direto pra rede
