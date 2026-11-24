/* Ploion — versão web (interface). A lógica do grego está em nucleo.js. */
(function () {
  "use strict";
  var N = window.PloionNucleo;
  var VERSAO = "2.7";
  var IDIOMAS = [["pt", "Português"], ["en", "English"], ["es", "Español"], ["fr", "Français"],
    ["de", "Deutsch"], ["it", "Italiano"], ["ru", "Русский"], ["zh", "中文"], ["ar", "العربية"],
    ["el", "Ελληνικά"], ["ja", "日本語"], ["ko", "한국어"]];
  var PIX = "00020126770014br.gov.bcb.pix01365ed9d39b-e7fe-4647-b178-70e0762ee59d0215Ploion_(doacao)5204000053039865802BR5920DOUGLAS_SANI_PIMENTA6005COTIA62070503***63043CDC";
  var TEXTO_APOIO = [
    "O autor deste aplicativo funciona à base de curiosidade, empolgação e feijoada.",
    "Idealizei o Ploion porque queria um aplicativo fácil de usar nos meus estudos de grego antigo na faculdade. Por isso, é difícil descrever a alegria de vê-lo tomar forma diante dos meus olhos e poder oferecê-lo para que todos o usem de forma totalmente gratuita.",
    "Se você também gostou de usá-lo, recomende-o a todos que possam se interessar: seria uma honra saber que ele ajudou, nem que fosse um pouquinho.",
    "E, se quiser contribuir para alimentar este autor apaixonado por feijoada, é só escolher uma das formas de doação ao lado. Ficarei muitíssimo grato, e isso vai me motivar ainda mais a criar novos aplicativos gratuitos que possam ser úteis."
  ];
  var NOME_DIAC = {};
  NOME_DIAC[N.SUAVE] = "espírito suave"; NOME_DIAC[N.ASPERO] = "espírito áspero";
  NOME_DIAC[N.AGUDO] = "agudo"; NOME_DIAC[N.GRAVE] = "grave"; NOME_DIAC[N.CIRC] = "circunflexo";
  NOME_DIAC[N.IOTA_SUB] = "iota subscrito"; NOME_DIAC[N.DIERESE] = "diérese";
  NOME_DIAC[N.MACRON] = "mácron"; NOME_DIAC[N.BRAQUIA] = "bráquia";

  // ------------------------------------------------------------ estado
  var $ = function (id) { return document.getElementById(id); };
  var ta = $("texto");
  var toque = window.matchMedia("(pointer: coarse)").matches;
  var cfg = lerCfg();
  var trad = { interface: {}, dados: {} };
  var base = [], exprBruta = [], dic = null, indice = null;
  var shift = 0;              // 0 = minúsculas, 1 = próxima maiúscula, 2 = travado
  var anterior = "";          // valor do texto antes da última mudança (para o Beta Code no celular)
  var editando = false;       // mudanças feitas pelo próprio Ploion
  var compondo = false, antesDaComposicao = "";
  var selecionado = null;     // verbete aberto no dicionário

  function lerCfg() {
    var c = {};
    try { c = JSON.parse(localStorage.getItem("ploion_cfg") || "{}"); } catch (e) { c = {}; }
    var padrao = { idioma: "", tema: "", sigma: true, teclado: true, beta: true, aba: "translit", tam: 22 };
    Object.keys(padrao).forEach(function (k) { if (c[k] === undefined) c[k] = padrao[k]; });
    return c;
  }
  function salvarCfg() { try { localStorage.setItem("ploion_cfg", JSON.stringify(cfg)); } catch (e) {} }
  function meusVerbetes() {
    try { var l = JSON.parse(localStorage.getItem("ploion_meus_verbetes") || "[]"); return Array.isArray(l) ? l : []; }
    catch (e) { return []; }
  }
  function gravarMeus() {
    try { localStorage.setItem("ploion_meus_verbetes", JSON.stringify(dic.pessoais)); } catch (e) {}
  }

  // ------------------------------------------------------------ idioma
  function _(t) { var r = trad.interface[t]; return typeof r === "string" && r ? r : t; }
  function td(t) { var r = t && trad.dados[t]; return typeof r === "string" && r ? r : t; }
  function fmt(s, o) { return s.replace(/\{(\w+)\}/g, function (m, k) { return o[k] !== undefined ? o[k] : m; }); }

  function idiomaInicial() {
    if (cfg.idioma) return cfg.idioma;
    var nav = (navigator.languages || [navigator.language || "pt"]).map(function (l) { return l.slice(0, 2).toLowerCase(); });
    for (var i = 0; i < nav.length; i++)
      if (IDIOMAS.some(function (x) { return x[0] === nav[i]; })) return nav[i];
    return "en";
  }
  function carregarIdioma(cod) {
    if (cod === "pt") { trad = { interface: {}, dados: {} }; return Promise.resolve(); }
    return fetch("dados/idiomas/" + cod + ".json").then(function (r) { return r.json(); })
      .then(function (d) { trad = { interface: d.interface || {}, dados: d.dados || {} }; })
      .catch(function () { trad = { interface: {}, dados: {} }; });
  }
  function traduzirVerbete(v) {
    var n = Object.assign({}, v), cod = cfg.idioma;
    if (Array.isArray(v.significados)) {
      // verbetes do Middle Liddell/Dodson guardam o inglês: sem tradução, mostra o inglês
      var en = v.significados_en || [], emIngles = !!v.traducao_pendente;
      n.significados = v.significados.map(function (s, i) {
        var t = td(s);
        if (t === s && en.length && cod !== "pt" && i < en.length) { emIngles = true; return en[i]; }
        return t;
      });
      delete n.significados_en; delete n.traducao_pendente;
      if (emIngles && cod !== "en") n.em_ingles = true;
    }
    ["classe", "gram", "exemplo"].forEach(function (c) { if (typeof v[c] === "string") n[c] = td(v[c]); });
    if (typeof v.fonte === "string" && v.fonte.indexOf("meu") !== 0) n.fonte = td(v.fonte);
    return n;
  }
  function traduzirExpressao(e) {
    var n = Object.assign({}, e);
    ["literal", "sentido", "categoria", "uso", "exemplo", "fonte"].forEach(function (c) {
      if (typeof e[c] === "string") n[c] = td(e[c]);
    });
    return n;
  }
  var flexoes = null;  // formas flexionadas (ἔλυσα -> λύω), carregadas depois do resto
  function montarDados() {
    dic = new N.Dicionario(base.map(traduzirVerbete), meusVerbetes(), cfg.idioma, flexoes);
    indice = new N.IndiceExpressoes(exprBruta.map(traduzirExpressao));
  }
  function aplicarTextos() {
    var cod = cfg.idioma;
    document.documentElement.lang = cod === "pt" ? "pt-BR" : cod;
    document.documentElement.dir = cod === "ar" ? "rtl" : "ltr";
    document.querySelectorAll("[data-t]").forEach(function (el) { el.textContent = _(el.getAttribute("data-t")); });
    document.querySelectorAll(".t-sobre").forEach(function (el) { el.textContent = fmt(_("Sobre o {NOME_APP}"), { NOME_APP: "Ploion" }); });
    document.querySelectorAll(".t-sig").forEach(function (el) { el.textContent = _("Significados\n(um por linha):").replace("\n", " "); });
    document.querySelectorAll(".t-ex").forEach(function (el) { el.textContent = _("Exemplo\n(opcional):").replace("\n", " "); });
    $("b-teclado").title = _("Teclado virtual");
    $("versao").textContent = fmt(_("πλοῖον, “navio”  ·  versão {VERSAO}"), { VERSAO: VERSAO }) + " · " + _("Versão web");
    $("sobre-descricao").textContent = fmt(_("{NOME_APP} (do grego πλοῖον, “navio”) é uma ferramenta gratuita para escrever e ler grego antigo. Ele permite digitar o grego politônico com todos os acentos, espíritos e iota subscrito, seja pelo teclado na tela, seja pelo teclado do computador no sistema Beta Code. Enquanto você escreve, mostra a transliteração, uma tradução aproximada palavra por palavra e as expressões comuns do grego antigo, e basta um clique numa palavra para consultá-la no dicionário. Funciona sem internet e está disponível em {n} idiomas."), { NOME_APP: "Ploion", n: 12 });
    $("sobre-navio").textContent = fmt(_("Por que um navio? Um navio leva o que carrega de uma margem à outra; o {NOME_APP} leva o texto do grego para a sua língua."), { NOME_APP: "Ploion" });
    $("sobre-autor").textContent = fmt(_("Idealizado por {AUTOR}"), { AUTOR: "Douglas Sani Pimenta" });
    $("sobre-copy").textContent = "© 2026 Douglas Sani Pimenta";
    var ap = $("texto-apoio"); ap.textContent = "";
    TEXTO_APOIO.forEach(function (p) { var e = document.createElement("p"); e.textContent = _(p); ap.appendChild(e); });
    $("busca").placeholder = "λόγος · lo/gos · logos";
    $("filtro-expr").placeholder = _("Filtrar:").replace(":", "") + "…";
    var sel = $("sel-idioma");
    if (!sel.options.length) IDIOMAS.forEach(function (i) { var o = document.createElement("option"); o.value = i[0]; o.textContent = i[1]; sel.appendChild(o); });
    sel.value = cod;
  }

  // ------------------------------------------------------------ avisos
  var tempoAviso = null;
  function avisar(msg, erro, ms) {
    var a = $("aviso");
    a.textContent = msg; a.className = "aviso ver" + (erro ? " erro" : "");
    a.onclick = null;
    clearTimeout(tempoAviso);
    tempoAviso = setTimeout(function () { a.className = "aviso"; }, ms || 3200);
    return a;
  }
  function mensagemErro(r, base) {
    if (r.erro === "nao_letra") return fmt(_("“{base}” não é uma letra grega."), { base: base });
    if (r.erro === "quantidade") return _("Mácron e bráquia só se usam em α, ι, υ (as outras vogais já indicam se são longas ou breves).");
    if (r.erro === "nao_existe") {
      var nomes = r.sinais.map(function (m) { return _(NOME_DIAC[m]); }).join(" + ");
      return fmt(_("A combinação {base} + {sinais} não existe no grego politônico."), { base: base, sinais: nomes });
    }
    return "";
  }

  // ------------------------------------------------------------ edição do texto
  function substituir(ini, fim, novo) {
    editando = true;
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(ini, fim);
    var ok = false;
    try { ok = document.execCommand("insertText", false, novo); } catch (e) { ok = false; }
    if (!ok || ta.value.slice(ini, ini + novo.length) !== novo) {
      ta.setRangeText(novo, ini, fim, "end");
    }
    editando = false;
    aoMudar();
  }
  function selecao() { return [ta.selectionStart, ta.selectionEnd]; }
  var RE_LETRA = /[\p{L}\p{N}_]/u;
  function terminaEmSigmaMedio(antes) { return antes.length >= 2 && antes.slice(-1) === "σ" && RE_LETRA.test(antes.slice(-2, -1)); }

  /* Ações de digitação, todas sobre o texto antes do cursor ("antes"): devolvem o
     novo "antes" ou {erro}. Servem ao teclado virtual, ao teclado físico e ao celular. */
  function acaoLetra(antes, l) {
    if (cfg.sigma && antes.slice(-1) === "ς") antes = antes.slice(0, -1) + "σ";
    return antes + l;
  }
  function acaoOutro(antes, c) {
    if (cfg.sigma && terminaEmSigmaMedio(antes)) antes = antes.slice(0, -1) + "ς";
    return antes + c;
  }
  function acaoMarcas(antes, marcas) {
    var t = antes;
    for (var i = 0; i < marcas.length; i++) {
      var seg = N.ultimoGrafema(t);
      if (!seg) return { erro: "sem_letra" };
      var r = N.aplicarDiacritico(t, marcas[i]);
      if (r.erro) { r.base = N.decompor(seg).base; return r; }
      t = r.texto;
    }
    return t;
  }
  /* Aplica uma ação no cursor, trocando só o trecho final que mudou (mantém o Ctrl+Z). */
  function executar(fn) {
    var s = selecao(), antes = ta.value.slice(0, s[0]);
    var r = fn(antes);
    if (typeof r !== "string") {
      if (r && r.erro && r.erro !== "sem_letra") avisar(mensagemErro(r, r.base), true);
      return false;
    }
    var comum = 0, lim = Math.min(antes.length, r.length);
    while (comum < lim && antes[comum] === r[comum]) comum++;
    // não corta no meio de um par substituto
    if (comum > 0 && /[\uDC00-\uDFFF]/.test(antes[comum] || "")) comum--;
    substituir(comum, s[1], r.slice(comum));
    return true;
  }
  function digitarLetra(l) {
    if (shift) { l = l.toUpperCase(); if (shift === 1) { shift = 0; desenharTeclado(); } }
    executar(function (a) { return acaoLetra(a, l); });
  }

  // Beta Code e acentos vindos de qualquer teclado -> ação
  var ACENTO_LATINO = { "́": N.AGUDO, "̀": N.GRAVE, "̃": N.CIRC, "̂": N.CIRC, "̈": N.DIERESE };
  function converter(c) {
    if (N.BETA_LETRAS[c]) return { letra: N.BETA_LETRAS[c] };
    var lo = c.toLowerCase();
    if (N.BETA_LETRAS[lo]) return { letra: N.BETA_LETRAS[lo].toUpperCase() };
    if (N.BETA_DIAC[c]) return { marcas: [N.BETA_DIAC[c]] };
    if (N.ACENTOS_SOLTOS[c]) return { marcas: N.ACENTOS_SOLTOS[c] };
    if (N.BETA_PONTUACAO[c]) return { outro: N.BETA_PONTUACAO[c] };
    if (N.LETRAS_GREGAS.has(c) || c === "ς") return { letra: c };
    var d = Array.from(c.normalize("NFD"));
    if (d.length > 1) {
      var b = d[0], lb = b.toLowerCase(), letra = N.BETA_LETRAS[lb] || (N.LETRAS_GREGAS.has(lb) ? lb : null);
      var marcas = d.slice(1).map(function (m) { return ACENTO_LATINO[m] || (N.ORDEM.indexOf(m) >= 0 || N.QUANTIDADE.indexOf(m) >= 0 ? m : null); });
      if (letra && marcas.every(Boolean)) return { letra: b === lb ? letra : letra.toUpperCase(), marcas: marcas };
    }
    if (/^[\s.,;!?·’"()\-—«»\d]$/u.test(c)) return { outro: c };
    return null;
  }
  function aplicarConvertido(antes, c) {
    var a = converter(c);
    if (!a) return antes + c;
    if (a.letra) {
      var t = acaoLetra(antes, a.letra);
      if (a.marcas) { var r = acaoMarcas(t, a.marcas); return typeof r === "string" ? r : t; }
      return t;
    }
    if (a.marcas) { var r2 = acaoMarcas(antes, a.marcas); return typeof r2 === "string" ? r2 : r2; }
    return acaoOutro(antes, a.outro);
  }

  // teclado físico (computador): troca a tecla antes de ela entrar no texto
  ta.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.isComposing && cfg.sigma) {
      e.preventDefault(); executar(function (a) { return acaoOutro(a, "\n"); }); return;
    }
    if (!cfg.beta || e.ctrlKey || e.metaKey || e.altKey || e.isComposing || e.key.length !== 1) return;
    if (!converter(e.key)) return;
    e.preventDefault();
    executar(function (a) {
      var r = aplicarConvertido(a, e.key);
      return r;
    });
  });
  // celulares (teclados que não informam a tecla): converte o que acabou de entrar
  ta.addEventListener("compositionstart", function () { compondo = true; antesDaComposicao = anterior; });
  ta.addEventListener("compositionend", function () { compondo = false; converterDiferenca(antesDaComposicao); });
  ta.addEventListener("input", function (e) {
    if (editando) return;
    if (compondo || e.isComposing) return;
    // colar ou apagar não converte nada (um texto em português colado fica como está)
    if (e.inputType && !/^insert(Text|CompositionText|ReplacementText)$/.test(e.inputType)) { aoMudar(); return; }
    converterDiferenca(anterior);
  });
  function converterDiferenca(velho) {
    var novo = ta.value;
    if (!cfg.beta || novo === velho) { aoMudar(); return; }
    var p = 0, s = 0;
    while (p < velho.length && p < novo.length && velho[p] === novo[p]) p++;
    while (s < velho.length - p && s < novo.length - p && velho[velho.length - 1 - s] === novo[novo.length - 1 - s]) s++;
    var inserido = novo.slice(p, novo.length - s);
    if (!inserido || !Array.from(inserido).some(function (c) { return converter(c) && !N.LETRAS_GREGAS.has(c); })) { aoMudar(); return; }
    var antes = novo.slice(0, p);
    Array.from(inserido).forEach(function (c) { antes = aplicarConvertido(antes, c); });
    ta.value = antes + novo.slice(novo.length - s);
    ta.setSelectionRange(antes.length, antes.length);
    aoMudar();
  }

  // ------------------------------------------------------------ teclado virtual
  var FILAS = [["ς", "ε", "ρ", "τ", "υ", "θ", "ι", "ο", "π"],
               ["α", "σ", "δ", "φ", "γ", "η", "ξ", "κ", "λ"],
               ["⇧", "ζ", "χ", "ψ", "ω", "β", "ν", "μ", "⌫"]];
  var DIACS = [N.SUAVE, N.ASPERO, N.AGUDO, N.GRAVE, N.CIRC, N.IOTA_SUB, N.DIERESE, N.MACRON, N.BRAQUIA];
  function tecla(rotulo, classe, acao, titulo) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "tecla" + (classe ? " " + classe : "");
    b.textContent = rotulo; if (titulo) b.title = titulo;
    // pointerdown: não tira o foco do texto e responde na hora
    b.addEventListener("pointerdown", function (e) { e.preventDefault(); acao(); });
    b.addEventListener("click", function (e) { e.preventDefault(); });
    return b;
  }
  function fila(itens) { var f = document.createElement("div"); f.className = "fila"; itens.forEach(function (i) { f.appendChild(i); }); return f; }
  function desenharTeclado() {
    var k = $("teclado"); k.textContent = "";
    k.appendChild(fila(DIACS.map(function (m) {
      return tecla(("◌" + m).normalize("NFC"), "diac", function () {
        executar(function (a) { return acaoMarcas(a, [m]); });
      }, _(NOME_DIAC[m]));
    })));
    FILAS.forEach(function (linha) {
      k.appendChild(fila(linha.map(function (l) {
        if (l === "⇧") return tecla("⇧", "esp" + (shift === 1 ? " ligada" : shift === 2 ? " travada" : ""), function () {
          var agora = Date.now();
          shift = shift === 0 ? 1 : (shift === 1 && agora - (desenharTeclado.ultimoShift || 0) < 400) ? 2 : 0;
          desenharTeclado.ultimoShift = agora; desenharTeclado();
        }, _("Próxima letra maiúscula"));
        if (l === "⌫") return tecla("⌫", "esp", apagar);
        var mostra = shift && l !== "ς" ? l.toUpperCase() : l;
        return tecla(mostra, "", function () { digitarLetra(l === "ς" && shift ? "σ" : l); });
      })));
    });
    k.appendChild(fila([
      tecla(";", "", function () { executar(function (a) { return acaoOutro(a, ";"); }); }),
      tecla("·", "", function () { executar(function (a) { return acaoOutro(a, "·"); }); }),
      tecla("’", "", function () { executar(function (a) { return acaoOutro(a, "’"); }); }),
      tecla(",", "", function () { executar(function (a) { return acaoOutro(a, ","); }); }),
      tecla(_("espaço"), "barra", function () { executar(function (a) { return acaoOutro(a, " "); }); }),
      tecla(".", "", function () { executar(function (a) { return acaoOutro(a, "."); }); }),
      tecla("↵", "esp", function () { executar(function (a) { return acaoOutro(a, "\n"); }); })
    ]));
  }
  function apagar() {
    var s = selecao();
    if (s[0] !== s[1]) { substituir(s[0], s[1], ""); return; }
    if (!s[0]) return;
    var antes = ta.value.slice(0, s[0]), seg = N.ultimoGrafema(antes) || antes.slice(-1);
    // apaga a letra inteira (com os sinais); se for só um sinal solto, só ele
    substituir(s[0] - seg.length, s[0], "");
  }
  // segurar ⌫ apaga em sequência
  (function () {
    var t1 = null, t2 = null;
    $("teclado").addEventListener("pointerdown", function (e) {
      if (e.target.textContent !== "⌫") return;
      t1 = setTimeout(function () { t2 = setInterval(apagar, 70); }, 450);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach(function (ev) {
      $("teclado").addEventListener(ev, function () { clearTimeout(t1); clearInterval(t2); });
    });
  })();

  function aplicarModoTeclado() {
    $("teclado").hidden = !cfg.teclado;
    $("b-teclado").setAttribute("aria-pressed", cfg.teclado ? "true" : "false");
    // no celular, com o teclado virtual ligado, o teclado do aparelho não aparece
    ta.setAttribute("inputmode", toque && cfg.teclado ? "none" : "text");
  }

  // ------------------------------------------------------------ painéis
  var tempoPainel = null;
  function aoMudar() {
    anterior = ta.value;
    try { localStorage.setItem("ploion_texto", ta.value); } catch (e) {}
    clearTimeout(tempoPainel);
    tempoPainel = setTimeout(atualizarPaineis, 90);
    atualizarRapido();
  }
  function atualizarPaineis() {
    var t = ta.value;
    var tl = $("saida-translit");
    if (!t.trim()) { tl.innerHTML = ""; tl.appendChild(vazio()); }
    else tl.textContent = t.split("\n").map(N.transliterar).join("\n");
    var g = $("saida-glosa"); g.textContent = "";
    if (!t.trim()) { g.appendChild(vazio()); return; }
    N.glosaAproximada(t, dic, indice).forEach(function (par) {
      var s = par[0], o = par[1];
      if (!o) { g.appendChild(document.createTextNode(s)); return; }
      var sp = document.createElement("span");
      sp.textContent = s;
      if (o.expressao) { sp.className = "expr"; sp.title = o.grego; sp.onclick = function () { abrirExpressao(o.expressao); }; }
      else if (o.verbete) {
        var an = dic.analise(o.grego, o.verbete, _);
        sp.className = "pal"; sp.title = o.grego + (an ? " → " + o.verbete.lema + ": " + an : "");
        sp.onclick = function () { abrirVerbete(o.verbete); };
      }
      else sp.className = "desc";
      g.appendChild(sp);
    });
  }
  function vazio() {
    var p = document.createElement("p"); p.className = "vazio";
    p.textContent = _("Escreva algo em grego para ver aqui.");
    return p;
  }
  function palavraNoCursor() {
    var t = ta.value, pos = ta.selectionStart;
    var pals = N.palavrasComPosicao(t);
    for (var i = 0; i < pals.length; i++) if (pals[i][0] <= pos && pos <= pals[i][1]) return pals[i][2];
    return "";
  }
  var rapidoVerbete = null;
  function atualizarRapido() {
    if (!dic) return;
    var p = ta.selectionStart === ta.selectionEnd ? palavraNoCursor() : "";
    var v = p && N.temGrego(p) ? dic.glosar(p) : null;
    var r = $("rapido");
    if (!v) { r.hidden = true; rapidoVerbete = null; return; }
    rapidoVerbete = v;
    r.querySelector(".r-lema").textContent = v.lema;
    r.querySelector(".r-translit").textContent = N.transliterar(v.lema);
    r.querySelector(".r-sig").textContent = "— " + v.significados.join("; ");
    r.hidden = false;
  }
  ["click", "keyup", "select"].forEach(function (ev) { ta.addEventListener(ev, atualizarRapido); });
  document.addEventListener("selectionchange", function () { if (document.activeElement === ta) atualizarRapido(); });
  $("b-rapido-ver").onclick = function () { if (rapidoVerbete) abrirVerbete(rapidoVerbete); };

  function mostrarAba(nome) {
    cfg.aba = nome; salvarCfg();
    document.querySelectorAll(".abas button").forEach(function (b) {
      b.setAttribute("aria-selected", b.getAttribute("data-aba") === nome ? "true" : "false");
    });
    document.querySelectorAll(".painel").forEach(function (p) { p.hidden = p.id !== "p-" + nome; });
    if (nome === "quadro" && !$("quadro").firstChild) desenharQuadro();
    if (nome === "expressoes") filtrarExpr();
  }
  document.querySelectorAll(".abas button").forEach(function (b) {
    b.onclick = function () { mostrarAba(b.getAttribute("data-aba")); };
  });

  // --- dicionário ---
  function buscar() {
    var q = $("busca").value, lista = $("resultados"); lista.textContent = "";
    if (!q.trim()) { $("status-dic").textContent = fmt(_("{v0} verbetes. Digite para buscar."), { v0: dic.tamanho }); return; }
    var r = dic.buscar(q);
    var st = r.resultados.length ? fmt(_("{v0} resultado(s) para “{consulta}”."), { v0: r.resultados.length, consulta: q })
      : r.sugestoes.length ? fmt(_("Nada encontrado para “{consulta}”. Você quis dizer…"), { consulta: q })
      : fmt(_("Nada encontrado para “{consulta}”. Você pode incluí-lo com “Adicionar verbete”."), { consulta: q });
    $("status-dic").textContent = st;
    r.resultados.forEach(function (x) { lista.appendChild(itemLista(x[0], x[1])); });
    if (r.sugestoes.length) {
      if (r.resultados.length) { var sep = document.createElement("li"); sep.className = "sep"; sep.textContent = _("— Você quis dizer… —"); lista.appendChild(sep); }
      r.sugestoes.forEach(function (v) { lista.appendChild(itemLista(v, "")); });
    }
    var primeiro = r.resultados.length ? r.resultados[0][0] : null;
    if (primeiro) mostrarVerbete(primeiro);
  }
  function itemLista(v, nota) {
    var li = document.createElement("li");
    li.textContent = v.lema;
    var sm = document.createElement("small");
    var pre = "";
    if (nota && nota.forma_de) pre = fmt(_("(forma de {lema})"), { lema: nota.forma_de }) + " ";
    else if (nota && nota.forma) {
      var an = flexoes ? flexoes.descrever(nota.ids, _) : "";
      pre = "(" + nota.forma + (an ? ": " + an : "") + ") ";
    }
    sm.textContent = pre + v.significados[0];
    li.appendChild(sm);
    li.onclick = function () { mostrarVerbete(v); };
    li._v = v;
    return li;
  }
  function mostrarVerbete(v) {
    selecionado = v;
    $("b-editar").disabled = false;
    document.querySelectorAll("#resultados li").forEach(function (li) { li.classList.toggle("sel", li._v === v); });
    var a = $("verbete"); a.textContent = "";
    function el(tag, cls, txt) { var e = document.createElement(tag); if (cls) e.className = cls; if (txt !== undefined) e.textContent = txt; a.appendChild(e); return e; }
    var cab = el("div");
    var l = document.createElement("span"); l.className = "lema"; l.textContent = v.lema; cab.appendChild(l);
    if (v.gram) { var g = document.createElement("span"); g.className = "gram"; g.textContent = ", " + v.gram; cab.appendChild(g); }
    if (N.ehMeu(v)) { var m = document.createElement("span"); m.className = "meu"; m.textContent = "meu"; cab.appendChild(m); }
    el("div", "info", v.classe + "  ·  " + N.transliterar(v.lema));
    var ol = el("ol"); v.significados.forEach(function (s) { var li = document.createElement("li"); li.textContent = s; ol.appendChild(li); });
    if (v.exemplo) { var p = el("p"); p.innerHTML = ""; var r = document.createElement("span"); r.className = "rot"; r.textContent = _("\nExemplo: ").trim() + " "; p.appendChild(r); var gg = document.createElement("span"); gg.className = "grego"; gg.textContent = v.exemplo; p.appendChild(gg); }
    if (v.formas && v.formas.length) { var p2 = el("p"); var r2 = document.createElement("span"); r2.className = "rot"; r2.textContent = _("\nFormas que levam a este verbete: ").trim() + " "; p2.appendChild(r2); var g2 = document.createElement("span"); g2.className = "grego"; g2.textContent = v.formas.join(", "); p2.appendChild(g2); }
    if (v.em_ingles) el("div", "fonte", _("\nSignificados em inglês (tradução em andamento).").trim());
    el("div", "fonte", fmt(_("\nFonte: {fonte}"), { fonte: v.fonte }).trim());
  }
  function abrirVerbete(v) {
    mostrarAba("dicionario");
    $("busca").value = v.lema;
    buscar();
    mostrarVerbete(v);
  }
  var tempoBusca = null;
  $("busca").addEventListener("input", function () { clearTimeout(tempoBusca); tempoBusca = setTimeout(buscar, 120); });

  // --- verbete pessoal ---
  var lemaEditado = null;
  function abrirFormulario(v) {
    lemaEditado = v ? v.lema : null;
    $("t-verbete").textContent = v ? _("Editar verbete") : _("Adicionar verbete");
    $("v-lema").value = v ? v.lema : ($("busca").value && N.temGrego($("busca").value) ? $("busca").value : "");
    $("v-gram").value = v ? v.gram : "";
    $("v-classe").value = v ? v.classe : "";
    $("v-sig").value = v ? v.significados.join("\n") : "";
    $("v-ex").value = v ? v.exemplo : "";
    $("b-v-excluir").hidden = !(v && N.ehMeu(v));
    $("d-verbete").showModal();
  }
  $("b-novo").onclick = function () { abrirFormulario(null); };
  $("b-editar").onclick = function () { if (selecionado) abrirFormulario(selecionado); };
  $("b-v-beta").onclick = function () {
    try { $("v-lema").value = N.betaParaGrego($("v-lema").value); }
    catch (e) { avisar(_("O lema precisa estar em grego.\nDigite em Beta Code e use “Beta Code → grego”."), true); }
  };
  $("f-verbete").addEventListener("submit", function (e) {
    e.preventDefault();
    var lema = N.nfc($("v-lema").value.trim());
    if (!N.temGrego(lema)) { avisar(_("O lema precisa estar em grego.\nDigite em Beta Code e use “Beta Code → grego”."), true); return; }
    var sigs = $("v-sig").value.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
    if (!sigs.length) { avisar(_("Escreva pelo menos um significado."), true); return; }
    var v = N.prepararVerbete({ lema: lema, gram: $("v-gram").value.trim(), classe: $("v-classe").value.trim() || _("não informada"),
                                significados: sigs, exemplo: $("v-ex").value.trim(), fonte: "meu" }, "meu");
    dic.salvarPessoal(v, lemaEditado);
    gravarMeus();
    $("d-verbete").close();
    avisar(fmt(_("Verbete “{lema}” salvo no seu dicionário."), { lema: lema }));
    abrirVerbete(dic.glosar(lema) || v);
    atualizarPaineis();
  });
  $("b-v-excluir").onclick = function () {
    if (!lemaEditado || !confirm(fmt(_("Excluir “{lema}” do seu dicionário?"), { lema: lemaEditado }))) return;
    dic.excluirPessoal(lemaEditado); gravarMeus();
    $("d-verbete").close(); $("verbete").textContent = ""; selecionado = null; $("b-editar").disabled = true;
    buscar(); atualizarPaineis();
  };

  // --- expressões ---
  function filtrarExpr() {
    var lista = N.filtrarExpressoes(indice.expressoes, $("filtro-expr").value, cfg.idioma), caixa = $("lista-expr");
    caixa.textContent = "";
    $("status-expr").textContent = lista.length ? fmt(_("{v0} expressão(ões)"), { v0: lista.length }) : _("Nada encontrado para este filtro.");
    lista.forEach(function (e) { caixa.appendChild(cartaoExpr(e)); });
  }
  function cartaoExpr(e) {
    var c = document.createElement("div"); c.className = "cartao";
    var cab = document.createElement("div"); cab.className = "cab";
    var gr = document.createElement("span"); gr.className = "gr"; gr.textContent = e.expressao; gr.dir = "ltr";
    var cat = document.createElement("span"); cat.className = "cat"; cat.textContent = e.categoria;
    cab.appendChild(gr); cab.appendChild(cat); c.appendChild(cab);
    function linha(rot, txt) { if (!txt) return; var p = document.createElement("p"); var b = document.createElement("b"); b.textContent = rot + ": "; p.appendChild(b); p.appendChild(document.createTextNode(txt)); c.appendChild(p); }
    linha(_("Tradução literal"), e.literal);
    linha(_("Sentido para um grego antigo"), e.sentido);
    linha(_("Uso"), e.uso);
    var b = document.createElement("button"); b.type = "button"; b.textContent = _("Inserir no texto");
    b.onclick = function () {
      var s = selecao(), antes = ta.value.slice(0, s[0]);
      var sep = antes && !/\s$/.test(antes) ? " " : "";
      substituir(s[0], s[1], sep + e.expressao);
      avisar(fmt(_("Inserido: {expressao}"), { expressao: e.expressao }));
    };
    c.appendChild(b);
    c._e = e;
    return c;
  }
  function abrirExpressao(e) {
    mostrarAba("expressoes");
    $("filtro-expr").value = e.expressao; filtrarExpr();
  }
  $("filtro-expr").addEventListener("input", function () { clearTimeout(tempoBusca); tempoBusca = setTimeout(filtrarExpr, 120); });

  // --- quadro de caracteres ---
  function desenharQuadro() {
    var q = $("quadro"); q.textContent = "";
    function grade(titulo, linhas, colunas) {
      var h = document.createElement("h4"); h.textContent = titulo; q.appendChild(h);
      var g = document.createElement("div"); g.className = "grade"; g.dir = "ltr";
      g.style.gridTemplateColumns = "repeat(" + colunas.length + ", minmax(38px, 1fr))";
      linhas.forEach(function (base) {
        colunas.forEach(function (marcas) {
          var c = N.formaDoQuadro(base, marcas, false), b = document.createElement("button");
          b.type = "button";
          if (!c) { b.className = "vazia"; b.disabled = true; }
          else {
            b.textContent = c;
            b.addEventListener("pointerdown", function (e) { e.preventDefault(); });
            b.onclick = function () { executar(function (a) { return /^\p{L}/u.test(c) ? acaoLetra(a, c) : acaoOutro(a, c); }); };
          }
          g.appendChild(b);
        });
      });
      q.appendChild(g);
    }
    grade(_("Vogais e ρ"), ["α", "ε", "η", "ι", "ο", "υ", "ω", "ρ"], N.COLUNAS_VOGAIS);
    grade(_("Iota subscrito"), ["α", "η", "ω"], N.COLUNAS_VOGAIS.slice(0, 12).map(function (m) { return m.concat([N.IOTA_SUB]); }));
    grade(_("Maiúsculas"), ["Α", "Ε", "Η", "Ι", "Ο", "Υ", "Ω", "Ρ"], N.COLUNAS_VOGAIS.slice(0, 12));
    var cons = "βγδζθκλμνξπρσςτφχψ·;’".split("");
    grade(_("Consoantes e pontuação"), cons, [[]]);
    q.lastChild.style.gridTemplateColumns = "repeat(auto-fill, minmax(42px, 1fr))";
  }

  // ------------------------------------------------------------ barra e menus
  $("b-copiar").onclick = function () {
    var t = ta.value;
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () {
      avisar(_("Texto copiado para a área de transferência."));
    }, function () { ta.select(); document.execCommand("copy"); avisar(_("Texto copiado para a área de transferência.")); });
  };
  $("b-limpar").onclick = function () {
    if (!ta.value) return;
    substituir(0, ta.value.length, "");
    avisar(_("Texto apagado (Ctrl+Z desfaz).").replace(/\s*\(.*\)/, ""));
  };
  $("b-teclado").onclick = function () { cfg.teclado = !cfg.teclado; salvarCfg(); aplicarModoTeclado(); $("op-teclado").checked = cfg.teclado; ta.focus(); };
  function abrir(id) { var d = $(id); if (!d.open) d.showModal(); }
  document.querySelectorAll("dialog").forEach(function (d) {
    d.addEventListener("click", function (e) { if (e.target === d) d.close(); });
    d.querySelectorAll("[data-fechar]").forEach(function (b) { b.onclick = function () { d.close(); }; });
  });
  $("b-menu").onclick = function () { abrir("d-menu"); };
  $("b-apoio").onclick = function () { abrir("d-apoio"); };
  $("b-apoio2").onclick = function () { $("d-menu").close(); abrir("d-apoio"); };
  $("b-sobre").onclick = function () { $("d-menu").close(); abrir("d-sobre"); };
  $("b-pix").onclick = function () {
    (navigator.clipboard ? navigator.clipboard.writeText(PIX) : Promise.reject()).then(function () {
      avisar(_("Código Pix copiado. Cole no app do seu banco."));
    }, function () { prompt("Pix", PIX); });
  };
  function ligar(id, chave, depois) {
    var c = $(id); c.checked = !!cfg[chave];
    c.onchange = function () { cfg[chave] = c.checked; salvarCfg(); if (depois) depois(); };
  }
  ligar("op-teclado", "teclado", aplicarModoTeclado);
  ligar("op-beta", "beta");
  ligar("op-sigma", "sigma");
  $("op-escuro").checked = cfg.tema === "escuro";
  $("op-escuro").onchange = function () { cfg.tema = this.checked ? "escuro" : "claro"; salvarCfg(); aplicarTema(); };
  function aplicarTema() {
    var escuro = cfg.tema ? cfg.tema === "escuro" : window.matchMedia("(prefers-color-scheme: dark)").matches;
    document.documentElement.setAttribute("data-tema", escuro ? "escuro" : "claro");
    $("op-escuro").checked = escuro;
    document.querySelector('meta[name="theme-color"]').content = escuro ? "#121a24" : "#1b3a5c";
  }
  function aplicarTamanho() { document.documentElement.style.setProperty("--tam", cfg.tam + "px"); }
  $("b-menor").onclick = function () { cfg.tam = Math.max(14, cfg.tam - 2); salvarCfg(); aplicarTamanho(); };
  $("b-maior").onclick = function () { cfg.tam = Math.min(44, cfg.tam + 2); salvarCfg(); aplicarTamanho(); };
  $("sel-idioma").onchange = function () { mudarIdioma(this.value); };
  function mudarIdioma(cod) {
    cfg.idioma = cod; salvarCfg();
    return carregarIdioma(cod).then(function () {
      montarDados(); aplicarTextos(); desenharTeclado(); $("quadro").textContent = "";
      atualizarPaineis(); buscar(); filtrarExpr(); mostrarAba(cfg.aba);
    });
  }

  // instalar
  var pedidoInstalar = null;
  var instalado = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault(); pedidoInstalar = e; $("b-instalar").hidden = false; $("dica-instalar").hidden = true;
  });
  $("b-instalar").onclick = function () {
    if (!pedidoInstalar) return;
    pedidoInstalar.prompt();
    pedidoInstalar.userChoice.then(function () { pedidoInstalar = null; $("b-instalar").hidden = true; });
  };
  if (!instalado) setTimeout(function () { if (!pedidoInstalar) $("dica-instalar").hidden = false; }, 1500);

  // service worker (funcionar sem internet e se atualizar sozinho)
  if ("serviceWorker" in navigator && location.protocol !== "file:") {
    navigator.serviceWorker.register("sw.js").then(function (reg) {
      function oferecer(w) {
        var a = avisar(_("Nova versão disponível. Toque para atualizar."), false, 20000);
        a.onclick = function () { w.postMessage("atualizar"); };
      }
      if (reg.waiting && navigator.serviceWorker.controller) oferecer(reg.waiting);
      reg.addEventListener("updatefound", function () {
        var w = reg.installing;
        w.addEventListener("statechange", function () {
          if (w.state === "installed" && navigator.serviceWorker.controller) oferecer(w);
        });
      });
    }).catch(function () {});
    var recarregou = false;
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (!recarregou) { recarregou = true; location.reload(); }
    });
  }

  function carregarFlexoes() {  // arquivo opcional: sem ele, o app funciona como antes
    fetch("dados/formas_flexionadas.json").then(function (r) {
      if (!r.ok) throw new Error(r.status);
      return r.json();
    }).then(function (d) {
      if (!d || !d.lemas || !d.lemas.length) return;  // arquivo vazio: ainda não gerado
      flexoes = new N.Flexoes(d);
      if (dic) dic.flexoes = flexoes;
      $("credito-formas").hidden = false;
      aoMudar();
    }).catch(function () {});
  }

  // ------------------------------------------------------------ início
  cfg.idioma = idiomaInicial();
  aplicarTema(); aplicarTamanho(); aplicarModoTeclado();
  try { ta.value = localStorage.getItem("ploion_texto") || ""; } catch (e) {}
  Promise.all([
    fetch("dados/dicionario_grego.json").then(function (r) { return r.json(); }),
    fetch("dados/expressoes_gregas.json").then(function (r) { return r.json(); }),
    carregarIdioma(cfg.idioma)
  ]).then(function (res) {
    base = res[0]; exprBruta = res[1];
    montarDados(); aplicarTextos(); desenharTeclado();
    aoMudar(); atualizarPaineis(); buscar(); mostrarAba(cfg.aba);
    if (!toque) ta.focus();
    document.documentElement.classList.add("pronto");
    carregarFlexoes();
  }).catch(function (e) {
    avisar("Não consegui carregar os dados do Ploion. Verifique a conexão e recarregue a página.", true, 15000);
    console.error(e);
  });
  window.Ploion = { cfg: cfg, get dic() { return dic; }, get indice() { return indice; }, mudarIdioma: mudarIdioma,
                    digitarLetra: digitarLetra, executar: executar, acaoMarcas: acaoMarcas, acaoOutro: acaoOutro };
})();
