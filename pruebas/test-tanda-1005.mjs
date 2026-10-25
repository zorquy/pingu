// Tanda 1005 — las versiones «Trick or Trade 2023» y «2024», por migración.
//
// PINGU: «métele una variante que se llame Trick or Trade y el año… salieron
// en Trick or Trade BOOster Bundle». Contra PostgreSQL de verdad, con la 885 y
// la 934 debajo: casa cada carta por colección y número (con o sin ceros, y
// una colección que solo casa por su código y su cuenta), prefiere la carta
// original a una «tcggo-…» que repite el número, copia la clase y el icono de
// la Trick or Trade 2022 que ya hizo PINGU, avisa de lo que no encuentra y no
// repite nada si se ejecuta dos veces.
import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const AQUI = dirname(fileURLToPath(import.meta.url))
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const MIGRACION = join(RAIZ, 'supabase-migration-1005-trick-or-trade.sql')
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 400) : ''}`)
}
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
if (psql(['-c', 'select 1']).status !== 0) { console.log('  FALLA  no hay PostgreSQL en 5433'); process.exit(1) }

// Las filas de la propia migración: (etiqueta, set, código, total, número, nombre).
const sql = readFileSync(MIGRACION, 'utf8')
const filas = [...sql.matchAll(/\('(Trick or Trade 20\d\d)', '([^']+)', +'([A-Z]+)', +(\d+), '(\d+)', '([^']+)'\)/g)].map((m) => ({ etiqueta: m[1], set: m[2], codigo: m[3], total: +m[4], numero: m[5], nombre: m[6] }))
check('la lista: 30 de 2023 y 30 de 2024', filas.filter((f) => f.etiqueta.endsWith('2023')).length === 30 && filas.filter((f) => f.etiqueta.endsWith('2024')).length === 30, filas.length)
check('  …sin una carta dos veces en el mismo año', new Set(filas.map((f) => `${f.etiqueta}|${f.set}|${f.numero}`)).size === filas.length)

// El catálogo de mentira: Rebel Clash con otro id (casa por RCL + 192), los de
// Espada y Escudo sin ceros delante, Iron Jugulis con el nombre en español, un
// Houndoom «tcggo-» que repite el 034 de SVI, y sin el Okidogi.
const q = (s) => `'${String(s).replace(/'/g, "''")}'`
const sets = new Map()
for (const f of filas) sets.set(f.set, f)
const lineas = []
for (const [id, f] of sets) {
  const nuestro = id === 'swsh2' ? 'swsh2-otro' : id
  lineas.push(`insert into public.tcg_sets (id, name, tcg_online_code, card_count_official) values (${q(nuestro)}, ${q(f.codigo)}, ${q(f.codigo)}, ${f.total});`)
}
const vistas = new Set()
for (const f of filas) {
  const set = f.set === 'swsh2' ? 'swsh2-otro' : f.set
  const local = f.set.startsWith('swsh') ? String(Number(f.numero)) : f.numero
  const id = `${set}-${local}`
  if (vistas.has(id) || (f.set === 'sv06' && f.numero === '111')) continue
  vistas.add(id)
  const nombre = f.nombre === 'Iron Jugulis' ? 'Ferrocuello' : f.nombre === 'Runerigus' ? 'Galarian Runerigus' : f.nombre
  lineas.push(`insert into public.tcg_cards (id, set_id, local_id, name) values (${q(id)}, ${q(set)}, ${q(local)}, ${q(nombre)});`)
}
lineas.push(`insert into public.tcg_cards (id, set_id, local_id, name) values ('tcggo-999', 'sv01', '034', 'Houndoom');`)
lineas.push(`insert into public.tcg_cards (id, set_id, local_id, name) values ('sv01-010', 'sv01', '010', 'Otra');`)
lineas.push(`insert into public.tcg_card_versions (tcggo_id, card_id, set_id, etiqueta, clase, icono, origen) values (-1, 'sv01-010', 'sv01', 'Trick or Trade 2022', 'adicional', 'calabaza', 'mano');`)
// Una que ya estaba metida a mano: no se repite.
lineas.push(`insert into public.tcg_card_versions (tcggo_id, card_id, set_id, etiqueta, clase, origen) values (-2, 'sv02-062', 'sv02', 'Trick or Trade 2023', 'sello', 'mano');`)
lineas.push(`select setval('public.tcg_card_versions_mano_seq', 5);`)
const fixture = join(AQUI, '.fixture-1005.sql')
writeFileSync(fixture, lineas.join('\n'))

