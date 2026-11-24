/* Ploion — núcleo (lógica do grego), versão web.
   Tradução fiel das funções do ploion.py (seção 2. LÓGICA). Não depende da interface:
   roda no navegador e no Node (testes de paridade com o Python). */
(function (raiz) {
  "use strict";

  // ---------------------------------------------------------------- diacríticos
  var SUAVE = "̓", ASPERO = "̔", AGUDO = "́", GRAVE = "̀",
      CIRC = "͂", IOTA_SUB = "ͅ", DIERESE = "̈",
      MACRON = "̄", BRAQUIA = "̆";
  var ORDEM = [DIERESE, SUAVE, ASPERO, AGUDO, GRAVE, CIRC, IOTA_SUB];
  var QUANTIDADE = [MACRON, BRAQUIA];
  var GRUPOS = [[SUAVE, ASPERO], [AGUDO, GRAVE, CIRC], [MACRON, BRAQUIA]];

  var MINUSCULAS = "αβγδεζηθικλμνξοπρσςτυφχψω";
  var LETRAS_GREGAS = new Set();
  for (var i = 0; i < MINUSCULAS.length; i++) {
    var l = MINUSCULAS[i];
    LETRAS_GREGAS.add(l);
    if (l !== "ς") LETRAS_GREGAS.add(l.toUpperCase());
  }

  var BETA_LETRAS = {
    a: "α", b: "β", g: "γ", d: "δ", e: "ε", z: "ζ", h: "η", q: "θ", i: "ι", k: "κ",
    l: "λ", m: "μ", n: "ν", c: "ξ", o: "ο", p: "π", r: "ρ", s: "σ", t: "τ", u: "υ",
    f: "φ", x: "χ", y: "ψ", w: "ω"
  };
  var BETA_DIAC = {
    ")": SUAVE, "(": ASPERO, "/": AGUDO, "\\": GRAVE, "=": CIRC,
    "|": IOTA_SUB, "+": DIERESE, "_": MACRON, "^": BRAQUIA
  };
  var BETA_PONTUACAO = { ":": "·", "'": "’" };
  var ACENTOS_SOLTOS = {
    "´": [AGUDO], "`": [GRAVE], "~": [CIRC], "¨": [DIERESE],
    "΄": [AGUDO], "΅": [DIERESE, AGUDO], "῀": [CIRC], "᾿": [SUAVE], "῾": [ASPERO]
  };

  var RE_MARCA = /\p{M}/u;
  function combinante(c) { return RE_MARCA.test(c); }
  function nfc(t) { return t.normalize("NFC"); }
  function nfd(t) { return t.normalize("NFD"); }

  function alternar(marcas, marca) {
    var novas = new Set(marcas);
    if (novas.has(marca)) { novas.delete(marca); return novas; }
    GRUPOS.forEach(function (g) {
      if (g.indexOf(marca) >= 0) g.forEach(function (m) { novas.delete(m); });
    });
    novas.add(marca);
    return novas;
  }

  /* Devolve {texto} ou {erro: código}. Códigos: "nao_letra", "nao_existe", "quantidade". */
  function compor(base, marcas) {
    marcas = new Set(marcas);
    if (!marcas.size) return { texto: base };
    if (!LETRAS_GREGAS.has(base)) return { erro: "nao_letra" };
    var principais = ORDEM.filter(function (m) { return marcas.has(m); });
    var quant = QUANTIDADE.filter(function (m) { return marcas.has(m); });
    var res = base;
    if (principais.length) {
      res = nfc(base + principais.join(""));
      if (Array.from(res).length !== 1) return { erro: "nao_existe", sinais: principais };
    }
    if (quant.length) {
      if ("αιυ".indexOf(base.toLowerCase()) < 0) return { erro: "quantidade" };
      var d = Array.from(nfd(res));
      res = nfc(d[0] + quant.join("") + d.slice(1).join(""));
    }
    return { texto: res };
  }

  function decompor(seg) {
    var d = Array.from(nfd(seg));
    return { base: d[0], marcas: new Set(d.slice(1)) };
  }

  /* Último caractere visível (letra + combinantes), em unidades do JS (string). */
  function ultimoGrafema(texto) {
    var cs = Array.from(texto), j = cs.length;
    while (j > 0 && combinante(cs[j - 1])) j--;
    if (j === 0) return "";
    return cs.slice(j - 1).join("");
  }

  var RE_SIGMA = /(?<=[\p{L}\p{N}_])σ(?![\p{L}\p{N}_])/gu;
  function aplicarSigmaFinal(t) { return t.replace(RE_SIGMA, "ς"); }

  /* Aplica um diacrítico à última letra do texto. Devolve {texto} ou {erro}. */
  function aplicarDiacritico(texto, marca) {
    var seg = ultimoGrafema(texto);
    if (!seg) return { erro: "sem_letra" };
    var d = decompor(seg);
    var r = compor(d.base, alternar(d.marcas, marca));
    if (r.erro) return r;
    return { texto: texto.slice(0, texto.length - seg.length) + r.texto };
  }

  // ---------------------------------------------------------- transliteração
  var TRANSLIT = {
    "α": "a", "β": "b", "γ": "g", "δ": "d", "ε": "e", "ζ": "z", "η": "ē",
    "θ": "th", "ι": "i", "κ": "k", "λ": "l", "μ": "m", "ν": "n", "ξ": "x",
    "ο": "o", "π": "p", "ρ": "r", "σ": "s", "ς": "s", "τ": "t", "υ": "y",
    "φ": "ph", "χ": "ch", "ψ": "ps", "ω": "ō"
  };
  var DITONGOS = { "αι": "ai", "ει": "ei", "οι": "oi", "υι": "ui", "αυ": "au",
                   "ευ": "eu", "ου": "ou", "ηυ": "ēu", "ωυ": "ōu" };
  var COM_MACRON = { a: "ā", i: "ī", y: "ȳ" };
  var PONT_TRANSLIT = { "·": ";", "·": ";", ";": "?", ";": "?", "’": "'" };

  function ordenarCodigos(arr) {
    return arr.slice().sort(function (a, b) { return a < b ? -1 : a > b ? 1 : 0; });
  }

  function transliterar(texto) {
    var u = [];
    Array.from(nfd(texto)).forEach(function (c) {
      if (combinante(c) && u.length) u[u.length - 1][1].add(c);
      else u.push([c, new Set()]);
    });
    var saida = [], i = 0, n = u.length;
    while (i < n) {
      var base = u[i][0], marcas = u[i][1], minus = base.toLowerCase();
      var maiuscula = base !== minus, s;
      if (!Object.prototype.hasOwnProperty.call(TRANSLIT, minus)) {
        saida.push((PONT_TRANSLIT[base] || base) + ordenarCodigos(Array.from(marcas)).join(""));
        i++;
        continue;
      }
      var prox = i + 1 < n ? u[i + 1] : null;
      var par = prox ? minus + prox[0].toLowerCase() : "";
      if (DITONGOS[par] && !prox[1].has(DIERESE) && !marcas.has(IOTA_SUB)) {
        s = DITONGOS[par];
        if (marcas.has(ASPERO) || prox[1].has(ASPERO)) s = "h" + s;
        i += 2;
      } else if (minus === "γ" && prox && "γκξχ".indexOf(prox[0].toLowerCase()) >= 0) {
        s = "n"; i++;
      } else if (minus === "ρ") {
        s = marcas.has(ASPERO) ? "rh" : "r"; i++;
      } else {
        s = TRANSLIT[minus];
        if (marcas.has(MACRON) && COM_MACRON[s]) s = COM_MACRON[s];
        if (marcas.has(IOTA_SUB)) s += "i";
        if (marcas.has(ASPERO)) s = "h" + s;
        i++;
      }
      if (maiuscula) s = s[0].toUpperCase() + s.slice(1);
      saida.push(s);
    }
    return saida.join("");
  }

  function betaParaGrego(beta, sigmaFinal) {
    if (sigmaFinal === undefined) sigmaFinal = true;
    var texto = "";
    Array.from(beta).forEach(function (c) {
      if (BETA_LETRAS[c]) texto += BETA_LETRAS[c];
      else if (BETA_LETRAS[c.toLowerCase()]) texto += BETA_LETRAS[c.toLowerCase()].toUpperCase();
      else if (BETA_DIAC[c]) {
        var r = aplicarDiacritico(texto, BETA_DIAC[c]);
        if (r.erro) throw new Error(r.erro);
        texto = r.texto;
      } else texto += BETA_PONTUACAO[c] || c;
    });
    if (sigmaFinal) texto = aplicarSigmaFinal(texto);
    return nfc(texto);
  }

  // ------------------------------------------------------------------- busca
  function temGrego(t) {
    for (var c of t) {
      var o = c.codePointAt(0);
      if ((o >= 0x370 && o <= 0x3FF) || (o >= 0x1F00 && o <= 0x1FFF)) return true;
    }
    return false;
  }
  function ehCjk(t) {
    for (var c of t) {
      var o = c.codePointAt(0);
      if ((o >= 0x2E80 && o <= 0x9FFF) || (o >= 0xF900 && o <= 0xFAFF) ||
          (o >= 0xAC00 && o <= 0xD7AF) || (o >= 0x1100 && o <= 0x11FF)) return true;
    }
    return false;
  }
  function semDiacriticos(t) {
    return Array.from(nfd(t.toLowerCase())).filter(function (c) { return !combinante(c); }).join("");
  }
  var RE_ALFA = /\p{L}/u, RE_ALNUM = /[\p{L}\p{N}]/u;
  function chaveGrega(t) {
    var s = semDiacriticos(t).replace(/ς/g, "σ");
    return Array.from(s).filter(function (c) { return RE_ALFA.test(c) || c === " "; }).join("").trim();
  }
  function chaveLatina(t) {
    var s = Array.from(semDiacriticos(t)).filter(function (c) {
      return !BETA_DIAC[c] && c !== "*";
    }).join("");
    s = Array.from(s).map(function (c) { return RE_ALNUM.test(c) ? c : " "; }).join("");
    return s.split(/\s+/).filter(Boolean).join(" ");
  }
  function latimParaGrego(t) {
    return Array.from(chaveLatina(t)).map(function (c) { return BETA_LETRAS[c] || c; }).join("");
  }
  var RE_PALAVRA_W = /[\p{L}\p{N}_]+/gu;
  function normalizarPt(t) { return (semDiacriticos(t).match(RE_PALAVRA_W) || []).join(" "); }
  function segmentosPt(sig) {
    return sig.split(/[,;()/，；（）／、،؛]/).map(normalizarPt).filter(Boolean);
  }
  function comparar(busca, chave) {
    if (!busca || !chave) return null;
    if (chave === busca) return 0;
    if (chave.startsWith(busca)) return 1;
    if (chave.indexOf(busca) >= 0) return 2;
    return null;
  }
  function rankPortugues(pt, norm, segs) {
    if (!pt) return null;
    if (segs.indexOf(pt) >= 0) return 0;
    if ((" " + norm + " ").indexOf(" " + pt + " ") >= 0 ||
        segs.some(function (s) { return s.startsWith(pt); })) return 1;
    if ((Array.from(pt).length >= 3 || ehCjk(pt)) && norm.indexOf(pt) >= 0) return 2;
    return null;
  }

  // ------------------------------------------------------- difflib (porte)
  function SequenceMatcher(a, b) {
    this.a = Array.from(a); this.b = Array.from(b);
    var b2j = new Map();
    this.b.forEach(function (c, j) {
      if (!b2j.has(c)) b2j.set(c, []);
      b2j.get(c).push(j);
    });
    // autojunk: o Python só descarta caracteres "populares" se len(b) >= 200
    if (this.b.length >= 200) {
      var limite = Math.floor(this.b.length / 100) + 1;
      b2j.forEach(function (idx, c) { if (idx.length > limite) b2j.delete(c); });
    }
    this.b2j = b2j;
  }
  SequenceMatcher.prototype.findLongestMatch = function (alo, ahi, blo, bhi) {
    var a = this.a, b2j = this.b2j, besti = alo, bestj = blo, bestsize = 0, j2len = new Map();
    for (var i = alo; i < ahi; i++) {
      var novo = new Map(), idx = b2j.get(a[i]) || [];
      for (var t = 0; t < idx.length; t++) {
        var j = idx[t];
        if (j < blo) continue;
        if (j >= bhi) break;
        var k = (j2len.get(j - 1) || 0) + 1;
        novo.set(j, k);
        if (k > bestsize) { besti = i - k + 1; bestj = j - k + 1; bestsize = k; }
      }
      j2len = novo;
    }
    // sem lixo (isjunk = None): as extensões do Python não mudam nada aqui,
    // exceto para caracteres "populares" descartados pelo autojunk
    var b = this.b, bpop = this.b.length >= 200;
    if (bpop) {
      var self = this;
      var ehPop = function (c) { return !self.b2j.has(c); };
      while (besti > alo && bestj > blo && ehPop(b[bestj - 1]) && a[besti - 1] === b[bestj - 1]) {
        besti--; bestj--; bestsize++;
      }
      while (besti + bestsize < ahi && bestj + bestsize < bhi && ehPop(b[bestj + bestsize]) &&
             a[besti + bestsize] === b[bestj + bestsize]) bestsize++;
    }
    return [besti, bestj, bestsize];
  };
  SequenceMatcher.prototype.matchingTotal = function () {
    if (this._total !== undefined) return this._total;
    var fila = [[0, this.a.length, 0, this.b.length]], total = 0;
    while (fila.length) {
      var q = fila.pop(), m = this.findLongestMatch(q[0], q[1], q[2], q[3]);
      if (m[2]) {
        total += m[2];
        if (q[0] < m[0] && q[2] < m[1]) fila.push([q[0], m[0], q[2], m[1]]);
        if (m[0] + m[2] < q[1] && m[1] + m[2] < q[3]) fila.push([m[0] + m[2], q[1], m[1] + m[2], q[3]]);
      }
    }
    return (this._total = total);
  };
  function razao(m, t) { return t ? 2 * m / t : 1; }
  SequenceMatcher.prototype.ratio = function () {
    return razao(this.matchingTotal(), this.a.length + this.b.length);
  };
  SequenceMatcher.prototype.quickRatio = function () {
    var cont = new Map(), m = 0;
    this.b.forEach(function (c) { cont.set(c, (cont.get(c) || 0) + 1); });
    var disp = new Map();
    this.a.forEach(function (c) {
      var n = disp.has(c) ? disp.get(c) : (cont.get(c) || 0);
      disp.set(c, n - 1);
      if (n > 0) m++;
    });
    return razao(m, this.a.length + this.b.length);
  };
  SequenceMatcher.prototype.realQuickRatio = function () {
    var la = this.a.length, lb = this.b.length;
    return razao(Math.min(la, lb), la + lb);
  };
  function getCloseMatches(palavra, possibilidades, n, cutoff) {
    var res = [];
    possibilidades.forEach(function (x) {
      var s = new SequenceMatcher(x, palavra);   // o Python compara (x, palavra)
      if (s.realQuickRatio() >= cutoff && s.quickRatio() >= cutoff && s.ratio() >= cutoff)
        res.push([s.ratio(), x]);
    });
    res.sort(function (p, q) {   // heapq.nlargest: maior razão; empate: maior texto
      if (p[0] !== q[0]) return q[0] - p[0];
      return p[1] < q[1] ? 1 : p[1] > q[1] ? -1 : 0;
    });
    return res.slice(0, n).map(function (r) { return r[1]; });
  }

  // ------------------------------------------------------------- dicionário
  function prepararVerbete(v, fontePadrao) {
    if (!v || typeof v !== "object") return null;
    var lema = nfc(String(v.lema || "").trim());
    var sigs = v.significados || [];
    if (typeof sigs === "string") sigs = sigs.split("|");
    sigs = sigs.map(function (s) { return nfc(String(s).trim()); }).filter(Boolean);
    if (!lema || !sigs.length) return null;
    var novo = { lema: lema, gram: nfc(String(v.gram || "")),
                 classe: nfc(String(v.classe || "não informada")),
                 significados: sigs, exemplo: nfc(String(v.exemplo || "")),
                 fonte: String(v.fonte || fontePadrao || "") };
    if (Array.isArray(v.formas))
      novo.formas = v.formas.map(function (f) { return nfc(String(f)); })
                            .filter(function (f) { return f.trim(); });
    if (v.em_ingles) novo.em_ingles = true;
    return novo;
  }
  function ehMeu(v) { return (v.fonte || "").startsWith("meu"); }

  function cmpTupla(a, b) {
    for (var i = 0; i < Math.max(a.length, b.length); i++) {
      if (i >= a.length) return -1;
      if (i >= b.length) return 1;
      var x = a[i], y = b[i];
      if (Array.isArray(x)) { var r = cmpTupla(x, y); if (r) return r; continue; }
      if (x < y) return -1;
      if (x > y) return 1;
    }
    return 0;
  }

  // ------------------------------------------------ formas flexionadas
  // formas_flexionadas.json (opcional), gerado por lexicos/importar_formas.py
  var ROTULO_FLEXAO = {
    "present": "presente", "imperfect": "imperfeito", "future": "futuro",
    "aorist": "aoristo", "perfect": "perfeito", "pluperfect": "mais-que-perfeito",
    "future-perfect": "futuro perfeito",
    "indicative": "indicativo", "subjunctive": "subjuntivo", "optative": "optativo",
    "imperative": "imperativo", "infinitive": "infinitivo", "participle": "particípio",
    "active": "ativo", "middle": "médio", "passive": "passivo", "mediopassive": "médio-passivo",
    "nominative": "nominativo", "genitive": "genitivo", "dative": "dativo",
    "accusative": "acusativo", "vocative": "vocativo",
    "masculine": "masculino", "feminine": "feminino", "neuter": "neutro",
    "first-person": "1ª pessoa", "second-person": "2ª pessoa", "third-person": "3ª pessoa",
    "singular": "singular", "dual": "dual", "plural": "plural",
    "comparative": "comparativo", "superlative": "superlativo",
    "Attic": "ático", "Epic": "épico", "Homeric": "homérico", "Ionic": "jônico",
    "Doric": "dórico", "Aeolic": "eólico", "Koine": "coiné", "poetic": "poético"
  };
  function chaveFlexao(p) {
    var d = String(p).trim().toLowerCase().normalize("NFD");
    d = d.replace(/[\u0304\u0306]/g, "").replace(/\u0300/g, "\u0301");
    return d.normalize("NFC");
  }
  function descreverAnalise(etiquetas, tr) {
    tr = tr || function (t) { return t; };
    return etiquetas.split(" ").filter(function (t) { return ROTULO_FLEXAO.hasOwnProperty(t); })
      .map(function (t) { return tr(ROTULO_FLEXAO[t]); }).join(" ");
  }
  // Mesmo formato de formas_flexionadas.txt do programa (veja texto_flexoes em ploion.py):
  // 1ª linha JSON; depois "forma<TAB>i:ids;i:ids", ordenadas pela chave sem acentos.
  function Flexoes(texto) {
    texto = String(texto || "");
    var nl = texto.indexOf("\n"), cab = nl < 0 ? texto : texto.slice(0, nl), c = {};
    try { c = JSON.parse(cab) || {}; } catch (e) { c = {}; }
    if (typeof c !== "object") c = {};
    this.analises = Array.isArray(c.analises) ? c.analises.slice() : [];
    this._lemas = Array.isArray(c.lemas) ? c.lemas.slice() : [];
    var corpo = this._texto = nl < 0 ? "" : texto.slice(nl + 1);
    var inicios = [], p = 0, n = corpo.length;
    while (p < n) {
      inicios.push(p);
      var q = corpo.indexOf("\n", p);
      if (q < 0) break;
      p = q + 1;
    }
    this._inicios = Uint32Array.from(inicios);
  }
  Flexoes.prototype.tamanho = function () { return this._inicios.length; };
  Flexoes.prototype._chaveEm = function (i) {
    var p = this._inicios[i];
    return chaveGrega(this._texto.slice(p, this._texto.indexOf("\t", p)));
  };
  Flexoes.prototype._linhas = function (k) {
    var lo = 0, hi = this._inicios.length, saida = [];
    while (lo < hi) {
      var m = (lo + hi) >> 1;
      if (this._chaveEm(m) < k) lo = m + 1; else hi = m;
    }
    for (; lo < this._inicios.length; lo++) {
      var p = this._inicios[lo], fim = this._texto.indexOf("\n", p);
      var partes = this._texto.slice(p, fim < 0 ? undefined : fim).split("\t");
      if (partes.length < 2 || chaveGrega(partes[0]) !== k) break;
      var regs = partes[1].split(";");
      for (var j = 0; j < regs.length; j++) {
        var d = regs[j].indexOf(":"), i = d < 0 ? regs[j] : regs[j].slice(0, d);
        if (/^\d+$/.test(i) && +i < this._lemas.length)
          saida.push([partes[0], this._lemas[+i], d < 0 ? "" : regs[j].slice(d + 1)]);
      }
    }
    return saida;
  };
  Flexoes.prototype.exatas = function (p) {
    var f = chaveFlexao(p);
    if (!f) return [];
    return this._linhas(chaveGrega(f)).filter(function (r) { return r[0] === f; });
  };
  Flexoes.prototype.semAcentos = function (p) {
    var k = chaveGrega(p);
    return k ? this._linhas(k) : [];
  };
  var ORDEM_ROTULOS = Object.keys(ROTULO_FLEXAO);
  Flexoes.prototype.descrever = function (ids, tr) {
    tr = tr || function (t) { return t; };
    var self = this, conj = [], vistos = new Set();
    String(ids).split(",").forEach(function (i) {
      if (!/^\d+$/.test(i) || +i >= self.analises.length) return;
      var c = [];
      self.analises[+i].split(" ").forEach(function (t) {
        if (ROTULO_FLEXAO.hasOwnProperty(t) && c.indexOf(t) < 0) c.push(t);
      });
      c.sort(function (a, b) { return ORDEM_ROTULOS.indexOf(a) - ORDEM_ROTULOS.indexOf(b); });
      var chave = c.join(" ");
      if (c.length && !vistos.has(chave)) { vistos.add(chave); conj.push(c); }
    });
    var contido = function (a, b) {  // a ⊂ b (estrito)
      return a.length < b.length && a.every(function (t) { return b.indexOf(t) >= 0; });
    };
    return conj.filter(function (c) { return !conj.some(function (o) { return contido(c, o); }); })
      .map(function (c) { return c.map(function (t) { return tr(ROTULO_FLEXAO[t]); }).join(" "); })
      .join(" / ");
  };
  function ordemFonte(v) {
    var f = v.fonte || "";
    return f.indexOf("Dodson") >= 0 ? 1 : f.indexOf("Middle Liddell") >= 0 ? 2 : 0;
  }

  function Dicionario(base, pessoais, idioma, flexoes) {
    this.idioma = idioma || "pt";
    this.flexoes = flexoes || null;
    this.base = (base || []).map(function (v) { return prepararVerbete(v); }).filter(Boolean);
    this.pessoais = (pessoais || []).map(function (v) { return prepararVerbete(v, "meu"); })
                                    .filter(Boolean);
    this.pessoais.forEach(function (v) { if (!ehMeu(v)) v.fonte = "meu"; });
    this.reindexar();
  }
  Dicionario.prototype.reindexar = function () {
    var porLema = new Map();
    this.base.forEach(function (v) { porLema.set(v.lema, v); });
    this.pessoais.forEach(function (v) { porLema.set(v.lema, v); });
    var lista = Array.from(porLema.values()).map(function (v) { return [chaveGrega(v.lema), v]; });
    lista.sort(function (p, q) { return p[0] < q[0] ? -1 : p[0] > q[0] ? 1 : 0; });
    this.verbetes = lista.map(function (p) { return p[1]; });
    this._idx = []; this._formas = new Map(); this._porGrega = new Map(); this._porLatina = new Map();
    this._porLema = porLema;
    var self = this;
    function por(mapa, k, v) { if (!mapa.has(k)) mapa.set(k, []); mapa.get(k).push(v); }
    this.verbetes.forEach(function (v) {
      var kg = chaveGrega(v.lema), kl = chaveLatina(transliterar(v.lema));
      var kp = v.significados.map(function (s) { return [normalizarPt(s), segmentosPt(s)]; });
      self._idx.push([v, kg, kl, kp]);
      por(self._porGrega, kg, v);
      por(self._porLatina, kl, v);
      (v.formas || []).forEach(function (f) { por(self._formas, chaveGrega(f), v); });
    });
  };
  Object.defineProperty(Dicionario.prototype, "tamanho", { get: function () { return this.verbetes.length; } });

  Dicionario.prototype._pontuar = function (consulta) {
    var q = nfc(consulta).trim(), achados = new Map(), kgs, kl, pt;
    function marcar(v, ordem, nota) {
      var at = achados.get(v);
      if (!at || cmpTupla(ordem, at[0]) < 0) achados.set(v, [ordem, v, nota || ""]);
    }
    if (temGrego(q)) { kgs = [chaveGrega(q)]; kl = ""; pt = this.idioma === "el" ? normalizarPt(q) : ""; }
    else { kgs = [chaveGrega(latimParaGrego(q))]; kl = chaveLatina(q); pt = normalizarPt(q); }
    kgs = kgs.filter(Boolean);
    var self = this;
    kgs.forEach(function (kg) {
      (self._formas.get(kg) || []).forEach(function (v) { marcar(v, [0, 0, 0], { forma_de: v.lema }); });
    });
    if (this.flexoes && kgs.length) {   // formas flexionadas (ἔλυσα -> λύω)
      var achadas = temGrego(q) ? this.flexionadas(q, true) : [];
      if (!achadas.length) achadas = this.flexionadas(kgs[0], false);
      achadas.slice(0, 12).forEach(function (a) {
        marcar(a[0], [0, 0, 0], { forma: a[1], ids: a[2] });
      });
    }
    this._idx.forEach(function (e) {
      var v = e[0], vkg = e[1], vkl = e[2], vkp = e[3];
      kgs.forEach(function (kg) {
        var r = comparar(kg, vkg);
        if (r !== null) marcar(v, [r, 0, Array.from(vkg).length]);
      });
      var r2 = comparar(kl, vkl);
      if (r2 !== null) marcar(v, [r2, 1, Array.from(vkl).length]);
      vkp.forEach(function (p, pos) {
        var r3 = rankPortugues(pt, p[0], p[1]);
        if (r3 !== null) marcar(v, [r3, 2, pos]);
      });
    });
    return { achados: achados, kgs: kgs, kl: kl };
  };
  function ordenarAchados(lista) {
    return lista.map(function (x, i) { return [x, chaveGrega(x[1].lema), i]; })
      .sort(function (p, q) {
        return cmpTupla(p[0][0], q[0][0]) || (p[1] < q[1] ? -1 : p[1] > q[1] ? 1 : 0) || p[2] - q[2];
      }).map(function (p) { return p[0]; });
  }
  Dicionario.prototype.buscar = function (consulta, limite) {
    limite = limite || 200;
    var p = this._pontuar(consulta), todos = Array.from(p.achados.values());
    var resultados = ordenarAchados(todos).slice(0, limite).map(function (x) { return [x[1], x[2]]; });
    var sugestoes = [];
    if (!todos.some(function (x) { return x[0][0] === 0; })) {
      var ja = new Set(resultados.map(function (r) { return r[0]; }));
      sugestoes = this.sugerir(p.kgs.length ? p.kgs[0] : "", p.kl)
                      .filter(function (v) { return !ja.has(v); });
    }
    return { resultados: resultados, sugestoes: sugestoes };
  };
  Dicionario.prototype.buscarExato = function (consulta) {
    var p = this._pontuar(consulta);
    return ordenarAchados(Array.from(p.achados.values()).filter(function (x) { return x[0][0] === 0; }))
      .map(function (x) { return [x[1], x[2]]; });
  };
  Dicionario.prototype.glosar = function (palavra) {
    var p = nfc(palavra).trim(), kg = chaveGrega(p);
    if (!kg) return null;
    var mesmos = this._porGrega.get(kg) || [], i;
    for (i = 0; i < mesmos.length; i++)
      if (mesmos[i].lema === p || mesmos[i].lema === p.toLowerCase()) return mesmos[i];
    var formas = this._formas.get(kg) || [];
    for (i = 0; i < formas.length; i++) {
      var fs = formas[i].formas || [];
      if (fs.indexOf(p) >= 0 || fs.indexOf(p.toLowerCase()) >= 0) return formas[i];
    }
    var flex = this.flexionadas(p, true);
    if (flex.length) return flex[0][0];
    if (formas.length) return formas[0];
    if (mesmos.length) return mesmos[0];
    flex = this.flexionadas(p, false);
    return flex.length ? flex[0][0] : null;
  };
  Dicionario.prototype.flexionadas = function (p, exatas) {
    if (!this.flexoes) return [];
    var regs = exatas ? this.flexoes.exatas(p) : this.flexoes.semAcentos(p);
    var saida = [], vistos = new Set(), self = this;
    regs.forEach(function (r) {
      var v = self._porLema.get(r[1]);
      if (!v || vistos.has(r[1] + "\u0000" + r[0])) return;
      vistos.add(r[1] + "\u0000" + r[0]);
      saida.push([v, r[0], r[2]]);
    });
    return saida.map(function (x, i) { return [x, i]; }).sort(function (a, b) {
      return ordemFonte(a[0][0]) - ordemFonte(b[0][0]) || a[1] - b[1];
    }).map(function (x) { return x[0]; });
  };
  Dicionario.prototype.analise = function (p, v, tr) {
    if (!this.flexoes || !v) return "";
    for (var e = 0; e < 2; e++) {
      var l = this.flexionadas(p, e === 0);
      for (var i = 0; i < l.length; i++) if (l[i][0] === v) return this.flexoes.descrever(l[i][2], tr);
    }
    return "";
  };
  Dicionario.prototype.sugerir = function (kg, kl, n) {
    n = n || 8;
    var cand = [], self = this;
    if (kg) {
      var chaves = [kg], ckg = Array.from(kg);
      if (kg.startsWith("ε") && ckg.length > 4) chaves.push(ckg.slice(1).join(""));
      chaves.forEach(function (chave) {
        var cc = Array.from(chave);
        for (var tam = cc.length - 1; tam > 2; tam--) {
          var pref = cc.slice(0, tam).join("");
          var achou = self._idx.filter(function (e) { return e[1].startsWith(pref); })
                               .map(function (e) { return e[0]; });
          if (achou.length) {
            achou = achou.map(function (v, i) {
              return [Math.abs(Array.from(chaveGrega(v.lema)).length - cc.length), i, v];
            }).sort(function (p, q) { return p[0] - q[0] || p[1] - q[1]; }).map(function (x) { return x[2]; });
            cand = cand.concat(achou.slice(0, 4));
            break;
          }
        }
      });
      getCloseMatches(kg, Array.from(this._porGrega.keys()), n, 0.6).forEach(function (k) {
        cand = cand.concat(self._porGrega.get(k));
      });
    }
    if (kl) getCloseMatches(kl, Array.from(this._porLatina.keys()), n, 0.7).forEach(function (k) {
      cand = cand.concat(self._porLatina.get(k));
    });
    var unicos = [], vistos = new Set();
    cand.forEach(function (v) { if (!vistos.has(v)) { vistos.add(v); unicos.push(v); } });
    return unicos.slice(0, n);
  };
  Dicionario.prototype.salvarPessoal = function (verbete, lemaAntigo) {
    this.pessoais = this.pessoais.filter(function (v) { return v.lema !== verbete.lema && v.lema !== lemaAntigo; });
    this.pessoais.push(verbete);
    this.reindexar();
  };
  Dicionario.prototype.excluirPessoal = function (lema) {
    this.pessoais = this.pessoais.filter(function (v) { return v.lema !== lema; });
    this.reindexar();
  };

  // --------------------------------------------------------------- expressões
  var RE_PALAVRA = /(?:\p{L}|[̀-ͯ])+/gu;
  function palavrasComPosicao(texto) {
    var saida = [], m;
    RE_PALAVRA.lastIndex = 0;
    while ((m = RE_PALAVRA.exec(texto)) !== null) saida.push([m.index, m.index + m[0].length, m[0]]);
    return saida;
  }
  function prepararExpressao(e) {
    if (!e || typeof e !== "object" || !String(e.expressao || "").trim()) return null;
    var nova = {};
    ["expressao", "literal", "sentido", "categoria", "uso", "exemplo", "fonte"].forEach(function (c) {
      nova[c] = nfc(String(e[c] || "")).trim();
    });
    var vars = Array.isArray(e.variantes) ? e.variantes : [];
    vars = vars.map(function (v) { return nfc(String(v)).trim(); }).filter(Boolean);
    if (vars.indexOf(nova.expressao) < 0) vars.unshift(nova.expressao);
    nova.variantes = vars;
    nova.categoria = nova.categoria || "outras";
    nova._chaves = vars.map(chaveGrega);
    nova._latinas = vars.map(function (v) { return chaveLatina(transliterar(v)); });
    nova._pt = normalizarPt([nova.literal, nova.sentido, nova.categoria, nova.uso].join(" "));
    return nova;
  }
  function IndiceExpressoes(lista) {
    var self = this;
    this.expressoes = (lista || []).map(prepararExpressao).filter(Boolean);
    this.variantes = []; this.porPrimeira = new Map();
    this.expressoes.forEach(function (e) {
      var vistos = new Set();
      e.variantes.forEach(function (v) {
        var ch = (v.match(RE_PALAVRA) || []).map(chaveGrega).filter(Boolean);
        var id = ch.join("\u0001");
        if (!ch.length || vistos.has(id)) return;
        vistos.add(id);
        var item = [ch, ch.join(" "), e];
        self.variantes.push(item);
        if (!self.porPrimeira.has(ch[0])) self.porPrimeira.set(ch[0], []);
        self.porPrimeira.get(ch[0]).push(item);
      });
    });
    this.multiplas = this.variantes.filter(function (v) { return v[0].length >= 2; });
  }
  IndiceExpressoes.prototype.categorias = function () {
    var ordem = [];
    this.expressoes.forEach(function (e) { if (ordem.indexOf(e.categoria) < 0) ordem.push(e.categoria); });
    return ordem;
  };
  var LIMIAR = 0.85;
  function mesmaTupla(a, b) {
    if (a.length !== b.length) return false;
    for (var i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
  }
  function acharExpressoes(texto, indice, limiar) {
    limiar = limiar === undefined ? LIMIAR : limiar;
    if (!indice || !indice.variantes.length) return [];
    var pal = palavrasComPosicao(texto), ch = pal.map(function (p) { return chaveGrega(p[2]); });
    var n = pal.length, achados = [], i = 0;
    function maior(c, m) { return m === null || cmpTupla(c.slice(0, 3), m.slice(0, 3)) > 0; }
    while (i < n) {
      var melhor = null;
      (indice.porPrimeira.get(ch[i]) || []).forEach(function (it) {
        var k = it[0].length;
        if (mesmaTupla(ch.slice(i, i + k), it[0])) {
          var c = [k, 1, 1.0, it[2]];
          if (maior(c, melhor)) melhor = c;
        }
      });
      indice.multiplas.forEach(function (it) {
        var k = it[0].length, vt = it[1];
        if (i + k > n || (melhor && cmpTupla([k, 0], melhor.slice(0, 2)) <= 0)) return;
        var janela = ch.slice(i, i + k).join(" ");
        if (!janela || janela[0] !== vt[0]) return;
        var lj = Array.from(janela).length, lv = Array.from(vt).length;
        if (Math.abs(lj - lv) > Math.max(2, Math.floor(lv / 5))) return;
        var sm = new SequenceMatcher(janela, vt);
        if (sm.realQuickRatio() < limiar || sm.quickRatio() < limiar) return;
        var r = sm.ratio();
        if (r >= limiar) {
          var c = [k, 0, r, it[2]];
          if (maior(c, melhor)) melhor = c;
        }
      });
      if (melhor) {
        var k = melhor[0];
        achados.push({ inicio: pal[i][0], fim: pal[i + k - 1][1], expressao: melhor[3],
                       exato: !!melhor[1], semelhanca: Math.round(melhor[2] * 1000) / 1000 });
        i += k;
      } else i++;
    }
    return achados;
  }
  function filtrarExpressoes(expressoes, consulta, idioma) {
    var q = nfc(consulta).trim();
    if (!q) return expressoes.slice();
    var kg, kl, pal;
    if (temGrego(q)) {
      kg = chaveGrega(q);
      pal = idioma === "el" ? normalizarPt(q).split(" ").filter(Boolean) : [];
      return expressoes.filter(function (e) {
        return (kg && e._chaves.some(function (k) { return k.indexOf(kg) >= 0; })) ||
               (pal.length && pal.every(function (p) { return e._pt.indexOf(p) >= 0; }));
      });
    }
    kg = chaveGrega(latimParaGrego(q)); kl = chaveLatina(q);
    pal = normalizarPt(q).split(" ").filter(Boolean);
    return expressoes.filter(function (e) {
      return (kg && Array.from(kg).length >= 2 && e._chaves.some(function (k) { return k.indexOf(kg) >= 0; })) ||
             (kl && Array.from(kl).length >= 2 && e._latinas.some(function (k) { return k.indexOf(kl) >= 0; })) ||
             (pal.length && pal.every(function (p) { return e._pt.indexOf(p) >= 0; }));
    });
  }

  // ------------------------------------------------------- tradução aproximada
  function resumirSignificado(sig) {
    var sem = sig.replace(/\([^)]*\)|（[^）]*）/g, " ");
    var primeiro = sem.split(/[,;，；、،؛]/)[0];
    primeiro = primeiro.split(/\s+/).filter(Boolean).join(" ").replace(/^[ .]+|[ .]+$/g, "");
    return primeiro || sig.trim();
  }
  function glosaAproximada(texto, dic, indice) {
    var unidades = [], exprs = indice ? acharExpressoes(texto, indice) : [];
    exprs.forEach(function (m) {
      var e = m.expressao;
      unidades.push([m.inicio, m.fim, e.literal || e.expressao,
                     { grego: texto.slice(m.inicio, m.fim), verbete: null, expressao: e }]);
    });
    var ocupado = exprs.map(function (m) { return [m.inicio, m.fim]; });
    palavrasComPosicao(texto).forEach(function (p) {
      if (ocupado.some(function (o) { return o[0] <= p[0] && p[0] < o[1]; })) return;
      var v = dic ? dic.glosar(p[2]) : null;
      unidades.push([p[0], p[1], v ? resumirSignificado(v.significados[0]) : "[" + p[2] + "]",
                     { grego: p[2], verbete: v, expressao: null }]);
    });
    unidades.sort(function (a, b) { return a[0] - b[0]; });
    var seg = [], pos = 0;
    unidades.forEach(function (u) {
      if (u[0] > pos) seg.push([texto.slice(pos, u[0]), null]);
      seg.push([u[2], u[3]]);
      pos = u[1];
    });
    if (pos < texto.length) seg.push([texto.slice(pos), null]);
    return seg;
  }

  // ------------------------------------------------------------ quadro
  var COLUNAS_VOGAIS = [[], [AGUDO], [GRAVE], [CIRC], [SUAVE], [ASPERO], [SUAVE, AGUDO],
    [ASPERO, AGUDO], [SUAVE, GRAVE], [ASPERO, GRAVE], [SUAVE, CIRC], [ASPERO, CIRC],
    [DIERESE], [DIERESE, AGUDO], [DIERESE, GRAVE], [DIERESE, CIRC], [MACRON], [BRAQUIA]];
  function formaDoQuadro(base, marcas, maiusculas) {
    if (maiusculas) { if (base === "ς") return null; base = base.toUpperCase(); }
    var r = compor(base, marcas);
    return r.erro ? null : r.texto;
  }

  var nucleo = {
    SUAVE: SUAVE, ASPERO: ASPERO, AGUDO: AGUDO, GRAVE: GRAVE, CIRC: CIRC, IOTA_SUB: IOTA_SUB,
    DIERESE: DIERESE, MACRON: MACRON, BRAQUIA: BRAQUIA, ORDEM: ORDEM, QUANTIDADE: QUANTIDADE,
    BETA_LETRAS: BETA_LETRAS, BETA_DIAC: BETA_DIAC, BETA_PONTUACAO: BETA_PONTUACAO,
    ACENTOS_SOLTOS: ACENTOS_SOLTOS, LETRAS_GREGAS: LETRAS_GREGAS, COLUNAS_VOGAIS: COLUNAS_VOGAIS,
    nfc: nfc, alternar: alternar, compor: compor, decompor: decompor, ultimoGrafema: ultimoGrafema,
    aplicarSigmaFinal: aplicarSigmaFinal, aplicarDiacritico: aplicarDiacritico,
    transliterar: transliterar, betaParaGrego: betaParaGrego, temGrego: temGrego,
    chaveGrega: chaveGrega, chaveLatina: chaveLatina, latimParaGrego: latimParaGrego,
    normalizarPt: normalizarPt, segmentosPt: segmentosPt, SequenceMatcher: SequenceMatcher,
    getCloseMatches: getCloseMatches, prepararVerbete: prepararVerbete, ehMeu: ehMeu,
    Dicionario: Dicionario, palavrasComPosicao: palavrasComPosicao, IndiceExpressoes: IndiceExpressoes,
    acharExpressoes: acharExpressoes, filtrarExpressoes: filtrarExpressoes,
    resumirSignificado: resumirSignificado, glosaAproximada: glosaAproximada,
    formaDoQuadro: formaDoQuadro, Flexoes: Flexoes, ROTULO_FLEXAO: ROTULO_FLEXAO,
    chaveFlexao: chaveFlexao, descreverAnalise: descreverAnalise
  };
  if (typeof module !== "undefined" && module.exports) module.exports = nucleo;
  else raiz.PloionNucleo = nucleo;
})(typeof globalThis !== "undefined" ? globalThis : this);
