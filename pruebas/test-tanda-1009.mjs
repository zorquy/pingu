// Tanda 1009 — las cuatro barajas de «My First Battle», por migración.
// Contra PostgreSQL de verdad (con la 885 debajo), cada sentencia en su
// conexión como en el SQL Editor (la 631), y dos veces.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const MIGRACION = join(RAIZ, 'supabase-migration-1009-my-first-battle.sql')
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
if (psql(['-c', 'select 1']).status !== 0) { console.log('  FALLA  no hay PostgreSQL en 5433'); process.exit(1) }
const sql = readFileSync(MIGRACION, 'utf8')
check('sin tablas temporales', !/create\s+temp(orary)?\s+table/i.test(sql))
// Las sentencias, sin los comentarios de cabecera: terminan en «;» a final de línea.
const sentencias = sql.replace(/^--.*$/gm, '').split(/;\s*$/m).map((s) => s.trim()).filter(Boolean)
check('tres sentencias (sets, cartas, cuenta)', sentencias.length === 3, sentencias.length)
const DB = 'prueba_1009'
psql(['-c', `drop database if exists ${DB}`])
psql(['-c', `create database ${DB}`])
try {
  for (const f of [join(AQUI, 'sql-tanda-885.sql'), join(RAIZ, 'supabase-migration-885-catalogo-correcciones.sql')]) {
    const r = psql(['-d', DB, '-f', f])
    if (r.status !== 0) throw new Error(`${f}: ${r.stderr}`)
  }
  psql(['-d', DB, '-c', "insert into public.tcg_sets (id, name, serie_id) values ('sv01', 'Scarlet & Violet', 'sv')"])
  const leer = (q) => psql(['-t', '-A', '-F', '|', '-d', DB, '-c', q]).stdout.trim()
  for (const vez of [1, 2]) {
    const rs = sentencias.map((s) => psql(['-t', '-A', '-F', '|', '-d', DB, '-c', s]))
    check(`vez ${vez}: cada sentencia corre sola`, rs.every((r) => r.status === 0), rs.map((r) => r.stderr).join(' '))
    check(`  …y la cuenta dice cuatro de doce`, rs[2].stdout.trim() === 'My First Battle: Bulbasaur Deck|12\nMy First Battle: Charmander Deck|12\nMy First Battle: Pikachu Deck|12\nMy First Battle: Squirtle Deck|12', rs[2].stdout)
  }
  check('las colecciones: a mano, visibles, en la era de Escarlata y Púrpura, 12 cartas', leer("select string_agg(distinct origen || ',' || oculto || ',' || serie_id || ',' || card_count_official, ' ') from tcg_sets where id like 'mfb-%'") === 'mano,false,sv,12')
  check('el primer Pokémon es otra carta y lo dice', leer("select name || '|' || name_es || '|' || local_id || '|' || dex_ids[1] || '|' || types[1] from tcg_cards where id = 'mano-mfb-pikachu-1'") === 'Pikachu (First Pokémon)|Pikachu (primer Pokémon)|1|25|Lightning')
  check('  …y su gemela, la 2', leer("select name || '|' || local_id from tcg_cards where id = 'mano-mfb-pikachu-2'") === 'Pikachu|2')
  check('las de entrenador: Poción y Cambio, objetos', leer("select string_agg(name_es || ':' || category || ':' || trainer_type, ',' order by local_id::int) from tcg_cards where set_id = 'mfb-squirtle' and category = 'Trainer'") === 'Poción:Trainer:Item,Cambio:Trainer:Item')
  check('las dos energías, la inicial aparte', leer("select string_agg(name_es || ':' || energy_type, ',' order by local_id::int) from tcg_cards where set_id = 'mfb-charmander' and category = 'Energy'") === 'Energía Fuego (energía inicial):Basic,Energía Fuego:Basic')
  check('todas a mano, en Normal y sin foto inventada', leer("select count(*) from tcg_cards where set_id like 'mfb-%' and origen = 'mano' and variants = '{\"normal\": true}'::jsonb and image_path is null") === '48')
} catch (e) {
  check('montar la base', false, e.message)
} finally {
  psql(['-c', `drop database if exists ${DB}`])
}
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
