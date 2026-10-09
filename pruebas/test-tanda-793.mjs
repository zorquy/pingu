// Tanda 793 — NU9, los logros de coleccionista: cartas distintas, sets
// completos, una carta de más de N € y N cartas de un ilustrador, contados
// con la colección que /mi-coleccion tiene en memoria; y «lo tiene el N %».
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

console.log('── 1. En el código ──')
const gam = leer('js/gamification.js')
const tipos = ['collection_cards_count', 'collection_sets_complete', 'collection_top_card_eur', 'collection_illustrator_cards']
check('gamification entiende los cuatro tipos nuevos', tipos.every((t) => gam.includes(`case '${t}'`)))
check('/admin los ofrece al crear un trofeo', tipos.every((t) => new RegExp(`${t}: '`).test(leer('admin/js/admin.js'))))
const mig = leer('supabase-migration-logros-coleccion.sql')
check('la migración los siembra y cada uno usa un tipo que se entiende', [...mig.matchAll(/"type": "([a-z_]+)"/g)].every(([, t]) => tipos.includes(t)) && /on conflict \(id\) do update/.test(mig))
check('  …y el reparto es una función que cualquiera puede leer', /create or replace function public\.logros_reparto\(\)/.test(mig) && /grant execute on function public\.logros_reparto\(\) to anon, authenticated/.test(mig))
check('  …sin tablas temporales (la 631)', !/temp(orary)? table/i.test(mig))
check('Mi colección los mira una vez, y no en el catálogo', /if \(logrosMirados \|\| !sesion\?\.user\?\.id \|\| !lineas\.length \|\| modoCatalogo\) return/.test(leer('js/mi-coleccion.js')))
check('/cartas lleva lo que sale del generador', leer('cartas.html').length > 0)

console.log('── 2. Lo puro ──')
const b = await chromium.launch()
const p = await b.newPage()
await p.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
const r = await p.evaluate(async () => {
  const { statsDeColeccion } = await import('/js/logros-coleccion.js')
  const { textoDeReparto } = await import('/js/logros-reparto.js')
  const cartas = new Map([['a1', { illustrator: 'Arita' }], ['a2', { illustrator: 'Arita' }], ['b1', { illustrator: 'Sugimori' }]])
  const lineas = [
    { card_id: 'a1', cantidad: 2, v: 250 },
    { card_id: 'a1', cantidad: 1, v: 10 },
    { card_id: 'a2', cantidad: 1, v: 0 },
    { card_id: 'b1', cantidad: 1, v: 99.9 },
  ]
  const stats = statsDeColeccion({
    lineas,
    cartaDe: (id) => cartas.get(id),
    cuantasPorSet: new Map([['s1', 2], ['s2', 1], ['s3', 0]]),
    totalDeSet: (id) => ({ s1: 2, s2: 5, s3: 0 })[id],
    unidad: (l) => l.v / l.cantidad,
  })
  return { stats, t: [textoDeReparto(3, 100), textoDeReparto(0, 50), textoDeReparto(1, 400), textoDeReparto(1, 0)] }
})
check('cartas DISTINTAS, no líneas', r.stats.cartas === 3, JSON.stringify(r.stats))
check('un set completo cuenta solo si tiene total y lo alcanzas', r.stats.setsCompletos === 1, JSON.stringify(r.stats))
check('la más cara es el valor de UNA copia', r.stats.cartaMasCara === 125, JSON.stringify(r.stats))
check('el ilustrador del que más tienes', r.stats.maxIlustrador === 2, JSON.stringify(r.stats))
check('«lo tiene el N %», sin inventarse un cero', r.t[0] === 'La tiene el 3 %' && r.t[1] === 'Nadie la tiene aún' && r.t[2] === 'La tiene menos del 1 %' && r.t[3] === '', JSON.stringify(r.t))
await b.close()

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
