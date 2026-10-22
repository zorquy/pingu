// Tanda 959 — los idiomas de la era Platino y sus SH, y el precio de un idioma
// en el que el set no salió.
//
// PINGU: Supreme Victors solo en inglés, francés y alemán; Arceus y Rising
// Rivals en inglés, francés, alemán e italiano; las SH son Reverse, y en
// Platinum, en español, Holo. Y con el Bulbasaur de Dark Explorers delante:
// «el español sí aparece como idioma y con precio… si ya hemos decidido que
// un set no tiene X idioma, tampoco puedes mostrar ese precio».
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'

const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const MIGRACION = join(RAIZ, 'supabase-migration-959-platino-idiomas-y-sh.sql')
const SQL = readFileSync(MIGRACION, 'utf8')
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 120000 })

console.log('── Contra PostgreSQL ──')
const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433 donde probar', hay.status === 0, (hay.stderr || '').slice(0, 120))
if (hay.status === 0) {
  psql(['-c', 'drop database if exists prueba_959'])
  psql(['-c', 'create database prueba_959'])
  const pasos = [join(AQUI, 'sql-tanda-956.sql'), join(AQUI, 'sql-tanda-959.sql'), join(RAIZ, 'supabase-migration-911-idiomas-de-set.sql'),
    join(RAIZ, 'supabase-migration-956-idiomas-y-versiones-a-mano.sql'), join(RAIZ, 'supabase-migration-958-versiones-por-idioma-de-una-carta.sql'), MIGRACION, MIGRACION]
  for (const f of pasos) {
    const r = psql(['-v', 'ON_ERROR_STOP=1', '-d', 'prueba_959', '-f', f])
    if (r.status !== 0) check(`carga ${f.split('/').pop()}`, false, (r.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
  }
  const r = psql(['-t', '-A', '-d', 'prueba_959', '-f', join(AQUI, 'sql-tanda-959-casos.sql')])
  const lineas = (r.stdout || '').split('\n').filter((l) => /^(ok|MAL) /.test(l))
  check('los casos se ejecutan', lineas.length >= 10, (r.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
  for (const l of lineas) check(l.replace(/^(ok|MAL) /, ''), l.startsWith('ok'))
  psql(['-c', 'drop database if exists prueba_959'])
}
check('la migración no usa tablas temporales (la 631)', !/create\s+temp/i.test(SQL))

console.log('── El idioma del precio ──')
const cm = await import(join(RAIZ, 'js/cardmarket.js'))
const DE = ['de', 'en', 'fr', 'it']
check('Dark Explorers sin español: el precio que se enseña es el inglés', cm.idiomaDePrecioDelSet('es', DE) === 'en')
check('  …el tuyo si salió en él', cm.idiomaDePrecioDelSet('fr', DE) === 'fr')
check('  …y sin saber los del set, el tuyo', cm.idiomaDePrecioDelSet('es', null) === 'es' && cm.idiomaDePrecioDelSet('es', []) === 'es')
check('  …y si el set solo dice idiomas sin precio, el tuyo', cm.idiomaDePrecioDelSet('es', ['nl']) === 'es')
// Se pintan de verdad: mirar el fuente no basta (la regla estuvo puesta en la
// función de al lado, que tiene la misma primera línea, y sin importar).
const { tarjetasDePrecio } = await import(join(RAIZ, 'js/precio-vista.js'))
const precio = { idProduct: 600, porIdioma: { es: 0.02, en: 1.1, de: 1.99, fr: 2.7, it: 0.1 } }
const cabs = (html) => [...html.matchAll(/<span class="pv-t-cab">.*?<b>(\w+)<\/b>/g)].map((m) => m[1]).join()
const sinEs = tarjetasDePrecio(precio, { idioma: 'es', idiomasDelSet: DE })
check('las tarjetas de Dark Explorers no tienen la española', cabs(sinEs) === 'EN,DE,FR,IT', cabs(sinEs))
check('  …ni el 0,02 €, ni «tu idioma»', !/0,02/.test(sinEs) && !/tu idioma/.test(sinEs))
check('  …sin saber los del set, como antes', cabs(tarjetasDePrecio(precio, { idioma: 'es' })).startsWith('ES'))
const copia = tarjetasDePrecio(precio, { idioma: 'es', idiomasDelSet: DE, rotuloActivo: 'tu copia' })
check('  …y la de tu copia en español sí', cabs(copia).startsWith('ES') && /tu copia/.test(copia))
check('la ficha de Mi colección (precio, gráfica y aviso) también', /idiomaDePrecioDeFicha\(l, c, tuya\)/.test(readFileSync(join(RAIZ, 'js/mi-coleccion.js'), 'utf8')))
check('/carta cambia el idioma al llegar los del set', /idiomaDePrecioDelSet\(estado\.idioma, lista\)/.test(readFileSync(join(RAIZ, 'js/carta-mercado.js'), 'utf8')))

console.log(fails ? `\n❌ ${fails} fallo(s)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
