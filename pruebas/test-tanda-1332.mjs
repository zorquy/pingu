// Tanda 1332 — I3 del plan 2027: el esquema de hoy en un fichero
// (`supabase-esquema-actual.sql`, generado por herramientas/esquema-actual.mjs).
// Comprueba que está, que no se sirve, que lleva lo de siempre y, con el
// PostgreSQL de pruebas, que está AL DÍA: regenerarlo da el mismo texto.
import { readFileSync, existsSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const RUTA = `${REPO}/supabase-esquema-actual.sql`
check('el fichero está en la raíz', existsSync(RUTA))
const texto = existsSync(RUTA) ? readFileSync(RUTA, 'utf8') : ''
check('dice que es GENERADO y que mandan las migraciones', /GENERADO: no se edita a mano/.test(texto) && /Lo que manda siguen siendo las supabase-migration-\*\.sql/.test(texto))
const { RUTAS_INTERNAS } = await import(`${REPO}/netlify/edge-functions/internos.js`)
check('no se sirve: casa con una ruta interna (/supabase-*)', RUTAS_INTERNAS.some((p) => new RegExp(`^${p.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`).test('/supabase-esquema-actual.sql')))

const migraciones = spawnSync('git', ['-C', REPO, 'ls-files', '--', 'supabase-migration-*.sql'], { encoding: 'utf8' }).stdout.split('\n').filter(Boolean).length
const n = Number((texto.match(/aplicando las (\d+) migraciones/) || [])[1])
check('cuenta todas las migraciones del repo', n >= migraciones && migraciones > 300, `${n} en el fichero, ${migraciones} en git`)
for (const [que, re] of [
  ['user_profiles', /CREATE TABLE public\.user_profiles \(/],
  ['tienda_stock', /CREATE TABLE public\.tienda_stock \(/],
  ['tournaments con precio_entrada (1331)', /CREATE TABLE public\.tournaments \([^;]*precio_entrada numeric\(8,2\)/s],
  ['las políticas', /CREATE POLICY /],
  ['las funciones (tienda_vender)', /CREATE FUNCTION public\.tienda_vender\(/],
]) check(`lleva ${que}`, re.test(texto))
const errores = (texto.match(/^--   supabase-migration-[^ ]+ \(\d+\)$/gm) || []).length
check('pocas migraciones con sentencias que no entran (≤ 6)', errores <= 6, `${errores}`)

const pg = spawnSync('psql', ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-Atc', 'select 1'], { encoding: 'utf8' })
if (pg.status === 0 && !process.env.PD_SIN_REGENERAR) {
  const { generar } = await import(new URL('../herramientas/esquema-actual.mjs', import.meta.url))
  const r = generar({ repo: REPO, escribir: false })
  check('está AL DÍA: regenerarlo da el mismo texto (si no: node herramientas/esquema-actual.mjs)', r.texto === texto, `${r.texto.length} contra ${texto.length}`)
} else console.log('  (sin PostgreSQL de pruebas: no se regenera)')

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
