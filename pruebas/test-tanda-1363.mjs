// Tanda 1363 — Lo nuevo de la API de TCGGO: la clase y la fase de cada carta
// (A) y el logo de cada era (B).
//
// Se mira: `fichaDeJuegoDe` traduce `card_type`/`card_subtype` a nuestros
// valores y no inventa lo que no reconoce; la fila de carta y la de set
// llevan lo nuevo; el catálogo apunta qué clases llegan; la estantería pone
// el logo de la expansión más nueva de cada era y la web pide la columna como
// opcional; y la migración, contra PostgreSQL con las tablas de hoy (y el
// disparador de correcciones), solo rellena lo vacío, no le cuelga un «Item»
// a un Pokémon, guarda el logo de la era y se puede ejecutar dos veces.
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const S = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
const tcggo = await import(`${RAIZ}/netlify/lib/tcggo.mjs`)
const { fichaDeJuegoDe, filaDeCartaTcggo, resumirEpisodio, filaDeSetTcggo } = tcggo

console.log('── 1. La clase y la fase, a nuestros valores ──')
{
  const casos = [
    [{ card_type: 'Pokémon', card_subtype: 'Basic' }, 'Pokemon|-|Basic|-'],
    [{ card_type: 'Pokemon', card_subtype: 'Stage 1' }, 'Pokemon|-|Stage1|-'],
    [{ card_type: 'Pokémon', card_subtype: 'Stage 2' }, 'Pokemon|-|Stage2|-'],
    [{ card_type: 'Supporter', card_subtype: null }, 'Trainer|Supporter|-|-'],
    [{ card_type: 'Trainer', card_subtype: 'Item' }, 'Trainer|Item|-|-'],
    [{ card_type: 'Pokémon Tool' }, 'Trainer|Tool|-|-'],
    [{ card_type: 'Stadium' }, 'Trainer|Stadium|-|-'],
    [{ card_type: 'Energy', card_subtype: 'Special' }, 'Energy|-|-|Special'],
    [{ card_type: 'Basic Energy' }, 'Energy|-|-|Normal'],
    // Lo que no se reconoce se queda vacío: un VMAX no es «Basic» ni «Stage1».
    [{ card_type: 'Pokémon', card_subtype: 'VMAX' }, 'Pokemon|-|-|-'],
    [{ card_type: 'Action' }, '-|-|-|-'],
    // Sin `card_type`, lo de siempre (el `supertype`).
    [{ supertype: 'Trainer' }, 'Trainer|-|-|-'],
    [{}, '-|-|-|-'],
  ]
  const txt = (f) => [f.category, f.trainer_type, f.stage, f.energy_type].map((x) => x ?? '-').join('|')
  for (const [carta, esperado] of casos) check(`${JSON.stringify(carta)} → ${esperado}`, txt(fichaDeJuegoDe(carta)) === esperado, txt(fichaDeJuegoDe(carta)))
  const fila = filaDeCartaTcggo({ id: 81898, name: 'Mega Rayquaza ex', card_number: 138, card_type: 'Pokémon', card_subtype: 'Basic' }, { setId: 'tcggo-437' })
  check('la fila de una carta lleva clase y fase', fila.category === 'Pokemon' && fila.stage === 'Basic' && fila.trainer_type === null && 'energy_type' in fila, JSON.stringify(fila))
}

console.log('\n── 2. El logo de la era, del episodio a la fila del set ──')
{
  // La forma del anuncio de TCGGO (Discord, 2026-11-14): `series` anidado con `logo`.
  const e = resumirEpisodio({ id: 437, name: 'Delta Reign', code: 'DLR', series: { id: 17, name: 'Mega Evolution', slug: 'mega-evolution', lang: 'en', logo: 'https://images.tcggo.com/tcggo/storage/1/mega-evolution.png' } })
  check('el resumen guarda el logo de la serie', e.serieLogo === 'https://images.tcggo.com/tcggo/storage/1/mega-evolution.png', JSON.stringify(e))
  check('sin logo (null) o sin serie, null', resumirEpisodio({ id: 1, series: { name: 'X', logo: null } }).serieLogo === null && resumirEpisodio({ id: 2 }).serieLogo === null)
  check('una dirección que no es http no entra', resumirEpisodio({ id: 3, series: { logo: 'javascript:alert(1)' } }).serieLogo === null)
  const f = filaDeSetTcggo('tcggo-437', e)
  check('la fila del set lleva `logo_serie`', f.logo_serie === e.serieLogo, JSON.stringify(f))
}