const DB = 'prueba_1005'
psql(['-c', `drop database if exists ${DB}`])
psql(['-c', `create database ${DB}`])
try {
  for (const f of [join(AQUI, 'sql-tanda-885.sql'), join(RAIZ, 'supabase-migration-885-catalogo-correcciones.sql'), join(AQUI, 'sql-tanda-934.sql'), join(RAIZ, 'supabase-migration-934-versiones-a-mano.sql'), fixture]) {
    const r = psql(['-d', DB, '-f', f])
    if (r.status !== 0) throw new Error(`${f}: ${r.stderr}`)
  }
  // Como en el SQL Editor: la migración entera, que es UNA sentencia.
  // La migración son dos sentencias (el `do` y la cuenta): cada una por su lado,
  // como en el SQL Editor (la 631).
  const [hacer, contar] = sql.split(/\n\$\$;\n/).map((x, i) => (i === 0 ? x + '\n$$;' : x))
  const una = psql(['-d', DB, '-c', hacer])
  check('el `do` corre solo, en su sentencia', una.status === 0, una.stderr)
  const cuenta = psql(['-t', '-A', '-F', '|', '-d', DB, '-c', contar])
  check('  …y la cuenta de después, en la suya: 30 de 2023 (con la que ya estaba) y 29 de 2024', cuenta.stdout.trim() === 'Trick or Trade 2023|30|Trick or Trade BOOster Bundle 2023|2023-09-01\nTrick or Trade 2024|29|Trick or Trade BOOster Bundle 2024|2024-08-30', cuenta.stdout + cuenta.stderr)
  const avisos = una.stderr
  check('dice lo que ha hecho: 58 creadas, 1 ya estaba, 1 sin encontrar', /58 creadas, 1 ya estaban, 1 sin encontrar/.test(avisos), avisos.split('\n').filter((l) => /creadas/.test(l)).join(' '))
  check('  …avisa del Okidogi que no está', /NO ENCONTRADA: Trick or Trade 2024 · 111\/167 Okidogi/.test(avisos))
  check('  …y del nombre que no casa (en español), creándola igual', /MIRAR EL NOMBRE: Trick or Trade 2024 · 139\/162 esperaba «Iron Jugulis» y es «Ferrocuello»/.test(avisos))
  const leer = (consulta) => psql(['-t', '-A', '-F', '|', '-d', DB, '-c', consulta]).stdout.trim()
  check('Rebel Clash casado por su código y su cuenta', leer(`select card_id from tcg_card_versions where etiqueta = 'Trick or Trade 2023' and set_id = 'swsh2-otro'`) === 'swsh2-otro-102')
  check('los de Espada y Escudo sin ceros delante («89» por «089»)', leer(`select card_id from tcg_card_versions where etiqueta = 'Trick or Trade 2023' and set_id = 'swsh1' order by card_id`) === 'swsh1-89\nswsh1-90')
  check('el Houndoom de SVI es el original, no la «tcggo-» del mismo número', leer(`select string_agg(card_id, ',') from tcg_card_versions where etiqueta = 'Trick or Trade 2023' and set_id = 'sv01' and card_id like '%034'`) === 'sv01-034')
  const una2024 = leer(`select etiqueta, salio_en, lanzamiento, clase, icono, origen, (tcggo_id < 0)::text from tcg_card_versions where card_id = 'sv06-024'`)
  check('una de 2024: su nombre, dónde salió, el 30 de agosto, la clase y el icono de la 2022, a mano y con id negativo', una2024 === 'Trick or Trade 2024|Trick or Trade BOOster Bundle 2024|2024-08-30|adicional|calabaza|mano|true', una2024)
  const una2023 = leer(`select salio_en, lanzamiento from tcg_card_versions where card_id = 'sv02-097'`)
  check('una de 2023: BOOster Bundle 2023, el 1 de septiembre de 2023', una2023 === 'Trick or Trade BOOster Bundle 2023|2023-09-01', una2023)
  check('el Pikachu de PAL que ya la tenía sigue con UNA', leer(`select count(*) from tcg_card_versions where card_id = 'sv02-062'`) === '1')
  check('los ids no chocan con los de antes de la secuencia', leer(`select count(*) from tcg_card_versions where tcggo_id between -5 and -1`) === '2')
  const otra = psql(['-d', DB, '-c', sql])
  check('otra vez: no crea nada', otra.status === 0 && /0 creadas, 59 ya estaban, 1 sin encontrar/.test(otra.stderr), otra.stderr.split('\n').filter((l) => /creadas/.test(l)).join(' '))
  // Sin ninguna 2022, la clase es «sello».
  psql(['-d', DB, '-c', `delete from tcg_card_versions where etiqueta like 'Trick or Trade 202_' and etiqueta <> 'Trick or Trade 2022'; delete from tcg_card_versions where etiqueta = 'Trick or Trade 2022';`])
  psql(['-d', DB, '-c', sql])
  check('sin una 2022 de la que copiar: «sello» y sin icono', leer(`select clase || '|' || coalesce(icono, '') from tcg_card_versions where card_id = 'sv06-024'`) === 'sello|')
} catch (e) {
  check('montar la base', false, e.message)
} finally {
  psql(['-c', `drop database if exists ${DB}`])
  spawnSync('rm', ['-f', fixture])
}
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
