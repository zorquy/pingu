// Tanda 1268 — los retos sin trampas: la base es el árbitro.
//
// PINGU: «revisa todos los minijuegos… para que ningún listillo haga
// trampa». Contra PostgreSQL de verdad: las respuestas no se leen, cada
// jugada la corrige `retos_jugar`, la XP la da la base al acabar (y
// `retos_guardar` ya no se puede llamar), la ficha de sin cuenta no se lee ni
// se retoca, la mesa de Parejas no sale nunca, y la cuenta de la carta en SQL
// dice lo mismo que `compararDetallado`. Y sin base: el cifrado de las fotos,
// la semilla secreta, que la mesa no lleve respuestas y que /reto-foto
// devuelva la foto borrosa o en silueta.
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
const AQUI = new URL('.', import.meta.url).pathname
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const { compararDetallado, rangoDeRareza } = await import(`${REPO}/js/carta-del-dia.js`)
const { mismaFamilia } = await import(`${REPO}/js/familias-pokemon.js`)
const { xpDe } = await import(`${REPO}/js/retos-xp.js`)
const { RAREZAS_ES } = await import(`${REPO}/js/rarezas-nombres.js`)
const MESA = await import(`${REPO}/netlify/lib/reto-mesa.mjs`)
const SECRETO = await import(`${REPO}/netlify/lib/reto-secreto.mjs`)
const { pokemonDelDia, opcionesDelDia } = await import(`${REPO}/js/quien-es.js`)

