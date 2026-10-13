/* Cena 3D (WebGL / Three.js r128): o cartão e tudo que nasce dele.
   Se o WebGL não existir, este arquivo sai sem fazer nada e a versão em CSS continua valendo.
   API: Cena3D.capitulo(c), .progresso(cp), .tema(i), .nome(s), .virar(), .arrasto(dx,dy), .imagem() */
(function () {
  'use strict';
  if (typeof THREE === 'undefined') return;

  var canvas = document.getElementById('gl');
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch (e) { return; }
  if (!renderer.getContext()) return;

  var raiz = document.documentElement;
  var reduz = window.matchMedia('(prefers-reduced-motion:reduce)').matches;
  var pequeno = window.innerWidth < 760;
  raiz.classList.add('webgl');

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pequeno ? 1.5 : 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .82;
  renderer.setClearColor(0x000000, 0);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(32, 1, .1, 80);
  var CAM_Z = 7.2;
  camera.position.set(0, 0, CAM_Z);

  function clamp(x, a, b) { return Math.max(a, Math.min(b, x)); }
  function ease(x) { return 1 - Math.pow(1 - x, 3); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /* ---------- ambiente de estúdio (reflexos do cartão) ---------- */
  var pm = new THREE.PMREMGenerator(renderer);
  var envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x05010a);
  function painel(w, h, cor, k, x, y, z) {
    var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(cor).multiplyScalar(k), side: THREE.DoubleSide }));
    m.position.set(x, y, z); m.lookAt(0, 0, 0); envScene.add(m);
  }
  painel(9, 2.6, 0xffffff, 3.2, 0, 6, 2);       // softbox superior
  painel(2.4, 8, 0xc58bff, 2.4, -6.5, 0, 1);    // tira roxa à esquerda
  painel(2.4, 8, 0xff7ad9, 2.0, 6.5, 0, -1);    // tira rosa à direita
  painel(8, 1.6, 0xffffff, 1.4, 0, -5, 3);      // rebatedor embaixo
  painel(4, 4, 0x7a2cff, 1.2, 0, 1, -7);        // fundo violeta
  var envMap = pm.fromScene(envScene, .035).texture;
  pm.dispose();

  /* ---------- luzes ---------- */
  scene.add(new THREE.AmbientLight(0x6a3fb0, .22));
  var key = new THREE.DirectionalLight(0xffffff, .55); key.position.set(3, 4, 6); scene.add(key);
  var rim = new THREE.PointLight(0xb06bff, 1.3, 14); rim.position.set(-4, 1, 3); scene.add(rim);
  var rim2 = new THREE.PointLight(0xff6ad5, .8, 14); rim2.position.set(4, -2, 2); scene.add(rim2);

  /* ---------- geometria utilitária ---------- */
  function retArred(w, h, r) {
    var s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.absarc(x + w - r, y + r, r, -Math.PI / 2, 0, false);
    s.lineTo(x + w, y + h - r); s.absarc(x + w - r, y + h - r, r, 0, Math.PI / 2, false);
    s.lineTo(x + r, y + h); s.absarc(x + r, y + h - r, r, Math.PI / 2, Math.PI, false);
    s.lineTo(x, y + r); s.absarc(x + r, y + r, r, Math.PI, Math.PI * 1.5, false);
    return s;
  }
  function geoFace(w, h, r) {
    var g = new THREE.ShapeGeometry(retArred(w, h, r), 14);
    var p = g.attributes.position, uv = g.attributes.uv;
    for (var i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + w / 2) / w, (p.getY(i) + h / 2) / h);
    return g;
  }

  /* ---------- texturas do cartão (desenhadas em canvas 2D) ---------- */
  var TEMAS = [
    { nome: 'Roxinho',       c: ['#b868ff', '#820ad1', '#3a0670'], ink: '#ffffff', glow: [166, 77, 245] },
    { nome: 'Ultravioleta',  c: ['#43305f', '#1a0b2a', '#050109'], ink: '#e9d5ff', glow: [120, 60, 200] },
    { nome: 'Aurora',        c: ['#ff86dc', '#a64df5', '#3f1aa8'], ink: '#ffffff', glow: [230, 110, 220] },
    { nome: 'Menta',         c: ['#5af0cf', '#12a39a', '#093f52'], ink: '#05242a', glow: [60, 210, 190] }
  ];
  var temaAtual = 0, nomeAtual = 'SEU NOME AQUI';
  var FW = 1024, FH = 646;
  var cvFrente = document.createElement('canvas'); cvFrente.width = FW; cvFrente.height = FH;
  var cvVerso = document.createElement('canvas'); cvVerso.width = FW; cvVerso.height = FH;
  var FONTE = '"Sora", system-ui, "Segoe UI", sans-serif';

  function espaco(ctx, txt, x, y, sp) {
    for (var i = 0; i < txt.length; i++) { ctx.fillText(txt[i], x, y); x += ctx.measureText(txt[i]).width + sp; }
  }
  function rrect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function desenhaFrente() {
    var t = TEMAS[temaAtual], ctx = cvFrente.getContext('2d');
    var g = ctx.createRadialGradient(FW * .12, 0, 20, FW * .3, FH * .35, FW * 1.05);
    g.addColorStop(0, t.c[0]); g.addColorStop(.5, t.c[1]); g.addColorStop(1, t.c[2]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, FW, FH);
    // relevo: arcos concêntricos saindo do canto
    ctx.strokeStyle = 'rgba(255,255,255,.07)'; ctx.lineWidth = 2;
    for (var r = 40; r < 1500; r += 22) { ctx.beginPath(); ctx.arc(FW * 1.05, FH * 1.18, r, 0, 6.2832); ctx.stroke(); }
    // faixa de luz
    var lg = ctx.createLinearGradient(0, FH, FW, 0);
    lg.addColorStop(0, 'rgba(255,255,255,0)'); lg.addColorStop(.45, 'rgba(255,255,255,.10)'); lg.addColorStop(.55, 'rgba(255,255,255,0)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, FW, FH);
    ctx.fillStyle = t.ink;
    // marca (texto)
    ctx.font = '800 96px ' + FONTE; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'right';
    ctx.fillText('nubank', FW - 70, 150);
    // chip
    var cx = 74, cy = 214, cw = 150, ch = 110;
    var cg = ctx.createLinearGradient(cx, cy, cx + cw, cy + ch);
    cg.addColorStop(0, '#fbe9a6'); cg.addColorStop(.55, '#d4a93d'); cg.addColorStop(1, '#f3d57a');
    ctx.fillStyle = cg; rrect(ctx, cx, cy, cw, ch, 16); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.32)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx, cy + ch / 3); ctx.lineTo(cx + cw, cy + ch / 3); ctx.moveTo(cx, cy + ch * 2 / 3); ctx.lineTo(cx + cw, cy + ch * 2 / 3);
    ctx.moveTo(cx + cw / 3, cy); ctx.lineTo(cx + cw / 3, cy + ch); ctx.moveTo(cx + cw * 2 / 3, cy); ctx.lineTo(cx + cw * 2 / 3, cy + ch); ctx.stroke();
    // contactless
    ctx.strokeStyle = t.ink; ctx.globalAlpha = .85; ctx.lineWidth = 7; ctx.lineCap = 'round';
    for (var k = 0; k < 3; k++) { ctx.beginPath(); ctx.arc(268, 270, 18 + k * 20, -0.9, 0.9); ctx.stroke(); }
    ctx.globalAlpha = 1;
    // número
    ctx.fillStyle = t.ink; ctx.textAlign = 'left'; ctx.font = '600 50px ' + FONTE;
    espaco(ctx, '•••• •••• •••• 0000', 74, 470, 9);
    // nome
    ctx.font = '600 34px ' + FONTE; ctx.globalAlpha = .92;
    espaco(ctx, nomeAtual.toUpperCase(), 74, 570, 6);
    ctx.globalAlpha = .7; ctx.textAlign = 'right'; ctx.font = '600 26px ' + FONTE;
    ctx.fillText('CONCEITO', FW - 70, 570);
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
    texFrente.needsUpdate = true;
  }
  function desenhaVerso() {
    var ctx = cvVerso.getContext('2d');
    var g = ctx.createLinearGradient(0, 0, FW, FH);
    g.addColorStop(0, '#2a0a4a'); g.addColorStop(1, '#0f0319');
    ctx.fillStyle = g; ctx.fillRect(0, 0, FW, FH);
    ctx.fillStyle = '#060109'; ctx.fillRect(0, 90, FW, 140);
    ctx.fillStyle = '#e8dcf6'; rrect(ctx, 70, 290, FW - 140, 104, 14); ctx.fill();
    ctx.fillStyle = 'rgba(120,70,170,.18)';
    for (var x = -100; x < FW; x += 26) { ctx.beginPath(); ctx.moveTo(x, 290); ctx.lineTo(x + 104, 394); ctx.lineTo(x + 130, 394); ctx.lineTo(x + 26, 290); ctx.fill(); }
    ctx.fillStyle = '#2b1146'; ctx.font = '500 30px ' + FONTE; ctx.textAlign = 'left';
    ctx.fillText('Assinatura', 100, 352);
    ctx.textAlign = 'right'; ctx.font = '700 40px ' + FONTE; ctx.fillText('•••', FW - 100, 358);
    ctx.fillStyle = '#c9b6e2'; ctx.textAlign = 'left'; ctx.font = '500 28px ' + FONTE;
    ctx.fillText('Cartão de conceito. Não é um produto real.', 70, 560);
    texVerso.needsUpdate = true;
  }
  var texFrente = new THREE.CanvasTexture(cvFrente), texVerso = new THREE.CanvasTexture(cvVerso);
  [texFrente, texVerso].forEach(function (t) {
    t.encoding = THREE.sRGBEncoding; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  });

  /* ---------- o cartão ---------- */
  var CW = 3.17, CH = 2, CR = .17, CD = .045;
  var raizCena = new THREE.Group(); scene.add(raizCena);
  var cartao = new THREE.Group(); raizCena.add(cartao);
  var flipGrp = new THREE.Group(); cartao.add(flipGrp);

  var corpoGeo = new THREE.ExtrudeGeometry(retArred(CW, CH, CR), {
    depth: CD, bevelEnabled: true, bevelThickness: .012, bevelSize: .012, bevelSegments: 3, curveSegments: 14
  });
  corpoGeo.translate(0, 0, -CD / 2);
  var corpo = new THREE.Mesh(corpoGeo, new THREE.MeshPhysicalMaterial({
    color: 0x1b0a2c, metalness: .85, roughness: .32, envMap: envMap, envMapIntensity: 1.1
  }));
  flipGrp.add(corpo);

  function matFace(tex) {
    return new THREE.MeshPhysicalMaterial({
      map: tex, roughness: .36, metalness: .04, clearcoat: 1, clearcoatRoughness: .16,
      envMap: envMap, envMapIntensity: .5
    });
  }
  var faceGeo = geoFace(CW, CH, CR);
  var frente = new THREE.Mesh(faceGeo, matFace(texFrente));
  frente.position.z = CD / 2 + .0125; flipGrp.add(frente);
  var verso = new THREE.Mesh(faceGeo, matFace(texVerso));
  verso.position.z = -CD / 2 - .0125; verso.rotation.y = Math.PI; flipGrp.add(verso);

  // holografia: reflexo arco-íris que depende do ângulo de visão
  var holoMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uA: { value: .6 } },
    vertexShader: 'varying vec2 vUv; varying vec3 vN; varying vec3 vV;' +
      'void main(){ vUv=uv; vN=normalize(normalMatrix*normal); vec4 mv=modelViewMatrix*vec4(position,1.); vV=-mv.xyz; gl_Position=projectionMatrix*mv; }',
    fragmentShader: 'uniform float uT; uniform float uA; varying vec2 vUv; varying vec3 vN; varying vec3 vV;' +
      'vec3 hsv(float h,float s,float v){ vec3 k=vec3(1.,2./3.,1./3.); vec3 p=abs(fract(vec3(h)+k)*6.-3.); return v*mix(vec3(1.),clamp(p-1.,0.,1.),s); }' +
      'void main(){ vec3 n=normalize(vN), v=normalize(vV); float d=abs(dot(n,v)); float f=pow(1.-d,1.4);' +
      ' float band=sin((vUv.x*1.4+vUv.y*1.1)*9.+d*7.+uT*.5)*.5+.5;' +
      ' vec3 c=hsv(fract(vUv.x*.45+vUv.y*.35+d*.8+uT*.02),.5,1.);' +
      ' float m=(.10+f*.75)*band; gl_FragColor=vec4(c*m*uA,m*uA); }'
  });
  var holo = new THREE.Mesh(faceGeo, holoMat);
  holo.position.z = CD / 2 + .0135; flipGrp.add(holo);
  var holo2 = new THREE.Mesh(faceGeo, holoMat);
  holo2.position.z = -CD / 2 - .0135; holo2.rotation.y = Math.PI; flipGrp.add(holo2);

  /* ---------- sombra de contato e brilho de fundo ---------- */
  function texRadial(c0, c1) {
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var x = c.getContext('2d'), g = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    g.addColorStop(0, c0); g.addColorStop(1, c1); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }
  var sombra = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: texRadial('rgba(0,0,0,.7)', 'rgba(0,0,0,0)'), transparent: true, depthWrite: false }));
  sombra.position.set(0, -1.55, -.5); sombra.scale.set(4.2, .8, 1); raizCena.add(sombra);
  var halo = new THREE.Mesh(new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: texRadial('rgba(166,77,245,.34)', 'rgba(166,77,245,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.position.set(0, 0, -1.2); halo.scale.set(8, 8, 1); raizCena.add(halo);

  /* ---------- faíscas ---------- */
  var NS = pequeno ? 260 : 620;
  var sPos = new Float32Array(NS * 3), sVel = new Float32Array(NS), sTam = new Float32Array(NS), sFase = new Float32Array(NS);
  for (var i = 0; i < NS; i++) {
    sPos[i * 3] = (Math.random() - .5) * 15; sPos[i * 3 + 1] = (Math.random() - .5) * 8; sPos[i * 3 + 2] = -5 + Math.random() * 7;
    sVel[i] = .06 + Math.random() * .22; sTam[i] = 6 + Math.random() * 16; sFase[i] = Math.random() * 6.28;
  }
  var sGeo = new THREE.BufferGeometry();
  sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
  sGeo.setAttribute('tam', new THREE.BufferAttribute(sTam, 1));
  sGeo.setAttribute('fase', new THREE.BufferAttribute(sFase, 1));
  var sMat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    uniforms: { uT: { value: 0 }, uCor: { value: new THREE.Color(0xc58bff) }, uEsc: { value: 1 } },
    vertexShader: 'attribute float tam; attribute float fase; uniform float uT; uniform float uEsc; varying float vA;' +
      'void main(){ vec4 mv=modelViewMatrix*vec4(position,1.); gl_Position=projectionMatrix*mv;' +
      ' gl_PointSize=tam*uEsc*(2.6/-mv.z); vA=.35+.65*(.5+.5*sin(uT*1.3+fase)); }',
    fragmentShader: 'uniform vec3 uCor; varying float vA; void main(){ float d=length(gl_PointCoord-.5); if(d>.5) discard;' +
      ' float a=smoothstep(.5,0.,d); gl_FragColor=vec4(uCor*a*vA,a*vA); }'
  });
  var faiscas = new THREE.Points(sGeo, sMat); faiscas.frustumCulled = false; scene.add(faiscas);

  /* ---------- celular (cap. Pix) ---------- */
  var PW = 1.15, PH = 2.35;
  var fone = new THREE.Group(); raizCena.add(fone);
  var foneCorpo = new THREE.Mesh(
    new THREE.ExtrudeGeometry(retArred(PW, PH, .2), { depth: .11, bevelEnabled: true, bevelThickness: .02, bevelSize: .02, bevelSegments: 4, curveSegments: 16 }),
    new THREE.MeshPhysicalMaterial({ color: 0x120a1d, metalness: .9, roughness: .28, envMap: envMap, envMapIntensity: 1.2 }));
  foneCorpo.geometry.translate(0, 0, -.055); fone.add(foneCorpo);
  var cvTela = document.createElement('canvas'); cvTela.width = 512; cvTela.height = 1040;
  var texTela = new THREE.CanvasTexture(cvTela); texTela.encoding = THREE.sRGBEncoding;
  var tela = new THREE.Mesh(geoFace(PW - .07, PH - .07, .17),
    new THREE.MeshBasicMaterial({ map: texTela, toneMapped: false }));
  tela.position.z = .078; fone.add(tela);
  fone.visible = false;

  function desenhaTela(t) {
    var c = cvTela.getContext('2d'), w = 512, h = 1040;
    var g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#9a2ae8'); g.addColorStop(1, '#4d0788');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    c.fillStyle = 'rgba(0,0,0,.55)'; rrect(c, w / 2 - 70, 22, 140, 34, 17); c.fill();
    c.fillStyle = '#fff'; c.textAlign = 'left'; c.font = '800 44px ' + FONTE; c.fillText('Pix', 40, 130);
    c.globalAlpha = .25; c.beginPath(); c.arc(w - 66, 112, 26, 0, 6.2832); c.fill(); c.globalAlpha = 1;
    // valor
    c.fillStyle = 'rgba(255,255,255,.16)'; rrect(c, 32, 190, w - 64, 190, 28); c.fill();
    c.fillStyle = 'rgba(255,255,255,.75)'; c.font = '500 26px ' + FONTE; c.fillText('Valor', 64, 244);
    var alvo = '150,00', n = clamp(Math.floor((t - .5) / .18), 0, alvo.length);
    c.fillStyle = '#fff'; c.font = '800 78px ' + FONTE;
    c.fillText('R$ ' + (n ? alvo.slice(0, n) : '0,00'), 64, 332);
    // para
    c.fillStyle = 'rgba(255,255,255,.12)'; rrect(c, 32, 410, w - 64, 130, 28); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(100, 475, 38, 0, 6.2832); c.fill();
    c.fillStyle = '#52088f'; c.font = '800 36px ' + FONTE; c.textAlign = 'center'; c.fillText('A', 100, 488);
    c.textAlign = 'left'; c.fillStyle = 'rgba(255,255,255,.7)'; c.font = '500 24px ' + FONTE; c.fillText('Para', 162, 460);
    c.fillStyle = '#fff'; c.font = '700 34px ' + FONTE; c.fillText('Ana Souza', 162, 502);
    // botão
    var press = t > 1.9 && t < 2.15 ? .95 : 1;
    c.save(); c.translate(w / 2, 900); c.scale(press, press);
    c.fillStyle = '#fff'; rrect(c, -(w - 80) / 2, -48, w - 80, 96, 48); c.fill();
    c.fillStyle = '#4a0a86'; c.textAlign = 'center'; c.font = '800 36px ' + FONTE; c.fillText('Enviar Pix', 0, 13);
    c.restore();
    // sucesso
    var s = clamp((t - 2.4) / .7, 0, 1);
    if (s > 0) {
      var e = ease(s);
      c.save(); c.globalAlpha = e;
      var og = c.createLinearGradient(0, 0, 0, h); og.addColorStop(0, '#9a2ae8'); og.addColorStop(1, '#4d0788');
      c.fillStyle = og; c.fillRect(0, 0, w, h);
      var rr = 20 + e * 90;
      c.fillStyle = '#fff'; c.beginPath(); c.arc(w / 2, 470, rr + (s < 1 ? 0 : 6 * Math.sin(t * 3)), 0, 6.2832); c.fill();
      c.strokeStyle = '#7a0ec8'; c.lineWidth = 16; c.lineCap = 'round'; c.lineJoin = 'round';
      var p = clamp((t - 2.7) / .45, 0, 1);
      c.beginPath(); c.moveTo(w / 2 - 44, 472);
      if (p < .5) c.lineTo(lerp(w / 2 - 44, w / 2 - 12, p * 2), lerp(472, 506, p * 2));
      else { c.lineTo(w / 2 - 12, 506); c.lineTo(lerp(w / 2 - 12, w / 2 + 50, (p - .5) * 2), lerp(506, 436, (p - .5) * 2)); }
      c.stroke();
      c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '800 54px ' + FONTE; c.fillText('Pix enviado', w / 2, 690);
      c.globalAlpha = .8 * e; c.font = '500 30px ' + FONTE; c.fillText('em 3 segundos', w / 2, 742);
      c.restore();
    }
    texTela.needsUpdate = true;
  }

  // fluxo de partículas do cartão ao celular
  var NF = 90, fPos = new Float32Array(NF * 3), fGeo = new THREE.BufferGeometry();
  fGeo.setAttribute('position', new THREE.BufferAttribute(fPos, 3));
  var fMat = new THREE.PointsMaterial({ color: 0xe6ccff, size: .2, map: texRadial('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), transparent: true, opacity: .95, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
  var fluxo = new THREE.Points(fGeo, fMat); fluxo.frustumCulled = false; fluxo.visible = false; raizCena.add(fluxo);

  /* ---------- caixinhas de vidro (cap. Caixinhas) ---------- */
  var jarros = new THREE.Group(); raizCena.add(jarros); jarros.visible = false;
  var JARROS = [
    { nome: 'Viagem', h: 1.9, p: .78, v: 3900 }, { nome: 'Reserva', h: 1.45, p: .45, v: 9000 }, { nome: 'Carro', h: 1.1, p: .92, v: 27600 }
  ];
  JARROS.forEach(function (j, i) {
    var g = new THREE.Group(); g.position.set(i * .98 - .98, 0, 0);
    var vidro = new THREE.Mesh(new THREE.BoxGeometry(.78, j.h, .54),
      new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: .13, roughness: .04, metalness: 0, clearcoat: 1, envMap: envMap, envMapIntensity: 1.8, side: THREE.DoubleSide, depthWrite: false }));
    var borda = new THREE.LineSegments(new THREE.EdgesGeometry(vidro.geometry), new THREE.LineBasicMaterial({ color: 0xe0c6ff, transparent: true, opacity: .55 }));
    var liq = new THREE.Mesh(new THREE.BoxGeometry(.7, 1, .46),
      new THREE.MeshBasicMaterial({ color: 0x8a22e6, transparent: true, opacity: .92 }));
    var cap = new THREE.Mesh(new THREE.PlaneGeometry(.7, .46), new THREE.MeshBasicMaterial({ color: 0xd9b0ff, transparent: true, opacity: .95 }));
    cap.rotation.x = -Math.PI / 2;
    // etiqueta
    var cvE = document.createElement('canvas'); cvE.width = 320; cvE.height = 140;
    var tE = new THREE.CanvasTexture(cvE); tE.encoding = THREE.sRGBEncoding;
    var etiqueta = new THREE.Mesh(new THREE.PlaneGeometry(.95, .415), new THREE.MeshBasicMaterial({ map: tE, transparent: true, depthWrite: false, toneMapped: false }));
    g.add(vidro); g.add(borda); g.add(liq); g.add(cap); g.add(etiqueta);
    g.position.y = -j.h / 2 + .95;
    jarros.add(g);
    j.g = g; j.liq = liq; j.cap = cap; j.etq = etiqueta; j.cv = cvE; j.tex = tE; j.ult = -1;
  });
  function etiquetaJarro(j, v) {
    var k = Math.round(v / 100);
    if (k === j.ult) return; j.ult = k;
    var c = j.cv.getContext('2d'); c.clearRect(0, 0, 320, 140);
    c.fillStyle = 'rgba(20,6,34,.62)'; rrect(c, 4, 4, 312, 132, 30); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.2)'; c.lineWidth = 2; rrect(c, 4, 4, 312, 132, 30); c.stroke();
    c.fillStyle = '#fff'; c.textAlign = 'center'; c.font = '800 46px ' + FONTE; c.fillText(j.nome, 160, 62);
    c.fillStyle = '#d9bcff'; c.font = '600 34px ' + FONTE; c.fillText('R$ ' + Math.round(v).toLocaleString('pt-BR'), 160, 110);
    j.tex.needsUpdate = true;
  }

  /* ---------- mundo (cap. Mundo) ---------- */
  var mundo = new THREE.Group(); raizCena.add(mundo); mundo.visible = false;
  var globo = new THREE.LineSegments(new THREE.WireframeGeometry(new THREE.SphereGeometry(2.05, 22, 14)),
    new THREE.LineBasicMaterial({ color: 0xc58bff, transparent: true, opacity: .22 }));
  mundo.add(globo);
  var ICONES = [
    'M6 8h12l-1 12H7zM9 8a3 3 0 0 1 6 0', 'M3 14l18-9-5 15-4-6z', 'M4 11h16l-1.5-5h-13zM6 11v6M18 11v6M4 17h16',
    'M6 3v8M10 3v8M6 7h4M8 11v10M17 3c-2 2-2 6 0 8v10', 'M9 18V6l10-2v12M9 18a3 3 0 1 1-3-3M19 16a3 3 0 1 1-3-3',
    'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 5.6-7 10-7 10z', 'M4 11l8-7 8 7M6 10v10h12V10', 'M4 7h16v11H4zM8 7V5h8v2'
  ];
  var tiles = [];
  ICONES.forEach(function (d, i) {
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var x = c.getContext('2d');
    x.fillStyle = 'rgba(40,12,70,.72)'; rrect(x, 8, 8, 240, 240, 54); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.28)'; x.lineWidth = 4; rrect(x, 8, 8, 240, 240, 54); x.stroke();
    x.translate(128 - 12 * 5.2, 128 - 12 * 5.2); x.scale(5.2, 5.2);
    x.strokeStyle = '#fff'; x.lineWidth = 1.8; x.lineCap = 'round'; x.lineJoin = 'round';
    x.stroke(new Path2D(d));
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
    var m = new THREE.Mesh(new THREE.PlaneGeometry(.62, .62), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }));
    m.userData.a = i / ICONES.length * Math.PI * 2;
    mundo.add(m); tiles.push(m);
  });

  /* ---------- poses por capítulo ---------- */
  // pos [x,y,z], rot [x,y,z], esc
  var POSES = [
    { p: [0, 0, 0],       r: [.14, -.5, .1],  s: 1 },
    { p: [0, 0, .5],      r: [.06, .22, -.03], s: 1.06 },
    { p: [0, 0, .3],      r: [.1, Math.PI - .3, .02], s: 1.05 },
    { p: [-1.55, -.85, -.3], r: [.1, .55, -.2], s: .62 },
    { p: [-1.15, 1.4, -.3], r: [.2, .35, -.14], s: .46 },
    { p: [0, 0, 0],       r: [.1, -.25, .08], s: .88 },
    { p: [0, 0, .5],      r: [.08, -.3, 0],   s: 1.12 }
  ];
  var cap = 0, cp = 0, tPeloCap = 0;
  var cur = { p: [0, 0, 0], r: [.14, -.5, .1], s: 1 };
  var wFone = 0, wJarros = 0, wMundo = 0;
  var flipAlvo = 0, flipCur = 0;
  var arrX = 0, arrY = 0, arrVX = 0, arrVY = 0, arrasta = false;
  var mx = 0, my = 0, sx = 0, sy = 0;
  var introT0 = null, intro = reduz ? 1 : 0;
  var W = 1, H = 1, esc0 = 1, visivel = true;

  /* ---------- layout: alinha a cena à coluna da página ---------- */
  function layout() {
    pequeno = window.innerWidth < 760;
    W = window.innerWidth; H = window.innerHeight;
    renderer.setSize(W, H, false);
    camera.aspect = W / H; camera.updateProjectionMatrix();
    var area = document.querySelector('.cena');
    var r = area ? area.getBoundingClientRect() : { left: W / 2, width: W / 2, top: 0, height: H };
    var visH = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * CAM_Z, visW = visH * camera.aspect;
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    raizCena.position.x = (cx / W - .5) * visW;
    raizCena.position.y = -(cy / H - .5) * visH;
    var colW = r.width / W * visW, colH = r.height / H * visH;
    esc0 = clamp(Math.min(colW * .66 / CW, colH * .6 / CH), .3, 1.3);
    raizCena.scale.setScalar(esc0);
  }
  window.addEventListener('resize', layout);

  /* ---------- entradas ---------- */
  window.addEventListener('pointermove', function (e) {
    mx = e.clientX / W - .5; my = e.clientY / H - .5;
    if (arrasta) {
      arrVX = (e.movementX || 0) * .006; arrVY = (e.movementY || 0) * .006;
      arrY += arrVX; arrX += arrVY;
    }
  }, { passive: true });
  window.addEventListener('pointerup', function () { arrasta = false; });

  // clique e arrasto no cartão (raycast)
  var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function acertou(e) {
    ndc.set((e.clientX / W) * 2 - 1, -(e.clientY / H) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects([frente, verso, corpo], false).length > 0;
  }
  function interativo(el) { return el && el.closest && el.closest('a,button,input,label,details,summary,nav,header'); }
  window.addEventListener('pointermove', function (e) {
    if (reduz || !visivel) return;
    if (interativo(e.target)) { document.body.style.cursor = ''; return; }
    var sobre = acertou(e);
    document.body.style.cursor = cap === 6 ? (arrasta ? 'grabbing' : (sobre ? 'grab' : '')) : (sobre ? 'pointer' : '');
  }, { passive: true });
  window.addEventListener('pointerdown', function (e) {
    if (interativo(e.target) || !visivel) return;
    if (cap === 6 && acertou(e)) { arrasta = true; arrVX = 0; arrVY = 0; }
  });
  window.addEventListener('click', function (e) {
    if (interativo(e.target) || !visivel) return;
    if (cap !== 6 && acertou(e)) flipAlvo += Math.PI;
  });

  /* ---------- laço ---------- */
  var relogio = new THREE.Clock();
  var tema3 = new THREE.Color(0xc58bff);
  var ultimoCap = -1;
  function quadro() {
    requestAnimationFrame(quadro);
    if (!visivel) return;
    var dt = Math.min(relogio.getDelta(), .05), t = relogio.elapsedTime;
    if (introT0 === null) introT0 = t;
    if (!reduz) intro = clamp((t - introT0) / 2.4, 0, 1);
    var ie = ease(intro);

    var alvo = POSES[cap];
    var k = 1 - Math.exp(-dt * 3.4);
    for (var i = 0; i < 3; i++) { cur.p[i] = lerp(cur.p[i], alvo.p[i], k); cur.r[i] = lerp(cur.r[i], alvo.r[i], k); }
    cur.s = lerp(cur.s, alvo.s, k);

    sx = lerp(sx, mx, 1 - Math.exp(-dt * 5)); sy = lerp(sy, my, 1 - Math.exp(-dt * 5));
    flipCur = lerp(flipCur, flipAlvo, 1 - Math.exp(-dt * 4));
    // inércia do arrasto (só no capítulo "Monte o seu")
    if (!arrasta) { arrY += arrVX; arrX += arrVY; arrVX *= .94; arrVY *= .94; }
    if (cap !== 6) { arrX *= .92; arrY *= .92; }
    arrX = clamp(arrX, -.9, .9);

    var sway = Math.sin(t * .8) * .035;
    var xk = pequeno ? .5 : 1;
    cartao.position.set(cur.p[0] * xk, cur.p[1] + Math.sin(t * 1.1) * .04, cur.p[2] - (1 - ie) * 6);
    cartao.rotation.set(cur.r[0] + sy * .28 + arrX + sway, cur.r[1] + sx * .5 + arrY + (1 - ie) * 2.6, cur.r[2] - sx * .06);
    flipGrp.rotation.y = flipCur;
    cartao.scale.setScalar(cur.s * (.3 + .7 * ie));

    // sombra acompanha
    sombra.position.set(cur.p[0] * xk * .9, cur.p[1] - 1.1 * cur.s - .45, -.6);
    sombra.scale.set(4.2 * cur.s, .8 * cur.s, 1);
    sombra.material.opacity = .85 * ie;
    halo.position.set(cur.p[0] * xk * .6, cur.p[1] * .6, -1.4);
    halo.scale.setScalar(8 * (.7 + .3 * ie));

    holoMat.uniforms.uT.value = t;
    holoMat.uniforms.uA.value = .55 + .25 * Math.sin(t * .7);
    rim.position.x = -4 + Math.sin(t * .5) * 1.2; rim2.position.y = -2 + Math.cos(t * .6) * 1.2;

    // pesos dos adereços
    var kw = 1 - Math.exp(-dt * 3);
    wFone = lerp(wFone, cap === 3 ? 1 : 0, kw);
    wJarros = lerp(wJarros, cap === 4 ? 1 : 0, kw);
    wMundo = lerp(wMundo, cap === 5 ? 1 : 0, kw);

    // celular
    fone.visible = wFone > .01;
    if (fone.visible) {
      var ef = ease(wFone);
      fone.position.set(1.45 * xk + (1 - ef) * 2.4, .05 - (1 - ef) * .8, .35);
      fone.rotation.set(Math.sin(t * .9) * .02, -.4 + (1 - ef) * .7 + sx * .15, .08);
      fone.scale.setScalar(.3 + .7 * ef);
      desenhaTela(tPeloCap % 7.5);
    }
    // fluxo
    fluxo.visible = fone.visible && wFone > .6;
    if (fluxo.visible) {
      var ax = cartao.position.x + .8 * xk, ay = cartao.position.y, bx = fone.position.x - .4, by = fone.position.y + .1;
      for (var n = 0; n < NF; n++) {
        var u = ((n / NF) + t * .45) % 1;
        var mxp = lerp(ax, bx, u), myp = lerp(ay, by, u) + Math.sin(u * Math.PI) * .9 + Math.sin(n * 7 + t * 4) * .06;
        fPos[n * 3] = mxp; fPos[n * 3 + 1] = myp; fPos[n * 3 + 2] = .4 + Math.sin(n * 3.1 + t * 2) * .12;
      }
      fGeo.attributes.position.needsUpdate = true;
    }
    // caixinhas
    jarros.visible = wJarros > .01;
    if (jarros.visible) {
      var ej = ease(wJarros);
      jarros.position.set(.2 * xk, -.95 + (1 - ej) * -1.2, .1);
      jarros.rotation.set(0, -.28 + sx * .2, 0);
      jarros.scale.setScalar((.4 + .6 * ej) * .92);
      var fill = ease(clamp(cp * 1.5 + .12, 0, 1));
      JARROS.forEach(function (j, i) {
        var altura = Math.max(.001, (j.h - .1) * j.p * fill);
        j.liq.scale.y = altura; j.liq.position.y = -j.h / 2 + .05 + altura / 2;
        j.cap.position.y = -j.h / 2 + .05 + altura + .001;
        j.etq.position.y = j.h / 2 + .38;
        j.g.position.y = -j.h / 2 + .95 + Math.sin(t * 1.2 + i) * .02;
        etiquetaJarro(j, j.v * fill);
      });
    }
    // mundo
    mundo.visible = wMundo > .01;
    if (mundo.visible) {
      var em = ease(wMundo);
      mundo.position.set(cur.p[0] * xk, cur.p[1], -1.0);
      mundo.scale.setScalar(.4 + .6 * em);
      globo.rotation.y = t * .12; globo.rotation.x = .3;
      globo.material.opacity = .22 * em;
      tiles.forEach(function (m, i) {
        var a = m.userData.a + t * .22;
        var R = 2.7;
        m.position.set(Math.cos(a) * R * 1.12, Math.sin(a * 1.0) * R * .38 + Math.sin(a * 2) * .1, Math.sin(a) * R * .55);
        m.quaternion.copy(camera.quaternion);
        m.material.opacity = em * (.55 + .45 * (Math.sin(a) * .5 + .5));
        m.scale.setScalar(.62 + .34 * (Math.sin(a) * .5 + .5));
      });
    }

    // faíscas: sobem devagar e aceleram com o capítulo
    sMat.uniforms.uT.value = t;
    sMat.uniforms.uEsc.value = (renderer.getPixelRatio() * (pequeno ? 1.1 : 1.5));
    var vel = 1 + (cap === 3 ? 1.4 : 0) + wMundo * .6;
    for (var s = 0; s < NS; s++) {
      sPos[s * 3 + 1] += sVel[s] * dt * vel;
      sPos[s * 3] += Math.sin(t * .3 + sFase[s]) * dt * .05;
      if (sPos[s * 3 + 1] > 4.2) sPos[s * 3 + 1] = -4.2;
    }
    sGeo.attributes.position.needsUpdate = true;
    tema3.setRGB(TEMAS[temaAtual].glow[0] / 255 * .6 + .4, TEMAS[temaAtual].glow[1] / 255 * .6 + .4, TEMAS[temaAtual].glow[2] / 255 * .6 + .4);
    sMat.uniforms.uCor.value.copy(tema3);

    renderer.render(scene, camera);
  }

  /* ---------- API ---------- */
  function visibilidade() {
    var el = document.getElementById('jornada');
    if (!el) return;
    var r = el.getBoundingClientRect();
    visivel = r.bottom > -50 && r.top < window.innerHeight + 50;
    canvas.style.visibility = visivel ? 'visible' : 'hidden';
  }
  window.addEventListener('scroll', visibilidade, { passive: true });

  window.Cena3D = {
    pronto: true,
    capitulo: function (c) {
      if (c === cap) return;
      cap = clamp(c, 0, POSES.length - 1);
      tPeloCap = 0; tPeloCapStart = performance.now();
      if (cap !== 2) flipAlvo = Math.round(flipAlvo / (Math.PI * 2)) * Math.PI * 2; // volta para a frente, sem giro extra
      if (cap === 2) flipAlvo = 0;
    },
    progresso: function (v) { cp = v; },
    tema: function (i) { temaAtual = clamp(i, 0, TEMAS.length - 1); desenhaFrente(); window.__glow = TEMAS[temaAtual].glow; return TEMAS[temaAtual]; },
    temas: TEMAS,
    nome: function (s) { nomeAtual = (s || '').trim() || 'SEU NOME AQUI'; desenhaFrente(); },
    virar: function () { flipAlvo += Math.PI; },
    arrasto: function (on) { arrasta = !!on; },
    imagem: function () { desenhaFrente(); return cvFrente.toDataURL('image/png'); },
    relayout: layout
  };
  var tPeloCapStart = performance.now();
  // relógio do capítulo (usado pela animação do Pix)
  setInterval(function () { tPeloCap = (performance.now() - tPeloCapStart) / 1000; }, 16);

  // desenha tudo (e de novo quando a fonte chegar)
  desenhaFrente(); desenhaVerso();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { desenhaFrente(); desenhaVerso(); });
  layout(); visibilidade();
  requestAnimationFrame(quadro);
})();
