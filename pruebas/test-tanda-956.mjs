// Tanda 956 — los idiomas de un set y las versiones de cada idioma, a mano.
//
// Sergio.M en el foro: Undaunted sin portugués, Dark Explorers sin español,
// Jungle con neerlandés, Stormfront sin Reverse en español… PINGU eligió que
// se corrija desde /admin. Contra PostgreSQL de verdad (la 911 y la 956
// encima, dos veces) y lo puro de la web y del panel.
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
const MIGRACION = join(RAIZ, 'supabase-migration-956-idiomas-y-versiones-a-mano.sql')
const SQL = readFileSync(MIGRACION, 'utf8')
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 120000 })

console.log('── Contra PostgreSQL ──')
const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433 donde probar', hay.status === 0, (hay.stderr || '').slice(0, 120))
if (hay.status === 0) {
  psql(['-c', 'drop database if exists prueba_956'])
  psql(['-c', 'create database prueba_956'])
  const pasos = [join(AQUI, 'sql-tanda-956.sql'), join(RAIZ, 'supabase-migration-911-idiomas-de-set.sql'), MIGRACION, MIGRACION]
  for (const f of pasos) {
    const r = psql(['-v', 'ON_ERROR_STOP=1', '-d', 'prueba_956', '-f', f])
    if (r.status !== 0) check(`carga ${f.split('/').pop()}`, false, (r.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
  }
  const r = psql(['-t', '-A', '-d', 'prueba_956', '-f', join(AQUI, 'sql-tanda-956-casos.sql')])
  const lineas = (r.stdout || '').split('\n').filter((l) => /^(ok|MAL) /.test(l))
  check('los casos se ejecutan', lineas.length >= 10, (r.stderr || '').split('\n').find((l) => /ERROR/.test(l) && !/Solo el admin/.test(l)) || '')
  check('  …y el que no es admin choca con «Solo el admin»', /Solo el admin corrige el catálogo/.test(r.stderr || ''))
  for (const l of lineas) check(l.replace(/^(ok|MAL) /, ''), l.startsWith('ok'))
  const raro = psql(['-d', 'prueba_956', '-c', "insert into public.user_collection (idioma) values ('xx')"])
  check('un idioma inventado no se guarda', raro.status !== 0)
  psql(['-c', 'drop database if exists prueba_956'])
}
check('la migración no usa tablas temporales (la 631)', !/create\s+temp/i.test(SQL))
check('  …y las tablas nuevas se pueden leer (política de SELECT, la 510)', /tcg_set_idiomas_mano_leer[\s\S]*for select using \(true\)/.test(SQL) && /tcg_version_idioma_leer[\s\S]*for select using \(true\)/.test(SQL))

console.log('── Lo de la web ──')
const cm = await import(join(RAIZ, 'js/cardmarket.js'))
const OCC = cm.IDIOMAS.filter((i) => ['es', 'en', 'fr', 'de', 'it', 'pt'].includes(i.id))
const ids = (l) => l.map((i) => i.id).join(',')
check('el neerlandés está en la lista de idiomas, sin precio propio', cm.IDIOMAS.some((i) => i.id === 'nl' && i.cm === null) && !cm.IDIOMAS_CON_PRECIO.includes('nl'))
check('sin saber nada del set no se ofrece el neerlandés', ids(cm.idiomasParaAnadirEn('WEST', OCC, null)) === 'es,en,fr,de,it,pt')
check('  …ni en un set que no lo tiene', !ids(cm.idiomasParaAnadirEn('WEST', OCC, ['en', 'fr'])).includes('nl'))
check('  …y sí en Jungle', ids(cm.idiomasParaAnadirEn('WEST', OCC, ['en', 'es', 'nl'])) === 'es,en,nl', ids(cm.idiomasParaAnadirEn('WEST', OCC, ['en', 'es', 'nl'])))
check('  …aunque la lista de base lo trajera', !ids(cm.idiomasParaAnadirEn('WEST', cm.IDIOMAS.filter((i) => i.id !== 'ja' && i.id !== 'ko' && i.id !== 'zh'), ['en'])).includes('nl'))
const VS = [{ id: 'normal', nombre: 'Normal' }, { id: 'reverse', nombre: 'Reverse holo' }, { id: 'holo', nombre: 'Holo' }]
const no = new Map([['es', new Set(['reverse'])], ['pt', new Set(['normal', 'reverse', 'holo'])]])
const es = cm.versionesDelIdioma(VS, no, 'es')
check('en español Stormfront no ofrece la Reverse', ids(es.versiones) === 'normal,holo' && ids(es.quitadas) === 'reverse')
check('  …y en inglés sí', ids(cm.versionesDelIdioma(VS, no, 'en').versiones) === 'normal,reverse,holo')
check('  …si quitara todas, se queda la lista (un dato mal puesto no deja la hoja sin versiones)', ids(cm.versionesDelIdioma(VS, no, 'pt').versiones) === 'normal,reverse,holo')
check('  …y sin datos, todas', ids(cm.versionesDelIdioma(VS, new Map(), 'es').versiones) === 'normal,reverse,holo')
// Desde la 1006 la versión manda: sin frase, y el idioma se acota a ella.
check('la hoja ofrece las versiones de TODOS los idiomas (1006)', ids(cm.versionesDeLosIdiomas(VS, no, ['es', 'en'])) === 'normal,reverse,holo')
check('  …y si en ninguno salió una, esa no', ids(cm.versionesDeLosIdiomas(VS, new Map([['es', new Set(['reverse'])], ['en', new Set(['reverse'])]]), ['es', 'en'])) === 'normal,holo')
check('con la Reverse elegida, el español no se puede elegir', cm.idiomasDeLaVersion(['es', 'en'], VS, no, 'reverse').join() === 'en')
check('  …con la Normal, los dos', cm.idiomasDeLaVersion(['es', 'en'], VS, no, 'normal').join() === 'es,en')
check('  …y una que no salió en ninguno no bloquea la hoja', cm.idiomasDeLaVersion(['es'], VS, no, 'reverse').join() === 'es')
check('el aviso de antes ya no existe', cm.avisoDeVersiones === undefined)

console.log('── Lo del panel ──')
const p = await import(join(RAIZ, 'admin/js/idiomas-set-puro.js'))
const est = p.estadoDeIdiomas(['en', 'es', 'pt'], [{ idioma: 'pt', hay: false }, { idioma: 'nl', hay: true }])
check('cada idioma con su estado: lo calculado, lo quitado y lo puesto', est.map((i) => `${i.id}:${i.estado}`).join(',') === 'es:auto,en:auto,pt:quitado,nl:puesto', est.map((i) => `${i.id}:${i.estado}`).join(','))
check('  …tocar uno calculado lo quita; tocar uno de a mano lo deja de mandar', est.find((i) => i.id === 'es').alTocar === false && est.find((i) => i.id === 'pt').alTocar === null && est.find((i) => i.id === 'nl').alTocar === null)
check('se pueden añadir los que no salen', ids(p.idiomasParaPoner(est)) === 'fr,de,it,ja,ko,zh')
const cartas = [
  { id: 'a', set_id: 'dp7', name: 'Gengar', rarity: 'Rare Holo', variants: { holo: true, reverse: true } },
  { id: 'b', set_id: 'dp7', name: 'Gastly', rarity: 'Common', variants: { normal: true, reverse: true } },
]
check('las versiones del set, juntas y sin repetir', ids(p.versionesDelSet(cartas)) === 'reverse,holo,normal', ids(p.versionesDelSet(cartas)))
check('  …y una con algo puesto aunque ya no se ofrezca', ids(p.versionesDelSet(cartas, [{ variante: 'primera', idioma: 'es', hay: false }])).endsWith('primera'))
check('sin fila, la versión salió; con la fila a false, no', p.salio([], 'reverse', 'es') && !p.salio([{ variante: 'reverse', idioma: 'es', hay: false }], 'reverse', 'es'))

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
