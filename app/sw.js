/* Ploion — service worker: guarda o app no aparelho para funcionar sem internet.
   A versão muda sozinha quando qualquer arquivo muda (gerada por montar_sw.py). */
var VERSAO = "ploion-cedc27b085";
var ARQUIVOS = [
  "./",
  "app.js",
  "dados/dicionario_grego.json",
  "dados/expressoes_gregas.json",
  "dados/idiomas/ar.json",
  "dados/idiomas/de.json",
  "dados/idiomas/el.json",
  "dados/idiomas/en.json",
  "dados/idiomas/es.json",
  "dados/idiomas/fr.json",
  "dados/idiomas/it.json",
  "dados/idiomas/ja.json",
  "dados/idiomas/ko.json",
  "dados/idiomas/ru.json",
  "dados/idiomas/zh.json",
  "estilo.css",
  "fontes/cardo-bold.woff",
  "fontes/cardo-italic.woff",
  "fontes/cardo-regular.woff",
  "icones/apple-180.png",
  "icones/beta.png",
  "icones/copiar.png",
  "icones/dicionario.png",
  "icones/escuro.png",
  "icones/expressoes.png",
  "icones/favicon-32.png",
  "icones/icone-192.png",
  "icones/icone-512.png",
  "icones/idioma.png",
  "icones/limpar.png",
  "icones/maskable-512.png",
  "icones/navio.png",
  "icones/pix_qrcode.png",
  "icones/quadro.png",
  "icones/sigma.png",
  "icones/sobre.png",
  "icones/tamanho.png",
  "icones/teclado.png",
  "icones/traducao.png",
  "icones/translit.png",
  "index.html",
  "manifest.webmanifest",
  "nucleo.js"
];
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(VERSAO).then(function (c) { return c.addAll(ARQUIVOS); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (nomes) {
    return Promise.all(nomes.filter(function (n) { return n.indexOf("ploion-") === 0 && n !== VERSAO; })
                            .map(function (n) { return caches.delete(n); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("message", function (e) { if (e.data === "atualizar") self.skipWaiting(); });
// formas_flexionadas.txt é grande e pode ser trocado sem nova versão do app: fica num
// cache próprio e é atualizado em segundo plano (mostra o guardado e revalida).
var CACHE_FORMAS = "formas-ploion";
function formasAtualizadas(req) {
  return fetch(req, { cache: "no-cache" }).then(function (r) {
    if (r.ok) { var copia = r.clone(); caches.open(CACHE_FORMAS).then(function (c) { c.put(req, copia); }); }
    return r;
  });
}
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  if (e.request.url.indexOf("formas_flexionadas.txt") >= 0) {
    e.respondWith(caches.open(CACHE_FORMAS).then(function (c) {
      return c.match(e.request, { ignoreSearch: true }).then(function (guardado) {
        var rede = formasAtualizadas(e.request);
        if (guardado) { e.waitUntil(rede.catch(function () {})); return guardado; }
        return rede;
      });
    }));
    return;
  }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(function (r) {
    return r || fetch(e.request);
  }));
});
