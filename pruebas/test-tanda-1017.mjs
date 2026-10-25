// Tanda 1017 — la portada con cuenta en tres olas (R3 del repaso).
//
//   1. La migración contra PostgreSQL, sentencia a sentencia (631) y dos
//      veces: `valor_de_copia` suma lo mismo que la foto diaria (la 377 y la
//      905, con las funciones de precio DE VERDAD), `coleccion_valor_de` con
//      su puerta, y las tres funciones con las mismas reglas que tenía el
//      navegador (los torneos, los lanzamientos, lo a medias, los temas que
//      sigues con la regla de `estaSinLeer`, el foro de la portada y el
//      índice con sus cuentas de no leídos).
//   2. Lo estático: la lista de bloques jugables de la base es COPIA de
//      `PRACTICE_TYPES` (la 322: una copia se vigila), y los tres caminos
//      nuevos llevan su respaldo `sinMigracion`.
//   3. En pantalla, con el doble: la portada con cuenta pide `portada_hoy` y
//      `portada_foro` UNA vez y nada de lo que pedía antes; sin la migración
//      (__SIN_1017__) pinta LO MISMO con las consultas de antes; y el índice
//      del foro cuenta los nuevos por `foro_resumen`.
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const AQUI = new URL('.', import.meta.url).pathname
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(join(REPO, f), 'utf8')
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 320) : ''}`) }

const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-X', '-q', '-v', 'ON_ERROR_STOP=1']
const psql = (args, input) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000, input })
const BD = 'prueba_1017'
const A = '00000000-0000-0000-0000-0000000000a1'
const B = '00000000-0000-0000-0000-0000000000b2'
const como = (uid, s, rol = 'authenticated') => {
  const r = psql(['-t', '-A', '-d', BD, '-c', `begin; set local role ${rol}; ${uid ? `set local prueba.uid = '${uid}';` : ''} ${s}; commit;`])
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() }
}
const json = (g) => { try { return JSON.parse(g.out.split('\n').find((l) => /^[[{]/.test(l)) || 'null') } catch { return null } }
const sql = (s) => { const r = psql(['-t', '-A', '-d', BD, '-c', s]); return (r.stdout || '').trim() + (r.status ? ` ERROR ${r.stderr}` : '') }
// La última definición de cada función de precio, de su migración (la 905).
const bloque = (f, nombre) => {
  const s = leer(f)
  const i = s.lastIndexOf(`create or replace function public.${nombre}(`)
  const cuerpo = s.indexOf('as $$', i) + 5
  return s.slice(i, s.indexOf('$$;', cuerpo) + 3)
}
// La migración como el SQL Editor: sentencia a sentencia (631), respetando los `$$`.
const sentenciasDe = (texto) => {
  const resto = texto.replace(/^--[^\n]*$/gm, '')
  const re = /\$\$[\s\S]*?\$\$|;/g
  const lista = []
  let m, desde = 0
  while ((m = re.exec(resto))) if (m[0] === ';') { lista.push(resto.slice(desde, m.index).trim()); desde = m.index + 1 }
  return lista.filter(Boolean)
}

console.log('── 1. La migración, contra PostgreSQL ──')
const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433 donde probar', hay.status === 0, (hay.stderr || '').slice(0, 160))
if (hay.status === 0) {
  psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
  let r = psql(['-d', BD, '-f', join(AQUI, 'sql-tanda-1017.sql')])
  check('el andamio carga', r.status === 0, r.stderr)
  r = psql(['-d', BD], [
    bloque('supabase-migration-precios-tcgplayer.sql', 'eur_por_usd'),
    bloque('supabase-migration-precios-tcgplayer.sql', 'tp_de_version'),
    bloque('supabase-migration-precios-tcgplayer.sql', 'emparejamiento_dudoso'),
    bloque('supabase-migration-tcggo-japones.sql', 'valor_de_linea'),
    bloque('supabase-migration-905-gradeadas.sql', 'valor_gradeado'),
    bloque('supabase-migration-905-gradeadas.sql', 'coleccion_foto_diaria'),
  ].join(';\n\n') + ';\n')
  check('  …con las funciones de precio de verdad', r.status === 0, r.stderr)
  for (const f of ['supabase-migration-retos-xp.sql', 'supabase-migration-retos-comunidad.sql']) {
    r = psql(['-d', BD, '-f', join(REPO, f)])
    check(`  …y ${f}`, r.status === 0, r.stderr)
  }
  const migracion = leer('supabase-migration-1017-portada-consultas.sql')
  const sentencias = sentenciasDe(migracion)
  const errores = []
  for (const s of sentencias) {
    const x = psql(['-d', BD, '-c', s])
    if (x.status !== 0) errores.push(`${s.slice(0, 70)}… → ${x.stderr.slice(0, 220)}`)
  }
  check('la 1017 pasa sentencia a sentencia', !errores.length && sentencias.length >= 18, errores.join(' || ') || String(sentencias.length))
  r = psql(['-d', BD, '-f', join(REPO, 'supabase-migration-1017-portada-consultas.sql')])
  check('  …y otra vez encima', r.status === 0, r.stderr)

  console.log('── El valor: la misma cuenta que la foto diaria ──')
  // Las seis líneas de la 905 (una PSA 10 de Cardmarket, una BGS 9.5 de eBay,
  // una PSA 8 sin precio de su nota, una con «Tu valor», una cruda y una
  // PSA 10 de una carta sin gradeadas): la web suma 10.474.
  sql(`insert into public.tcg_card_prices (card_id, cm_low, cm_low_es, cm_gradeadas, ebay_gradeadas) values
      ('xy5-150', 39, 140, '{"psa":{"psa10":2621,"psa9":184}}', '{"bgs":{"9.5":{"median_price":100,"sample_size":3}}}'),
      ('sv8-1', 2, 3, null, null);
    insert into public.user_collection (user_id, card_id, idioma, cantidad, gradeo, valor_manual) values
      ('${A}', 'xy5-150', 'es', 2, 'PSA 10', null), ('${A}', 'xy5-150', 'es', 1, 'BGS 9.5', null), ('${A}', 'xy5-150', 'es', 1, 'PSA 8', null),
      ('${A}', 'xy5-150', 'es', 1, 'PSA 10', 5000), ('${A}', 'sv8-1', 'es', 1, null, null), ('${A}', 'sv8-1', 'es', 1, 'PSA 10', null),
      ('${A}', 'sin-precio', 'es', 3, null, null);
    select public.coleccion_foto_diaria('2026-10-20');`)
  const foto = sql(`select valor || '|' || copias || '|' || distintas || '|' || sin_precio from public.user_collection_value where user_id = '${A}' and dia = '2026-10-20'`)
  let d = json(como(A, `select public.coleccion_valor_de('${A}')`))
  const [fv, fc, fd, fs] = foto.split('|').map(Number)
  check('la foto diaria sigue sumando lo de la web (10.474, 10 copias, 3 sin precio)', fv === 10474 && fc === 10 && fd === 3 && fs === 3, foto)
  check('  …y `coleccion_valor_de` dice LO MISMO, de la misma función', d && Number(d.valor) === fv && d.copias === fc && d.distintas === fd && d.sin_precio === fs && d.lineas === 7, JSON.stringify(d))
  check('  …que no se le enseña a otro (colección privada: null, no cero)', json(como(B, `select coalesce(public.coleccion_valor_de('${A}')::text, 'null')`)) === null && como(B, `select coalesce(public.coleccion_valor_de('${A}')::text, 'nulo')`).out === 'nulo')
  sql(`update public.user_profiles set coleccion_publica = true where id = '${A}'`)
  check('  …y sí con la colección pública', json(como(B, `select public.coleccion_valor_de('${A}')`))?.valor === 10474)
  sql(`update public.user_profiles set coleccion_publica = false where id = '${A}'`)

  console.log('── portada_hoy(): lo tuyo de hoy, de una vez ──')
  sql(`insert into public.user_collection_value (user_id, dia, valor) values ('${A}', current_date - 40, 9000), ('${A}', current_date - 100, 1), ('${B}', current_date - 1, 5);
    insert into public.tournaments (id, slug, name, start_at, status, format, matchday_dates) values
      ('00000000-0000-0000-0001-0000000000e1', 't1', 'Liga', now() - interval '20 days', 'in_progress', 'liga', '["2099-01-10"]'),
      ('00000000-0000-0000-0001-0000000000e2', 't2', 'Copa', now() + interval '2 days', 'registration_open', 'standard', null),
      ('00000000-0000-0000-0001-0000000000e3', 't3', 'Vieja', now() - interval '2 days', 'registration_open', 'standard', null);
    insert into public.tournament_registrations (tournament_id, user_id, status) values
      ('00000000-0000-0000-0001-0000000000e1', '${A}', 'active'), ('00000000-0000-0000-0001-0000000000e2', '${B}', 'active'), ('00000000-0000-0000-0001-0000000000e2', '${A}', 'cancelled');
    insert into public.tcg_sets (id, market, name, serie_id, release_date, oculto, tcggo_id) values
      ('s1', 'WEST', 'Pronto', 'sv', current_date + 5, false, null), ('s2', 'WEST', 'Pocket', 'tcgp', current_date + 10, false, null),
      ('s3', 'JP', 'Japonés', 'sv', current_date + 12, false, null), ('s4', 'WEST', 'Ayer', 'sv', current_date - 1, false, null),
      ('s5', 'WEST', 'Luego', 'sv', current_date + 30, true, 7), ('s6', 'WEST', 'Y luego', 'sv', current_date + 40, false, null);
    insert into public.guides (id, slug, title, blocks, estimated_mins, published_at) values
      ('00000000-0000-0000-0002-0000000000f1', 'g1', 'Con curso', '[{"type":"text"},{"type":"quiz"}]', 10, now()),
      ('00000000-0000-0000-0002-0000000000f2', 'g2', 'Solo texto', '[{"type":"text"}]', 4, now()),
      ('00000000-0000-0000-0002-0000000000f3', 'g3', 'Acabada', '[]', 4, now());
    insert into public.user_progress (user_id, guide_id, current_block, status, started_at, read_at) values
      ('${A}', '00000000-0000-0000-0002-0000000000f1', 1, 'in_progress', now() - interval '1 hour', null),
      ('${A}', '00000000-0000-0000-0002-0000000000f2', 0, 'in_progress', now() - interval '2 hours', now() - interval '1 hour'),
      ('${A}', '00000000-0000-0000-0002-0000000000f3', 0, 'completed', now() - interval '3 hours', null);
    insert into public.user_decks (id, user_id, name, cards, updated_at) values
      ('00000000-0000-0000-0003-0000000000d1', '${A}', 'A medias', '[{"id":"x","n":2},{"id":"y","n":3}]', now()),
      ('00000000-0000-0000-0003-0000000000d2', '${A}', 'Vacío', '[]', now() - interval '1 day');
    insert into public.forum_sections (id, name, position) values ('00000000-0000-0000-0004-0000000000c1', 'General', 1);
    insert into public.forum_boards (id, section_id, name, slug, position, is_hidden) values
      ('00000000-0000-0000-0005-0000000000b1', '00000000-0000-0000-0004-0000000000c1', 'Charla', 'charla', 1, false),
      ('00000000-0000-0000-0005-0000000000b2', '00000000-0000-0000-0004-0000000000c1', 'Escondido', 'escondido', 2, true);
    insert into public.forum_threads (id, board_id, title, post_count, author_id, last_post_author_id, created_at, last_post_at) values
      ('00000000-0000-0000-0006-0000000000a1', '00000000-0000-0000-0005-0000000000b1', 'Hola a todos', 2, '${A}', '${B}', now() - interval '2 hours', now() - interval '1 hour'),
      ('00000000-0000-0000-0006-0000000000a2', '00000000-0000-0000-0005-0000000000b1', 'Lo mío', 1, '${A}', '${A}', now() - interval '30 minutes', now() - interval '30 minutes'),
      ('00000000-0000-0000-0006-0000000000a3', '00000000-0000-0000-0005-0000000000b1', 'Sin mensajes', 0, '${B}', null, now() - interval '5 days', null),
      ('00000000-0000-0000-0006-0000000000a4', '00000000-0000-0000-0005-0000000000b2', 'Oculto', 1, '${B}', '${B}', now() - interval '10 minutes', now() - interval '10 minutes');
    insert into public.forum_posts (thread_id, author_id, body_html, created_at) values
      ('00000000-0000-0000-0006-0000000000a1', '${A}', '<p>Primero</p>', now() - interval '2 hours'),
      ('00000000-0000-0000-0006-0000000000a1', '${B}', '<p>Segundo, de misty</p>', now() - interval '1 hour'),
      ('00000000-0000-0000-0006-0000000000a2', '${A}', '<p>Lo mío</p>', now() - interval '30 minutes'),
      ('00000000-0000-0000-0006-0000000000a4', '${B}', '<p>Oculto</p>', now() - interval '10 minutes');
    insert into public.forum_subscriptions (user_id, thread_id) values ('${A}', '00000000-0000-0000-0006-0000000000a1'), ('${A}', '00000000-0000-0000-0006-0000000000a2');
    insert into public.forum_thread_reads (user_id, thread_id, last_read_at) values ('${A}', '00000000-0000-0000-0006-0000000000a1', now() - interval '3 hours');
    insert into public.course_review_queue (user_id, guide_id, question_key, review_after) values
      ('${A}', '00000000-0000-0000-0002-0000000000f1', 'q1', now() - interval '1 hour'), ('${A}', '00000000-0000-0000-0002-0000000000f1', 'q2', now() + interval '1 day');`)
  const anon = como(null, 'select coalesce(public.portada_hoy()::text, \'nulo\')', 'anon')
  check('sin cuenta, portada_hoy no da nada (anon ni puede llamarla)', !anon.ok && /permission denied/.test(anon.err), anon.out + anon.err)
  d = json(como(A, 'select public.portada_hoy()'))
  check('con cuenta: la historia de 60 días (la foto de arriba y la de hace 40; no la de hace 100 ni la de otro) y la suma de ahora', d?.valor?.historia?.length === 2 && d.valor.historia[0].valor === 9000 && d.valor.historia[1].valor === 10474 && d.valor.ahora?.valor === 10474 && d.valor.ahora.lineas === 7, JSON.stringify(d?.valor))
  check('tus torneos: los de inscripción activa, con sus jornadas (quién es el próximo lo decide la web)', d?.torneos?.length === 1 && d.torneos[0].slug === 't1' && d.torneos[0].matchday_dates?.[0] === '2099-01-10' && d.torneos[0].format === 'liga', JSON.stringify(d?.torneos))
  check('el próximo abierto: el que empieza antes y no ha pasado', d?.abierto?.slug === 't2', JSON.stringify(d?.abierto))
  check('los lanzamientos: tres occidentales desde hoy, sin Pocket, con los escondidos de TCGGO', (d?.sets || []).map((s) => s.name).join(',') === 'Pronto,Luego,Y luego' && d.sets[1].oculto === true && d.sets[1].tcggo_id === 7, JSON.stringify(d?.sets))
  const p = d?.sigue?.progreso || []
  check('lo a medias: las guías empezadas sin acabar (la última abierta primero), con sus bloques contados y si tienen curso', p.length === 2 && p[0].guia.slug === 'g1' && p[0].guia.bloques === 2 && p[0].guia.curso === true && p[0].current_block === 1 && p[1].guia.slug === 'g2' && p[1].guia.curso === false && p[1].read_at, JSON.stringify(p))
  check('  …y los mazos con sus cartas contadas', d?.sigue?.mazos?.length === 2 && d.sigue.mazos[0].name === 'A medias' && Number(d.sigue.mazos[0].cartas) === 5 && Number(d.sigue.mazos[1].cartas) === 0, JSON.stringify(d?.sigue?.mazos))
  check('los temas que sigues con algo nuevo: el de misty (posterior a tu marca), no el tuyo', d?.hilos?.cuenta === 1 && d.hilos.uno === '00000000-0000-0000-0006-0000000000a1' && d.hilos.titulo === 'Hola a todos', JSON.stringify(d?.hilos))
  check('los retos y la gente de hoy, de sus funciones', d?.retos && 'racha' in d.retos && d?.comunidad && 'jugadores' in d.comunidad, JSON.stringify({ retos: Object.keys(d?.retos || {}), comunidad: Object.keys(d?.comunidad || {}) }))
  check('una pregunta por repasar (la otra es para mañana)', d?.repaso === 1, String(d?.repaso))
  check('los primeros pasos: leído y curso sí, foro sí, trofeo no', d?.pasos?.leer === true && d.pasos.curso === true && d.pasos.foro === true && d.pasos.logro === false, JSON.stringify(d?.pasos))
  sql(`update public.user_profiles set achievements = array['primeros_pasos'] where id = '${A}'`)
  check('  …y con el trofeo, el trofeo', json(como(A, 'select public.portada_hoy()'))?.pasos?.logro === true)
  sql(`update public.user_profiles set forum_read_all_at = now() where id = '${A}'`)
  check('«todo leído» de hace un momento deja los temas que sigues a cero', json(como(A, 'select public.portada_hoy()'))?.hilos?.cuenta === 0)
  sql(`update public.user_profiles set forum_read_all_at = null where id = '${A}'`)

  console.log('── portada_foro(): «Ahora en el foro», de una vez ──')
  const DESDE = `now() - interval '3 hours'`
  d = json(como(null, `select public.portada_foro(${DESDE})`, 'anon'))
  check('sin cuenta: los temas de los foros que se ven (el escondido no), el más hablado delante', (d?.temas || []).map((t) => t.title).join('|') === 'Hola a todos|Lo mío|Sin mensajes', JSON.stringify((d?.temas || []).map((t) => t.title)))
  check('  …lo de hoy por tema y cuánta gente escribe', d?.hoy?.['00000000-0000-0000-0006-0000000000a1'] === 2 && d.hoy['00000000-0000-0000-0006-0000000000a2'] === 1 && d.escribiendo === 2, JSON.stringify({ hoy: d?.hoy, escribiendo: d?.escribiendo }))
  check('  …el último mensaje del de delante y quién participa (el más reciente primero)', /misty/.test(d?.ultimo?.body_html || '') && JSON.stringify(d?.participantes) === JSON.stringify([B, A]), JSON.stringify({ ultimo: d?.ultimo, participantes: d?.participantes }))
  check('  …los perfiles de los dos y el nombre del foro', d?.perfiles?.[A]?.username === 'ash' && d.perfiles[B]?.username === 'misty' && d.foros?.['00000000-0000-0000-0005-0000000000b1'] === 'Charla' && !('00000000-0000-0000-0005-0000000000b2' in (d.foros || {})), JSON.stringify({ perfiles: Object.keys(d?.perfiles || {}), foros: d?.foros }))
  check('  …y nada sin leer, que sin cuenta no hay marcas', JSON.stringify(d?.nuevos) === '{}' && d?.sesion === false)
  d = json(como(A, `select public.portada_foro(${DESDE})`))
  check('con cuenta: el de delante tiene UN mensaje nuevo (el de misty tras tu marca); el tuyo, ninguno', JSON.stringify(d?.nuevos) === JSON.stringify({ '00000000-0000-0000-0006-0000000000a1': 1 }) && d?.sesion === true, JSON.stringify(d?.nuevos))
  sql(`delete from public.forum_thread_reads where user_id = '${A}'`)
  d = json(como(A, `select public.portada_foro(${DESDE})`))
  check('  …sin marca ninguna, los mensajes que tiene (hasta diez)', d?.nuevos?.['00000000-0000-0000-0006-0000000000a1'] === 2, JSON.stringify(d?.nuevos))

  console.log('── foro_resumen(): el índice, de una vez ──')
  d = json(como(A, 'select public.foro_resumen()'))
  check('con cuenta: la sección, el foro visible con sus cuentas (el escondido no)', d?.secciones?.[0]?.name === 'General' && d.foros?.length === 1 && d.foros[0].slug === 'charla' && d.foros[0].thread_count === 3 && d.foros[0].post_count === 3, JSON.stringify(d?.foros))
  check('  …un tema sin leer en ese foro (el de misty; el tuyo y el sin mensajes no)', d?.nuevos?.['00000000-0000-0000-0005-0000000000b1'] === 1, JSON.stringify(d?.nuevos))
  check('  …el perfil del último que escribió, tu rol y que hay marcas', d?.perfiles?.[A]?.username === 'ash' && d.rol?.staff === false && d.rol?.admin === false && d.marcas === true, JSON.stringify({ perfiles: Object.keys(d?.perfiles || {}), rol: d?.rol, marcas: d?.marcas }))
  sql(`update public.user_profiles set is_moderator = true where id = '${A}'`)
  check('  …y de moderador, staff', json(como(A, 'select public.foro_resumen()'))?.rol?.staff === true)
  d = json(como(null, 'select public.foro_resumen()', 'anon'))
  check('sin cuenta: lo mismo sin nuevos, sin rol y sin marcas', d?.foros?.length === 1 && JSON.stringify(d.nuevos) === '{}' && d.rol === null && d.marcas === false, JSON.stringify({ nuevos: d?.nuevos, rol: d?.rol, marcas: d?.marcas }))
  if (!process.env.PD_DEJAR) psql(['-c', `drop database if exists ${BD}`])
}

console.log('\n── 2. Lo estático ──')
{
  const sqlTxt = leer('supabase-migration-1017-portada-consultas.sql')
  const enSql = (sqlTxt.match(/v_practica text\[\] := array\[([^\]]+)\]/) || [])[1]?.match(/'([^']+)'/g)?.map((x) => x.slice(1, -1)) || []
  const enJs = (leer('js/guia-contenido.js').match(/export const PRACTICE_TYPES = \[([^\]]+)\]/) || [])[1]?.match(/'([^']+)'/g)?.map((x) => x.slice(1, -1)) || []
  check('los bloques jugables de la base son los de PRACTICE_TYPES (una copia, vigilada)', enJs.length >= 10 && JSON.stringify(enSql) === JSON.stringify(enJs), `${enSql.join(',')} / ${enJs.join(',')}`)
  const hoy = leer('js/hoy.js')
  check('hoy.js pide portada_hoy UNA vez por visita y cae a lo de antes sin la migración', /let pedidoDeHoy = null/.test(hoy) && /supabase\.rpc\('portada_hoy'\)/.test(hoy) && /sinMigracion\(error\)/.test(hoy) && /datos \? await deLaBase\(/.test(hoy))
  check('el bloque de retos y los primeros pasos lo comparten (datosDeHoy)', /hoyMod\.datosDeHoy\(session\.user\.id\)/.test(leer('js/home.js')) && /m\.datosDeHoy\(session\.user\.id\)/.test(leer('js/primeros-pasos.js')))
  check('con sesión el héroe no pide sus cinco consultas', /session \? null : pintarHeroe\(\)/.test(leer('js/home.js')))
  const pb = leer('js/portada-bloques.js')
  check('el foro de la portada pide portada_foro con tu medianoche y cae a lo de antes', /rpc\('portada_foro', \{ p_desde: medianoche\.toISOString\(\) \}\)/.test(pb) && /return datosDelForoAntiguo\(session\)/.test(pb))
  const foro = leer('js/foro.js')
  check('el índice del foro pide foro_resumen y solo sin ella las lecturas de antes', /rpc\('foro_resumen'\)/.test(foro) && /if \(sesion\) lecturas = cargarLecturas\(\)/.test(foro) && /if \(sesion && \(consulta \|\| slugForo\)\) lecturas = cargarLecturas\(\)/.test(foro))
  check('`sinMigracion` vive en un módulo sin dependencias y lo importan los tres', /^export const sinMigracion/m.test(leer('js/sin-migracion.js')) && !/^import/m.test(leer('js/sin-migracion.js')) && [hoy, pb, foro].every((t) => /from '\.\/sin-migracion\.js'/.test(t)))
}

console.log('\n── 3. En pantalla ──')
{
  const browser = await chromium.launch()
  const HOY = new Date()
  const en = (dias) => new Date(Date.now() + dias * 86400e3).toISOString()
  const SEMILLA = {
    __FAKE_SESSION__: 'user-1',
    __FAKE_COLECCION__: [{ user_id: 'user-1', card_id: 'sv8-1', cantidad: 2, idioma: 'es' }],
    __FAKE_PRECIOS__: [{ card_id: 'sv8-1', cm_low: 10, cm_low_es: 12 }],
    __FAKE_TORNEOS__: [{ status: 'registration_open', name: 'Copa de la portada', start_at: en(2) }],
    __FAKE_SETS__: [{ id: 'sv99', name: 'Set que viene', serie_id: 'sv', release_date: en(10).slice(0, 10), market: 'WEST' }],
    __FAKE_SECCIONES__: [{ name: 'General' }],
    __FAKE_FOROS__: [{ name: 'Charla', slug: 'charla' }],
    __FAKE_TEMAS__: [{ title: 'Hola desde el foro', author_id: 'admin-1', last_post_author_id: 'admin-1', post_count: 2, last_post_at: new Date(Date.now() - 3600e3).toISOString() }],
    __FAKE_MENSAJES__: [{ thread_id: 'tema-1', author_id: 'admin-1', body_html: '<p>Un mensaje de la mañana</p>', created_at: new Date(Date.now() - 3600e3).toISOString() }],
    __FAKE_SUSCRIPCIONES__: [{ user_id: 'user-1', thread_id: 'tema-1' }],
  }
  async function abrir(ruta, extra = {}) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'es-ES', serviceWorkers: 'block' })
    await ctx.addInitScript((s) => {
      for (const [k, v] of Object.entries(s)) window[k] = v
      window.__QUIEN__ = []
      window.__LINEA__ = []
      try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())); localStorage.setItem('sb-prueba-auth-token', '{}') } catch {}
    }, { ...SEMILLA, ...extra })
    const page = await ctx.newPage()
    const errores = []
    page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
    await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2600)
    const pedidas = await page.evaluate(() => ({ tablas: window.__QUIEN__.map(([t, , f]) => `${t}@${f}`), rpcs: window.__LINEA__.filter((x) => /^rpc:/.test(x[0])).map((x) => x[0]) }))
    return { page, ctx, errores, pedidas }
  }
  const leerPortada = (page) => page.evaluate(() => ({
    valor: (document.querySelector('.hoy-valor b')?.textContent || '').replace(/\u00a0/g, ' ').trim(),
    fichas: [...document.querySelectorAll('.hoy-ficha b')].map((b) => b.textContent.trim()),
    foro: document.querySelector('#foroVivo .pb-foro-titulo')?.textContent.trim() || '',
    nuevos: document.querySelector('#foroVivo .pb-nuevos')?.textContent.trim() || '',
    pasos: document.querySelector('#primerosPasos .primeros-pasos-cuenta')?.textContent.trim() || '',
  }))
  const con = await abrir('/index.html')
  const v1 = await leerPortada(con.page)
  check('con la migración: la cartera, las fichas (torneo en 2 días, el set que viene, 1 sin leer) y el foro con su «nuevo»', v1.valor === '24,00 €' && v1.fichas.some((f) => /Torneo en 2 días/.test(f)) && v1.fichas.some((f) => /^Sale /.test(f)) && v1.fichas.includes('1 sin leer') && v1.foro === 'Hola desde el foro' && /nuevo/.test(v1.nuevos) && v1.pasos === '0 de 3', JSON.stringify(v1))
  check('  …pidiendo portada_hoy y portada_foro UNA vez cada una', con.pedidas.rpcs.filter((x) => x === 'rpc:portada_hoy').length === 1 && con.pedidas.rpcs.filter((x) => x === 'rpc:portada_foro').length === 1, con.pedidas.rpcs.join(' '))
  const deAntes = con.pedidas.tablas.filter((x) => /@js\/(hoy|primeros-pasos|curso-datos|portada-retos)\.js|forum_boards@js\/portada-bloques|forum_threads@js\/portada-bloques|forum_posts@js\/portada-bloques|user_collection@js\/mi-coleccion\/datos|^(guides|user_profiles|tcg_cards|tcg_sets)@js\/home\.js/.test(x))
  check('  …y ninguna de las que pedían antes hoy.js, los primeros pasos, el bloque del foro ni el héroe', deAntes.length === 0, deAntes.join(' '))
  check('  …sin errores', con.errores.length === 0, con.errores.join(' | '))
  await con.ctx.close()
  const sin = await abrir('/index.html', { __SIN_1017__: true })
  const v2 = await leerPortada(sin.page)
  check('sin la migración, LO MISMO en pantalla', JSON.stringify(v2) === JSON.stringify(v1), JSON.stringify(v2))
  check('  …con las consultas de antes', sin.pedidas.tablas.some((x) => /forum_subscriptions@js\/hoy\.js/.test(x)) && sin.pedidas.tablas.some((x) => /forum_threads@js\/portada-bloques/.test(x)) && sin.pedidas.tablas.some((x) => /user_progress@js\/primeros-pasos/.test(x)), sin.pedidas.tablas.filter((x) => /hoy|portada-bloques|primeros/.test(x)).join(' '))
  check('  …sin errores', sin.errores.length === 0, sin.errores.join(' | '))
  await sin.ctx.close()
  const foro = await abrir('/foro.html')
  const chapa = await foro.page.evaluate(() => document.querySelector('#foroPrincipal .foro-chapa-nuevos')?.textContent.trim() || '')
  check('el índice del foro cuenta el tema sin leer por foro_resumen, sin bajar las lecturas ni mil temas', chapa === '1 nuevo' && foro.pedidas.rpcs.includes('rpc:foro_resumen') && !foro.pedidas.tablas.some((x) => /forum_thread_reads@js\/foro-lecturas|forum_threads@js\/foro-lecturas|forum_boards_resumen@js\/foro\.js/.test(x)), `${chapa} · ${foro.pedidas.tablas.filter((x) => /foro/.test(x)).join(' ')}`)
  check('  …sin errores', foro.errores.length === 0, foro.errores.join(' | '))
  await foro.ctx.close()
  await browser.close()
}

console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
