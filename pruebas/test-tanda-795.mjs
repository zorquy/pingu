// Tanda 795 — NU4, confianza en los cambios: «Cambio hecho» entre dos que han
// hablado, «todo bien» / «hubo un problema», y «12 cambios · todos bien» en
// el perfil. Los problemas solo los ve la moderación.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')

console.log('── 1. La migración ──')
const sql = leer('supabase-migration-cambios-hechos.sql')
check('la tabla nace con RLS y su política de lectura en la misma migración (la 510)', /enable row level security/.test(sql) && /create policy trade_confirmations_ver/.test(sql))
check('nadie escribe a pelo: solo las funciones', !/for (insert|update|delete)/.test(sql) && /function public\.cambio_marcar/.test(sql) && /function public\.cambio_valorar/.test(sql))
check('solo entre dos que han hablado por Mensajes', /conversation_participants c1\s+join public\.conversation_participants c2/.test(sql))
check('lo público no cuenta los problemas', /returns table \(hechos bigint, bien bigint\)/.test(sql) && !/returns table[^)]*problema/.test(sql))
check('  …y lo lee cualquiera; marcar y valorar, solo con cuenta', /cambios_de\(uuid\) to anon, authenticated/.test(sql) && /cambio_marcar\(uuid\) to authenticated;/.test(sql))
check('sin tablas temporales (la 631)', !/temp(orary)? table/i.test(sql))
check('la conversación lleva el botón y el perfil la confianza', /cambio-boton\.js/.test(leer('js/mensajes.js')) && /textoDeConfianza/.test(leer('js/usuario.js')))

console.log('── 2. Lo puro ──')
const b = await chromium.launch()
const p = await b.newPage()
await p.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
const r = await p.evaluate(async () => {
  const m = await import('/js/cambios-hechos.js')
  const fila = (o) => ({ id: 'c', user_a: 'a', user_b: 'b', hecho_a_at: null, hecho_b_at: null, valoracion_a: null, valoracion_b: null, ...o })
  return {
    t: [m.textoDeConfianza({ hechos: 12, bien: 12 }), m.textoDeConfianza({ hechos: 1, bien: 0 }), m.textoDeConfianza({ hechos: 5, bien: 3 }), m.textoDeConfianza({ hechos: 0, bien: 0 }), m.textoDeConfianza(null)],
    p: [
      m.estadoDelCambio([], 'a').paso,
      m.estadoDelCambio([fila({ hecho_a_at: 'x' })], 'a').paso,
      m.estadoDelCambio([fila({ hecho_a_at: 'x' })], 'b').paso,
      m.estadoDelCambio([fila({ hecho_a_at: 'x', hecho_b_at: 'y' })], 'b').paso,
      m.estadoDelCambio([fila({ hecho_a_at: 'x', hecho_b_at: 'y', valoracion_b: 'bien' })], 'b').paso,
    ],
  }
})
check('el rótulo: todos bien, sin valorar, algunos, y nada sin cambios', JSON.stringify(r.t) === JSON.stringify(['12 cambios · todos bien', '1 cambio', '5 cambios · 3 dijeron que fue bien', '', '']), JSON.stringify(r.t))
check('los pasos: marcar, esperar, confirmar, valorar, hecho', r.p.join() === 'marcar,esperando,confirmar,valorar,hecho', r.p.join())
await b.close()

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
