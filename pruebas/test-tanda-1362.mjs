// Tanda 1362 — Delta Reign sin su cuenta de cartas.
//
// PINGU: «¿por qué Delta Reign está diferente?». Nació escondida y sin
// cuenta (756) y nadie se la ponía al llegar sus cartas. Se mira: el
// catálogo, al escribir las cartas de un set sin cuenta, le pone la de las
// cartas que tiene, con el filtro «solo si está vacía» en la escritura; a un
// set con cuenta no lo toca; y la migración rellena los de TCGGO vacíos, no
// pisa nada y se puede ejecutar dos veces.
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const { procesar, CLAVE_ESTADO } = await import(`${RAIZ}/netlify/functions/tcggo-catalogo.mjs`)
const { CLAVE_ESTADO: CLAVE_PARES } = await import(`${RAIZ}/netlify/functions/tcggo-emparejar.mjs`)
const { resumirEpisodio } = await import(`${RAIZ}/netlify/lib/tcggo.mjs`)

console.log('── 1. El catálogo le pone la cuenta al set que nació sin ella ──')
const ENV = { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0' }
async function pasada({ cuenta = null, oficial = null } = {}) {
  const DELTA = { id: 437, name: 'Delta Reign', released_at: '2026-11-06', code: 'DLR', cards_total: 3, cards_printed_total: 0 }
  const AHORA = new Date('2026-11-15T10:00:00Z')
  const estados = { [CLAVE_PARES]: { episodios: { fecha: AHORA.toISOString(), lista: [resumirEpisodio(DELTA)] }, hechos: {} }, [CLAVE_ESTADO]: { episodiosJp: { fecha: AHORA.toISOString(), lista: [] } } }
  const sets = [{ id: 'tcggo-437', name: 'Delta Reign', name_en: 'Delta Reign', tcg_online_code: 'DLR', serie_id: 'me', tcggo_id: 437, oculto: false, card_count_total: cuenta, card_count_official: oficial }]
  const cartas = [{ id: 'tcggo-1', set_id: 'tcggo-437', local_id: '1', name: 'Heracross' }]
  const parches = []
  const lecturas = []
  const b = {
    fetchImpl: async (url) => {
      const u = new URL(url)
      const page = (data) => ({ ok: true, status: 200, text: async () => JSON.stringify({ data, paging: { current: 1, total: 1, per_page: 100 } }) })
      if (u.pathname.endsWith('/episodes')) return page([])
      if (Number(u.searchParams.get('episode_id')) === 437) return page([
        { id: 1, name: 'Heracross', card_number: '1', cardmarket_id: 1001, type: 'singles' },
        { id: 2, name: 'Surskit', card_number: '2', cardmarket_id: 1002, type: 'singles' },
        { id: 3, name: 'Masquerain', card_number: '3', cardmarket_id: 1003, type: 'singles' },
      ])
      return { ok: false, status: 404, text: async () => 'no' }
    },
    restImpl: async (ruta, opciones = null) => {
      const r = decodeURIComponent(ruta)
      if (opciones?.method === 'PATCH') { parches.push({ ruta: r, cuerpo: JSON.parse(opciones.body) }); return null }
      if (r.startsWith('tcg_sets?')) return /market=eq\.WEST/.test(r) ? sets.map((s) => ({ ...s })) : []
      if (r.startsWith('tcg_cards?')) { lecturas.push(r); return /set_id=eq\./.test(r) ? cartas.filter((c) => r.includes(`set_id=eq.${c.set_id}`)) : cartas.map((c) => ({ ...c })) }
      throw new Error(`ruta inesperada ${r}`)
    },
    guardarCartasImpl: async (filas) => { for (const f of filas) if (!cartas.some((c) => c.id === f.id)) cartas.push(f); return filas.length },
    crearSetsImpl: async () => 0,
    estadoImpl: async (k) => JSON.parse(JSON.stringify(estados[k] || {})),
    guardarEstadoImpl: async (k, v) => { estados[k] = JSON.parse(JSON.stringify(v)) },
  }
  const r = await procesar({ env: ENV, ...b, pausa: async () => {}, ahora: AHORA })
  return { r, parches, lecturas, cartas, estado: estados[CLAVE_ESTADO] }
}
{
  const { r, parches, cartas, estado } = await pasada()
  const p = parches.find((x) => 'card_count_total' in x.cuerpo)
  check('la pasada va bien y escribe sus cartas', r.ok && cartas.length === 3, JSON.stringify(r).slice(0, 300))
  check('el set sin cuenta recibe la de sus cartas (3)', p && p.cuerpo.card_count_total === 3, JSON.stringify(parches))
  check('  …con «solo si está vacía» en la propia escritura', p && /id=eq\.tcggo-437/.test(p.ruta) && /card_count_total=is\.null/.test(p.ruta), p?.ruta)
  check('  …y se apunta en el estado (para /admin)', estado?.cuentasPuestas?.['WEST:tcggo-437'] === 3, JSON.stringify(estado?.cuentasPuestas))
}
{
  const { parches } = await pasada({ cuenta: 141 })
  check('un set que ya tiene cuenta no se toca', !parches.some((x) => 'card_count_total' in x.cuerpo), JSON.stringify(parches))
  const { parches: p2 } = await pasada({ oficial: 132 })
  check('ni uno que solo tiene la impresa', !p2.some((x) => 'card_count_total' in x.cuerpo), JSON.stringify(p2))
}

console.log('\n── 2. La migración, contra PostgreSQL ──')
{
  const PG = { ...process.env, PGUSER: 'postgres', PGHOST: '/var/tmp', PGPORT: '5433' }
  const psql = (sql, db = 'p1362') => execFileSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-At', '-d', db, '-c', sql], { env: PG, encoding: 'utf8' }).trim()
  try {
    execFileSync('psql', ['-X', '-q', '-d', 'postgres', '-c', 'drop database if exists p1362', '-c', 'create database p1362'], { env: PG, encoding: 'utf8' })
  } catch (e) {
    check('PostgreSQL arrancado (pg_ctl -D /var/tmp/pgdata … start)', false, String(e.message).slice(0, 160))
    process.exit(1)
  }
  psql(`create table public.tcg_sets (id text, market text default 'WEST', name text, release_date date, card_count_total int, card_count_official int, tcggo_id int, primary key (id, market));
        create table public.tcg_cards (id text, market text default 'WEST', set_id text, primary key (id, market));
        insert into public.tcg_sets values
          ('tcggo-437','WEST','Delta Reign', current_date - 9, null, null, 437),
          ('me3','WEST','Ascended Heroes', current_date - 100, 295, 217, 400),
          ('vacia','WEST','Una próxima', current_date + 30, null, null, 999),
          ('sv-x','WEST','Una de TCGdex sin cuenta', current_date - 50, null, null, null),
          ('soloimpresa','WEST','Con la impresa', current_date - 40, null, 99, 401);
        insert into public.tcg_cards (id, set_id) select 'd'||g, 'tcggo-437' from generate_series(1,141) g;
        insert into public.tcg_cards (id, set_id) select 'a'||g, 'me3' from generate_series(1,10) g;
        insert into public.tcg_cards (id, set_id) select 's'||g, 'sv-x' from generate_series(1,5) g;
        insert into public.tcg_cards (id, set_id) select 'i'||g, 'soloimpresa' from generate_series(1,7) g;`)
  const sql = readFileSync(`${RAIZ}/supabase-migration-1362-cuenta-de-sets-nuevos.sql`, 'utf8')
  const f = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/m1362.sql'
  writeFileSync(f, sql)
  const correr = () => execFileSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-At', '-d', 'p1362', '-f', f], { env: PG, encoding: 'utf8' })
  const salida = correr()
  const fila = (id) => psql(`select coalesce(card_count_total::text,'-')||'|'||coalesce(card_count_official::text,'-') from public.tcg_sets where id='${id}'`)
  check('Delta Reign: 141, la impresa sin inventar', fila('tcggo-437') === '141|-', fila('tcggo-437'))
  check('Ascended Heroes (con cuenta): intacta', fila('me3') === '295|217', fila('me3'))
  check('la próxima sin cartas: sigue vacía', fila('vacia') === '-|-', fila('vacia'))
  check('un set que no es de TCGGO: no se toca', fila('sv-x') === '-|-', fila('sv-x'))
  check('uno con solo la impresa: no se toca', fila('soloimpresa') === '-|99', fila('soloimpresa'))
  check('el SELECT final lista Delta Reign con su cuenta', /tcggo-437\|Delta Reign\|[\d-]+\|141\|/.test(salida), salida)
  let segunda = true
  try { correr() } catch { segunda = false }
  check('se puede ejecutar dos veces', segunda && fila('tcggo-437') === '141|-')
  execFileSync('psql', ['-X', '-q', '-d', 'postgres', '-c', 'drop database if exists p1362'], { env: PG })
}

console.log(fails ? `\n${fails} FALLAN` : '\nTodo bien')
process.exit(fails ? 1 : 0)
