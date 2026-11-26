// Tanda 1460 — Los arquetipos de Limitless, y las cartas en su forma de
// Estándar (Ibai: «tráete todos los arquetipos de mazos de Limitless… y sigue
// habiendo cartas del formato estándar que PokeDoc no usa en su forma
// estándar como en Limitless: no salen al mandar una lista a un torneo ni en
// el constructor, y en las repeticiones salen cartas que no son»).
//
//   1. El requisito de un arquetipo con `minimo` de copias, y los nombres sin
//      guiones («Mega-Lucario ex» es «Mega Lucario ex»).
//   2. La migración: 148 arquetipos con el id y el nombre de Limitless, sin
//      el Other ni sus Basic Box, sin nada que el SQL Editor lea mal, y unas
//      listas reales que salen con el arquetipo que les pone Limitless.
//   3. Los números y los códigos de una lista: «DLR 084» es el «84» de Delta
//      Reign y «SVP 149» va a `svp`.
//   4. La impresión del meta, por sección.
//   5. En PostgreSQL, sentencia a sentencia como el SQL Editor, dos veces.
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const PSQL = ['-h', process.env.PD_PG_HOST || '/var/tmp', '-p', process.env.PD_PG_PORT || '5433', '-U', 'postgres', '-X', '-q', '-v', 'ON_ERROR_STOP=1']
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 400) : ''}`) }

const A = await import(`${RAIZ}/js/torneos/arquetipos.js`)
const C = await import(`${RAIZ}/js/torneos/comun.js`)
const M = await import(`${RAIZ}/js/impresion-del-meta.js`)

console.log('── 1. Los requisitos ──')
const lineas = [{ name: 'Dragapult ex', quantity: 3 }, { name: 'Dusknoir', quantity: 1 }, { name: 'Dusknoir', set: 'SFA', number: '20', quantity: 1 }, { name: 'Mega-Lucario ex', quantity: 2 }]
check('sin mínimo, basta una copia', A.llevaLaCarta(lineas, { nombres: ['Dusknoir'] }))
check('con mínimo, se SUMAN las copias de todas sus impresiones', A.llevaLaCarta(lineas, { nombres: ['Dusknoir'], minimo: 2 }) && !A.llevaLaCarta(lineas, { nombres: ['Dusknoir'], minimo: 3 }))
check('el nombre sin guiones: «Mega-Lucario ex» casa con «Mega Lucario ex»', A.llevaLaCarta(lineas, { nombres: ['Mega Lucario ex'], minimo: 2 }))
check('y por set y número, como siempre', A.llevaLaCarta(lineas, { set: 'SFA', numero: '20' }))
const cat = [
  { id: 'dragapult-ex', nombre: 'Dragapult', requiere: [{ nombres: ['Dragapult ex'] }] },
  { id: 'dragapult-dusknoir', nombre: 'Dragapult Dusknoir', requiere: [{ nombres: ['Dragapult ex'] }, { nombres: ['Dusknoir'], minimo: 2 }] },
]
const mazo = (dusk) => ({ pokemon: [{ name: 'Dragapult ex', quantity: 3 }, { name: 'Dusknoir', quantity: dusk }], trainer: [] })
check('un Dusknoir suelto de tecnología no hace «Dragapult Dusknoir»', A.arquetipoDeMazo(mazo(1), cat).id === 'dragapult-ex')
check('  …y dos, sí', A.arquetipoDeMazo(mazo(2), cat).id === 'dragapult-dusknoir')

console.log('── 2. La migración ──')
const SQL = readFileSync(`${RAIZ}/supabase-migration-1460-arquetipos-limitless.sql`, 'utf8')
const json = /jsonb_to_recordset\('([\s\S]*?)'::jsonb\)/.exec(SQL)?.[1]?.replace(/''/g, "'")
let filas = []
try { filas = JSON.parse(json) } catch (e) { check('el JSON de la migración se lee', false, e.message) }
check('148 arquetipos', filas.length === 148, filas.length)
check('ids únicos y de Limitless (minúsculas y guiones)', new Set(filas.map((f) => f.id)).size === filas.length && filas.every((f) => /^[a-z0-9-]+$/.test(f.id)))
check('ni el Other de Limitless ni sus Basic Box (la web ya reconoce el Basic Box sola)', !filas.some((f) => f.id === 'other' || /^basic-box/.test(f.id)))
check('cada uno con requisitos (la base no deja uno sin ellos) y como mucho dos iconos con su nombre', filas.every((f) => f.requiere.length > 0 && f.requiere.every((r) => r.nombres?.length) && f.iconos.length >= 1 && f.iconos.length <= 2 && f.iconos.every((i) => i.nombre)))
check('ningún nombre de una o dos letras (filas del catálogo sin nombre de verdad)', filas.every((f) => f.requiere.every((r) => r.nombres.every((n) => n.length >= 3))))
check('nombres en inglés y en español (el export viene en el idioma de cada uno)', filas.find((f) => f.id === 'raging-bolt-ogerpon')?.requiere.some((r) => r.nombres.includes('Electrofuria ex')))
const sinCadena = SQL.replace(/'(?:[^']|'')*'/g, "''")
check('fuera de la cadena, solo el «insert into» de la tabla de verdad (el SQL Editor lee «into» con regex)', (sinCadena.match(/\binto\b/gi) || []).length === 1 && /insert into public\.tcg_archetypes/.test(sinCadena))
check('  …y dentro, ni «into» ni «$» (van escapados en el JSON)', !/into/i.test(json.replace(/\\u0069nto/g, '')) && !/\$/.test(json))
check('  …y nada de comillas en los comentarios', SQL.split('\n').filter((l) => l.trim().startsWith('--')).every((l) => !/['"]/.test(l)))
check('no pisa lo que un admin haya corregido (on conflict do nothing)', /on conflict \(id\) do nothing/.test(SQL))
// Listas de verdad de Limitless, con su arquetipo de allí.
const L = (pk, tr = []) => ({ pokemon: pk.map(([n, q]) => ({ name: n, quantity: q })), trainer: tr.map(([n, q]) => ({ name: n, quantity: q })), energy: [] })
const casos = [
  ['dragapult-dusknoir', L([['Dreepy', 4], ['Drakloak', 3], ['Dragapult ex', 2], ['Duskull', 2], ['Dusclops', 1], ['Dusknoir', 1], ['Budew', 1]])],
  ['charizard-pidgeot', L([['Charmander', 3], ['Charmeleon', 1], ['Charizard ex', 2], ['Pidgey', 2], ['Pidgeot ex', 2]])],
  ['gardevoir', L([['Ralts', 4], ['Kirlia', 3], ['Gardevoir ex', 2], ['Munkidori', 1]])],
  // En español, como sale del TCG Live de quien juega en español.
  ['raging-bolt-ogerpon', L([['Electrofuria ex', 3], ['Ogerpon Máscara Turquesa ex', 3], ['Latias ex', 1]], [['Órdenes de Jefes', 2]])],
  ['iono-bellibolt', L([["Iono's Voltorb", 4], ["Iono's Bellibolt ex", 3], ["Iono's Kilowattrel", 2]])],
]
for (const [esperado, lista] of casos) {
  const arq = A.arquetipoDeMazo(lista, filas)
  check(`«${esperado}» sale como en Limitless`, arq.id === esperado && arq.curado, `${arq.id} ${arq.nombre}`)
}
check('un mazo que no es ninguno sigue saliendo deducido, sin inventarse un arquetipo', !A.arquetipoDeMazo(L([['Bulbasaur', 4], ['Ivysaur', 3], ['Venusaur', 2]]), filas).curado)

console.log('── 3. Los números y los códigos de una lista ──')
check('«084»: tal cual, con ceros y sin ellos', JSON.stringify(C.variantesDeNumero('084')) === '["084","84"]')
check('  …y con el código delante, como numera TCGGO («SVP 149»)', C.variantesDeNumero('149', ['SVP', 'PR-SV']).includes('SVP 149') && C.variantesDeNumero('149', ['SVP']).includes('149'))
check('  …sin número, ninguna', C.variantesDeNumero('').length === 0 && C.variantesDeNumero(null).length === 0)
check('«SVP» y «PR-SV» van a `svp`, y «MEE» a `mee`', C.ALIAS_DE_CODIGO_LIVE.SVP === 'svp' && C.ALIAS_DE_CODIGO_LIVE['PR-SV'] === 'svp' && C.ALIAS_DE_CODIGO_LIVE.MEE === 'mee')
const LC = readFileSync(`${RAIZ}/js/lista-canonica.js`, 'utf8')
check('/torneo los usa (antes «SVP 149» y «DLR 084» no eran exactas)', /ALIAS_DE_CODIGO_LIVE\[clave\]/.test(LC) && /variantesDeNumero\(linea\.number/.test(LC))
const D = readFileSync(`${RAIZ}/js/constructor/datos.js`, 'utf8')
check('el constructor busca por colección y número lo que no sale por su id (las de TCGGO: «tcggo-81961»)', /cartasPorNumero\(/.test(D) && /\.in\('set_id', sets\)\.in\('local_id', numeros\)/.test(D))
check('  …y lo que encuentra por el nombre pasa por la impresión del meta', /preferirLaDelMeta\(deNombre/.test(D))
check('  …y entre las que se llaman igual, antes una de TCG Live que una de Prize Pack', /enTcgLive/.test(D) && /escalon/.test(D))

console.log('── 4. La impresión del meta ──')
const filasMeta = [
  { nombre: "Boss's Orders", seccion: 'trainer', set_codigo: 'MEG', numero: '114', mazos: 40 },
  { nombre: "Boss's Orders", seccion: 'trainer', set_codigo: 'PAL', numero: '172', mazos: 10 },
  { nombre: 'Shaymin', seccion: 'pokemon', set_codigo: 'DRI', numero: '010', mazos: 20 },
  { nombre: 'Shaymin', seccion: 'trainer', set_codigo: 'PFL', numero: '12', mazos: 500 },
]
check('de cada nombre, la impresión que más mazos suma', M.laMasJugada(M.masJugadas(filasMeta), "Boss's Orders")?.set === 'MEG')
check('  …y por sección: un Pokémon no se cuenta con un Entrenador que se llame igual', M.laMasJugada(M.masJugadas(filasMeta, { seccion: 'pokemon' }), 'Shaymin')?.set === 'DRI' && M.laMasJugada(M.masJugadas(filasMeta), 'Shaymin')?.set === 'PFL')
check('la sección de una carta del catálogo', M.seccionDeCarta({ category: 'Pokemon' }) === 'pokemon' && M.seccionDeCarta({ category: 'Trainer' }) === 'trainer' && M.seccionDeCarta({}) === null)
check('«es esa impresión» casa sin ceros ni mayúsculas', M.esLaImpresion('dri', '10', M.laMasJugada(M.masJugadas(filasMeta, { seccion: 'pokemon' }), 'Shaymin')))
// La impresión que se enseña (624) no pasa de una colección de TCG Live a un
// Prize Pack, aunque el Prize Pack sea de rareza más baja.
const { impresionMasComun } = await import(`${RAIZ}/js/impresion-canonica.js`)
const t = (id, extra = {}) => ({ id, set_id: id.split('-').slice(0, -1).join('-'), local_id: id.split('-').pop(), category: 'Trainer', image_path: `x/${id}`, regulation_mark: 'I', name: 'Arven', name_key: 'arven', ...extra })
const tef = t('sv03-186', { rarity: 'Uncommon' })
const pp = t('tg-739-186', { rarity: 'Common' })
const codigos = { sv03: 'OBF' }
check('la de TCG Live no pasa a la de un Prize Pack más común', impresionMasComun(tef, [tef, pp], { legales: ['H', 'I', 'J'], codigoDeSet: (id) => codigos[id] }).id === 'sv03-186')
check('  …y sin códigos, como antes (pasa a la más común)', impresionMasComun(tef, [tef, pp], { legales: ['H', 'I', 'J'] }).id === 'tg-739-186')
const MD = readFileSync(`${RAIZ}/js/impresion-del-meta.js`, 'utf8')
check('una consulta por nombre (juntos, la Boss\'s Orders se comía el tope de 1.000 de las demás)', /\.eq\('nombre', nombre\)/.test(MD) && /\.gte\('dia', desde\)/.test(MD))
const RI = await import(`${RAIZ}/js/repeticiones/impresion.js`)
const RD = readFileSync(`${RAIZ}/js/repeticiones/datos.js`, 'utf8')
check('las repeticiones siguen encontrándolo donde estaba (reexportado)', typeof RI.masJugadas === 'function' && typeof RI.esLaImpresion === 'function' && /export \{ impresionesDelMeta \} from '\.\.\/impresion-del-meta\.js'/.test(RD))

console.log('── 5. En PostgreSQL, como el SQL Editor ──')
const psql = (sql) => execFileSync('psql', [...PSQL, '-At', '-c', sql], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
let hayPg = true
try { psql('select 1') } catch { hayPg = false }
check(`hay un PostgreSQL en ${PSQL[1]}:${PSQL[3]}`, hayPg)
if (hayPg) {
  const esquema = 'p1460'
  psql(`drop schema if exists ${esquema} cascade; create schema ${esquema}`)
  psql(`create table ${esquema}.tcg_archetypes (id text primary key, nombre text not null, iconos jsonb not null default '[]', requiere jsonb not null default '[]', activo boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(), constraint arquetipos_con_requisitos check (jsonb_typeof(requiere) = 'array' and jsonb_array_length(requiere) > 0), constraint arquetipos_dos_iconos check (jsonb_typeof(iconos) = 'array' and jsonb_array_length(iconos) <= 2))`)
  // Lo que había a mano antes: no se pisa.
  psql(`insert into ${esquema}.tcg_archetypes (id, nombre, requiere) values ('gardevoir', 'Gardevoir a mano', '[{"nombres":["Gardevoir ex"]}]')`)
  const sentencias = SQL.replace(/--[^\n]*/g, '').split(/;\s*(?:\n|$)/).map((s) => s.trim()).filter(Boolean).map((s) => s.replace(/public\.tcg_archetypes/g, `${esquema}.tcg_archetypes`))
  let error = null
  for (let vez = 0; vez < 2 && !error; vez++) for (const s of sentencias) { try { psql(s) } catch (e) { error = String(e.stderr || e).slice(0, 300); break } }
  check('cada sentencia en su conexión, dos veces, sin error', !error, error)
  check('  …148 filas', psql(`select count(*) from ${esquema}.tcg_archetypes`) === '148')
  check('  …y la que había a mano, intacta', psql(`select nombre from ${esquema}.tcg_archetypes where id = 'gardevoir'`) === 'Gardevoir a mano')
  check('  …y el «into» escapado vuelve a ser texto normal en la base', psql(`select count(*) from ${esquema}.tcg_archetypes where requiere::text like '%u0069%'`) === '0')
  psql(`drop schema ${esquema} cascade`)
}

console.log(fails ? `\n${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
