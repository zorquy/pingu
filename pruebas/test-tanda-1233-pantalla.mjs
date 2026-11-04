// Tanda 1233 — nada se pisa (PINGU: «hay algunos espaciados en la web que no
// funcionan y causa pisotones entre objetos, revísalo todo»).
// Recorre las páginas a 390, 1024 y 1440 px con los textos ALARGADOS (los de
// verdad son más largos que los de las pruebas: 537 personas, nombres largos)
// y falla si dos cosas pintadas se montan sin ser una de la otra. Lo que se
// monta a propósito lleva margen negativo (el avatar sobre la franja, las caras
// en montón) o va fijo/absoluto (chapas, la barra), y eso no cuenta. También
// falla si dos cajas con borde quedan pegadas sin hueco (la banda de Gente
// sobre sus chips), salvo las filas de una lista con raya.
import { contexto, chromium } from './fixtures-app.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
const RUTAS = ['/', '/aprender', '/usuarios', '/perfil', '/foro', '/noticias', '/lanzamientos', '/novedades', '/retos', '/torneos', '/guardados', '/glosario', '/mensajes', '/mis-partidas', '/mazos', '/meta', '/eventos', '/mi-coleccion', '/mi-coleccion?ver=buscar', '/mi-coleccion?ver=deseos', '/cartas', '/avisos', '/ajustes']
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 400) : ''}`)
}
function medir() {
  const vista = (el) => { const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05 }
  const flotante = (el) => { for (let e = el; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); if (s.position === 'fixed' || s.position === 'absolute' || s.position === 'sticky') return true; if (e.matches('details:not([open]) > :not(summary), dialog:not([open]), [hidden], .sr-only, .bm, .burbuja-movil, nav.lateral, .nav-lateral, .toast, .hidden')) return true } return false }
  const recorte = (el) => { let r = el.getBoundingClientRect(); r = { l: r.left, t: r.top, r: r.right, b: r.bottom }
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) { const s = getComputedStyle(e); if (s.overflowX !== 'visible' || s.overflowY !== 'visible' || s.clipPath !== 'none') { const c = e.getBoundingClientRect(); r = { l: Math.max(r.l, c.left), t: Math.max(r.t, c.top), r: Math.min(r.r, c.right), b: Math.min(r.b, c.bottom) } } }
    return r }
  const pinta = (el) => { const s = getComputedStyle(el)
    if (/^(IMG|SVG|INPUT|SELECT|TEXTAREA|BUTTON|VIDEO|CANVAS)$/i.test(el.tagName)) return true
    if (s.backgroundColor !== 'rgba(0, 0, 0, 0)' && s.backgroundColor !== 'transparent') return true
    if (s.backgroundImage !== 'none') return true
    if (parseFloat(s.borderTopWidth) + parseFloat(s.borderBottomWidth) + parseFloat(s.borderLeftWidth) > 0 && s.borderTopStyle !== 'none') return true
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return true
    return false }
  const hojas = []
  for (const el of document.body.querySelectorAll('*')) {
    if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue
    if (!vista(el) || !pinta(el) || flotante(el)) continue
    const r = recorte(el); if (r.r - r.l < 2 || r.b - r.t < 2) continue
    if (getComputedStyle(el).display === 'inline' && el.getClientRects().length > 1) {
      for (const q of el.getClientRects()) { const rr = { l: Math.max(q.left, r.l), t: Math.max(q.top, r.t), r: Math.min(q.right, r.r), b: Math.min(q.bottom, r.b) }; if (rr.r - rr.l > 2 && rr.b - rr.t > 2) hojas.push({ el, r: rr }) }
    } else hojas.push({ el, r })
  }
  const nombre = (el) => { const c = (el.className?.baseVal ?? el.className ?? '').toString().trim().split(/\s+/).filter(Boolean).slice(0, 2).join('.'); return el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (c ? '.' + c : '') + ` «${(el.innerText || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 24)}»` }
  // Lo que se monta A PROPÓSITO lleva un margen negativo (el avatar sobre la
  // franja, las caras en montón): eso no es un pisotón.
  const aposta = (el) => { for (let e = el, k = 0; e && k < 3; e = e.parentElement, k++) { const s = getComputedStyle(e); if (parseFloat(s.marginTop) < -2 || parseFloat(s.marginLeft) < -2 || parseFloat(s.marginRight) < -2 || parseFloat(s.marginBottom) < -2) return true } return false }
  const out = []
  hojas.sort((a, b) => a.r.t - b.r.t)
  for (let i = 0; i < hojas.length; i++) {
    const A = hojas[i]
    for (let j = i + 1; j < hojas.length; j++) {
      const B = hojas[j]; if (B.r.t >= A.r.b - 2) break
      if (A.el.contains(B.el) || B.el.contains(A.el)) continue
      if (aposta(A.el) || aposta(B.el)) continue
      const w = Math.min(A.r.r, B.r.r) - Math.max(A.r.l, B.r.l), h = Math.min(A.r.b, B.r.b) - Math.max(A.r.t, B.r.t)
      if (w > 3 && h > 3) out.push({ a: nombre(A.el), b: nombre(B.el), w: Math.round(w), h: Math.round(h), y: Math.round(A.r.t + scrollY) })
    }
  }
  // Y lo PEGADO: dos cajas con borde o fondo, una encima de otra, sin hueco
  // (0–3 px) y sin ser una de la otra (la banda encima de los chips).
  const caja = (el) => { const s = getComputedStyle(el); return (parseFloat(s.borderTopWidth) > 0 && s.borderTopStyle !== 'none') || (s.backgroundColor !== 'rgba(0, 0, 0, 0)' && !/^(SPAN|A|B|I|SMALL|STRONG)$/.test(el.tagName)) }
  const cajas = hojas.filter((h) => caja(h.el) && h.r.r - h.r.l > 60 && h.r.b - h.r.t > 24)
  for (const A of cajas) for (const B of cajas) {
    if (A === B || A.el.contains(B.el) || B.el.contains(A.el)) continue
    const hueco = B.r.t - A.r.b, solape = Math.min(A.r.r, B.r.r) - Math.max(A.r.l, B.r.l)
    if (hueco >= -1 && hueco < 4 && solape > 40 && !(aposta(A.el) || aposta(B.el))) {
      // Las filas de una lista con raya (una caja con filas) se tocan a propósito.
      if (A.el.parentElement === B.el.parentElement && (getComputedStyle(A.el.parentElement).overflow === 'hidden' || (A.el.tagName === B.el.tagName && String(A.el.className).split(' ')[0] === String(B.el.className).split(' ')[0]) || /^(LI|ARTICLE|TR)$/.test(A.el.tagName))) continue
      if (A.el.className && A.el.className === B.el.className && A.el.parentElement?.parentElement === B.el.parentElement?.parentElement) continue
      out.push({ pegado: true, a: nombre(A.el), b: nombre(B.el), hueco: Math.round(hueco), y: Math.round(A.r.b + scrollY) })
    }
  }
  return out
}
const estresar = (p) => p.evaluate(() => {
      // Textos más largos, como los de verdad: nombres, títulos y cifras.
      const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
      const nodos = []; while (w.nextNode()) nodos.push(w.currentNode)
      for (const n of nodos) { const t = n.textContent; if (n.parentElement.closest('script,style,svg')) continue
        if (/^\s*\d{1,3}\s*$/.test(t)) n.textContent = t.replace(/\d+/, (d) => String(d * 47).slice(0, 4))
        else if (t.trim().length >= 3 && t.trim().length <= 28) n.textContent = t.replace(/(\S.*\S)/, '$1 $1') }
    }).catch(() => {})
const b = await chromium.launch()
for (const ancho of [390, 1024, 1440]) {
  const movil = ancho < 600
  for (const ruta of RUTAS) {
    const ctx = await contexto(b, movil); const p = await ctx.newPage()
    if (!movil) await p.setViewportSize({ width: ancho, height: 900 })
    await p.emulateMedia({ reducedMotion: 'reduce' })
    await p.goto(BASE + ruta, { waitUntil: 'networkidle', timeout: 20000 }).catch(() => {})
    await p.waitForTimeout(1200)
    await estresar(p).catch(() => {})
    await p.waitForTimeout(300)
    const r = await p.evaluate(medir).catch((e) => [{ error: e.message }])
    check(`${ancho} ${ruta}: nada se pisa ni va pegado`, r.length === 0, JSON.stringify(r.slice(0, 3)))
    await ctx.close()
  }
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
