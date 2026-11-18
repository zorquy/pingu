// El modelo de la mascota (1389): el mismo de la propuesta («La mascota en
// 3D», con la gorra, el cubo de hielo, el buzón y los gestos), en un módulo
// que no sabe de páginas. Lo arma `crearModelo(THREE)` una sola vez y lo usa
// js/mascota.js, que es quien lo pinta en cada hueco de la web.
//
// Todo sale del instante: `pose(gesto, a, t, opciones)` deja el modelo como
// está `a` segundos después de empezar el gesto, sin estado entre fotogramas.
// Así un mismo modelo sirve para varios huecos a la vez (se pinta uno tras
// otro) y una foto quieta («menos movimiento») es una pose más.
export function crearModelo(T) {
  const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches

  // ── Utilidades ──
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x))
  const suave = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x) }
  const tramo = (p, a, b) => clamp((p - a) / (b - a), 0, 1)
  const ventana = (t, a, b, rampa = 0.15) => suave(tramo(t, a, a + rampa)) * (1 - suave(tramo(t, b - rampa, b)))
  const azar = (i, k = 0) => { const x = Math.sin(i * 12.9898 + k * 78.233) * 43758.5453; return x - Math.floor(x) }
  const arco = (p) => 4 * p * (1 - p)

  function lienzoTex(w, h, dibuja) {
    const c = document.createElement('canvas'); c.width = w; c.height = h
    const g = c.getContext('2d'); dibuja(g, w, h)
    const t = new T.CanvasTexture(c); t.anisotropy = 4; return t
  }
  const redondo = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath() }
  const TINTA = '#163d59'
  const TEX = {}
  function corazonPath(g, cx, cy, s) {
    g.beginPath(); g.moveTo(cx, cy + s * 0.9)
    g.bezierCurveTo(cx - s * 1.5, cy - s * 0.1, cx - s * 0.9, cy - s * 1.2, cx, cy - s * 0.45)
    g.bezierCurveTo(cx + s * 0.9, cy - s * 1.2, cx + s * 1.5, cy - s * 0.1, cx, cy + s * 0.9); g.closePath()
  }
  function texto(g, w, h, t, color, borde = '#fff', tam = 0.8) {
    g.font = `900 ${Math.round(h * tam)}px system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'
    g.lineJoin = 'round'; g.lineWidth = h * 0.12; g.strokeStyle = borde; g.strokeText(t, w / 2, h * 0.54)
    g.fillStyle = color; g.fillText(t, w / 2, h * 0.54)
  }
  function texturas() {
    TEX.ojo = lienzoTex(256, 320, (g, w, h) => {
      g.save(); g.beginPath(); g.ellipse(w / 2, h / 2, w * 0.4, h * 0.42, 0, 0, Math.PI * 2); g.clip()
      const gr = g.createLinearGradient(0, h * 0.1, 0, h * 0.9); gr.addColorStop(0, '#6fc6da'); gr.addColorStop(0.45, '#c4f2f9'); gr.addColorStop(1, '#e6fbfd')
      g.fillStyle = gr; g.fillRect(0, 0, w, h)
      g.fillStyle = 'rgba(255,255,255,.85)'; g.beginPath(); g.ellipse(w * 0.6, h * 0.68, w * 0.08, h * 0.05, -0.5, 0, Math.PI * 2); g.fill()
      g.restore()
      g.lineWidth = 15; g.strokeStyle = TINTA; g.beginPath(); g.ellipse(w / 2, h / 2, w * 0.4, h * 0.42, 0, 0, Math.PI * 2); g.stroke()
    })
    TEX.feliz = lienzoTex(256, 256, (g) => { g.lineWidth = 24; g.lineCap = 'round'; g.strokeStyle = TINTA; g.beginPath(); g.moveTo(40, 170); g.quadraticCurveTo(128, 30, 216, 170); g.stroke() })
    TEX.cerrado = lienzoTex(256, 256, (g) => { g.lineWidth = 22; g.lineCap = 'round'; g.strokeStyle = TINTA; g.beginPath(); g.moveTo(40, 110); g.quadraticCurveTo(128, 190, 216, 110); g.stroke() })
    TEX.corazonOjo = lienzoTex(256, 256, (g) => { corazonPath(g, 128, 140, 80); g.fillStyle = '#ff4d6d'; g.fill(); g.lineWidth = 12; g.strokeStyle = '#7a1028'; g.stroke(); g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.ellipse(95, 105, 16, 10, -0.6, 0, 7); g.fill() })
    TEX.espiral = lienzoTex(256, 256, (g) => { g.lineWidth = 13; g.lineCap = 'round'; g.strokeStyle = TINTA; g.beginPath(); for (let a = 0; a < Math.PI * 6.2; a += 0.08) { const r = 6 + a * 5.6; const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r; a === 0 ? g.moveTo(x, y) : g.lineTo(x, y) } g.stroke() })
    TEX.ceja = lienzoTex(256, 96, (g) => { g.fillStyle = TINTA; redondo(g, 16, 28, 224, 40, 20); g.fill() })
    TEX.rubor = lienzoTex(128, 64, (g, w, h) => { const gr = g.createRadialGradient(64, 32, 2, 64, 32, 60); gr.addColorStop(0, 'rgba(255,120,150,.95)'); gr.addColorStop(1, 'rgba(255,120,150,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(220,60,100,.7)'; g.lineWidth = 4; for (const x of [44, 64, 84]) { g.beginPath(); g.moveTo(x - 6, 40); g.lineTo(x + 6, 24); g.stroke() } })
    TEX.boca = lienzoTex(128, 96, (g) => { g.fillStyle = '#16303d'; g.beginPath(); g.ellipse(64, 48, 58, 42, 0, 0, 7); g.fill(); g.fillStyle = '#ff7b93'; g.beginPath(); g.ellipse(64, 72, 30, 16, 0, 0, 7); g.fill() })
    TEX.brillo = lienzoTex(64, 256, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.3, 'rgba(255,255,255,.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.beginPath(); g.ellipse(32, 128, 22, 120, 0, 0, 7); g.fill() })
    TEX.placa = lienzoTex(160, 110, (g, w, h) => { g.fillStyle = '#f5d33a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#111'; g.lineWidth = 8; g.strokeRect(4, 4, w - 8, h - 8); g.beginPath(); g.moveTo(26, 26); g.lineTo(80, 66); g.lineTo(134, 26); g.stroke(); g.strokeRect(26, 26, 108, 60) })
    TEX.pegatina = lienzoTex(200, 200, (g) => {
      g.fillStyle = '#3b7bd8'; redondo(g, 8, 8, 184, 184, 22); g.fill(); g.lineWidth = 8; g.strokeStyle = '#111'; g.stroke()
      g.fillStyle = '#e3350d'; g.beginPath(); g.arc(100, 100, 62, Math.PI, 0); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(100, 100, 62, 0, Math.PI); g.fill()
      g.lineWidth = 10; g.strokeStyle = '#111'; g.beginPath(); g.arc(100, 100, 62, 0, 7); g.stroke(); g.beginPath(); g.moveTo(38, 100); g.lineTo(162, 100); g.stroke()
      g.fillStyle = '#fff'; g.beginPath(); g.arc(100, 100, 17, 0, 7); g.fill(); g.stroke()
    })
    TEX.corazon = lienzoTex(128, 128, (g) => { corazonPath(g, 64, 70, 40); g.fillStyle = '#ff4d6d'; g.fill(); g.lineWidth = 7; g.strokeStyle = '#7a1028'; g.stroke() })
    TEX.exclama = lienzoTex(128, 128, (g, w, h) => texto(g, w, h, '!', '#e4472d', TINTA, 0.9))
    TEX.pregunta = lienzoTex(128, 128, (g, w, h) => texto(g, w, h, '?', '#2a6b96', '#fff', 0.85))
    TEX.zeta = lienzoTex(128, 128, (g, w, h) => texto(g, w, h, 'Z', '#2a6b96', '#fff', 0.8))
    TEX.puntos = lienzoTex(192, 64, (g) => { g.fillStyle = TINTA; for (const x of [36, 96, 156]) { g.beginPath(); g.arc(x, 32, 15, 0, 7); g.fill() } })
    TEX.nota = lienzoTex(128, 128, (g) => { g.fillStyle = TINTA; g.strokeStyle = TINTA; g.lineWidth = 10; g.beginPath(); g.ellipse(46, 96, 22, 16, -0.4, 0, 7); g.fill(); g.beginPath(); g.moveTo(64, 92); g.lineTo(64, 18); g.quadraticCurveTo(96, 30, 104, 58); g.stroke() })
    TEX.enfado = lienzoTex(128, 128, (g) => { g.strokeStyle = '#e4472d'; g.lineWidth = 12; g.lineCap = 'round'; for (let i = 0; i < 4; i++) { g.save(); g.translate(64, 64); g.rotate(i * Math.PI / 2); g.beginPath(); g.moveTo(12, -40); g.quadraticCurveTo(12, -12, 40, -12); g.stroke(); g.restore() } })
    TEX.gota = lienzoTex(96, 128, (g) => { g.fillStyle = '#8fd8f0'; g.strokeStyle = '#2a6b96'; g.lineWidth = 7; g.beginPath(); g.moveTo(48, 10); g.bezierCurveTo(56, 40, 84, 64, 84, 86); g.arc(48, 86, 36, 0, Math.PI); g.bezierCurveTo(12, 64, 40, 40, 48, 10); g.fill(); g.stroke(); g.fillStyle = 'rgba(255,255,255,.8)'; g.beginPath(); g.ellipse(36, 86, 7, 12, 0.3, 0, 7); g.fill() })
    TEX.estrella = lienzoTex(128, 128, (g) => { g.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? 22 : 54, a = -Math.PI / 2 + i * Math.PI / 5; g.lineTo(64 + Math.cos(a) * r, 66 + Math.sin(a) * r) } g.closePath(); g.fillStyle = '#f6c453'; g.fill(); g.lineWidth = 7; g.strokeStyle = '#8a5a0a'; g.stroke() })
    TEX.bombilla = lienzoTex(128, 160, (g) => {
      g.strokeStyle = '#f6c453'; g.lineWidth = 8; g.lineCap = 'round'; for (let i = 0; i < 7; i++) { const a = Math.PI + i * Math.PI / 6; g.beginPath(); g.moveTo(64 + Math.cos(a) * 50, 62 + Math.sin(a) * 50); g.lineTo(64 + Math.cos(a) * 60, 62 + Math.sin(a) * 60); g.stroke() }
      g.fillStyle = '#fff3a8'; g.strokeStyle = TINTA; g.lineWidth = 6; g.beginPath(); g.arc(64, 62, 36, 0, 7); g.fill(); g.stroke()
      g.fillStyle = '#9aa7b2'; g.fillRect(48, 98, 32, 26); g.strokeRect(48, 98, 32, 26)
    })
    TEX.vapor = lienzoTex(128, 128, (g) => { g.fillStyle = 'rgba(255,255,255,.95)'; g.strokeStyle = 'rgba(120,140,155,.8)'; g.lineWidth = 5; for (const [x, y, r] of [[50, 72, 30], [80, 60, 28], [70, 88, 24]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); g.stroke() } })
    TEX.chispa = lienzoTex(128, 128, (g) => { g.fillStyle = '#fff6b0'; g.strokeStyle = '#c8920a'; g.lineWidth = 5; g.beginPath(); g.moveTo(64, 6); g.quadraticCurveTo(70, 58, 122, 64); g.quadraticCurveTo(70, 70, 64, 122); g.quadraticCurveTo(58, 70, 6, 64); g.quadraticCurveTo(58, 58, 64, 6); g.fill(); g.stroke() })
  }
  texturas()

  // ── Piezas ──
  function cuboRedondo(w, h, d, r, seg = 10) {
    const g = new T.BoxGeometry(w, h, d, seg, seg, seg)
    const p = g.attributes.position, n = g.attributes.normal, v = new T.Vector3(), c = new T.Vector3()
    const hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i)
      c.set(clamp(v.x, -hw, hw), clamp(v.y, -hh, hh), clamp(v.z, -hd, hd))
      v.sub(c).normalize(); n.setXYZ(i, v.x, v.y, v.z)
      v.multiplyScalar(r).add(c); p.setXYZ(i, v.x, v.y, v.z)
    }
    return g
  }
  function arcoBuzon(ancho, recto, prof, bisel) {
    const r = ancho / 2, s = new T.Shape()
    s.moveTo(-r, 0); s.lineTo(r, 0); s.lineTo(r, recto); s.absarc(0, recto, r, 0, Math.PI, false); s.lineTo(-r, 0)
    const g = new T.ExtrudeGeometry(s, { depth: prof, bevelEnabled: bisel > 0, bevelThickness: bisel, bevelSize: bisel, bevelSegments: 3, curveSegments: 28 })
    g.center()
    return g
  }
  const ESFERA = new T.SphereGeometry(1, 36, 26)
  const PLANO = new T.PlaneGeometry(1, 1)
  const grad = new T.DataTexture(new Uint8Array([95, 175, 255]), 3, 1, T.LuminanceFormat)
  grad.minFilter = grad.magFilter = T.NearestFilter; grad.needsUpdate = true
  const contornoMat = new T.MeshBasicMaterial({ color: 0x0d1b2a, side: T.BackSide })

  let estilo = 'dibujo'
  const mat = (color, extra = {}) => estilo === 'dibujo'
    ? new T.MeshToonMaterial({ color, gradientMap: grad, ...extra })
    : new T.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0, ...extra })
  const planoMat = (map, extra = {}) => new T.MeshBasicMaterial({ map, transparent: true, depthWrite: false, ...extra })

  // tam: medio grosor más pequeño de la pieza, para que el contorno salga igual de fino en todas.
  function pieza(geo, material, { pos = [0, 0, 0], esc = [1, 1, 1], rot = [0, 0, 0], borde = true, tam } = {}) {
    const m = new T.Mesh(geo, material)
    m.position.set(...pos); m.scale.set(...esc); m.rotation.set(...rot)
    if (borde && estilo === 'dibujo') {
      const t = tam || Math.min(...esc)
      const o = new T.Mesh(geo, contornoMat)
      o.scale.setScalar(1 + 0.022 / Math.max(0.04, t))
      m.add(o)
    }
    return m
  }
  const grupo = (padre, pos = [0, 0, 0], rot = [0, 0, 0]) => { const g = new T.Group(); g.position.set(...pos); g.rotation.set(...rot); padre.add(g); return g }
  const plano = (padre, map, w, h, pos, extra = {}) => { const m = new T.Mesh(PLANO, planoMat(map, extra)); m.scale.set(w, h, 1); m.position.set(...pos); padre.add(m); return m }

  // ── La escena ──
  const escena = new T.Scene()
  escena.add(new T.HemisphereLight(0xffffff, 0x60808f, 0.75))
  const sol = new T.DirectionalLight(0xffffff, 0.95); sol.position.set(3, 6, 5); escena.add(sol)

  let R = {}
  function montar() {
    if (R.raiz) escena.remove(R.raiz)
    const raiz = new T.Group(); escena.add(raiz)
    const C = {
      negro: mat(0x1d2129), blanco: mat(0xf3f6f7), hielo: estilo === 'dibujo' ? mat(0x9fe6f1) : new T.MeshPhysicalMaterial({ color: 0xa6e9f3, roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.08, transparent: true, opacity: 0.94 }),
      pico: mat(0x6fd3e3), pata: mat(0xf6b73c), azul: mat(0x2d50c0), negroGorra: mat(0x111318), cuero: mat(0xa0682f), cueroOsc: mat(0x7a4d22), oro: mat(0xf5d33a),
      rojo: mat(0xff4b23), gris: mat(0x8b97a3), papel: mat(0xefe7d0), cristal: new T.MeshBasicMaterial({ color: 0xbfefff, transparent: true, opacity: 0.45 }),
    }

    // Buzón: de lado, con la puerta abierta y la carta asomando, como en el dibujo
    const buzon = grupo(raiz, [0.05, 0, -0.05], [0, 1.15, 0])
    buzon.add(pieza(new T.CylinderGeometry(0.26, 0.3, 0.05, 28), C.gris, { pos: [0, 0.025, 0], tam: 0.03 }))
    buzon.add(pieza(new T.CylinderGeometry(0.055, 0.055, 0.58, 14), C.gris, { pos: [0, 0.3, 0], tam: 0.055 }))
    const caja = grupo(buzon, [0, 0.98, 0])
    caja.add(pieza(arcoBuzon(0.94, 0.34, 1.08, 0.035), C.rojo, { tam: 0.45 }))
    const fondo = new T.Mesh(PLANO, new T.MeshBasicMaterial({ color: 0x2a0c08 })); fondo.scale.set(0.8, 0.66, 1); fondo.position.set(0, -0.04, 0.548); caja.add(fondo)
    const puerta = grupo(caja, [0, -0.42, 0.575])
    const hoja = pieza(arcoBuzon(0.86, 0.3, 0.035, 0), C.rojo, { pos: [0, 0.38, 0], tam: 0.05 })
    puerta.add(hoja)
    hoja.add(pieza(new T.CylinderGeometry(0.035, 0.035, 0.08, 12), C.gris, { pos: [0, 0.18, 0.05], rot: [Math.PI / 2, 0, 0], borde: false }))
    const cartaBuzon = pieza(new T.BoxGeometry(0.58, 0.38, 0.025), C.papel, { pos: [0.06, -0.06, 0.66], rot: [-0.45, 0.1, 0.18], tam: 0.06 })
    caja.add(cartaBuzon)
    const pegatina = plano(caja, TEX.pegatina, 0.3, 0.3, [-0.52, -0.02, 0.18], { depthWrite: true })
    pegatina.rotation.y = -Math.PI / 2
    const bandera = grupo(caja, [-0.52, -0.12, -0.25])
    bandera.add(pieza(new T.BoxGeometry(0.03, 0.42, 0.03), C.rojo, { pos: [0, 0.21, 0], tam: 0.03 }))
    bandera.add(pieza(ESFERA, C.rojo, { pos: [0, 0.43, 0], esc: [0.05, 0.05, 0.05] }))

    // El pingüino, sentado arriba
    const pin = grupo(raiz, [0, 1.47, 0.02])
    const cuerpo = grupo(pin)
    cuerpo.add(pieza(ESFERA, C.negro, { pos: [0, 0.42, 0], esc: [0.56, 0.5, 0.48] }))
    cuerpo.add(pieza(ESFERA, C.blanco, { pos: [0, 0.37, 0.2], esc: [0.43, 0.4, 0.31], borde: false }))
    cuerpo.add(pieza(ESFERA, C.hielo, { pos: [-0.17, 0.56, 0.42], esc: [0.11, 0.15, 0.05], rot: [0, 0, 0.4], borde: false }))
    const aleta = (lado) => {
      const g = grupo(cuerpo, [0.44 * lado, 0.6, 0.02])
      g.add(pieza(ESFERA, C.negro, { pos: [0.27 * lado, -0.02, 0], esc: [0.34, 0.1, 0.19] }))
      return g
    }
    const aletaI = aleta(-1), aletaD = aleta(1)
    const pie = (lado) => {
      const g = grupo(cuerpo, [0.21 * lado, 0.06, 0.34])
      for (const [i, a] of [[-1, -0.38], [0, 0], [1, 0.38]]) g.add(pieza(ESFERA, C.pata, { pos: [0.075 * i, -0.02, 0.1], esc: [0.055, 0.045, 0.14], rot: [0.35, a, 0], tam: 0.045 }))
      return g
    }
    const pieI = pie(-1), pieD = pie(1)
    const correa = new T.CatmullRomCurve3([[-0.36, 0.7, 0.27], [-0.16, 0.56, 0.47], [0.1, 0.38, 0.53], [0.32, 0.2, 0.44], [0.43, 0.1, 0.32]].map((p) => new T.Vector3(...p)))
    cuerpo.add(pieza(new T.TubeGeometry(correa, 40, 0.026, 8), C.cueroOsc, { borde: false }))
    const bolso = grupo(cuerpo, [0.44, 0.1, 0.36], [0, -0.75, 0.05])
    bolso.add(pieza(cuboRedondo(0.32, 0.25, 0.13, 0.045), C.cuero, { tam: 0.065 }))
    bolso.add(pieza(cuboRedondo(0.33, 0.13, 0.03, 0.012), C.cueroOsc, { pos: [0, 0.07, 0.07], tam: 0.03 }))
    bolso.add(pieza(new T.BoxGeometry(0.06, 0.05, 0.02), C.oro, { pos: [0, 0.02, 0.085], borde: false }))

    // Cabeza de hielo
    const cabeza = grupo(cuerpo, [0, 0.8, 0])
    const cubo = pieza(cuboRedondo(1.32, 1.08, 1.12, 0.17), C.hielo, { pos: [0, 0.54, 0], tam: 0.54 })
    cabeza.add(cubo)
    plano(cabeza, TEX.brillo, 0.08, 0.5, [-0.5, 0.78, 0.565], { opacity: 0.9 }).rotation.z = 0.12
    plano(cabeza, TEX.brillo, 0.05, 0.32, [-0.4, 0.86, 0.566], { opacity: 0.7 }).rotation.z = 0.12
    const brilloArriba = plano(cabeza, TEX.brillo, 0.07, 0.8, [-0.15, 1.085, 0.2], { opacity: 0.75 })
    brilloArriba.rotation.set(-Math.PI / 2, 0, Math.PI / 2 - 0.1)
    const MODOS = ['ojo', 'feliz', 'cerrado', 'corazonOjo', 'espiral']
    const ojos = [-1, 1].map((lado) => {
      const g = grupo(cabeza, [0.29 * lado, 0.66, 0.566])
      const modos = {}
      for (const m of MODOS) {
        const p = plano(g, TEX[m], m === 'ojo' ? 0.25 : 0.3, m === 'ojo' ? 0.32 : 0.3, [0, 0, 0])
        p.visible = m === 'ojo'; modos[m] = p
      }
      return { g, modos, lado }
    })
    const cejas = [-1, 1].map((lado) => { const p = plano(cabeza, TEX.ceja, 0.24, 0.09, [0.29 * lado, 0.92, 0.568]); p.visible = false; p.userData.lado = lado; return p })
    const rubor = [-1, 1].map((lado) => plano(cabeza, TEX.rubor, 0.26, 0.13, [0.47 * lado, 0.42, 0.567], { opacity: 0 }))
    const bocaInt = plano(cabeza, TEX.boca, 0.22, 0.17, [0, 0.33, 0.567]); bocaInt.visible = false
    const picoSup = pieza(new T.OctahedronGeometry(1, 0), C.pico, { pos: [0, 0.4, 0.6], esc: [0.31, 0.1, 0.18], tam: 0.1 })
    const picoInf = pieza(new T.OctahedronGeometry(1, 0), C.pico, { pos: [0, 0.37, 0.58], esc: [0.23, 0.07, 0.13], tam: 0.07 })
    cabeza.add(picoSup, picoInf)
    const pompa = new T.Mesh(ESFERA, C.cristal); pompa.position.set(0.16, 0.36, 0.7); pompa.scale.setScalar(0.001); pompa.visible = false; cabeza.add(pompa)
    // Gorra plana de cartero, ladeada
    const gorra = grupo(cabeza, [0.05, 1.08, -0.02], [-0.04, 0, -0.12])
    gorra.add(pieza(new T.CylinderGeometry(0.47, 0.44, 0.12, 36), C.negroGorra, { pos: [0, 0.06, 0], tam: 0.06 }))
    gorra.add(pieza(new T.CylinderGeometry(0.6, 0.47, 0.2, 36), C.azul, { pos: [0, 0.22, 0], tam: 0.1 }))
    gorra.add(pieza(new T.CylinderGeometry(0.6, 0.6, 0.03, 36), mat(0x3d63d6), { pos: [0, 0.335, 0], tam: 0.015, borde: false }))
    gorra.add(pieza(new T.CylinderGeometry(0.42, 0.42, 0.04, 32, 1, false, 0, Math.PI), C.negroGorra, { pos: [0, 0.03, 0.12], esc: [1, 1, 0.9], rot: [0.12, Math.PI / 2, 0], tam: 0.02 }))
    const placa = plano(gorra, TEX.placa, 0.2, 0.14, [0, 0.23, 0.555], { depthWrite: true })
    placa.rotation.x = -0.35

    // Lo que sale según el gesto
    const cartaMano = pieza(new T.BoxGeometry(0.5, 0.34, 0.025), C.papel, { tam: 0.05 })
    const linea = new T.MeshBasicMaterial({ color: 0x9c8f72 })
    cartaMano.add(pieza(new T.BoxGeometry(0.25, 0.015, 0.03), linea, { pos: [-0.09, 0.05, 0.01], rot: [0, 0, -0.55], borde: false }))
    cartaMano.add(pieza(new T.BoxGeometry(0.25, 0.015, 0.03), linea, { pos: [0.09, 0.05, 0.01], rot: [0, 0, 0.55], borde: false }))
    raiz.add(cartaMano)
    const charco = new T.Mesh(new T.CircleGeometry(0.5, 40), new T.MeshBasicMaterial({ color: 0x8fd8f0, transparent: true, opacity: 0.75 }))
    charco.rotation.x = -Math.PI / 2; charco.position.set(0.25, 0.012, 0.75); raiz.add(charco)
    const sombra = new T.Mesh(new T.CircleGeometry(0.75, 32), new T.MeshBasicMaterial({ color: 0x0d1b2a, transparent: true, opacity: 0.12, depthWrite: false }))
    sombra.rotation.x = -Math.PI / 2; sombra.position.y = 0.004; raiz.add(sombra)
    // Efectos: unos en la cabeza (se mueven con ella) y otros en el mundo
    const pool = (padre, n) => Array.from({ length: n }, () => { const s = new T.Sprite(new T.SpriteMaterial({ map: TEX.corazon, transparent: true, depthWrite: false })); s.visible = false; s.renderOrder = 5; padre.add(s); return s })
    const fxC = pool(cabeza, 16), fxM = pool(raiz, 8)
    const COL = [0xe4472d, 0xf6c453, 0x2d50c0, 0x0d9e6e, 0x7cc6d8, 0xff4d6d]
    const confeti = Array.from({ length: 44 }, (_, i) => { const m = new T.Mesh(new T.BoxGeometry(0.07, 0.11, 0.01), new T.MeshBasicMaterial({ color: COL[i % COL.length], side: T.DoubleSide })); m.visible = false; raiz.add(m); return m })

    R = { raiz, puerta, cartaBuzon, bandera, pin, cuerpo, aletaI, aletaD, pieI, pieD, cabeza, ojos, cejas, rubor, bocaInt, picoSup, picoInf, pompa, gorra, cartaMano, charco, sombra, fxC, fxM, confeti, hielo: C.hielo, hieloBase: C.hielo.color.clone() }
    R.animables = [pin, cuerpo, aletaI, aletaD, pieI, pieD, cabeza, gorra, picoSup, picoInf, puerta, bandera, cartaBuzon, ...ojos.map((o) => o.g), ...cejas, bocaInt]
    for (const o of R.animables) o.userData.base = { p: o.position.clone(), r: o.rotation.clone(), s: o.scale.clone() }
  }

  // ── La cara ──
  function ojos(modoI, modoD = modoI, { sy = 1, sx = 1, dy = 0, giro = 0 } = {}) {
    R.ojos.forEach((o, i) => {
      const modo = i === 0 ? modoI : modoD
      for (const [k, p] of Object.entries(o.modos)) p.visible = k === modo
      o.g.scale.set(sx, sy, 1); o.g.position.y = o.g.userData.base.p.y + dy
      o.modos.espiral.rotation.z = giro * (i ? 1 : -1)
    })
  }
  function cejas(tipo, k = 1) {
    R.cejas.forEach((c) => {
      const lado = c.userData.lado
      c.visible = k > 0.02
      if (tipo === 'enfado') { c.rotation.z = 0.45 * lado * k; c.position.y -= 0.04 * k }
      if (tipo === 'triste') { c.rotation.z = -0.4 * lado * k; c.position.y += 0.02 * k }
      if (tipo === 'duda') { c.rotation.z = lado < 0 ? 0.25 * k : -0.1 * k; c.position.y += (lado < 0 ? 0.07 : -0.02) * k }
      c.scale.y = 0.09 * (0.6 + 0.4 * k)
    })
  }
  const rubor = (k) => R.rubor.forEach((r) => { r.material.opacity = k })
  function pico(abre) {
    R.picoInf.position.y -= 0.11 * abre; R.picoInf.rotation.x = 0.25 * abre
    R.picoSup.position.y += 0.025 * abre
    R.bocaInt.visible = abre > 0.05; R.bocaInt.scale.y = 0.17 * abre + 0.001; R.bocaInt.position.y -= 0.03 * abre
  }
  let nC = 0, nM = 0
  function fx(enCabeza, nombre, x, y, z, s, op = 1, sy = s) {
    const pool = enCabeza ? R.fxC : R.fxM
    const sp = pool[enCabeza ? nC++ : nM++]
    if (!sp || s <= 0.001) return
    sp.visible = true; sp.material.map = TEX[nombre]; sp.material.opacity = op
    sp.position.set(x, y, z); sp.scale.set(s, sy, 1)
  }

  // ── Las poses: todo sale del instante, sin estado, así se pueden fotografiar ──
  let giroUsuario = -0.3
  function reposo(tg, vivo) {
    for (const o of R.animables) { const b = o.userData.base; o.position.copy(b.p); o.rotation.copy(b.r); o.scale.copy(b.s) }
    R.raiz.rotation.set(0, giroUsuario, 0)
    ojos('ojo'); R.cejas.forEach((c) => (c.visible = false)); rubor(0); pico(0)
    R.pompa.visible = false; R.cartaMano.visible = false; R.charco.visible = false; R.cartaBuzon.visible = true
    R.puerta.rotation.x = 1.42; R.bandera.rotation.x = 1.5
    R.sombra.scale.setScalar(1)
    R.hielo.color.copy(R.hieloBase)
    for (const s of R.fxC) s.visible = false
    for (const s of R.fxM) s.visible = false
    for (const c of R.confeti) c.visible = false
    nC = 0; nM = 0
    R.aletaI.rotation.z = 0.28; R.aletaD.rotation.z = -0.28
    if (!vivo) return
    const resp = Math.sin(tg * 2.1)
    R.cuerpo.scale.y = 1 + 0.018 * resp
    R.aletaI.rotation.z = 0.28 + 0.05 * resp; R.aletaD.rotation.z = -0.28 - 0.05 * resp
    if ((tg % 3.7) < 0.12 || ((tg % 11.3) > 0.3 && (tg % 11.3) < 0.4)) R.ojos.forEach((o) => (o.g.scale.y = 0.1))
  }
  function tics(tg) {
    // Lo que hace solo cuando no hace nada (un ciclo de 12 s)
    const c = tg % 12
    const mira = ventana(c, 3.6, 5.8, 0.3)
    R.cabeza.rotation.y += 0.38 * mira * Math.sin((c - 3.6) * 1.4)
    const balanceo = ventana(c, 6.6, 9.4, 0.2)
    R.pieI.rotation.x = 0.45 * balanceo * Math.sin(c * 7); R.pieD.rotation.x = -0.45 * balanceo * Math.sin(c * 7)
    const ajusta = ventana(c, 9.8, 11.4, 0.25)
    R.aletaD.rotation.z += 1.75 * ajusta; R.aletaD.rotation.y = -0.4 * ajusta
    R.gorra.rotation.z += 0.12 * ajusta * Math.sin(c * 18); R.gorra.position.y += 0.03 * ajusta
    R.cabeza.rotation.z += 0.03 * Math.sin(tg * 0.8)
  }

  function confetiEn(a, t0, [ox, oy, oz]) {
    const t = a - t0
    if (t < 0 || t > 2.3) return
    R.confeti.forEach((m, i) => {
      const vx = (azar(i, 1) - 0.5) * 3, vy = 2.4 + azar(i, 2) * 1.8, vz = (azar(i, 3) - 0.3) * 2
      m.visible = true
      m.position.set(ox + vx * t, oy + vy * t - 3.4 * t * t, oz + vz * t)
      m.rotation.set(t * (4 + azar(i, 4) * 8), t * 6 * azar(i, 5), t * 5)
      if (m.position.y < 0.05) m.visible = false
    })
  }

  const ANIM = {
    saludar: { d: 2.2, t: () => '¡Hola!', f(a) {
      const w = ventana(a, 0, 2.1, 0.25)
      R.aletaD.rotation.z = -0.28 + w * (1.55 + 0.4 * Math.sin(a * 16))
      R.cabeza.rotation.z = 0.12 * w; R.cuerpo.rotation.y = -0.15 * w
      if (a > 0.15 && a < 2.0) ojos('feliz')
      rubor(0.5 * w); pico(0.25 * w * Math.abs(Math.sin(a * 9)))
    } },
    contento: { d: 2.6, t: () => '¡Toma ya!', f(a) {
      const h1 = a > 0.25 && a < 0.8 ? arco(tramo(a, 0.25, 0.8)) : 0
      const h2 = a > 0.95 && a < 1.55 ? arco(tramo(a, 0.95, 1.55)) : 0
      const salto = Math.max(h1, h2)
      R.pin.position.y += 0.4 * salto
      const agacha = (a < 0.25 ? suave(a / 0.25) : 0) + (a > 0.8 && a < 0.95 ? 1 : 0) + (a > 1.55 && a < 1.75 ? 1 - tramo(a, 1.55, 1.75) : 0)
      R.cuerpo.scale.set(1 + 0.08 * agacha, 1 - 0.12 * agacha, 1 + 0.08 * agacha)
      const w = ventana(a, 0.1, 2.5)
      R.aletaD.rotation.z = -0.28 + w * (1.35 + 0.35 * Math.sin(a * 24)); R.aletaI.rotation.z = 0.28 - w * (1.35 + 0.35 * Math.sin(a * 24))
      R.pieI.rotation.x = -0.5 * salto; R.pieD.rotation.x = -0.5 * salto
      ojos('feliz'); rubor(0.8 * w); pico(0.55 * w)
      R.sombra.scale.setScalar(1 - 0.2 * salto)
      confetiEn(a, 0.32, [0.0, 3.4, 0.25])
    } },
    risa: { d: 1.8, t: () => '¡Ji, ji! ¡Cosquillas!', f(a) {
      const w = ventana(a, 0, 1.8, 0.15)
      R.cuerpo.rotation.z = 0.1 * w * Math.sin(a * 38); R.cuerpo.position.y += 0.03 * w * Math.abs(Math.sin(a * 19))
      R.aletaD.rotation.set(0, -1.0 * w, -0.28 - 0.5 * w); R.aletaI.rotation.set(0, 1.0 * w, 0.28 + 0.5 * w)
      ojos('feliz'); rubor(w); pico(w * (0.45 + 0.4 * Math.sin(a * 30)))
      R.pieI.rotation.x = 0.5 * w * Math.sin(a * 22); R.pieD.rotation.x = -0.5 * w * Math.sin(a * 22)
    } },
    enamorado: { d: 3.2, t: () => '¡La quiero!', f(a) {
      const w = ventana(a, 0, 3.2, 0.25)
      const latido = 1 + 0.18 * Math.pow(Math.max(0, Math.sin(a * 9)), 4)
      ojos('corazonOjo', 'corazonOjo', { sx: latido, sy: latido })
      rubor(w); pico(0.15 * w)
      R.cuerpo.rotation.z = 0.1 * w * Math.sin(a * 2.4); R.cabeza.rotation.z = 0.12 * w * Math.sin(a * 2.4 + 0.6)
      R.aletaD.rotation.set(0, -1.15 * w, -0.28 + 0.3 * w); R.aletaI.rotation.set(0, 1.15 * w, 0.28 - 0.3 * w)
      R.pieI.rotation.x = 0.3 * w * Math.sin(a * 3); R.pieD.rotation.x = 0.3 * w * Math.sin(a * 3 + 1)
      for (let i = 0; i < 6; i++) {
        if (a < 0.2 + i * 0.12) continue
        const f = (a * 0.5 + i / 6) % 1
        fx(true, 'corazon', 0.75 * Math.sin(i * 2.1) + 0.1 * Math.sin(a * 3 + i), 1.1 + f * 1.1, 0.3, 0.22 + 0.08 * Math.sin(a * 5 + i), (1 - f) * w)
      }
    } },
    sorpresa: { d: 1.9, t: (a) => (a > 0.15 ? '¡¿Qué?!' : ''), f(a) {
      const pre = a < 0.15 ? suave(a / 0.15) : 0
      const w = ventana(a, 0.15, 1.85, 0.12)
      R.cuerpo.scale.set(1 + 0.06 * pre, 1 - 0.08 * pre, 1)
      R.cuerpo.rotation.x = -0.18 * w; R.pin.position.y += 0.18 * arco(tramo(a, 0.15, 0.55))
      ojos('ojo', 'ojo', { sx: 1 + 0.3 * w, sy: 1 + 0.38 * w })
      pico(w)
      const gp = tramo(a, 0.17, 1.15)
      // 0,5 y no 0,75 (1396): con 0,75 la gorra se salía del lienzo por arriba.
      R.gorra.position.y += 0.5 * arco(gp); R.gorra.rotation.y = Math.PI * 2 * suave(gp); R.gorra.rotation.z += 0.3 * arco(gp)
      R.aletaD.rotation.z = -0.28 + 1.5 * w; R.aletaI.rotation.z = 0.28 - 1.5 * w
      R.pieI.rotation.x = -0.6 * w; R.pieD.rotation.x = -0.6 * w
      if (a > 0.15) { const s = 0.5 * (1 + 0.35 * Math.max(0, 1 - (a - 0.15) * 5)); fx(true, 'exclama', 0.6, 1.75, 0.3, s * w, w) }
    } },
    toque: { d: 0.9, t: () => '¡Eh!', f(a) {
      const w = ventana(a, 0, 0.9, 0.1)
      R.cuerpo.rotation.x = -0.12 * w; R.cuerpo.position.z -= 0.06 * w
      ojos('ojo', 'ojo', { sx: 1 + 0.2 * w, sy: 1 + 0.3 * w }); pico(0.6 * w)
      fx(true, 'exclama', 0.55, 1.6, 0.3, 0.38 * w, w)
    } },
    enfado: { d: 2.5, t: () => '¡Grrr!', f(a) {
      const w = ventana(a, 0, 2.5, 0.2)
      const pulso = 0.5 + 0.5 * Math.sin(a * 12)
      cejas('enfado', w); ojos('ojo', 'ojo', { sy: 1 - 0.35 * w, dy: -0.02 * w })
      R.hielo.color.copy(R.hieloBase).lerp(new T.Color(0xff8f8f), 0.45 * w * (0.6 + 0.4 * pulso))
      R.cuerpo.rotation.z = 0.035 * w * Math.sin(a * 55)
      R.aletaD.rotation.set(0, 0.6 * w, -0.28 - 0.7 * w); R.aletaI.rotation.set(0, -0.6 * w, 0.28 + 0.7 * w)
      const pisa = Math.sin(a * 11)
      R.pieI.rotation.x = 0.7 * w * Math.max(0, pisa); R.pieD.rotation.x = 0.7 * w * Math.max(0, -pisa)
      pico(w * (0.12 + 0.08 * Math.sin(a * 40)))
      fx(true, 'enfado', 0.55, 1.05, 0.45, (0.26 + 0.06 * pulso) * w, w)
      for (let i = 0; i < 4; i++) {
        const f = (a * 1.3 + i / 4) % 1, lado = i % 2 ? 1 : -1
        fx(true, 'vapor', lado * (0.62 + 0.25 * f), 1.25 + 0.5 * f, 0, (0.18 + 0.3 * f) * w, (1 - f) * w)
      }
    } },
    triste: { d: 3.4, t: () => 'Snif…', f(a) {
      const w = ventana(a, 0, 3.4, 0.35)
      cejas('triste', w); ojos('ojo', 'ojo', { sy: 1 - 0.18 * w, dy: -0.02 * w })
      R.cabeza.rotation.x = 0.2 * w; R.cabeza.rotation.z = -0.06 * w
      R.gorra.position.y -= 0.05 * w; R.gorra.rotation.x += 0.14 * w
      R.aletaD.rotation.z = -0.28 - 0.75 * w; R.aletaI.rotation.z = 0.28 + 0.75 * w
      R.cuerpo.scale.y = 1 - 0.04 * w; R.cuerpo.rotation.x = 0.08 * w
      pico(0.06 * w * (1 + Math.sin(a * 6)))
      if (a > 0.4) for (let i = 0; i < 6; i++) {
        const lado = i % 2 ? 1 : -1, f = (a * 0.9 + Math.floor(i / 2) / 3) % 1
        fx(true, 'gota', 0.29 * lado + 0.05 * lado * f, 0.5 - f * 1.4, 0.62 + 0.15 * f, 0.1, (1 - f * f) * w, 0.13)
      }
    } },
    mareado: { d: 3.2, t: () => 'Todo da vueltas…', f(a) {
      const w = ventana(a, 0, 3.2, 0.3)
      ojos('espiral', 'espiral', { giro: a * 7 })
      R.cabeza.rotation.x = 0.16 * w * Math.sin(a * 4.2); R.cabeza.rotation.z = 0.16 * w * Math.cos(a * 4.2)
      R.cuerpo.rotation.z = 0.06 * w * Math.sin(a * 4.2 + 1)
      R.gorra.rotation.y = 0.5 * w * Math.sin(a * 3)
      R.aletaD.rotation.z = -0.28 + 0.4 * w * Math.sin(a * 5); R.aletaI.rotation.z = 0.28 + 0.4 * w * Math.sin(a * 5 + 1)
      pico(0.3 * w)
      for (let i = 0; i < 3; i++) { const ang = a * 3.2 + i * Math.PI * 2 / 3; fx(true, 'estrella', Math.cos(ang) * 0.78, 1.5 + 0.06 * Math.sin(ang * 2), Math.sin(ang) * 0.6, 0.24 * w, w) }
    } },
    agobiado: { d: 3.8, t: (a) => (a > 3.1 ? '¡Uf!' : 'Qué calor…'), f(a) {
      const w = ventana(a, 0, 3.8, 0.25)
      const derrite = suave(tramo(a, 0.2, 2.4)) * (1 - suave(tramo(a, 2.9, 3.5)))
      R.cabeza.scale.set(1 + 0.08 * derrite, 1 - 0.2 * derrite, 1 + 0.08 * derrite)
      cejas('triste', w); ojos('ojo', 'ojo', { sy: 1 - 0.3 * w, dy: -0.03 * w })
      pico(w * (0.35 + 0.25 * Math.sin(a * 13)))
      R.aletaD.rotation.set(0, -0.9 * w, -0.28 + w * (0.9 + 0.45 * Math.sin(a * 26)))
      R.aletaI.rotation.z = 0.28 + 0.5 * w
      R.cuerpo.scale.y = 1 - 0.04 * w
      R.hielo.color.copy(R.hieloBase).lerp(new T.Color(0xd3f6fb), 0.6 * derrite)
      for (let i = 0; i < 5; i++) {
        const lado = i % 2 ? 1 : -1, f = (a * 0.8 + i / 5) % 1
        fx(true, 'gota', lado * (0.68 + 0.04 * f), 0.95 - f * 0.9, 0.2 + 0.1 * i, 0.09, (1 - f) * w, 0.12)
      }
      R.charco.visible = derrite > 0.01; R.charco.scale.setScalar(0.2 + 0.8 * suave(tramo(a, 0.6, 2.6)))
      R.charco.material.opacity = 0.75 * (1 - suave(tramo(a, 3.0, 3.8)))
    } },
    guino: { d: 1.7, t: () => '¡Hecho!', f(a) {
      const w = ventana(a, 0, 1.7, 0.15)
      ojos(w > 0.3 ? 'feliz' : 'ojo', 'ojo')
      R.cabeza.rotation.z = 0.15 * w; R.cuerpo.rotation.y = -0.1 * w
      R.aletaD.rotation.set(0, -0.5 * w, -0.28 + 1.25 * w)
      rubor(0.45 * w); pico(0.15 * w)
      const ch = suave(tramo(a, 0.25, 0.5)) * w
      fx(true, 'chispa', -0.6, 0.95, 0.6, 0.26 * ch * (1 + 0.2 * Math.sin(a * 20)), ch)
    } },
    pensar: { d: 3.6, t: (a) => (a > 2.35 ? '¡Ya sé!' : 'Mmm…'), f(a) {
      const w = ventana(a, 0, 3.6, 0.3)
      const idea = suave(tramo(a, 2.3, 2.5)) * w
      const piensa = w * (1 - idea)
      R.aletaD.rotation.set(0, -1.25 * piensa, -0.28 + 0.75 * piensa + 1.4 * idea)
      R.cabeza.rotation.z = 0.15 * piensa; R.cabeza.rotation.x = -0.1 * piensa
      cejas('duda', piensa); ojos('ojo', 'ojo', { dy: 0.025 * piensa, sx: 1 + 0.15 * idea, sy: 1 + 0.2 * idea })
      pico(0.5 * idea)
      if (a < 2.3) {
        fx(true, 'pregunta', 0.6, 1.5 + 0.05 * Math.sin(a * 5), 0.3, 0.32 * piensa, piensa)
        const n = Math.floor(a * 3) % 4
        if (n > 0) fx(true, 'puntos', -0.55, 1.45, 0.3, 0.12 * n, piensa, 0.12 * n / 3)
      } else {
        const p = 1 + 0.3 * Math.max(0, 1 - (a - 2.3) * 4)
        fx(true, 'bombilla', 0, 1.85, 0.25, 0.42 * p * idea, idea, 0.52 * p * idea)
      }
    } },
    entregar: { d: 3.2, t: (a) => (a > 2.0 ? '¡Enviada!' : ''), f(a) {
      R.cartaBuzon.visible = false
      const inclina = ventana(a, 0, 2.1, 0.35)
      R.cuerpo.rotation.x = 0.18 * inclina; R.cuerpo.rotation.y = -0.45 * inclina; R.cuerpo.rotation.z = -0.15 * inclina
      const alBolso = ventana(a, 0, 0.6, 0.2)
      const alaDelante = suave(tramo(a, 0.45, 0.9)) * (1 - suave(tramo(a, 1.7, 2.1)))
      R.aletaD.rotation.set(0, -0.8 * alaDelante, -0.28 - 0.8 * alBolso - 0.3 * alaDelante)
      const ini = new T.Vector3(0.48, 1.58, 0.45), arr = new T.Vector3(0.75, 2.0, 0.8), boca = new T.Vector3(0.62, 1.0, 0.4), dentro = new T.Vector3(0.3, 0.98, 0.15)
      if (a > 0.45 && a < 1.85) {
        R.cartaMano.visible = true
        const p1 = tramo(a, 0.45, 1.05), p2 = tramo(a, 1.05, 1.5), p3 = tramo(a, 1.5, 1.85)
        const v = a < 1.05 ? ini.clone().lerp(arr, suave(p1)) : a < 1.5 ? arr.clone().lerp(boca, suave(p2)) : boca.clone().lerp(dentro, p3)
        R.cartaMano.position.copy(v)
        R.cartaMano.rotation.set(-0.15, 0.25 + 0.9 * p3, 0.15 - 0.55 * suave(p2))
        R.cartaMano.scale.setScalar(1 - 0.4 * p3)
      }
      R.puerta.rotation.x = 1.42 * (1 - suave(tramo(a, 1.75, 2.05)))
      R.bandera.rotation.x = 1.5 * (1 - suave(tramo(a, 2.0, 2.3)))
      if (a > 2.0) { ojos('feliz'); rubor(0.5 * ventana(a, 2.0, 3.2)) }
      pico(0.35 * ventana(a, 2.0, 3.0))
    } },
    bailar: { d: 3.4, t: () => 'La-la-la', f(a) {
      const w = ventana(a, 0, 3.4, 0.25)
      const b = a * 2.2, s = Math.sin(Math.PI * b)
      R.pin.position.y += 0.08 * w * Math.abs(s)
      R.cabeza.rotation.z = 0.2 * w * s; R.cuerpo.rotation.z = -0.08 * w * s; R.cuerpo.rotation.y = 0.15 * w * Math.sin(Math.PI * b / 2)
      R.aletaD.rotation.z = -0.28 + w * (0.2 + 1.3 * Math.max(0, s)); R.aletaI.rotation.z = 0.28 - w * (0.2 + 1.3 * Math.max(0, -s))
      R.pieI.rotation.x = 0.6 * w * Math.max(0, s); R.pieD.rotation.x = 0.6 * w * Math.max(0, -s)
      R.gorra.position.y += 0.04 * w * Math.abs(s)
      ojos('feliz'); rubor(0.4 * w); pico(0.3 * w * Math.abs(s))
      for (let i = 0; i < 4; i++) { const f = (a * 0.55 + i / 4) % 1, lado = i % 2 ? 1 : -1; fx(true, 'nota', lado * (0.7 + 0.15 * Math.sin(f * 6)), 1.0 + f * 1.0, 0.2, 0.24 * w, (1 - f) * w) }
    } },
    dormir: { d: Infinity, t: (a) => ((a % 6.5) > 5 && (a % 6.5) < 5.9 && a > 1 ? '¿Eh? ¡Estoy despierto!' : 'Zzz…'), f(a) {
      const c = a % 6.5
      const sueno = a < 0.6 ? suave(a / 0.6) : 1
      const despierta = ventana(c, 5.0, 5.9, 0.1) * (a > 1 ? 1 : 0)
      const duerme = sueno * (1 - despierta)
      R.cabeza.rotation.x = (0.24 + 0.05 * Math.sin(a * 1.3)) * duerme; R.cabeza.rotation.z = 0.12 * duerme
      R.cuerpo.scale.y = 1 + 0.03 * Math.sin(a * 1.3) * duerme
      R.aletaD.rotation.z = -0.28 - 0.5 * duerme; R.aletaI.rotation.z = 0.28 + 0.5 * duerme
      if (despierta > 0.3) { ojos('ojo', 'ojo', { sx: 1.2, sy: 1.3 }); fx(true, 'exclama', 0.55, 1.6, 0.3, 0.35, despierta) }
      else ojos('cerrado')
      // La pompa del sueño, que explota al despertarse
      if (c < 5.0 && a > 0.8) { R.pompa.visible = true; R.pompa.scale.setScalar(0.04 + 0.14 * (0.5 - 0.5 * Math.cos(c * 1.9))) }
      if (despierta < 0.3) for (let i = 0; i < 3; i++) { const f = (a * 0.4 + i / 3) % 1; fx(true, 'zeta', 0.5 + 0.35 * f, 1.25 + f * 0.8, 0.3, (0.14 + 0.16 * f) * duerme, (1 - f) * duerme) }
    } },
  }

  const mirada = { x: 0, y: 0, activa: false }
  function pose(nombre, a, tg, { vivo = false, vacio = false } = {}) {
    reposo(tg, vivo && !reducido && nombre === 'reposo' ? true : vivo && !reducido)
    if (vacio) R.cartaBuzon.visible = false
    if (nombre === 'reposo') { if (vivo && !reducido) tics(tg) }
    else ANIM[nombre].f(a, tg)
    if (vivo && mirada.activa && nombre !== 'dormir') {
      R.cabeza.rotation.y += mirada.x * 0.4
      R.cabeza.rotation.x += -mirada.y * 0.16
    }
  }

  montar()
  return {
    escena,
    pose,
    ANIM,
    get raiz() { return R.raiz },
    // El giro del cuerpo de cada hueco (los vacíos lo enseñan de frente).
    girar(g) { giroUsuario = g },
  }
}
