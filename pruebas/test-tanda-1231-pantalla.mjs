// Tandas 1231 y 1232 — Buscar de Mi colección y Mensajes, como la maqueta
// (PINGU: «se ve feo, no como me habías propuesto»; «sigue como antiguamente»).
//   Buscar, antes de escribir: la caja a lo ancho y alta, «Prueba con» en una
//   fila, los sets de cuatro en cuatro en el PC y de dos en el móvil, y los
//   mandos de una lista (orden, filtros, Seleccionar) solo cuando hay lista.
//   Mensajes: la lista es UNA caja con filas sin borde propio, la abierta
//   teñida, lo tuyo teñido del acento con la letra de siempre y, en el PC, la
//   conversación en su caja.
import { contexto, chromium } from './fixtures-app.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const b = await chromium.launch()

console.log('── Buscar ──')
for (const movil of [false, true]) {
  const ctx = await contexto(b, movil); const p = await ctx.newPage()
  const errores = []; p.on('pageerror', (e) => errores.push(e.message))
  await p.goto(`${BASE}/mi-coleccion?ver=buscar`, { waitUntil: 'networkidle' }).catch(() => {})
  await p.waitForSelector('#mcBuscarAntes .mc-antes-set', { timeout: 8000 }).catch(() => {})
  const r = await p.evaluate(() => {
    const vis = (el) => !!el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden'
    const caja = document.getElementById('mcBuscarTodo').getBoundingClientRect()
    const barra = document.getElementById('mcBuscarBarra').getBoundingClientRect()
    const sug = [...document.querySelectorAll('#mcBuscarVacio .mc-sugerencia')].map((s) => Math.round(s.getBoundingClientRect().top))
    const sets = [...document.querySelectorAll('#mcBuscarAntes .mc-antes-set')].map((s) => Math.round(s.getBoundingClientRect().top))
    return {
      alto: Math.round(caja.height), ancho: Math.round(caja.width), barra: Math.round(barra.width),
      sugUnaFila: sug.length > 2 && sug.every((t) => t === sug[0]),
      sets, orden: vis(document.getElementById('mcBuscarAbrirOrden')), seleccionar: vis(document.getElementById('mcBuscarSeleccionar')),
      catalogo: vis(document.querySelector('#mcBuscarBarra .mc-lista-cats, #mcBuscarBarra select')),
    }
  })
  const n = movil ? 2 : 4
  check(`${movil ? 'móvil' : 'PC'}: la caja a lo ancho y alta`, r.alto >= (movil ? 48 : 56) && r.ancho >= r.barra * 0.95, JSON.stringify(r))
  check(`${movil ? 'móvil' : 'PC'}: «Prueba con» en una fila`, r.sugUnaFila, JSON.stringify(r))
  check(`${movil ? 'móvil' : 'PC'}: los sets de ${n} en ${n}`, r.sets.length === 4 && r.sets.slice(0, n).every((t) => t === r.sets[0]) && (n === 4 || r.sets[2] > r.sets[0]), JSON.stringify(r.sets))
  check(`${movil ? 'móvil' : 'PC'}: antes de escribir, sin Orden ni Seleccionar`, !r.orden && !r.seleccionar, JSON.stringify(r))
  await p.fill('#mcBuscarTodo', 'pikachu'); await p.waitForTimeout(1200)
  const d = await p.evaluate(() => ({ orden: document.getElementById('mcBuscarAbrirOrden').getClientRects().length > 0, sel: document.getElementById('mcBuscarSeleccionar').getClientRects().length > 0 }))
  check(`${movil ? 'móvil' : 'PC'}: al escribir vuelven los mandos`, d.orden && d.sel, JSON.stringify(d))
  check(`${movil ? 'móvil' : 'PC'}: sin errores`, errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── Mensajes ──')
const conConversaciones = () => {
  const h = (m) => new Date(Date.now() - m * 60000).toISOString()
  const F = window.__FAKE_FILAS__ ||= {}
  F.conversation_participants = [
    { conversation_id: 'conv-1', user_id: 'user-1', last_read_at: h(60) }, { conversation_id: 'conv-1', user_id: 'user-2', last_read_at: h(1) },
    { conversation_id: 'conv-2', user_id: 'user-1', last_read_at: h(10) }, { conversation_id: 'conv-2', user_id: 'extra-3', last_read_at: h(40) },
  ]
}
for (const movil of [false, true]) {
  const ctx = await contexto(b, movil, 'user-1', conConversaciones); const p = await ctx.newPage()
  const errores = []; p.on('pageerror', (e) => errores.push(e.message))
  await p.goto(`${BASE}/mensajes${movil ? '' : '?c=conv-1'}`, { waitUntil: 'networkidle' }).catch(() => {})
  await p.waitForTimeout(1200)
  const r = await p.evaluate(() => {
    const cs = (el) => el && getComputedStyle(el)
    const filas = document.querySelector('.msg-filas'); const fila = document.querySelector('.msg-filas .msg-fila')
    const activa = document.querySelector('.msg-filas .msg-fila.activa'); const otra = document.querySelector('.msg-filas .msg-fila:not(.activa)')
    const mia = document.querySelector('.msg-burbuja.mia'); const hilo = document.querySelector('.msg-hilo')
    const prueba = document.createElement('i'); prueba.style.color = 'var(--text)'; document.body.append(prueba)
    return {
      cajaBorde: cs(filas)?.borderTopWidth, filas: document.querySelectorAll('.msg-filas .msg-fila').length,
      filaRadio: cs(fila)?.borderTopLeftRadius, filaBorde: cs(fila)?.borderTopWidth,
      activa: activa ? cs(activa).backgroundColor !== cs(otra).backgroundColor : null,
      miaLetra: mia ? cs(mia).color === getComputedStyle(prueba).color : null,
      hiloBorde: hilo ? cs(hilo).borderTopWidth : null,
    }
  })
  check(`${movil ? 'móvil' : 'PC'}: la lista es una caja con las filas sin borde propio`, r.cajaBorde === '1px' && r.filas === 2 && r.filaRadio === '0px' && r.filaBorde === '0px', JSON.stringify(r))
  if (!movil) {
    check('PC: la abierta, teñida', r.activa === true, JSON.stringify(r))
    check('PC: lo tuyo, con la letra de siempre (no blanco sobre azul)', r.miaLetra === true, JSON.stringify(r))
    check('PC: la conversación en su caja', r.hiloBorde === '1px', JSON.stringify(r))
  }
  check(`${movil ? 'móvil' : 'PC'}: sin errores`, errores.length === 0, errores.join(' | '))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