console.log('── 1. Sin base: lo secreto, la mesa y las fotos ──')
{
  const t = SECRETO.sellar({ u: ['https://assets.tcgdex.net/en/sv/sv03/125/high.webp'], e: { d: 28 } }, 'clave')
  check('la dirección de una foto no dice de qué carta es', !/sv03|tcgdex|125/.test(t) && !/sv03|tcgdex/.test(Buffer.from(t.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('latin1')))
  check('  …y con la clave se abre tal cual', JSON.stringify(SECRETO.abrir(t, 'clave')) === JSON.stringify({ u: ['https://assets.tcgdex.net/en/sv/sv03/125/high.webp'], e: { d: 28 } }))
  check('  …sin la clave, o tocada, no se abre', SECRETO.abrir(t, 'otra') === null && SECRETO.abrir(t.slice(0, -2) + (t.endsWith('A') ? 'BB' : 'AA'), 'clave') === null)
  check('  …y la misma foto tiene la misma dirección (la guarda la CDN)', SECRETO.sellar({ u: ['a'], e: { d: 5 } }, 'k') === SECRETO.sellar({ u: ['a'], e: { d: 5 } }, 'k'))
  const s1 = SECRETO.semillaDelDia('2026-11-08', 'k')
  check('la semilla cambia con el día y con la clave', s1 !== SECRETO.semillaDelDia('2026-11-09', 'k') && s1 !== SECRETO.semillaDelDia('2026-11-08', 'k2') && s1 > 0)
  check('el Pokémon de la silueta ya no sale de la fecha sola', [11, 2345, 98765, 1234567].some((x) => pokemonDelDia('2026-11-08', x) !== pokemonDelDia('2026-11-08')))
  check('  …y la buena está entre sus opciones', [11, 98765].every((x) => opcionesDelDia('2026-11-08', x).includes(pokemonDelDia('2026-11-08', x))))

  // Una foto «cifrada» de mentira: lo que hace a la foto se lee, de dónde sale no.
  const opaca = (u) => Buffer.from(JSON.stringify(u)).toString('hex').slice(0, 12)
  const foto = (spec) => `F(${opaca(spec.u)}${spec.e ? JSON.stringify(spec.e) : ''})`
  const carta = { id: 'sv3-125', market: 'WEST', set_id: 'sv3', local_id: '125', name: 'Charizard ex', name_es: 'Charizard ex', image_path: 'sv/sv03/125', rarity: 'Double Rare', types: ['Darkness'], dex_ids: [6], illustrator: 'X', tcg_sets: { name: 'Obsidian Flames', serie_id: 'sv', release_date: '2023-08-11', tcg_online_code: 'OBF' } }
  const pc = MESA.partirCarta({ dia: '2026-11-08', numero: 7, carta, ayer: null }, foto)
  const mesaC = JSON.stringify(pc.mesa)
  check('la mesa de la carta no lleva la carta (ni su nombre, ni su id, ni la foto nítida)', !/Charizard|sv3-125|"name"/.test(mesaC) && pc.mesa.foto.includes('"d":28'), mesaC)
  check('  …el árbitro sí, con su familia y seis fotos de borrosa a casi nítida', pc.datos.respuesta.id === 'sv3-125' && pc.datos.respuesta.familia.join() === '4,5,6' && pc.datos.fotos.length === 6 && /"d":5/.test(pc.datos.fotos[5]))
  const seis = [3, 8, 1.5, 20, 7, 2].map((p, i) => ({ ...carta, id: `c${i}`, precio: p }))
  const mc = MESA.partirCaro({ dia: '2026-11-08', cartas: seis }, foto)
  check('la mesa de «Más caro» no lleva precios ni ids', !/precio|"id"|c0|c1/.test(JSON.stringify(mc.mesa)) && mc.datos.precios.join() === '3,8,1.5,20,7,2', JSON.stringify(mc.mesa).slice(0, 200))
  const mo = MESA.partirOrdena({ dia: '2026-11-08', cartas: seis.slice(0, 4) }, foto)
  check('la de «Ordena» tampoco: llaves que no dicen nada', mo.mesa.cartas.map((c) => c.id).join() === 'a,b,c,d' && !/precio|c0/.test(JSON.stringify(mo.mesa)) && mo.datos.precios.b === 8)
  const sets = ['s1', 's2', 's3', 's4'].map((id) => ({ id, name: id.toUpperCase(), serie_id: 'sv' }))
  const mx = MESA.partirExpansion({ dia: '2026-11-08', rondas: [0, 1, 2, 3, 4].map((i) => ({ carta: { ...carta, id: `x${i}` }, set_id: 's2', opciones: sets })) }, foto)
  check('la de «¿De qué expansión es?» no dice la buena ni la carta', !/set_id|buena|x0|sv3/.test(JSON.stringify(mx.mesa)) && mx.datos.buenas.every((b) => b === 's2'), JSON.stringify(mx.mesa).slice(0, 300))
  const ms = MESA.partirSilueta({ dia: '2026-11-08', buena: 25, opciones: [1, 25, 7, 133] }, foto)
  check('la de la silueta: las opciones sí, la buena no (ni el dibujo por su número)', !/official-artwork|"buena"/.test(JSON.stringify(ms.mesa)) && ms.datos.buena === 25 && ms.datos.fotos.length === 3)

  // /reto-foto de verdad, con sharp.
  const { servirFoto, transformar } = await import(`${REPO}/netlify/functions/reto-foto.mjs`)
  const sharp = (await import(`${REPO}/node_modules/sharp/lib/index.js`)).default
  const png = await sharp({ create: { width: 200, height: 200, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).composite([{ input: Buffer.from('<svg width="200" height="200"><circle cx="100" cy="100" r="60" fill="#fc0"/></svg>') }]).png().toBuffer()
  const sil = await sharp(await transformar(png, { s: 3 })).raw().ensureAlpha().toBuffer({ resolveWithObject: true })
  const mitad = (sil.info.height / 2 | 0) * sil.info.width * 4 + (sil.info.width / 2 | 0) * 4
  check('la silueta sale negra donde está el Pokémon (y transparente fuera)', sil.data[mitad] < 10 && sil.data[mitad + 1] < 10 && sil.data[mitad + 3] > 200 && sil.data[3] < 10)
  const tok = SECRETO.sellar({ u: ['https://x/rota.png', 'https://x/buena.png'], e: { d: 10 } }, 'k')
  const r = await servirFoto(tok, { clave: 'k', fetchImpl: async (u) => (u.includes('rota') ? new Response('no', { status: 404 }) : new Response(png, { headers: { 'content-type': 'image/png' } })) })
  check('/reto-foto prueba la cadena, desenfoca y la sirve en WebP', r.estado === 200 && (await sharp(r.datos).metadata()).format === 'webp')
  check('  …y lo que no ha cifrado una función nuestra, 404', (await servirFoto('cualquiera', { clave: 'k' })).estado === 404)
}

const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_1268'
const A = '00000000-0000-0000-0000-0000000000a1'
const B = '00000000-0000-0000-0000-0000000000b2'
const C = '00000000-0000-0000-0000-0000000000c3'
const como = (uid, sql, rol = 'authenticated') => {
  const r = psql(['-t', '-A', '-d', BD, '-c', `begin; set local role ${rol}; ${uid ? `set local prueba.uid = '${uid}';` : ''} ${sql}; commit;`])
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() }
}
const sql = (s) => { const r = psql(['-t', '-A', '-d', BD, '-c', s]); return (r.stdout || '').trim() + (r.status ? ` ERROR ${r.stderr}` : '') }
const lit = (o) => `'${JSON.stringify(o).replace(/'/g, "''")}'`
// Una jugada (o abrir, sin jugada) y su respuesta como objeto.
const jugar = (uid, juego, jugada = null, { ficha = null, libre = null, dia = 'current_date' } = {}) => {
  const r = como(uid, `select public.retos_jugar('${juego}', ${dia}, ${libre ?? 'null'}, ${jugada ? `${lit(jugada)}::jsonb` : 'null'}, ${ficha ? `'${ficha}'` : 'null'})`, uid ? 'authenticated' : 'anon')
  if (!r.ok) return { error: r.err }
  return JSON.parse(r.out.split('\n').find((l) => l.startsWith('{')))
}

const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433 donde probar', hay.status === 0, (hay.stderr || '').slice(0, 120))
if (hay.status === 0) {
  psql(['-c', `drop database if exists ${BD}`])
  psql(['-c', `create database ${BD}`])
  let r = psql(['-d', BD, '-f', join(AQUI, 'sql-tanda-835.sql')])
  check('el andamio carga', r.status === 0, r.stderr)
  const dir = mkdtempSync(join(tmpdir(), 'p1268-'))
  writeFileSync(join(dir, 'andamio.sql'), `
create extension if not exists unaccent;
create or replace function public.immutable_unaccent(text) returns text language sql immutable strict parallel safe as $$ select public.unaccent('public.unaccent', $1) $$;
create table public.tcg_sets (id text, market text not null default 'WEST', name text, serie_id text, release_date date, primary key (id, market));
create table public.tcg_cards (id text primary key, market text not null default 'WEST', set_id text, local_id text, name text, name_es text, category text, dex_ids int[], types text[], rarity text, rarity_en text);
create table public.carta_del_dia (day date primary key, card_id text);
alter table public.carta_del_dia enable row level security;
create policy "carta_del_dia_lectura" on public.carta_del_dia for select using (true);
grant select on public.carta_del_dia to anon, authenticated;
grant select on public.tcg_cards, public.tcg_sets to anon, authenticated;
insert into public.carta_del_dia values (current_date, 'sv3-125');`)
  r = psql(['-d', BD, '-f', join(dir, 'andamio.sql')])
  check('  …y el del catálogo', r.status === 0, r.stderr)
  for (const m of ['retos-xp', '989-parejas', '991-quien-es']) {
    r = psql(['-d', BD, '-f', join(REPO, `supabase-migration-${m}.sql`)])
    check(`la migración ${m} carga`, r.status === 0, r.stderr)
  }
  r = psql(['-d', BD, '-f', join(REPO, 'supabase-migration-1268-retos-arbitro.sql')])
  check('la migración 1268 carga', r.status === 0, r.stderr)
  r = psql(['-d', BD, '-f', join(REPO, 'supabase-migration-1268-retos-arbitro.sql')])
  check('  …y se puede ejecutar otra vez', r.status === 0, r.stderr)
  // Sentencia a sentencia, cada una en su conexión (631).
  const mig = readFileSync(join(REPO, 'supabase-migration-1268-retos-arbitro.sql'), 'utf8')
  check('  …y no usa tablas temporales entre sentencias', !/create\s+temp/i.test(mig))

  // ── El catálogo de la prueba ──
  const SETS = [['sv3', 'sv', '2023-08-11', 'Obsidian Flames'], ['sv1', 'sv', '2023-03-31', 'Scarlet & Violet'], ['swsh1', 'swsh', '2020-02-07', 'Sword & Shield'], ['swsh12', 'swsh', '2022-11-11', 'Silver Tempest'], ['base1', 'base', '1999-01-09', 'Base']]
  const CARTAS = [
    { id: 'sv3-125', set_id: 'sv3', local_id: '125', name: 'Charizard ex', dex_ids: [6], types: ['Darkness'], rarity: 'Double Rare' },
    { id: 'sv3-26', set_id: 'sv3', local_id: '026', name: 'Charmander', dex_ids: [4], types: ['Fire'], rarity: 'Common' },
    { id: 'sv1-6', set_id: 'sv1', local_id: '6', name: 'Charizard ex', dex_ids: [6], types: ['Fire'], rarity: 'Ultra Rare' },
    { id: 'tcggo-sv3-125', set_id: 'sv3', local_id: '125', name: 'Charizard  EX', dex_ids: [6], types: ['Darkness'], rarity: 'Double Rare' },
    { id: 'swsh1-25', set_id: 'swsh1', local_id: '25', name: 'Pikachu', dex_ids: [25], types: ['Lightning'], rarity: 'Common', rarity_en: 'Common' },
    { id: 'swsh12-1', set_id: 'swsh12', local_id: '1', name: 'Flabébé', dex_ids: [669], types: ['Psychic'], rarity: 'Uncommon' },
    { id: 'base1-4', set_id: 'base1', local_id: '4', name: 'Charizard', dex_ids: [6], types: ['Fire'], rarity: 'Rare Holo' },
    { id: 'sv1-200', set_id: 'sv1', local_id: '200', name: 'Pikachu', dex_ids: [25], types: ['Lightning'], rarity: 'Special Illustration Rare' },
    { id: 'sv1-raro', set_id: 'sv1', local_id: '201', name: 'Raichu', dex_ids: [26], types: null, rarity: null, rarity_en: 'Illustration Rare' },
  ]
  sql(`insert into tcg_sets (id, serie_id, release_date, name) values ${SETS.map(([id, s, d, n]) => `('${id}', '${s}', '${d}', '${n.replace(/'/g, "''")}')`).join(',')}`)
  sql(`insert into tcg_cards (id, set_id, local_id, name, category, dex_ids, types, rarity, rarity_en) values ${CARTAS.map((c) => `('${c.id}', '${c.set_id}', '${c.local_id}', '${c.name}', 'Pokemon', ${c.dex_ids ? `'{${c.dex_ids}}'` : 'null'}, ${c.types ? `'{${c.types}}'` : 'null'}, ${c.rarity ? `'${c.rarity}'` : 'null'}, ${c.rarity_en ? `'${c.rarity_en}'` : 'null'})`).join(',')}`)
  const conSet = (c) => { const s = SETS.find((x) => x[0] === c.set_id); return { ...c, market: 'WEST', tcg_sets: { serie_id: s[1], release_date: s[2], name: s[3] } } }
  const foto = (spec) => `F${JSON.stringify(spec)}`
  const guardarArbitro = (juego, dia, datos) => sql(`insert into retos_arbitro (juego, day, datos) values ('${juego}', ${dia}, ${lit(datos)}::jsonb) on conflict (juego, day) do update set datos = excluded.datos`)
  const RESP = conSet(CARTAS[0])
  guardarArbitro('carta', 'current_date', MESA.partirCarta({ dia: 'x', carta: { ...RESP, illustrator: 'Arita' } }, foto).datos)

  console.log('\n── 2. Lo que sabe el árbitro no lo lee nadie ──')
  for (const t of ['retos_arbitro', 'retos_partidas', 'retos_llave', 'carta_del_dia']) {
    const g = como(null, `select count(*) from public.${t}`, 'anon')
    const g2 = como(A, `select count(*) from public.${t}`)
    check(`${t}: ni sin cuenta ni con cuenta`, (!g.ok || g.out === '0') && (!g2.ok || g2.out === '0'), g.out + g.err + g2.out)
  }
  let g = como(A, `select public.retos_guardar('carta', current_date, 1, 1, 1, true, null, null)`)
  check('`retos_guardar` ya no se puede llamar desde fuera (la XP de la consola se acabó)', !g.ok && /permission denied/.test(g.err), g.err)
  for (const f of ['retos_mover', 'retos_vista', 'retos_carta_det']) {
    g = como(A, `select public.${f}(${f === 'retos_carta_det' ? "'sv3-125', '{}'::jsonb" : f === 'retos_vista' ? "'carta', '{}'::jsonb, '{}'::jsonb" : "'carta', '{}'::jsonb, '{}'::jsonb, '{}'::jsonb"})`)
    check(`  …ni las piezas del árbitro (${f})`, !g.ok && /permission denied/.test(g.err), g.err)
  }

  console.log('\n── 3. «¿Qué carta es?»: cada intento lo corrige la base ──')
  let v = jugar(null, 'carta')
  check('al abrir: la foto más borrosa, ninguna pista y ni rastro de la carta', v.estado && /"d":28/.test(v.estado.foto) && Object.keys(v.estado.pistas).length === 0 && v.estado.respuesta == null && !/sv3-125|Charizard/.test(JSON.stringify(v.estado)) && v.ficha, JSON.stringify(v).slice(0, 300))
  check('  …y la ficha (sin cuenta) no se puede leer', v.ficha && !/intentos|carta|sv3/.test(Buffer.from(v.ficha, 'base64').toString('latin1')))
  let w = jugar(null, 'carta', { carta: 'swsh1-25' }, { ficha: v.ficha })
  const det = (id) => compararDetallado(conSet(CARTAS.find((c) => c.id === id)), RESP, { familia: mismaFamilia })
  const norm = (x) => JSON.stringify(Object.fromEntries(Object.entries(x || {}).sort().map(([k, v]) => [k, Object.fromEntries(Object.entries(v).sort())])))
  check('un fallo: sus casillas, una pista (la era) y una foto menos borrosa', w.eco?.det?.nombre?.estado === 'no' && norm(w.eco.det) === norm(det('swsh1-25')) && Object.keys(w.estado.pistas).join() === 'era' && /"d":20/.test(w.estado.foto) && w.estado.respuesta == null, JSON.stringify(w.eco))
  g = jugar(null, 'carta', { carta: 'sv1-6' }, { ficha: 'esto-no-es-una-ficha' })
  check('una ficha inventada no vale: la partida empieza de cero', g.estado?.intentos?.length === 1)
  const ficha2 = jugar(null, 'carta', { carta: 'sv1-6' }, { ficha: w.ficha })
  check('  …y con la buena sigue donde iba (dos intentos)', ficha2.estado.intentos.length === 2 && Object.keys(ficha2.estado.pistas).length === 2)
  g = jugar(null, 'carta', { carta: 'no-existe' }, { ficha: w.ficha })
  check('una carta que no está en el catálogo no gasta intento', /no está en el catálogo/.test(g.error || ''), JSON.stringify(g))
  // Con cuenta: la partida vive en la base y la XP la da ella.
  jugar(A, 'carta', { carta: 'base1-4' })
  w = jugar(A, 'carta', { carta: 'tcggo-sv3-125' })
  check('con cuenta, la misma carta de otra fuente (mismo set, número y nombre) acierta', w.estado.acertada === true && w.estado.terminada && w.estado.respuesta === 'sv3-125' && Object.keys(w.estado.pistas).length === 5 && w.estado.foto == null, JSON.stringify(w.estado).slice(0, 300))
  check('  …y la base apunta la XP sola: 45 por acertar en 2', w.guardado?.nuevo === true && w.guardado?.xp === 45 && sql(`select total_xp from user_profiles where id = '${A}'`) === '45' && sql(`select intentos || ',' || acertada from retos_resultados where user_id = '${A}' and juego = 'carta'`) === '2,true', `${JSON.stringify(w.guardado)} ${sql(`select total_xp from user_profiles where id = '${A}'`)} ${sql(`select intentos || ',' || acertada from retos_resultados where user_id = '${A}' and juego = 'carta'`)}`)
  g = jugar(A, 'carta', { carta: 'sv3-125' })
  check('  …acabada no se juega más', /acabada/.test(g.error || ''))
  g = jugar(A, 'carta')
  check('  …y al volver sale hecha, sin XP otra vez', g.estado?.terminada && g.guardado?.xp === 45 && sql(`select total_xp from user_profiles where id = '${A}'`) === '45')
  check('  …la partida está en la base (otro aparato la ve igual) y sin ficha', g.ficha == null && g.estado.intentos.length === 2)
  // Traerse la de sin cuenta al entrar (B empieza sin cuenta y entra).
  const sinCuenta = jugar(null, 'carta', { carta: 'swsh12-1' })
  g = jugar(B, 'carta', null, { ficha: sinCuenta.ficha })
  check('lo empezado sin cuenta se trae al entrar', g.estado?.intentos?.length === 1 && g.cuenta === true)
  g = jugar(B, 'carta', null, { ficha: w.ficha })
  check('  …pero solo la primera vez: después manda la de la base', g.estado?.intentos?.length === 1)
  g = jugar(C, 'carta', null, { dia: 'current_date - 5' })
  check('un día que no es el de hoy no se juega', /no es el de hoy/.test(g.error || ''))
  // Lo ya apuntado antes de la 1268: hecho.
  sql(`insert into retos_resultados (user_id, juego, day, aciertos, total, intentos, acertada, xp) values ('${C}', 'carta', current_date, 1, 1, 3, true, 40)`)
  g = jugar(C, 'carta')
  check('lo apuntado antes de la 1268 sale hecho (y no se vuelve a jugar)', g.estado?.terminada && g.guardado?.nuevo === false && /acabada/.test(jugar(C, 'carta', { carta: 'sv3-125' }).error || ''))

  console.log('\n── 4. La cuenta de las casillas en SQL es la de la web ──')
  const datosResp = (c) => MESA.partirCarta({ dia: 'x', carta: conSet(c) }, foto).datos.respuesta
  let iguales = 0
  let pares = 0
  for (const resp of CARTAS) {
    for (const intento of CARTAS) {
      pares++
      const js = compararDetallado(conSet(intento), conSet(resp), { familia: mismaFamilia })
      const db = JSON.parse(sql(`select public.retos_carta_det('${intento.id}', ${lit(datosResp(resp))}::jsonb)`))
      if (norm(js) === norm(db)) iguales++
      else if (iguales + 3 > pares) console.log('     distinto:', intento.id, '→', resp.id, norm(js), norm(db))
    }
  }
  check(`las ${pares} parejas de cartas dan las mismas casillas en la web y en la base`, iguales === pares, `${iguales}/${pares}`)
  const rarezas = [...new Set([...Object.keys(RAREZAS_ES), 'Rare Holo VMAX', 'Rare Holo LV.X', 'Rare BREAK', 'ACE SPEC Rare', 'Mega Hyper Rare', 'Shiny Rare', 'Promo', 'Rare Holo EX', 'Trainer Gallery Rare Holo', ''])]
  const db = sql(`select string_agg(coalesce(public.retos_rango_rareza(r)::text, 'null'), '|' order by i) from unnest(array[${rarezas.map((r) => `'${r.replace(/'/g, "''")}'`).join(',')}]::text[]) with ordinality as x(r, i)`).split('|')
  const malas = rarezas.filter((r, i) => String(rangoDeRareza(r)) !== db[i])
  check(`el rango de las ${rarezas.length} rarezas es el mismo`, !malas.length, malas.map((r) => `${r}: ${rangoDeRareza(r)} / ${db[rarezas.indexOf(r)]}`).join('; '))

  console.log('\n── 5. «¿Más caro?», «Ordena», «Expansión» y la silueta ──')
  const precios = [3, 8, 1.5, 20, 7, 2]
  guardarArbitro('caro', 'current_date', { precios })
  v = jugar(null, 'caro')
  check('«Más caro» al abrir: solo el precio de la primera', JSON.stringify(v.estado.precios) === '[3]', JSON.stringify(v.estado))
  w = jugar(null, 'caro', { respuesta: 'mas' }, { ficha: v.ficha })
  check('  …contestar dice si aciertas y el precio de B (y nada más)', w.eco.bien === true && w.eco.precio === 8 && JSON.stringify(w.estado.precios) === '[3, 8]'.replace(' ', '') || JSON.stringify(w.estado.precios) === '[3,8]', JSON.stringify(w))
  g = jugar(null, 'caro', { respuesta: 'igual' }, { ficha: w.ficha })
  check('  …una respuesta inventada no vale', /desconocida/.test(g.error || ''))
  let f = null
  const tira = []
  for (const resp of ['mas', 'menos', 'mas', 'menos', 'menos']) {
    const x = jugar(A, 'caro', { respuesta: resp })
    tira.push(x.eco.bien)
    f = x
  }
  check('  …con cuenta, cinco rondas y la XP que dice la web', f.estado.terminada && f.guardado?.xp === xpDe('caro', { tira }) && JSON.stringify(f.estado.precios) === JSON.stringify(precios), `${JSON.stringify(tira)} ${JSON.stringify(f.guardado)}`)

  guardarArbitro('ordena', 'current_date', { precios: { a: 3, b: 8, c: 1.5, d: 20 } })
  v = jugar(null, 'ordena')
  check('«Ordena» al abrir: sin precios', v.estado.precios == null && v.estado.bien.length === 0)
  g = jugar(null, 'ordena', { orden: ['a', 'a', 'b', 'c'] })
  check('  …un orden con repetidas no vale', /no vale/.test(g.error || ''))
  w = jugar(null, 'ordena', { orden: ['a', 'c', 'b', 'd'] }, { ficha: v.ficha })
  check('  …un intento dice cuáles están en su sitio, sin precios', JSON.stringify(w.eco.bien) === '[false,false,true,true]' && w.estado.precios == null, JSON.stringify(w))
  w = jugar(null, 'ordena', { orden: ['c', 'a', 'b', 'd'] }, { ficha: w.ficha })
  check('  …y al acertar, los precios', w.estado.acertada && w.estado.terminada && w.estado.precios?.d === 20)

  guardarArbitro('expansion', 'current_date', { buenas: ['s2', 's1', 's3', 's4', 's2'], opciones: Array(5).fill(['s1', 's2', 's3', 's4']) })
  v = jugar(null, 'expansion')
  check('«Expansión» al abrir: ninguna buena', v.estado.buenas.length === 0)
  g = jugar(null, 'expansion', { set: 'otra' })
  check('  …una expansión que no está entre las cuatro no vale', /no está entre/.test(g.error || ''))
  w = jugar(null, 'expansion', { set: 's1' }, { ficha: v.ficha })
  check('  …contestar dice la buena de ESA ronda (y solo de esa)', w.eco.bien === false && w.eco.buena === 's2' && JSON.stringify(w.estado.buenas) === '["s2"]')
  for (const s of ['s2', 's1', 's3', 's1', 's2']) f = jugar(B, 'expansion', { set: s })
  check('  …con cuenta, 4 de 5 son 16 XP', f.estado.terminada && f.guardado?.xp === 16, JSON.stringify(f.guardado))

  guardarArbitro('silueta', 'current_date', { buena: 25, opciones: [1, 25, 7, 133], fotos: ['n1', 'n2', 'n3'] })
  v = jugar(null, 'silueta')
  check('la silueta al abrir: la más borrosa y sin la buena', v.estado.foto === 'n1' && v.estado.buena == null)
  g = jugar(null, 'silueta', { dex: 150 })
  check('  …un Pokémon que no está entre las cuatro no vale', /no está/.test(g.error || ''))
  w = jugar(null, 'silueta', { dex: 7 }, { ficha: v.ficha })
  check('  …un fallo trae la siguiente silueta', w.eco.bien === false && w.estado.foto === 'n2' && w.estado.buena == null)
  g = jugar(null, 'silueta', { dex: 7 }, { ficha: w.ficha })
  check('  …el mismo otra vez no gasta intento', /ya la has dicho/.test(g.error || ''))
  w = jugar(A, 'silueta', { dex: 1 })
  w = jugar(A, 'silueta', { dex: 25 })
  check('  …con cuenta, acertar en 2 son 20 XP y dice cuál era', w.estado.acertada && w.estado.buena === 25 && w.guardado?.xp === 20, JSON.stringify(w))

  console.log('\n── 6. Parejas: la mesa no sale nunca ──')
  v = jugar(null, 'parejas')
  check('al abrir: ni la mesa ni nada tapado', !('mesa' in v.estado) && Object.keys(v.estado.descubiertas).length === 0 && v.estado.abierta == null, JSON.stringify(v.estado))
  check('  …y la ficha no la deja leer', !/mesa/.test(Buffer.from(v.ficha, 'base64').toString('latin1')))
  // La mesa la sabe solo la base; se lee como postgres para jugar «bien».
  const yo = jugar(C, 'parejas')
  check('con cuenta, igual', !('mesa' in yo.estado))
  const mesa = JSON.parse(sql(`select estado->'mesa' from retos_partidas where user_id = '${C}' and juego = 'parejas'`))
  check('  …la mesa son las seis, dos veces, barajadas', mesa.length === 12 && [0, 1, 2, 3, 4, 5].every((i) => mesa.filter((x) => x === i).length === 2))
  w = jugar(C, 'parejas', { hueco: 0 })
  check('  …dar la vuelta a una dice cuál es (solo esa)', w.eco.carta === mesa[0] && w.estado.abierta?.hueco === 0 && Object.keys(w.estado.descubiertas).length === 0)
  g = jugar(C, 'parejas', { hueco: 0 })
  check('  …la misma otra vez no cuenta', /ya está vuelta/.test(g.error || ''))
  const otro = mesa.findIndex((x, i) => i > 0 && x !== mesa[0])
  w = jugar(C, 'parejas', { hueco: otro })
  check('  …dos distintas: un movimiento sin pareja, y se tapan', w.eco.pareja === false && w.estado.movimientos === 1 && w.estado.abierta == null && Object.keys(w.estado.descubiertas).length === 0)
  // Ahora sin fallar.
  for (let c = 0; c < 6; c++) {
    const [h1, h2] = mesa.map((x, i) => (x === c ? i : -1)).filter((i) => i >= 0)
    jugar(C, 'parejas', { hueco: h1 })
    f = jugar(C, 'parejas', { hueco: h2 })
  }
  check('  …seis parejas en 7 movimientos: acabada y 30 XP', f.estado.terminada && f.estado.movimientos === 7 && f.guardado?.xp === 30 && Object.keys(f.estado.descubiertas).length === 12, JSON.stringify(f).slice(0, 300))
  g = jugar(C, 'parejas', { hueco: 3 })
  check('  …acabada no se juega más', /acabada/.test(g.error || ''))
  // Una partida de Parejas sin cuenta NO se trae al entrar: con la ficha se
  // pueden mirar huecos desde un mismo punto sin que cuenten.
  const anon = jugar(null, 'parejas', { hueco: 5 })
  g = jugar(A, 'parejas', null, { ficha: anon.ficha })
  check('lo de Parejas sin cuenta NO se trae al entrar (la ficha se podría repetir)', g.estado?.abierta == null && g.estado.movimientos === 0)

  console.log('\n── 7. Las partidas libres ──')
  guardarArbitro('caro', "date '1900-01-01' + 7", { precios: [1, 2, 3, 4, 5, 6] })
  g = jugar(A, 'caro', { respuesta: 'mas' }, { libre: 7, dia: "date '1900-01-01' + 7" })
  check('una libre se juega con su ficha, también con cuenta, y no apunta nada', g.eco?.bien === true && g.ficha && g.cuenta === false && g.guardado == null && sql(`select count(*) from retos_resultados where day < '1901-01-01'`) === '0', JSON.stringify(g).slice(0, 200))
  g = jugar(A, 'caro', null, { libre: 7, dia: 'current_date' })
  check('  …y con un día que no es el suyo, no', /partida libre/.test(g.error || ''))
  g = jugar(null, 'caro', { respuesta: 'mas' }, { libre: 8, dia: "date '1900-01-01' + 8" })
  check('una libre que nadie ha elegido todavía no se juega', /todavía no hay reto/.test(g.error || ''))

  psql(['-c', `drop database if exists ${BD}`])
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
