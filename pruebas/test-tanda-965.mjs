// Tanda 965 — Reviving Legends (japonés) vuelve a «1st Edition» y «Unlimited»
// (la lógica de la 951), contra PostgreSQL de verdad y dos veces.
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const MIGRACION = join(RAIZ, 'supabase-migration-965-reviving-legends-versiones.sql')
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 120000 })
const uno = (q) => (psql(['-t', '-A', '-d', 'prueba_965', '-c', q]).stdout || '').trim()
check('hay un PostgreSQL donde probar', psql(['-c', 'select 1']).status === 0)
psql(['-c', 'drop database if exists prueba_965'])
psql(['-c', 'create database prueba_965'])
for (const f of [join(AQUI, 'sql-tanda-965.sql'), MIGRACION]) {
  const r = psql(['-v', 'ON_ERROR_STOP=1', '-d', 'prueba_965', '-f', f])
  check(`carga ${f.split('/').pop()}`, r.status === 0, (r.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
}
const copia = uno("select valor::text from scrydex_estado where clave = 'reviving_legends_965'")
const r2 = psql(['-v', 'ON_ERROR_STOP=1', '-d', 'prueba_965', '-f', MIGRACION])
check('se puede ejecutar dos veces', r2.status === 0, r2.stderr)
const de = (card) => uno(`select string_agg(etiqueta, ',' order by tcggo_id desc) from tcg_card_versions where card_id = '${card}' and origen in ('edicion','mano')`)
check('cada carta, con 1st Edition y Unlimited y nada más', de('L2-001') === '1st Edition,Unlimited' && de('L2-002') === '1st Edition,Unlimited', `${de('L2-001')} | ${de('L2-002')}`)
check('  …las de la 951, no unas nuevas', uno("select string_agg(tcggo_id::text, ',' order by tcggo_id desc) from tcg_card_versions where card_id in ('L2-001','L2-002') and origen = 'edicion'") === '-10,-11,-12,-13')
check('a la que le faltaban se le ponen, la Unlimited con su producto', de('L2-003') === '1st Edition,Unlimited' && uno("select cm_id_product from tcg_card_versions where card_id = 'L2-003' and etiqueta = 'Unlimited'") === '5003', de('L2-003'))
check('la de TCGGO no se toca', uno("select count(*) from tcg_card_versions where tcggo_id = 777") === '1')
check('otro set no se toca', uno("select count(*) from tcg_card_versions where card_id = 'L1-001'") === '1' && uno("select variante from user_collection where card_id = 'L1-001'") === 'normal')
check('las copias van a la que queda (1.ª edición → 1st Edition, lo demás → Unlimited)', uno("select string_agg(variante, ',' order by id) from user_collection where card_id like 'L2-%'") === 'primera,unlimited,primera,unlimited', uno("select string_agg(variante, ',' order by id) from user_collection where card_id like 'L2-%'"))
check('queda copia de lo que había, para deshacerlo', /1st Edition Reverse Holo/.test(copia) && /"borradas": 6/.test(copia), copia.slice(0, 200))
check('  …y la segunda pasada no la pisa', uno("select valor::text from scrydex_estado where clave = 'reviving_legends_965'") === copia)
psql(['-c', 'drop database if exists prueba_965'])
console.log(fails ? `\n❌ ${fails} fallo(s)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