console.log('\n── 3. El catálogo apunta qué clases llegan ──')
{
  const { procesar, CLAVE_ESTADO } = await import(`${RAIZ}/netlify/functions/tcggo-catalogo.mjs`)
  const { CLAVE_ESTADO: CLAVE_PARES } = await import(`${RAIZ}/netlify/functions/tcggo-emparejar.mjs`)
  const AHORA = new Date('2026-11-15T10:00:00Z')
  const estados = { [CLAVE_PARES]: { episodios: { fecha: AHORA.toISOString(), lista: [resumirEpisodio({ id: 437, name: 'Delta Reign', code: 'DLR', cards_total: 2, released_at: '2026-11-06' })] }, hechos: {} }, [CLAVE_ESTADO]: { episodiosJp: { fecha: AHORA.toISOString(), lista: [] } } }
  const sets = [{ id: 'tcggo-437', name: 'Delta Reign', tcg_online_code: 'DLR', tcggo_id: 437, oculto: false, card_count_total: 141 }]
  const guardadas = []
  const r = await procesar({
    env: { SUPABASE_SERVICE_ROLE_KEY: 's', TCGGO_API_KEY: 'k', TCGGO_PAUSA_MS: '0' },
    fetchImpl: async (url) => {
      const page = (data) => ({ ok: true, status: 200, text: async () => JSON.stringify({ data, paging: { current: 1, total: 1, per_page: 100 } }) })
      if (new URL(url).pathname.endsWith('/episodes')) return page([])
      return page([
        { id: 81898, name: 'Mega Rayquaza ex', card_number: 138, cardmarket_id: 918982, type: 'singles', card_type: 'Pokémon', card_subtype: 'Basic' },
        { id: 81899, name: 'Lisia', card_number: 139, cardmarket_id: 918983, type: 'singles', card_type: 'Supporter', card_subtype: null },
      ])
    },
    restImpl: async (ruta, opciones = null) => {
      const r = decodeURIComponent(ruta)
      if (opciones?.method === 'PATCH') return null
      if (r.startsWith('tcg_sets?')) return /market=eq\.WEST/.test(r) ? sets.map((s) => ({ ...s })) : []
      if (r.startsWith('tcg_cards?')) return []
      throw new Error(`ruta inesperada ${r}`)
    },
    guardarCartasImpl: async (filas) => { guardadas.push(...filas); return filas.length },
    crearSetsImpl: async () => 0,
    estadoImpl: async (k) => JSON.parse(JSON.stringify(estados[k] || {})),
    guardarEstadoImpl: async (k, v) => { estados[k] = JSON.parse(JSON.stringify(v)) },
    pausa: async () => {},
    ahora: AHORA,
  })
  const ray = guardadas.find((f) => f.tcggo_id === 81898)
  const lisia = guardadas.find((f) => f.tcggo_id === 81899)
  check('la pasada va bien', r.ok, JSON.stringify(r).slice(0, 200))
  check('las cartas se escriben con su clase y su fase', ray?.category === 'Pokemon' && ray?.stage === 'Basic' && lisia?.category === 'Trainer' && lisia?.trainer_type === 'Supporter', JSON.stringify(guardadas))
  const tipos = estados[CLAVE_ESTADO].tiposDeCarta || {}
  check('y el estado dice qué valores han llegado', tipos['Pokémon · Basic'] === 1 && tipos['Supporter · —'] === 1, JSON.stringify(tipos))
}

