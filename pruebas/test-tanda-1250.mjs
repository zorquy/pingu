// Tanda 1250 — comprarle a una tienda, contra PostgreSQL: pedir a su precio u
// ofrecer menos (nunca más), el mínimo de la tienda, sus formas de cobro (y el
// efectivo solo en mano), el envío de la tabla de los cambios, una oferta viva
// por persona y copia (ofrecer otra vez es un paso), los turnos (contestar
// solo a quien le toca, retirar solo quien compra), aceptar RESERVA (saca las
// unidades a una reserva de 7 días a su nombre), pagado → hecha es la VENTA
// con «pokedoc» y el coste de ese momento, cancelar devuelve, lo que caduca a
// las 48 h y la reserva que vence, el Bizum solo a quien compra y solo
// aceptada, el coste solo a la tienda, la tienda de pruebas no vende, y cada
// paso deja su línea con el adjunto en la conversación y su aviso.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_1250'
const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
const MIG = `${REPO}/supabase-migration-1250-tienda-ofertas.sql`
const mig = readFileSync(MIG, 'utf8')
check('la migración no usa tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
check('el Bizum va en una tabla aparte, sin políticas (tiendas la lee cualquiera)', /create table if not exists public\.tienda_cobros/.test(mig) && !/policy[^;]*tienda_cobros/.test(mig) && !/alter table public\.tiendas add column[^;]*bizum/.test(mig))
const funcion = (fichero, nombre) => {
  const t = readFileSync(`${REPO}/${fichero}`, 'utf8')
  const i = t.indexOf(`create or replace function public.${nombre}(`)
  return t.slice(i, t.indexOf('$$;', t.indexOf('$$', t.indexOf('as $$', i) + 5)) + 3)
}
const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0)
if (hay.status === 0) {
  psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
  let r = psql(['-d', BD, '-c', `do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    do $$ begin create role service_role; exception when duplicate_object then null; end $$;
    create schema if not exists auth; create table auth.users (id uuid primary key);
    grant usage on schema auth to anon, authenticated, service_role;
    create or replace function auth.uid() returns uuid language sql as $f$ select nullif(current_setting('prueba.uid', true), '')::uuid $f$;
    create or replace function auth.role() returns text language sql as $f$ select nullif(current_setting('prueba.rol', true), '') $f$;
    create or replace function auth.email() returns text language sql as $f$ select nullif(current_setting('prueba.email', true), '') $f$;
    create or replace function is_admin() returns boolean language sql as $f$ select current_setting('prueba.admin', true) = 'si' $f$;
    grant usage on schema public to anon, authenticated, service_role;
    create table user_profiles (id uuid primary key, username text, display_name text, avatar_url text, is_admin boolean not null default false, is_moderator boolean default false, is_banned boolean default false, onboarding_completed boolean, notification_prefs_disabled text[] not null default '{}', created_at timestamptz not null default now());
    grant select, insert, update on user_profiles to anon, authenticated;
    create table user_notifications (id uuid primary key default gen_random_uuid(), recipient_id uuid not null, type text not null, title text not null, body text, link text, read_at timestamptz, created_at timestamptz not null default now());
    create table user_collection (id uuid primary key default gen_random_uuid(), user_id uuid, card_id text, market text default 'WEST', idioma text default 'es', estado text default 'NM', variante text default 'normal', cantidad int default 1, cambio int not null default 0, gradeo text, valor_manual numeric(10,2), precio_compra numeric(10,2), notas text, created_at timestamptz default now(), updated_at timestamptz default now());
    create table user_wants (id uuid primary key default gen_random_uuid(), user_id uuid not null, card_id text not null, idioma text, variante text, prioridad int default 1);
    create table tcg_sets (id text, market text default 'WEST', name text, primary key (id, market));
    create table tcg_cards (id text primary key, market text not null default 'WEST', set_id text, local_id text, name text, name_es text, name_search text, rarity text, rarity_en text);
    create table tcg_card_prices (card_id text primary key, cm_id_product int, cm_low numeric(10,2), cm_trend numeric(10,2), cm_avg30 numeric(10,2), cm_avg7 numeric(10,2),
      cm_trend_holo numeric(10,2), cm_avg30_holo numeric(10,2), cm_low_holo numeric(10,2),
      cm_low_es numeric(10,2), cm_low_en numeric(10,2), cm_low_de numeric(10,2), cm_low_fr numeric(10,2), cm_low_it numeric(10,2), cm_low_ja numeric(10,2),
      tp_market_eur numeric, tp_normal_market numeric, tp_normal_low numeric, tp_holo_market numeric, tp_holo_low numeric, tp_reverse_market numeric, tp_reverse_low numeric, tp_primera_market numeric, tp_primera_low numeric,
      cm_gradeadas jsonb, ebay_gradeadas jsonb);
    create table tcg_products (id bigint primary key, name text not null, cm_lowest numeric, cm_lowest_eu numeric, cm_lowest_es numeric);
    grant select on tcg_cards, tcg_card_prices, tcg_products, tcg_sets to anon, authenticated;
    create table conversations (id uuid primary key default gen_random_uuid(), created_at timestamptz not null default now());
    create table conversation_participants (conversation_id uuid references conversations (id) on delete cascade, user_id uuid references auth.users (id), last_read_at timestamptz, primary key (conversation_id, user_id));
    create table private_messages (id uuid primary key default gen_random_uuid(), conversation_id uuid not null references conversations (id), sender_id uuid not null references auth.users (id), body text not null, adjuntos jsonb not null default '[]', deleted_at timestamptz, created_at timestamptz not null default now());`])
  check('el andamio carga', r.status === 0, r.stderr)
  for (const [fichero, nombre] of [['supabase-migration-precios-tcgplayer.sql', 'eur_por_usd'], ['supabase-migration-precios-tcgplayer.sql', 'tp_de_version'], ['supabase-migration-precios-tcgplayer.sql', 'emparejamiento_dudoso'], ['supabase-migration-905-gradeadas.sql', 'valor_gradeado'], ['supabase-migration-tcggo-japones.sql', 'valor_de_linea'], ['supabase-migration-1017-portada-consultas.sql', 'valor_de_copia'], ['supabase-migration-942-propuestas-cambio.sql', 'cambio_conversacion'], ['supabase-migration-1108-cambio-envio-automatico.sql', 'cambio_envio_tarifa']]) {
    r = psql(['-d', BD, '-c', funcion(fichero, nombre)])
    if (r.status !== 0) check(`  …${nombre}`, false, r.stderr)
  }
  for (const m of ['1067-tiendas', '1068-tienda-stock', '1069-tiendas-escaparate', '1072-tienda-ventas', '1073-tienda-hoy', '1074-tienda-sin-local', '1079-tiendas-vuelta-2', '1092-tienda-reservas']) {
    r = psql(['-d', BD, '-c', readFileSync(`${REPO}/supabase-migration-${m}.sql`, 'utf8').replace(/notify pgrst[^;]*;/, '')])
    check(`la ${m.slice(0, 4)} entra`, r.status === 0, r.stderr)
  }
  // De la 1245 solo hace falta su columna y `tienda_publica`.
  r = psql(['-d', BD, '-c', `alter table tiendas add column if not exists de_pruebas boolean not null default false; ${funcion('supabase-migration-1245-tienda-de-pruebas.sql', 'tienda_publica')}`])
  check('`tienda_publica` de la 1245', r.status === 0, r.stderr)
  const [T, P, ANE, BEA] = ['b1', 'b5', 'c1', 'c2'].map((x) => `00000000-0000-0000-0000-0000000000${x}`)
  r = psql(['-d', BD, '-c', `insert into auth.users values ('${T}'), ('${P}'), ('${ANE}'), ('${BEA}');
    insert into user_profiles (id, username, display_name, tipo, onboarding_completed) values
      ('${T}', 'ryu', 'RyuCards', 'tienda', true), ('${P}', 'prueba', 'Tienda de Prueba', 'tienda', true),
      ('${ANE}', 'ane', 'Ane', 'persona', true), ('${BEA}', 'bea', 'Bea', 'persona', true);
    insert into tiendas (user_id, precio_visible) values ('${T}', true), ('${P}', true);
    update tiendas set de_pruebas = true where user_id = '${P}';
    insert into tcg_sets values ('sv3', 'WEST', 'Obsidian Flames');
    insert into tcg_cards (id, market, set_id, local_id, name, name_es, name_search) values ('sv3-223', 'WEST', 'sv3', '223', 'Charizard ex', 'Charizard ex', 'charizard ex');`])
  check('los datos de la prueba entran', r.status === 0, r.stderr)
  const como = (u) => `set prueba.uid = '${u}'; set role authenticated;`
  const comoAnon = `set prueba.uid = ''; set role anon;`
  const L = '00000000-0000-0000-0000-00000000a001'
  const LP = '00000000-0000-0000-0000-00000000e001'
  r = q(`${como(T)} insert into tienda_stock (id, card_id, idioma, estado, unidades, coste, precio, visible) values ('${L}', 'sv3-223', 'es', 'NM', 2, 25, 40, true)`)
  check('el stock entra (2 a 40 €, coste 25)', r.ok, r.err)
  r = q(`${como(P)} insert into tienda_stock (id, card_id, idioma, estado, unidades, precio) values ('${LP}', 'sv3-223', 'es', 'NM', 1, 1)`)
  check('  …y el de la tienda de pruebas', r.ok, r.err)
  r = psql(['-d', BD, '-c', mig.replace(/notify pgrst[^;]*;/, '')])
  check('la 1250 entra', r.status === 0, r.stderr)
  check('  …y otra vez encima', psql(['-d', BD, '-c', mig.replace(/notify pgrst[^;]*;/, '')]).status === 0)

  const json = (u, sql) => { const x = q(`${u} select ${sql}`); return x.ok ? JSON.parse(x.out || 'null') : { error: x.err } }
  const uds = () => Number(q(`select unidades from tienda_stock where id = '${L}'`).out)
  const oferta = (id) => JSON.parse(q(`select to_jsonb(o) from tienda_ofertas o where id = '${id}'`).out)
  const msgs = () => q(`select count(*) from private_messages where adjuntos @> '[{"tipo":"oferta_tienda"}]'`).out

  console.log('── Condiciones y cobros ──')
  const cond = json(comoAnon, `tienda_condiciones('${T}')`)
  check('sin cuenta se ven las condiciones (las tres formas, sin mínimo)', JSON.stringify(cond.pagos) === '["bizum","paypal","efectivo"]' && cond.minimo === null, JSON.stringify(cond))
  check('una persona no pone cobros', /tienda/.test(json(como(ANE), `tienda_cobros_poner(array['bizum'], '600', null, 80)`).error || ''))
  const c = json(como(T), `tienda_cobros_poner(array['bizum','efectivo','cripto'], ' 600 11 22 33 ', null, 80)`)
  check('la tienda pone Bizum y efectivo y un mínimo del 80 % (lo raro no entra)', JSON.stringify(c.pagos) === '["bizum","efectivo"]' && c.bizum === '600 11 22 33' && c.minimo === 80, JSON.stringify(c))
  check('  …sin ninguna forma, no', /al menos una/.test(json(como(T), `tienda_cobros_poner(array[]::text[], null, null, null)`).error || ''))
  check('  …el Bizum no sale en las condiciones', !/600/.test(JSON.stringify(json(comoAnon, `tienda_condiciones('${T}')`))))
  check('  …ni nadie lee la tabla a pelo', !q(`${como(ANE)} select count(*) from tienda_cobros`).ok || q(`${como(ANE)} select count(*) from tienda_cobros`).out === '0')

  console.log('── Pedir y ofrecer ──')
  check('sin cuenta, no', !q(`${comoAnon} select tienda_oferta_enviar('${L}', 35, 'mano', 'bizum')`).ok)
  check('la tienda no se compra a sí misma ni otra tienda compra', /no compra|ya no está/.test(json(como(T), `tienda_oferta_enviar('${L}', 35, 'mano', 'bizum')`).error || ''))
  check('por debajo del mínimo (32 €), no y lo dice', /por debajo de 32\.00/.test(json(como(ANE), `tienda_oferta_enviar('${L}', 30, 'mano', 'bizum')`).error || ''), json(como(ANE), `tienda_oferta_enviar('${L}', 30, 'mano', 'bizum')`).error)
  check('PayPal, que no acepta: no', /no cobra así/.test(json(como(ANE), `tienda_oferta_enviar('${L}', 35, 'mano', 'paypal')`).error || ''))
  check('efectivo por correo: no', /solo en mano/.test(json(como(ANE), `tienda_oferta_enviar('${L}', 35, 'correo', 'efectivo')`).error || ''))
  check('más unidades de las que hay: no', /No quedan tantas/.test(json(como(ANE), `tienda_oferta_enviar('${L}', 35, 'mano', 'bizum', 3)`).error || ''))
  check('a la tienda de pruebas no se le compra', /ya no está/.test(json(como(ANE), `tienda_oferta_enviar('${LP}', 1, 'mano', 'bizum')`).error || ''))
  const o1 = json(como(ANE), `tienda_oferta_enviar('${L}', 35, 'correo', 'bizum')`)
  let o = oferta(o1.id)
  check('Ane ofrece 35 € por correo: abierta, le toca a la tienda, 48 h', o.estado === 'abierta' && o.turno === 'tienda' && Number(o.precio) === 35 && Number(o.precio_tienda) === 40 && o1.que === 'ofrece' && Math.abs(new Date(o.caduca_at) - Date.now() - 48 * 36e5) < 60e3, JSON.stringify(o))
  check('  …el envío es la tabla de los cambios (≤ 25 € no: 35 € es certificado)', o.envio_tipo === 'certificado' && Number(o.envio_precio) === 7.06, `${o.envio_tipo} ${o.envio_precio}`)
  check('  …lo que es va copiado (carta, idioma, estado)', o.card_id === 'sv3-223' && o.idioma === 'es' && o.estado_carta === 'NM')
  check('  …y las unidades siguen en el stock (ofrecer no reserva)', uds() === 2)
  check('  …una línea en la conversación con su adjunto y un aviso a la tienda, a su pestaña', msgs() === '1' && q(`select link from user_notifications where recipient_id = '${T}' and type = 'tienda_oferta'`).out === `/tienda?ver=ofertas#oferta-${o1.id}`)
  const o1b = json(como(ANE), `tienda_oferta_enviar('${L}', 50, 'mano', 'bizum')`)
  o = oferta(o1.id)
  check('ofrecer otra vez es un paso de la MISMA (y nunca más de lo que pide: 50 → 40, «pide»)', o1b.id === o1.id && Number(o.precio) === 40 && o1b.que === 'pide' && o.pasos.length === 2 && o.envio === 'mano' && Number(o.envio_precio) === 0, JSON.stringify(o1b))
  check('  …una sola viva', q(`select count(*) from tienda_ofertas where comprador_id = '${ANE}' and estado = 'abierta'`).out === '1')

  console.log('── Turnos ──')
  check('Ane no contesta su propia oferta (le toca a la tienda)', /le toca/.test(json(como(ANE), `tienda_oferta_responder('${o1.id}', 'aceptar')`).error || ''))
  check('Bea no ve ni toca la de Ane', /no existe/.test(json(como(BEA), `tienda_oferta_responder('${o1.id}', 'rechazar')`).error || '') && json(como(BEA), `tienda_oferta_ver('${o1.id}')`) === null)
  check('  …ni por la tabla (RLS)', q(`${como(BEA)} select count(*) from tienda_ofertas`).out === '0' && q(`${como(ANE)} select count(*) from tienda_ofertas`).out === '1')
  check('la tienda no contraoferta por encima de su precio', /Como mucho/.test(json(como(T), `tienda_oferta_responder('${o1.id}', 'contraoferta', 45)`).error || ''))
  q(`${como(ANE)} select tienda_oferta_enviar('${L}', 34, 'mano', 'bizum')`)
  let x = json(como(T), `tienda_oferta_responder('${o1.id}', 'contraoferta', 38)`)
  check('la tienda contraoferta 38: le toca a Ane', x.turno === 'comprador' && Number(x.precio) === 38, JSON.stringify(x))
  check('  …y ya no le toca a la tienda', /le toca/.test(json(como(T), `tienda_oferta_responder('${o1.id}', 'aceptar')`).error || ''))
  check('  …su aviso a Ane va a la conversación', /^\/mensajes\.html\?c=/.test(q(`select link from user_notifications where recipient_id = '${ANE}' order by created_at desc limit 1`).out))

  console.log('── Aceptar reserva ──')
  check('el Bizum no se ve antes de aceptar', json(como(ANE), `tienda_oferta_ver('${o1.id}')`).cobro === null)
  x = json(como(ANE), `tienda_oferta_responder('${o1.id}', 'aceptar')`)
  check('Ane acepta 38: aceptada, con su reserva de 7 días', x.estado === 'aceptada' && x.reserva_id && Math.abs(new Date(x.reservada_hasta) - Date.now() - 7 * 864e5) < 60e3, JSON.stringify(x))
  check('  …la unidad sale del stock a una reserva a su nombre y a 38', uds() === 1 && q(`select para || '|' || precio || '|' || para_usuario from tienda_reservas where id = '${x.reserva_id}'`).out === `@ane|38.00|${ANE}`)
  const v = json(como(ANE), `tienda_oferta_ver('${o1.id}')`)
  check('  …y ahora Ane ve el Bizum, sin el coste', v.cobro === '600 11 22 33' && v.coste === null && v.soy === 'comprador' && v.tienda.username === 'ryu', JSON.stringify(v))
  const vt = json(como(T), `tienda_oferta_ver('${o1.id}')`)
  check('la tienda ve su coste y no su propio Bizum', Number(vt.coste) === 25 && vt.cobro === null && vt.soy === 'tienda' && vt.comprador.username === 'ane')
  check('ya no se puede contestar', /ya no está abierta/.test(json(como(T), `tienda_oferta_responder('${o1.id}', 'rechazar')`).error || ''))
  const lista = json(como(T), `tienda_ofertas_lista('reservadas')`)
  check('el panel la lista en «reservadas» con quien compra y su coste', lista.cuentas.reservadas === 1 && lista.filas.length === 1 && lista.filas[0].comprador.username === 'ane' && Number(lista.filas[0].coste) === 25 && lista.filas[0].nombre === 'Charizard ex', JSON.stringify(lista).slice(0, 300))
  check('  …y una persona no puede pedir esa lista', /tienda/.test(json(como(ANE), `tienda_ofertas_lista('responder')`).error || ''))

  console.log('── Después de aceptar ──')
  check('solo la tienda marca pasos', /tienda/.test(json(como(ANE), `tienda_oferta_paso('${o1.id}', 'pagada')`).error || ''))
  x = json(como(T), `tienda_oferta_paso('${o1.id}', 'alargar')`)
  check('alargar suma 7 días a la reserva', Math.abs(new Date(x.reservada_hasta) - Date.now() - 14 * 864e5) < 60e3, JSON.stringify(x))
  x = json(como(T), `tienda_oferta_paso('${o1.id}', 'pagada')`)
  check('pagado', x.estado === 'pagada')
  x = json(como(T), `tienda_oferta_paso('${o1.id}', 'hecha', 'PK123')`)
  const venta = q(`select donde || '|' || precio || '|' || coste || '|' || unidades from tienda_ventas where ticket = '${x.ticket}'`).out
  check('hecha: la VENTA con «pokedoc», a 38 y con el coste de la línea; la reserva se va', x.estado === 'hecha' && venta === 'pokedoc|38.00|25.00|1' && q(`select count(*) from tienda_reservas`).out === '0' && uds() === 1, venta)
  check('  …y Ane recibe «Venta hecha» con el paso', /Venta hecha/.test(q(`select title from user_notifications where recipient_id = '${ANE}' order by created_at desc limit 1`).out))

  console.log('── Cancelar, rechazar, retirar y caducar ──')
  const o2 = json(como(BEA), `tienda_oferta_enviar('${L}', 40, 'mano', 'efectivo')`)
  json(como(T), `tienda_oferta_responder('${o2.id}', 'aceptar')`)
  check('Bea pide la última (40 €, efectivo) y la tienda acepta: no queda ninguna', uds() === 0)
  const o3 = json(como(ANE), `tienda_oferta_enviar('${L}', 36, 'mano', 'bizum')`)
  check('sin unidades, nadie ofrece', /No quedan tantas/.test(o3.error || ''))
  x = json(como(T), `tienda_oferta_paso('${o2.id}', 'cancelar')`)
  check('cancelar devuelve la unidad', x.estado === 'cancelada' && uds() === 1 && q(`select count(*) from tienda_reservas`).out === '0')
  const o4 = json(como(BEA), `tienda_oferta_enviar('${L}', 33, 'mano', 'bizum')`)
  x = json(como(T), `tienda_oferta_responder('${o4.id}', 'rechazar')`)
  check('rechazar', x.estado === 'rechazada' && uds() === 1)
  const o5 = json(como(BEA), `tienda_oferta_enviar('${L}', 33, 'mano', 'bizum')`)
  check('después de rechazada, otra oferta es otra fila', o5.id && o5.id !== o4.id)
  check('la tienda no retira la oferta de otro', /Solo quien ofrece/.test(json(como(T), `tienda_oferta_responder('${o5.id}', 'retirar')`).error || ''))
  x = json(como(BEA), `tienda_oferta_responder('${o5.id}', 'retirar')`)
  check('quien ofrece la retira', x.estado === 'retirada')
  const o6 = json(como(BEA), `tienda_oferta_enviar('${L}', 33, 'mano', 'bizum')`)
  q(`update tienda_ofertas set caduca_at = now() - interval '1 minute' where id = '${o6.id}'`)
  check('pasadas las 48 h no se puede aceptar', /caducado/.test(json(como(T), `tienda_oferta_responder('${o6.id}', 'aceptar')`).error || '') && uds() === 1)
  check('  …y `tienda_ofertas_al_dia` la apunta (también sin cuenta)', json(comoAnon, `tienda_ofertas_al_dia('${T}')`) >= 1 && oferta(o6.id).estado === 'caducada')
  const o7 = json(como(BEA), `tienda_oferta_enviar('${L}', 40, 'mano', 'bizum')`)
  x = json(como(T), `tienda_oferta_responder('${o7.id}', 'aceptar')`)
  q(`update tienda_reservas set hasta = now() - interval '1 minute' where id = '${x.reserva_id}'`)
  const vencida = json(como(BEA), `tienda_oferta_ver('${o7.id}')`)
  check('una reserva que vence: la carta vuelve y la oferta caduca', vencida.estado === 'caducada' && uds() === 1, JSON.stringify(vencida).slice(0, 200))
  check('  …y a una caducada ya no se le marca nada', /no está aceptada/.test(json(como(T), `tienda_oferta_paso('${o7.id}', 'hecha')`).error || ''))
  check('cada paso dejó su línea con el adjunto en la conversación', Number(msgs()) >= 12, msgs())
  check('la tienda y Ane comparten UNA conversación (y Bea la suya)', q(`select count(*) from conversation_participants a join conversation_participants b on b.conversation_id = a.conversation_id where a.user_id = '${ANE}' and b.user_id = '${T}'`).out === '1' && q(`select count(distinct conversation_id) from conversation_participants where user_id = '${T}'`).out === '2')
  check('ninguna función de dentro se llama desde fuera', !q(`${como(ANE)} select tienda_oferta_avisar('${o1.id}', '${ANE}', '${T}', 'x', 'x', 'x')`).ok)
}

console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
