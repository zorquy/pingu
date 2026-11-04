// Tanda 1226 — el Pokémon de cada tema de Aprender (la A de la propuesta).
//   · la migración contra PostgreSQL, sentencia a sentencia (la 631): crea
//     `categories.pokemon`, pone los seis por el nombre, no pisa uno puesto a
//     mano y entra dos veces;
//   · `pokemonDelTema` (puro): manda la columna, si no el nombre, y lo que no
//     casa no lleva Pokémon (nada de uno al azar);
//   · /aprender: tres por fila en el PC, el nombre entero, el Pokémon con
//     sentido y su porqué; sin Pokémon, el icono; en el móvil, la fila.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { contexto, VP, chromium } from './fixtures-app.mjs'

const REPO = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. La migración, contra PostgreSQL ──')
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_1226'
const mig = readFileSync(`${REPO}/supabase-migration-1226-temas-pokemon.sql`, 'utf8')
check('sin tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0, hay.stderr)
if (hay.status === 0) {
  psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
  let r = psql(['-d', BD, '-c', `create table categories (id uuid primary key default gen_random_uuid(), name text not null, slug text);
    insert into categories (name, slug) values ('Primeros pasos', 'a'), ('Comprar, vender y cambiar', 'b'), ('¿Es real o falsa?', 'c'),
      ('Identificar cartas', 'd'), ('Historia & curiosidades', 'e'), ('Mazos & estrategia', 'f'), ('Otra cosa', 'g');`])
  check('el andamio carga', r.status === 0, r.stderr)
  // Cada sentencia por su lado, cada una en su conexión (como el SQL Editor).
  const sentencias = mig.replace(/--[^\n]*/g, '').split(/;\s*\n/).map((x) => x.trim()).filter(Boolean)
  check('son dos sentencias', sentencias.length === 2, sentencias.length)
  for (const s of sentencias) { r = psql(['-d', BD, '-c', s]); check(`  entra: ${s.slice(0, 40)}…`, r.status === 0, r.stderr) }
  const lee = () => psql(['-At', '-d', BD, '-c', `select string_agg(name || '=' || coalesce(pokemon::text, '-'), ',' order by slug) from categories`]).stdout.trim()
  check('los seis por su nombre, y lo que no casa, vacío', lee() === 'Primeros pasos=172,Comprar, vender y cambiar=52,¿Es real o falsa?=132,Identificar cartas=201,Historia & curiosidades=142,Mazos & estrategia=65,Otra cosa=-', lee())
  psql(['-d', BD, '-c', `update categories set pokemon = 25 where slug = 'a'`])
  for (const s of sentencias) psql(['-d', BD, '-c', s])
  check('otra vez encima: no pisa lo puesto a mano', lee().startsWith('Primeros pasos=25,'), lee())
  psql(['-c', `drop database if exists ${BD}`])
}

console.log('── 2. pokemonDelTema ──')
const m = await import(`${REPO}/js/temas-pokemon.js`)
check('manda la columna', m.pokemonDelTema({ name: 'Primeros pasos', pokemon: 25 }) === 25)
check('sin columna, por el nombre', ['Primeros pasos', 'Comprar, vender y cambiar', '¿Es real o falsa?', 'Identificar cartas', 'Historia & curiosidades', 'Mazos & estrategia'].map((n) => m.pokemonDelTema({ name: n })).join() === '172,52,132,201,142,65')
check('lo que no casa: nada (no uno al azar)', m.pokemonDelTema({ name: 'Otra cosa', slug: 'otra' }) === null)
check('los seis llevan su porqué', [172, 52, 132, 201, 142, 65].every((d) => m.porqueDelPokemon(d)?.porque))

console.log('── 3. /aprender ──')
const b = await chromium.launch()
for (const movil of [false, true]) {
  const ctx = await contexto(b, movil)
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(e.message))
  await p.goto(`${BASE}/aprender`, { waitUntil: 'networkidle' }).catch(() => {})
  await p.waitForSelector('#apTemas .ap-baldosa', { timeout: 8000 }).catch(() => {})
  const t = await p.$$eval('#apTemas .ap-baldosa', (as) => as.map((a) => {
    const n = a.querySelector('.ap-baldosa-nombre')
    const r = a.getBoundingClientRect()
    return { nombre: n.textContent, entero: n.scrollWidth <= n.clientWidth + 1 && n.scrollHeight <= n.clientHeight + 1, top: Math.round(r.top), ancho: Math.round(r.width), dex: (a.querySelector('img.ap-baldosa-arte')?.getAttribute('src') || '').match(/\/(\d+)\.png/)?.[1] || null, icono: !!a.querySelector('.ap-baldosa-icono'), porque: a.querySelector('.ap-baldosa-porque')?.textContent || '', ver: a.querySelector('.ap-baldosa-porque') ? getComputedStyle(a.querySelector('.ap-baldosa-porque')).display : 'none' }
  }))
  const de = (n) => t.find((x) => x.nombre === n)
  if (!movil) {
    check('PC: hay temas', t.length >= 3, JSON.stringify(t))
    check('PC: los tres primeros en la misma fila', t.length >= 3 && t[0].top === t[1].top && t[1].top === t[2].top, t.map((x) => x.top).join())
    check('PC: tres por fila, no seis (cada uno, más de 280 px)', t.every((x) => x.ancho > 280), t.map((x) => x.ancho).join())
    check('PC: el nombre se lee entero', t.every((x) => x.entero), JSON.stringify(t.filter((x) => !x.entero)))
    check('«Empezar» → Pichu, con su porqué', de('Empezar')?.dex === '172' && /Pichu/.test(de('Empezar')?.porque) && de('Empezar')?.ver !== 'none', JSON.stringify(de('Empezar')))
    check('«Competitivo» → Alakazam', de('Competitivo')?.dex === '65', JSON.stringify(de('Competitivo')))
    check('«Coleccionar» no casa: su icono, sin Pokémon', de('Coleccionar')?.dex === null && de('Coleccionar')?.icono, JSON.stringify(de('Coleccionar')))
  } else {
    check('móvil: fila de baldosas de 160 px', t.length >= 3 && t.every((x) => x.ancho === 160) && t[0].top === t[1].top, t.map((x) => `${x.ancho}@${x.top}`).join())
    check('móvil: sin el porqué', t.every((x) => x.ver === 'none'))
  }
  // Un nombre largo (el «Comprar, vender & mercado» de producción) se corta a
  // dos líneas y NO pisa la línea de debajo (1228: con `overflow: visible` la
  // tercera línea caía encima de «2 guías · 2 cursos»).
  const pisa = await p.evaluate(() => {
    const a = document.querySelector('#apTemas .ap-baldosa')
    if (!a) return 'sin baldosa'
    a.querySelector('.ap-baldosa-nombre').textContent = 'Comprar, vender & mercado de cartas sueltas'
    const el = a.querySelector('.ap-baldosa-nombre')
    const n = el.getBoundingClientRect()
    const sub = a.querySelector('.ap-baldosa-sub').getBoundingClientRect()
    // La caja mide dos líneas aunque el texto se salga: lo que se sale se pinta
    // FUERA de ella. Se mira si sobra texto y si se ve.
    const sobra = el.scrollHeight > el.clientHeight + 1 && getComputedStyle(el).overflowY === 'visible'
    if (sobra) return `se sale y se ve (${el.scrollHeight} > ${el.clientHeight})`
    return Math.round(n.bottom) <= Math.round(sub.top) + 1 ? 'no' : `${Math.round(n.bottom)} > ${Math.round(sub.top)}`
  })
  check(`${movil ? 'móvil' : 'PC'}: un nombre largo no pisa la línea de debajo`, pisa === 'no', pisa)
  check(`${movil ? 'móvil' : 'PC'}: sin errores de JavaScript`, errores.length === 0, errores.join(' | '))
  if (process.env.OUT) await p.screenshot({ path: `${process.env.OUT}/1226-${movil ? 'movil' : 'pc'}.png` })
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