console.log('\n── 4. La estantería: el logo de la expansión más nueva de cada era ──')
{
  const { erasDeEstanteria } = await import(`${RAIZ}/js/mi-coleccion/estanteria.js`)
  const L = (n) => `https://images.tcggo.com/tcggo/storage/${n}/serie.png`
  const eras = erasDeEstanteria([
    { id: 'me1', serie_id: 'me', name: 'Mega Evolution', release_date: '2025-09-26', logo_serie_tcggo: L(1) },
    { id: 'dlr', serie_id: 'me', name: 'Delta Reign', release_date: '2026-11-06', logo_serie_tcggo: L(2) },
    { id: 'pbl', serie_id: 'me', name: 'Pitch Black', release_date: '2026-07-17', logo_serie_tcggo: null },
    { id: 'sv1', serie_id: 'sv', name: 'Scarlet & Violet', release_date: '2023-03-31' },
  ])
  const me = eras.find((e) => e.id === 'me')
  const sv = eras.find((e) => e.id === 'sv')
  check('la era coge el logo de su expansión más nueva que lo tenga', me?.logo === L(2), me?.logo)
  check('una era sin logo no lleva ninguno (se pinta solo el nombre)', sv && sv.logo === null, sv?.logo)
  const mc = readFileSync(`${RAIZ}/js/mi-coleccion.js`, 'utf8')
  check('la cabecera pinta el logo delante del nombre, sin texto alternativo (el nombre va al lado)', /class="mc-era-logo" src="\$\{escapeHtml\(g\.logo\)\}" alt=""/.test(mc) && /alt="" loading="lazy" decoding="async">` : ''\}\$\{escapeHtml\(g\.titulo\)\}<\/h3>/.test(mc))
  check('…y si no carga, se quita', /querySelectorAll\('\.mc-era-logo'\)/.test(mc) && /addEventListener\('error', quitar/.test(mc))
  for (const f of ['js/sets-catalogo.js', 'netlify/functions/sets.mjs']) {
    const t = readFileSync(`${RAIZ}/${f}`, 'utf8')
    check(`${f} pide la columna como OPCIONAL (se quita sola sin la migración, la 624)`, /COLUMNA_LOGO_ERA = 'logo_serie_tcggo'/.test(t) && /opcionales = \[[^\]]*COLUMNA_LOGO_ERA/.test(t) && !/COLUMNAS = '[^']*logo_serie_tcggo/.test(t))
  }
  const css = readFileSync(`${RAIZ}/css/mi-coleccion.css`, 'utf8')
  check('el logo tiene su alto reservado', /\.mc-era-logo \{[^}]*height: 32px/.test(css))
}

console.log('\n── 5. La migración, contra PostgreSQL ──')
{
  const PG = { ...process.env, PGUSER: 'postgres', PGHOST: '/var/tmp', PGPORT: '5433' }
  const DB = 'p1363'
  const psql = (sql) => execFileSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-At', '-d', DB, '-c', sql], { env: PG, encoding: 'utf8' }).trim()
  try {
    execFileSync('psql', ['-X', '-q', '-d', 'postgres', '-c', `drop database if exists ${DB}`, '-c', `create database ${DB}`], { env: PG, encoding: 'utf8' })
  } catch (e) {
    check('PostgreSQL arrancado', false, String(e.message).slice(0, 160))
    process.exit(1)
  }
  // Las tablas de HOY, sacadas del esquema (no unas que se le parezcan).
  const esquema = readFileSync(`${RAIZ}/supabase-esquema-actual.sql`, 'utf8')
  const bloque = (inicio) => { const i = esquema.indexOf(inicio); if (i < 0) throw new Error(`sin ${inicio}`); return esquema.slice(i, esquema.indexOf('\n$$;', i) > 0 && inicio.startsWith('CREATE FUNCTION') ? esquema.indexOf('\n$$;', i) + 4 : esquema.indexOf('\n);', i) + 3) }
  const base = [
    'create extension if not exists unaccent with schema public;',
    "do $$ begin if not exists (select from pg_roles where rolname='anon') then create role anon; end if; if not exists (select from pg_roles where rolname='authenticated') then create role authenticated; end if; if not exists (select from pg_roles where rolname='service_role') then create role service_role; end if; end $$;",
    bloque('CREATE FUNCTION public.immutable_unaccent(text)').replace(/\$_\$;$/, '$_$;'),
    bloque('CREATE TABLE public.tcg_sets ('),
    bloque('CREATE TABLE public.tcg_cards ('),
    bloque('CREATE TABLE public.tcg_set_valor ('),
    bloque('CREATE TABLE public.tcg_correcciones ('),
    bloque('CREATE FUNCTION public.catalogo_aplicar_correcciones()'),
    'alter table public.tcg_sets add primary key (id, market);',
    'alter table public.tcg_cards add primary key (id, market);',
    'alter table public.tcg_set_valor add primary key (set_id, market, dia);',
    'CREATE TRIGGER catalogo_correcciones_cards BEFORE INSERT OR UPDATE ON public.tcg_cards FOR EACH ROW EXECUTE FUNCTION public.catalogo_aplicar_correcciones();',
    'CREATE TRIGGER catalogo_correcciones_sets BEFORE INSERT OR UPDATE ON public.tcg_sets FOR EACH ROW EXECUTE FUNCTION public.catalogo_aplicar_correcciones();',
    // Las dos funciones de ANTES (las de hoy en la base), para ver que la migración las cambia.
    bloque('CREATE FUNCTION public.tcggo_guardar_sets(p_sets jsonb'),
    bloque('CREATE FUNCTION public.tcggo_guardar_cartas(p_cartas jsonb'),
  ].join('\n\n')
  const fBase = `${S}/b1363.sql`
  writeFileSync(fBase, base.replace(/immutable_unaccent\(text\) RETURNS text\n    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE\n    AS \$_\$ select public\.unaccent\('public\.unaccent', \$1\) \$_\$;[^]*?(?=\n\nCREATE TABLE)/, "immutable_unaccent(text) RETURNS text\n    LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE\n    AS $_$ select public.unaccent('public.unaccent', $1) $_$;"))
  execFileSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', DB, '-f', fBase], { env: PG, encoding: 'utf8' })
  psql(`insert into public.tcg_sets (id, market, name, tcggo_id) values ('tcggo-437','WEST','Delta Reign',437), ('me1','WEST','Mega Evolution',400);
        insert into public.tcg_cards (id, market, set_id, local_id, name, category, stage) values
          ('me1-1','WEST','me1','1','Bulbasaur','Pokemon','Basic'),
          ('tcggo-81900','WEST','tcggo-437','140','Carta sin clase', null, null);
        insert into public.tcg_correcciones (tabla, id, market, columna, valor) values ('tcg_cards','tcggo-81901','WEST','stage','"Stage1"');`)
  const cartas = (extra) => JSON.stringify([
    { id: 'tcggo-81898', set_id: 'tcggo-437', local_id: '138', name: 'Mega Rayquaza ex', tcggo_id: 81898, category: 'Pokemon', trainer_type: null, stage: 'Basic', energy_type: null, ...extra },
    { id: 'me1-1', set_id: 'me1', local_id: '1', name: 'Bulbasaur', tcggo_id: 5, category: 'Trainer', trainer_type: 'Item', stage: null, energy_type: null },
    { id: 'tcggo-81900', set_id: 'tcggo-437', local_id: '140', name: 'Carta sin clase', tcggo_id: 81900, category: 'Trainer', trainer_type: 'Supporter', stage: null, energy_type: null },
    { id: 'tcggo-81901', set_id: 'tcggo-437', local_id: '141', name: 'Corregida a mano', tcggo_id: 81901, category: 'Pokemon', trainer_type: null, stage: 'Basic', energy_type: null },
  ]).replace(/'/g, "''")
  // ANTES de la migración: lo nuevo se manda y se ignora (la web puede subir primero).
  const antes = psql(`select public.tcggo_guardar_cartas('${cartas()}'::jsonb, 'WEST')`)
  check('sin la migración, mandar los campos nuevos no rompe la escritura', Number(antes) >= 3, antes)
  check('  …y no escribe la fase (la función vieja no la conoce)', psql("select coalesce(stage,'-') from public.tcg_cards where id='tcggo-81898'") === '-')
  const sql = readFileSync(`${RAIZ}/supabase-migration-1363-clase-de-carta-y-logo-de-era.sql`, 'utf8')
  const fMig = `${S}/m1363.sql`
  writeFileSync(fMig, sql)
  const correr = () => execFileSync('psql', ['-X', '-q', '-v', 'ON_ERROR_STOP=1', '-d', DB, '-f', fMig], { env: PG, encoding: 'utf8' })
  let bien = true
  try { correr() } catch (e) { bien = false; console.log(String(e.stderr || e.message).slice(0, 400)) }
  check('la migración entra', bien)
  psql(`select public.tcggo_guardar_cartas('${cartas()}'::jsonb, 'WEST')`)
  const fila = (id) => psql(`select coalesce(category,'-')||'|'||coalesce(trainer_type,'-')||'|'||coalesce(stage,'-')||'|'||coalesce(energy_type,'-') from public.tcg_cards where id='${id}'`)
  check('una carta de TCGGO ya existente recibe su fase', fila('tcggo-81898') === 'Pokemon|-|Basic|-', fila('tcggo-81898'))
  check('una carta de TCGdex (Pokémon) NO recibe el «Item» de TCGGO', fila('me1-1') === 'Pokemon|-|Basic|-', fila('me1-1'))
  check('una carta sin clase recibe clase y tipo de entrenador', fila('tcggo-81900') === 'Trainer|Supporter|-|-', fila('tcggo-81900'))
  check('una carta nueva con una fase corregida a mano se queda con la de /admin', fila('tcggo-81901') === 'Pokemon|-|Stage1|-', fila('tcggo-81901'))
  // Lo ya escrito no se pisa con lo que llegue después.
  psql(`select public.tcggo_guardar_cartas('${cartas({ stage: 'Stage2' })}'::jsonb, 'WEST')`)
  check('una fase ya puesta no se pisa en la pasada siguiente', fila('tcggo-81898') === 'Pokemon|-|Basic|-', fila('tcggo-81898'))
  // El logo de la era.
  const sets = (logo) => JSON.stringify([{ id: 'tcggo-437', tcggo_id: 437, logo: null, simbolo: null, logo_serie: logo, fecha: '2026-11-06', cartas: 141, impresas: 132 }])
  psql(`select public.tcggo_guardar_sets('${sets('https://images.tcggo.com/a.png')}'::jsonb, 'WEST')`)
  check('el set guarda el logo de su era', psql("select logo_serie_tcggo from public.tcg_sets where id='tcggo-437'") === 'https://images.tcggo.com/a.png')
  psql(`select public.tcggo_guardar_sets('${sets(null)}'::jsonb, 'WEST')`)
  check('  …y un día sin logo no lo borra', psql("select logo_serie_tcggo from public.tcg_sets where id='tcggo-437'") === 'https://images.tcggo.com/a.png')
  let dos = true
  try { correr() } catch { dos = false }
  check('se puede ejecutar dos veces', dos)
  check('las dos funciones siguen cerradas a anon y a authenticated', psql("select bool_or(has_function_privilege(r, f, 'execute')) from unnest(array['anon','authenticated']) r, unnest(array['public.tcggo_guardar_sets(jsonb,text)','public.tcggo_guardar_cartas(jsonb,text)']) f") === 'f')
  execFileSync('psql', ['-X', '-q', '-d', 'postgres', '-c', `drop database if exists ${DB}`], { env: PG })
}

console.log(fails ? `\n${fails} FALLAN` : '\nTodo bien')
process.exit(fails ? 1 : 0)
