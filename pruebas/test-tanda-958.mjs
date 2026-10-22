// Tanda 958 — las versiones de cada idioma, también carta a carta.
//
// PINGU con el Duskull SH2 de Stormfront: Holo en español, Reverse en inglés,
// francés, alemán e italiano. La 956 solo quitaba versiones del SET entero, y
// la carta trae de TCGdex solo la Holo: no había Reverse que dejar. Contra
// PostgreSQL de verdad (la 956 y la 958 encima, dos veces) y lo puro de la
// web y del panel.
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
const MIGRACION = join(RAIZ, 'supabase-migration-958-versiones-por-idioma-de-una-carta.sql')
const SQL = readFileSync(MIGRACION, 'utf8')
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 120000 })

console.log('── Contra PostgreSQL ──')
const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433 donde probar', hay.status === 0, (hay.stderr || '').slice(0, 120))
if (hay.status === 0) {
  psql(['-c', 'drop database if exists prueba_958'])
  psql(['-c', 'create database prueba_958'])
  const SH = join(AQUI, 'sql-tanda-958.sql')
  const pasos = [join(AQUI, 'sql-tanda-956.sql'), SH, join(RAIZ, 'supabase-migration-911-idiomas-de-set.sql'),
    join(RAIZ, 'supabase-migration-956-idiomas-y-versiones-a-mano.sql'), MIGRACION, MIGRACION]
  for (const f of pasos) {
    const r = psql(['-v', 'ON_ERROR_STOP=1', '-d', 'prueba_958', '-f', f])
    if (r.status !== 0) check(`carga ${f.split('/').pop()}`, false, (r.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
  }
  const r = psql(['-t', '-A', '-d', 'prueba_958', '-f', join(AQUI, 'sql-tanda-958-casos.sql')])
  const lineas = (r.stdout || '').split('\n').filter((l) => /^(ok|MAL) /.test(l))
  check('los casos se ejecutan', lineas.length >= 10, (r.stderr || '').split('\n').find((l) => /ERROR/.test(l) && !/no es del set/.test(l)) || '')
  for (const l of lineas) check(l.replace(/^(ok|MAL) /, ''), l.startsWith('ok'))
  // Y la 956 sigue pasando con la 958 puesta: sus casos llaman con cinco.
  const c956 = psql(['-t', '-A', '-d', 'prueba_958', '-f', join(AQUI, 'sql-tanda-956-casos.sql')])
  const l956 = (c956.stdout || '').split('\n').filter((l) => /^(ok|MAL) /.test(l))
  check('los casos de la 956 siguen en verde con la 958 encima', l956.length >= 10 && l956.every((l) => l.startsWith('ok') || /dos veces no repite/.test(l)), l956.filter((l) => !l.startsWith('ok')).join(' | '))
  // (la cuenta de filas de la 956 cuenta también las de las SH: aquí no vale)
  psql(['-c', 'drop database if exists prueba_958'])
}
check('la migración no usa tablas temporales (la 631)', !/create\s+temp/i.test(SQL))

console.log('── Lo de la web ──')
const cm = await import(join(RAIZ, 'js/cardmarket.js'))
const ids = (l) => l.map((i) => i.id).join(',')
const filas = [
  { set_id: 'dp7', card_id: '', variante: 'reverse', idioma: 'es', hay: false },
  ...['en', 'fr', 'de', 'it'].flatMap((idioma) => [
    { set_id: 'dp7', card_id: 'dp7-SH2', variante: 'reverse', idioma, hay: true },
    { set_id: 'dp7', card_id: 'dp7-SH2', variante: 'holo', idioma, hay: false },
  ]),
  // Lo de un set a sí no pone nada (sería ponerla en todas sus cartas).
  { set_id: 'dp7', card_id: '', variante: 'primera', idioma: 'en', hay: true },
]
const reglas = cm.reglasDeFilas(filas)
const SOLO_HOLO = [{ id: 'holo', nombre: 'Holo' }]
check('el Duskull SH2 en español: Holo', ids(cm.versionesDelIdioma(SOLO_HOLO, reglas, 'es', 'dp7-SH2').versiones) === 'holo')
const en = cm.versionesDelIdioma(SOLO_HOLO, reglas, 'en', 'dp7-SH2')
check('  …en inglés: Reverse, y solo Reverse', ids(en.versiones) === 'reverse', ids(en.versiones))
check('  …con su nombre de siempre', en.versiones[0]?.nombre === 'Reverse holo')
check('  …y la frase dice que la Holo no salió', cm.avisoDeVersiones(en.quitadas, 'en', 'Stormfront') === 'En inglés, Stormfront no salió en Holo.')
check('  …igual en francés, alemán e italiano', ['fr', 'de', 'it'].every((l) => ids(cm.versionesDelIdioma(SOLO_HOLO, reglas, l, 'dp7-SH2').versiones) === 'reverse'))
check('  …y en portugués, lo de la carta (no se ha dicho nada)', ids(cm.versionesDelIdioma(SOLO_HOLO, reglas, 'pt', 'dp7-SH2').versiones) === 'holo')
const VS = [{ id: 'normal', nombre: 'Normal' }, { id: 'reverse', nombre: 'Reverse holo' }]
check('otra carta del set no se entera de lo del Duskull', ids(cm.versionesDelIdioma(VS, reglas, 'en', 'dp7-1').versiones) === 'normal,reverse')
check('  …y en español sigue sin Reverse (956)', ids(cm.versionesDelIdioma(VS, reglas, 'es', 'dp7-1').versiones) === 'normal')
check('  …y el sí de un set no pone la 1.ª edición', !ids(cm.versionesDelIdioma(VS, reglas, 'en', 'dp7-1').versiones).includes('primera'))
check('lo de una carta manda sobre lo del set', ids(cm.versionesDelIdioma(VS, cm.reglasDeFilas([...filas, { card_id: 'dp7-1', variante: 'reverse', idioma: 'es', hay: true }]), 'es', 'dp7-1').versiones) === 'normal,reverse')
check('sin carta, solo lo del set', ids(cm.versionesDelIdioma(SOLO_HOLO, reglas, 'en').versiones) === 'holo')
check('el Map de la 956 sigue valiendo', ids(cm.versionesDelIdioma(VS, new Map([['es', new Set(['reverse'])]]), 'es').versiones) === 'normal')
check('si quitara todas, se queda la lista', ids(cm.versionesDelIdioma(SOLO_HOLO, cm.reglasDeFilas([{ card_id: 'x', variante: 'holo', idioma: 'en', hay: false }]), 'en', 'x').versiones) === 'holo')
const ids_ = readFileSync(join(RAIZ, 'js/idiomas-de-set.js'), 'utf8')
check('la web pide `*` y no nombra `card_id` (antes de la 958 no existe, la 624)', /from\('tcg_version_idioma'\)\.select\('\*'\)/.test(ids_) && !/select\([^)]*card_id/.test(ids_))
const adm = readFileSync(join(RAIZ, 'admin/js/idiomas-set.js'), 'utf8')
check('  …y el panel igual', /from\('tcg_version_idioma'\)\.select\('\*'\)/.test(adm))
for (const f of ['js/mi-coleccion.js', 'js/carta-mercado.js']) {
  check(`${f} pasa la carta a versionesDelIdioma`, /versionesDelIdioma\(.*, (c|hojaDeVersiones\.carta\?)\.id\)/.test(readFileSync(join(RAIZ, f), 'utf8')))
}

console.log('── Lo del panel ──')
const p = await import(join(RAIZ, 'admin/js/idiomas-set-puro.js'))
const duskull = { id: 'dp7-SH2', set_id: 'dp7', name: 'Duskull', rarity: 'Rare Holo LV.X', variants: { holo: true }, versiones: [] }
check('la carta ofrece también las versiones que no trae', ids(p.versionesDeUnaCarta(duskull, [])).split(',').sort().join(',') === 'holo,normal,reverse', ids(p.versionesDeUnaCarta(duskull, [])))
check('sin nada puesto: Holo sí, Reverse no', p.casillaDeCarta(duskull, [], 'holo', 'en').si && !p.casillaDeCarta(duskull, [], 'reverse', 'en').si)
check('  …tocar la Reverse en inglés la pone', p.alTocarCasilla(duskull, [], 'reverse', 'en') === true)
check('  …y tocar la Holo la quita', p.alTocarCasilla(duskull, [], 'holo', 'en') === false)
const puestas = filas.filter((f) => f.card_id === 'dp7-SH2' || !f.card_id)
check('con lo de la migración: inglés Reverse sí y Holo no, puestas en la carta', p.casillaDeCarta(duskull, puestas, 'reverse', 'en').si && p.casillaDeCarta(duskull, puestas, 'reverse', 'en').propia && !p.casillaDeCarta(duskull, puestas, 'holo', 'en').si)
check('  …tocar otra vez una puesta la devuelve a lo del set (null, sin fila de más)', p.alTocarCasilla(duskull, puestas, 'reverse', 'en') === null && p.alTocarCasilla(duskull, puestas, 'holo', 'en') === null)
check('  …y en español, como el set: Holo sí, Reverse no (956)', p.casillaDeCarta(duskull, puestas, 'holo', 'es').si && !p.casillaDeCarta(duskull, puestas, 'reverse', 'es').si && !p.casillaDeCarta(duskull, puestas, 'reverse', 'es').propia)
check('  …y ponerla en español sí escribe en la carta', p.alTocarCasilla(duskull, puestas, 'reverse', 'es') === true)
check('la matriz del set no cuenta lo de una carta', p.salio(puestas, 'holo', 'en'))

console.log(fails ? `\n❌ ${fails} fallo(s)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
