/* Nubank · O cartão que vira mundo — jornada de rolagem.
   Um cartão 3D atravessa 6 capítulos. A rolagem escolhe o capítulo (data-c no palco)
   e o CSS cuida da pose; o progresso dentro do capítulo (--cp) alimenta barras e contadores. */
(function () {
  'use strict';

  var reduz = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var fino = window.matchMedia('(hover:hover)').matches;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var raiz = document.documentElement;
  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function ease(x) { return 1 - Math.pow(1 - x, 3); }
  function fmt(n) { return Math.round(n).toLocaleString('pt-BR'); }

  var N = 7;
  var alto = $('#jornada'), stage = $('#stage');
  var paineis = $$('.painel'), pontos = $$('#pontos button');
  var contagem = $('#contagem');
  var limNum = $('#limNum'), limBarra = $('#limBarra'), pixVal = $('#pixVal');
  var cxVal = $$('[data-cx]'), caixas = $$('.caixa');
  var barra = $('#barra'), topo = $('#topo');
  var cap = -1, cp = 0, pj = 0;

  /* ---- carregamento ---- */
  var loader = $('#loader'), pct = $('#loaderPct');
  var feitos = 0;
  function passo() {
    feitos++;
    if (pct) pct.textContent = String(Math.round(feitos / 2 * 100));
    if (feitos >= 2) setTimeout(function () {
      document.body.classList.remove('carregando');
      loader.classList.add('sumiu');
      medir();
      if (window.Cena3D) Cena3D.relayout();
      if (typeof ScrollTrigger !== 'undefined') ScrollTrigger.refresh();
    }, 250);
  }
  var fontes = (document.fonts && document.fonts.ready) ? document.fonts.ready : Promise.resolve();
  Promise.race([fontes, new Promise(function (r) { setTimeout(r, 4000); })]).then(passo);
  if (document.readyState === 'complete') passo(); else window.addEventListener('load', passo, { once: true });

  /* ---- progresso do palco ---- */
  var topoAlto = 0, total = 1;
  function medir() {
    var r = alto.getBoundingClientRect();
    topoAlto = r.top + window.scrollY;
    total = Math.max(1, alto.offsetHeight - window.innerHeight);
  }
  function irParaCap(i) {
    var y = topoAlto + total * ((i + .5) / N);
    window.scrollTo({ top: y, behavior: reduz ? 'auto' : 'smooth' });
  }
  pontos.forEach(function (b) {
    b.addEventListener('click', function () { irParaCap(+b.getAttribute('data-i')); });
  });

  function defineCap(c) {
    if (c === cap) return;
    cap = c;
    stage.setAttribute('data-c', String(c));
    if (window.Cena3D) Cena3D.capitulo(c);
    paineis.forEach(function (p) { var on = +p.getAttribute('data-c') === c; p.classList.toggle('on', on); p.setAttribute('aria-hidden', on ? 'false' : 'true'); });
    pontos.forEach(function (b, i) { b.classList.toggle('on', i === c); });
    if (contagem) contagem.textContent = ('0' + (c + 1)).slice(-2) + ' / 0' + N;
    // o Pix recomeça a cada vez que o capítulo entra
    if (c === 3) { $('.fone-btn').style.animation = 'none'; $('.fone-ok').style.animation = 'none'; $('.ok-bola').style.animation = 'none';
      void stage.offsetWidth;
      $('.fone-btn').style.animation = ''; $('.fone-ok').style.animation = ''; $('.ok-bola').style.animation = '';
      digitaPix();
    }
  }

  // "digita" o valor do Pix
  var pixTimer = null;
  function digitaPix() {
    clearInterval(pixTimer);
    var alvo = '150,00', i = 0;
    pixVal.textContent = '0,00';
    setTimeout(function () {
      pixTimer = setInterval(function () {
        i++; pixVal.textContent = i >= alvo.length ? alvo : alvo.slice(0, i) + (i < 3 ? '' : '');
        if (i >= alvo.length) clearInterval(pixTimer);
      }, 140);
    }, 700);
  }

  function aoRolar() {
    var y = window.scrollY - topoAlto;
    pj = clamp(y / total, 0, 1);
    var c = clamp(Math.floor(pj * N), 0, N - 1);
    cp = clamp(pj * N - c, 0, 1);
    defineCap(c);
    raiz.style.setProperty('--cp', cp.toFixed(3));
    if (window.Cena3D) Cena3D.progresso(cp);

    // detalhes ligados ao progresso local
    if (c === 2) {
      var v = ease(clamp(cp * 1.6, 0, 1));
      limNum.textContent = 'R$ ' + fmt(8000 * v);
      limBarra.style.transform = 'scaleX(' + (.82 * v).toFixed(3) + ')';
    }
    if (c === 4) {
      var f = ease(clamp(cp * 1.5 + .15, 0, 1));
      caixas.forEach(function (cx) { cx.style.setProperty('--fill', f.toFixed(3)); });
      cxVal.forEach(function (el) { el.textContent = fmt(+el.getAttribute('data-cx') * f); });
    }
    // barra de progresso e cabeçalho
    var h = document.documentElement.scrollHeight - window.innerHeight;
    barra.style.transform = 'scaleX(' + (h > 0 ? window.scrollY / h : 0).toFixed(4) + ')';
    topo.classList.toggle('rolou', window.scrollY > 40);
  }
  window.addEventListener('scroll', aoRolar, { passive: true });
  window.addEventListener('resize', function () { medir(); aoRolar(); });

  /* ---- inclinação do cartão pelo mouse + brilho ---- */
  var card = $('#card3d'), flip = $('#cardFlip');
  var mx = 0, my = 0, sx = 0, sy = 0, extra = 0, ocioso = 0;
  window.addEventListener('pointermove', function (e) {
    mx = e.clientX / window.innerWidth - .5;
    my = e.clientY / window.innerHeight - .5;
    raiz.style.setProperty('--mx', e.clientX + 'px');
    raiz.style.setProperty('--my', e.clientY + 'px');
    ocioso = 0;
  }, { passive: true });

  var t0 = performance.now();
  function laco(agora) {
    requestAnimationFrame(laco);
    var t = (agora - t0) / 1000;
    sx += (mx - sx) * .08; sy += (my - sy) * .08;
    // parado: o cartão respira sozinho
    var rx = 6 + -sy * 18 + Math.sin(t * .9) * 2;
    var ry = -12 + sx * 26 + Math.cos(t * .7) * 3;
    card.style.setProperty('--tx', rx.toFixed(2) + 'deg');
    card.style.setProperty('--ty', ry.toFixed(2) + 'deg');
    card.style.setProperty('--sx', (50 + sx * 90).toFixed(1) + '%');
    card.style.setProperty('--sy', (30 + sy * 90).toFixed(1) + '%');
    desenhaFundo(t);
  }

  function virar() {
    if (window.Cena3D) { Cena3D.virar(); return; }
    extra = extra === 0 ? 180 : 0;
    flip.style.setProperty('--fx', extra + 'deg');
  }
  card.addEventListener('click', virar);
  $('#btnVirar').addEventListener('click', virar);
  // capítulo 02 já mostra o verso; um toque inverte
  card.style.cursor = 'pointer';

  /* ---- fundo: orbes e poeira ---- */
  var cv = $('#fundo'), g = cv.getContext('2d'), W = 0, H = 0, DPR = 1;
  var pontosFundo = [];
  var matiz = [[166, 77, 245], [130, 10, 209], [197, 139, 255], [100, 20, 190], [150, 60, 230], [190, 110, 255]];
  var corAtual = [166, 77, 245], pequeno = false;
  function tamanho() {
    pequeno = window.innerWidth < 700;
    DPR = Math.min(window.devicePixelRatio || 1, pequeno ? 1.5 : 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    g.setTransform(DPR, 0, 0, DPR, 0, 0);
    pontosFundo = [];
    var n = pequeno ? 40 : 90;
    for (var i = 0; i < n; i++) pontosFundo.push({ x: Math.random(), y: Math.random(), z: .25 + Math.random() * .9, p: Math.random() * 6 });
  }
  tamanho();
  window.addEventListener('resize', tamanho);

  function desenhaFundo(t) {
    var alvo = window.__glow || matiz[Math.max(0, cap)] || matiz[0];
    for (var k = 0; k < 3; k++) corAtual[k] += (alvo[k] - corAtual[k]) * .03;
    var c = corAtual;
    g.clearRect(0, 0, W, H);
    var gr = g.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, '#12031d'); gr.addColorStop(.55, '#1d0633'); gr.addColorStop(1, '#0c0214');
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
    // orbes suaves
    for (var i = 0; i < 3; i++) {
      var ox = W * (.25 + i * .3) + Math.sin(t * .13 + i * 2) * W * .08;
      var oy = H * (.3 + (i % 2) * .4) + Math.cos(t * .11 + i) * H * .06;
      var r = Math.max(W, H) * (.34 + i * .06);
      var og = g.createRadialGradient(ox, oy, 0, ox, oy, r);
      og.addColorStop(0, 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + (.2 - i * .04) + ')');
      og.addColorStop(1, 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',0)');
      g.fillStyle = og; g.fillRect(0, 0, W, H);
    }
    // poeira
    var vel = pj * 220;
    g.fillStyle = 'rgba(230,205,255,1)';
    for (var n = 0; n < pontosFundo.length; n++) {
      var o = pontosFundo[n];
      var x = o.x * W + Math.sin(t * .2 + o.p) * 14 * o.z;
      var y = (((o.y * H - t * 5 * o.z - vel * o.z * 1.4) % H) + H) % H;
      g.globalAlpha = .1 + .3 * o.z;
      g.beginPath(); g.arc(x, y, .7 + o.z * 1.5, 0, 6.2832); g.fill();
    }
    g.globalAlpha = 1;
  }

  /* ---- monte o seu: nome, cor e imagem ---- */
  var inp = $('#inpNome'), cores = $$('.cor'), btnBaixar = $('#btnBaixar');
  if (inp) inp.addEventListener('input', function () { if (window.Cena3D) Cena3D.nome(inp.value); });
  cores.forEach(function (b) {
    b.addEventListener('click', function () {
      cores.forEach(function (o) { o.classList.remove('on'); o.setAttribute('aria-checked', 'false'); });
      b.classList.add('on'); b.setAttribute('aria-checked', 'true');
      if (window.Cena3D) Cena3D.tema(+b.getAttribute('data-i'));
    });
  });
  if (btnBaixar) btnBaixar.addEventListener('click', function () {
    if (!window.Cena3D) return;
    var a = document.createElement('a');
    a.href = Cena3D.imagem(); a.download = 'meu-cartao-conceito.png';
    document.body.appendChild(a); a.click(); a.remove();
  });

  /* ---- botões magnéticos ---- */
  if (!reduz && fino) {
    $$('.btn').forEach(function (b) {
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        b.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * .2).toFixed(1) + 'px,' + ((e.clientY - r.top - r.height / 2) * .3).toFixed(1) + 'px) scale(1.04)';
      });
      b.addEventListener('pointerleave', function () { b.style.transform = ''; });
    });
  }

  /* ---- âncoras e "ver de novo" ---- */
  $$('a[href^="#"]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var id = a.getAttribute('href');
      if (id === '#') return;
      var alvoEl = $(id); if (!alvoEl) return;
      e.preventDefault();
      var y = id === '#jornada' ? 0 : alvoEl.getBoundingClientRect().top + window.scrollY - 64;
      window.scrollTo({ top: y, behavior: reduz ? 'auto' : 'smooth' });
    });
  });

  /* ---- seções claras entram com stagger ---- */
  if (!reduz && typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
    function entra(alvos, gatilho) {
      if (!alvos.length) return;
      gsap.set(alvos, { opacity: 0, y: 40 });
      ScrollTrigger.create({
        trigger: gatilho, start: 'top 84%', once: true,
        onEnter: function () { gsap.to(alvos, { opacity: 1, y: 0, duration: .9, ease: 'power3.out', stagger: .08, clearProps: 'transform' }); }
      });
    }
    $$('.claro .sec').forEach(function (s) { entra($$('.rotulo-c, .t-sec, .sec-sub', s), s); });
    entra($$('.bene'), '.grade');
    entra($$('.faq details'), '.faq');
    entra($$('.fim-in > *'), '.fim');
  }

  /* ---- início ---- */
  medir(); aoRolar();
  defineCap(0);
  if (!reduz) requestAnimationFrame(laco); else desenhaFundo(0);
})();
