// Tanda 963 — smL, las seis barajas de TCG Classic y svG, contra PostgreSQL de
// verdad (dos veces, y una sentencia por conexión como en el SQL Editor).
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
const MIGRACION = join(RAIZ, 'supabase-migration-963-classic-family-y-special-deck.sql')
const SQL = readFileSync(MIGRACION, 'utf8')
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 120000 })
const uno = (q) => (psql(['-t', '-A', '-d', 'prueba_963', '-c', q]).stdout || '').trim()

const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433 donde probar', hay.status === 0)
if (hay.status === 0) {
  psql(['-c', 'drop database if exists prueba_963'])
  psql(['-c', 'create database prueba_963'])
  for (const f of [join(AQUI, 'sql-tanda-963.sql'), MIGRACION, MIGRACION]) {
    const r = psql(['-v', 'ON_ERROR_STOP=1', '-d', 'prueba_963', '-f', f])
    check(`carga ${f.split('/').pop()}`, r.status === 0, (r.stderr || '').split('\n').find((l) => /ERROR/.test(l)) || '')
  }
  const cartas = (id, m) => Number(uno(`select count(*) from tcg_cards where set_id = '${id}' and market = '${m}'`))
  check('smL: 51 cartas, en la era de Sol y Luna, del 15-3-2019', cartas('sml_ja', 'JP') === 51 && uno(`select serie_id || ' ' || release_date from tcg_sets where id = 'sml_ja'`) === 'SM 2019-03-15')
  check('svG: 52 (49 y las tres a toda carta), era SV', cartas('svg_ja', 'JP') === 52 && uno(`select serie_id || ' ' || card_count_official || '/' || card_count_total from tcg_sets where id = 'svg_ja'`) === 'SV 49/52')
  check('las tres barajas japonesas de Classic: 34 cada una, sin día, era SV', ['clf_ja', 'cll_ja', 'clk_ja'].every((id) => cartas(id, 'JP') === 34) && uno(`select string_agg(distinct coalesce(release_date::text, 'sin') || ' ' || serie_id, ',') from tcg_sets where id like 'cl%_ja'`) === 'sin SV')
  check('  …con las energías por sus letras (GRA, FIG…)', uno(`select string_agg(local_id, ',' order by local_id) from tcg_cards where set_id = 'clf_ja' and category = 'Energy'`) === '032,FIG,GRA')
  check('CLV y CLB en el occidental, 34 cada una, del 17-11-2023', cartas('clv', 'WEST') === 34 && cartas('clb', 'WEST') === 34 && uno(`select release_date from tcg_sets where id = 'clv'`) === '2023-11-17')
  check('CLC NO se crea: ya hay otro set con ese código (el guarda)', uno(`select count(*) from tcg_sets where id = 'clc'`) === '0' && cartas('clc', 'WEST') === 0)
  check('  …y la tabla del final lo dice', /no creada: tcggo-999/.test(psql(['-t', '-A', '-d', 'prueba_963', '-f', MIGRACION]).stdout || ''))
  check('ejecutarla dos veces no repite nada', uno('select count(*) from tcg_cards') === String(51 + 52 + 34 * 5) && uno("select count(*) from tcg_sets where origen = 'mano'") === '7')
  check('todo nace a mano', uno("select count(*) from tcg_cards where origen is distinct from 'mano'") === '0')
  check('los Pokémon llevan tipo y Pokédex; los entrenadores y energías, no', uno("select count(*) from tcg_cards where category = 'Pokemon' and (types is null or dex_ids is null)") === '0' && uno("select count(*) from tcg_cards where category <> 'Pokemon' and (types is not null or dex_ids is not null)") === '0')
  check('  …Lugia ex es la 249 y el Rattata de Lt. Surge la 19', uno("select dex_ids[1] from tcg_cards where id = 'clv-017'") === '249' && uno("select dex_ids[1] from tcg_cards where id = 'clb-015'") === '19')
  check('las listas siguen el orden de Bulbapedia (CLF 018 Super Rod, CLV 018 Bill)', uno("select name from tcg_cards where id = 'clf_ja-018'") === 'Super Rod' && uno("select name from tcg_cards where id = 'clv-018'") === 'Bill')
  check('idiomas: Classic occidental solo en inglés; el japonés también en coreano y chino', uno("select string_agg(idioma, ',' order by idioma) from tcg_set_idiomas_mano where set_id = 'clv' and hay") === 'en' && uno("select string_agg(idioma, ',' order by idioma) from tcg_set_idiomas_mano where set_id = 'clk_ja' and hay") === 'ja,ko,zh')
  psql(['-c', 'drop database if exists prueba_963'])
}
check('la migración no usa tablas temporales (la 631)', !/create\s+temp/i.test(SQL))
console.log(fails ? `\n❌ ${fails} fallo(s)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
