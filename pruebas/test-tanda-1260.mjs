// Tanda 1260 — los avisos del equipo, de verdad: varios a la vez, dónde sale
// cada uno, cifras sin quién, «Me apunto» con sorteo y el recordatorio del
// final. Lo puro (js/aviso-puro.js) y la migración contra PostgreSQL de
// verdad, dos veces encima y sentencia a sentencia (la 631).
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── Lo puro ──')
{
  const m = await import(`${REPO}/js/aviso-puro.js`)
  const ahora = new Date('2026-11-06T12:00:00Z')
  const base = { id: 'a1', titulo: 'Gana los Funko Pop', tipo: 'concurso', sitios: ['popup', 'franja', 'inicio', 'campanita'], publicado: true, publico: 'todos' }
  const a = (x) => ({ ...base, ...x })
  check('estado: borrador, programado, en marcha y terminado', m.estadoDeAviso(a({ publicado: false }), ahora) === 'borrador' && m.estadoDeAviso(a({ desde: '2026-11-07T00:00:00Z' }), ahora) === 'programado' && m.estadoDeAviso(a({ hasta: '2026-11-15T22:59:00Z' }), ahora) === 'en_marcha' && m.estadoDeAviso(a({ hasta: '2026-11-06T11:00:00Z' }), ahora) === 'terminado')
  check('a quién: con cuenta, sin cuenta y en el móvil', !m.seVeAviso(a({ publico: 'cuenta' }), { ahora }) && m.seVeAviso(a({ publico: 'cuenta' }), { ahora, conCuenta: true }) && m.seVeAviso(a({ publico: 'sin_cuenta' }), { ahora }) && !m.seVeAviso(a({ publico: 'sin_cuenta' }), { ahora, conCuenta: true }) && !m.seVeAviso(a({ publico: 'movil' }), { ahora }) && m.seVeAviso(a({ publico: 'movil' }), { ahora, movil: true }))
  check('una tienda solo ve la franja de mantenimiento', !m.seVeAviso(a({}), { ahora, tienda: true }) && m.seVeAviso(a({ tipo: 'mantenimiento' }), { ahora, tienda: true }))
  check('lo que queda: días, horas y minutos', JSON.stringify(m.loQueQueda('2026-11-15T22:59:00Z', ahora)) === JSON.stringify({ dias: 9, horas: 10, minutos: 59 }) && m.loQueQueda('2026-11-06T11:00:00Z', ahora) === null)
  check('  …y en palabras', m.quedanTexto('2026-11-15T22:59:00Z', ahora) === 'Quedan 9 días' && m.quedanTexto('2026-11-06T20:00:00Z', ahora) === 'Quedan 8 horas' && m.quedanTexto('2026-11-06T12:30:00Z', ahora) === 'Quedan 30 min' && m.quedanTexto('2026-11-07T12:00:00Z', ahora) === 'Queda 1 día')
  const lista = [a({ id: 'n', tipo: 'novedad', publicado_at: '2026-11-05T00:00:00Z' }), a({ id: 'm', tipo: 'mantenimiento', sitios: ['franja'], publicado_at: '2026-11-01T00:00:00Z' }), a({ id: 'c', publicado_at: '2026-11-04T00:00:00Z' })]
  check('la franja que sale: la más importante (mantenimiento antes que concurso y novedad)', m.elegir(lista, 'franja')?.id === 'm')
  check('el pop-up que sale: el más nuevo de los que lo llevan', m.elegir(lista, 'popup')?.id === 'n' && m.elegir(lista, 'popup', { vistos: new Set([m.huellaDeAviso(lista[0])]) })?.id === 'c' && m.elegir(lista, 'popup', { vistos: new Set([m.huellaDeAviso(lista[0]), m.huellaDeAviso(lista[2])]) }) === null)
  check('el enlace: de la casa o https; javascript: y // no', m.enlaceSeguro('/tema/x') === '/tema/x' && m.enlaceSeguro('https://instagram.com/p/x') === 'https://instagram.com/p/x' && m.enlaceSeguro('javascript:alert(1)') === '' && m.enlaceSeguro('//malo.com') === '' && m.enlaceSeguro('http://x') === '')
  const h = m.huellaDeAviso(a({}))
  check('la huella cambia con otro título o con otra fecha (vuelve a salir)', h !== m.huellaDeAviso(a({ titulo: 'Otro' })) && h !== m.huellaDeAviso(a({ desde: '2026-11-07T00:00:00Z' })) && h === m.huellaDeAviso(a({ publico: 'movil' })))
  const p = m.popHtml(a({ titulo: '<b>ojo</b>', texto: 'Bulbasaur, Charmander y Squirtle', participar: true, cuenta_atras: true, hasta: '2026-11-15T22:59:00Z', enlace: '/tema/bases', enlace_texto: 'Bases del concurso' }), { ahora })
  check('el pop-up: título escapado, cuenta atrás, «Me apunto» y el enlace pequeño', /&lt;b&gt;ojo/.test(p) && /data-cuenta/.test(p) && /data-apuntarme/.test(p) && /href="\/tema\/bases"[^>]*>Bases del concurso/.test(p))
  const sinImg = m.popHtml(a({ imagen: null }), { ahora })
  check('  …sin imagen, el degradado con el icono del tipo', /aviso-pop-hero[^"]*sin-imagen/.test(sinImg) && !/<img/.test(sinImg))
  const conImg = m.popHtml(a({ imagen: 'https://x.supabase.co/storage/v1/object/public/avisos/a.webp' }), { ahora })
  check('  …con imagen, la imagen con su tamaño reservado', /<img[^>]+src="https:\/\/x\.supabase\.co[^"]+"[^>]+width="[0-9]+"[^>]+height="[0-9]+"/.test(conImg))
  check('  …con un botón que lleva a un sitio', /href="\/foro"[^>]*data-aviso-clic[^>]*>Ver más/.test(m.popHtml(a({ participar: false, boton_texto: 'Ver más', boton_enlace: '/foro' }), { ahora })))
  check('  …y sin «Me apunto», sin botón ni enlace raros', !/href="javascript/.test(m.popHtml(a({ participar: false, boton_texto: 'X', boton_enlace: 'javascript:alert(1)' }), { ahora })))
  const f = m.franjaHtml(a({ cuenta_atras: true, hasta: '2026-11-15T22:59:00Z', participar: true }), { ahora })
  check('la franja: su tipo, lo que queda y el botón', /data-tipo="concurso"/.test(f) && /Quedan 9 días/.test(f) && /data-apuntarme|data-abrir-aviso/.test(f) && /aviso-global-cerrar/.test(f))
  const t = m.tarjetaHtml(a({ cuenta_atras: true, hasta: '2026-11-15T22:59:00Z' }), { ahora })
  check('la tarjeta de Inicio: chapa del tipo, título y lo que queda', /aviso-tarjeta/.test(t) && /Concurso/.test(t) && /Quedan 9 días/.test(t))
  check('los tipos y sus plantillas', Object.keys(m.TIPOS_DE_AVISO).join() === 'concurso,novedad,evento,aviso,mantenimiento' && m.PLANTILLAS.concurso.participar === false && m.PLANTILLAS.concurso.boton_texto === 'Apuntarme' && m.PLANTILLAS.concurso.sitios.length === 4 && m.PLANTILLAS.mantenimiento.sitios.join() === 'franja')
  check('las cifras: suma de días y el porcentaje', JSON.stringify(m.sumarCifras([{ vistos: 10, clics: 3, cerrados: 2 }, { vistos: 30, clics: 7, cerrados: 1 }])) === JSON.stringify({ vistos: 40, clics: 10, cerrados: 3, porcentaje: 25 }) && m.sumarCifras([]).porcentaje === null)
}

console.log('── La migración, contra PostgreSQL ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const BD = 'prueba_1260'
  const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
  const mig = readFileSync(`${REPO}/supabase-migration-1260-avisos.sql`, 'utf8')
  check('la migración no usa tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
  const hay = psql(['-c', 'select 1'])
  check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0, hay.stderr)
  if (hay.status === 0) {
    psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
    const ADMIN = '00000000-0000-0000-0000-00000000ad01'
    const ANE = '00000000-0000-0000-0000-0000000000a1'
    const JON = '00000000-0000-0000-0000-0000000000a2'
    const TIENDA = '00000000-0000-0000-0000-0000000000a3'
    const MIKEL = '00000000-0000-0000-0000-0000000000a4'
    const ANDAMIO = `do $$ begin create role anon; exception when duplicate_object then null; end $$;
      do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
      do $$ begin create role service_role; exception when duplicate_object then null; end $$;
      create schema if not exists auth; create table auth.users (id uuid primary key);
      grant usage on schema auth to anon, authenticated, service_role;
      create or replace function auth.uid() returns uuid language sql as $f$ select nullif(current_setting('prueba.uid', true), '')::uuid $f$;
      create or replace function is_admin() returns boolean language sql as $f$ select current_setting('prueba.admin', true) = 'si' $f$;
      grant usage on schema public to anon, authenticated, service_role;
      create table user_profiles (id uuid primary key, username text, display_name text, avatar_url text, tipo text, notification_prefs_disabled text[] not null default '{}');
      grant select on user_profiles to anon, authenticated;
      create table user_notifications (id uuid primary key default gen_random_uuid(), recipient_id uuid not null, type text not null, title text not null, body text, link text, created_at timestamptz not null default now());
      create table site_settings (key text primary key, value jsonb, updated_at timestamptz default now());
      insert into site_settings values ('aviso_global', '{"texto": "Torneo el sábado", "tono": "aviso", "enlace": "/torneos", "texto_enlace": "Apúntate", "activo": true, "publico": "movil"}');
      create schema storage; grant usage on schema storage to anon, authenticated, service_role;
      create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
      create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text references storage.buckets(id), name text, owner uuid default auth.uid());
      alter table storage.objects enable row level security;
      grant select, insert, update, delete on storage.objects to anon, authenticated;
      insert into auth.users values ('${ADMIN}'), ('${ANE}'), ('${JON}'), ('${TIENDA}'), ('${MIKEL}');
      insert into user_profiles (id, username, display_name, tipo, notification_prefs_disabled) values
        ('${ADMIN}', 'pingu', 'PINGU', null, '{}'), ('${ANE}', 'ane', 'Ane', null, '{}'), ('${JON}', 'jon', 'Jon', null, '{aviso_equipo}'),
        ('${TIENDA}', 'rincon', 'El Rincón', 'tienda', '{}'), ('${MIKEL}', 'mikel', 'Mikel', null, '{}');`
    let r = psql(['-d', BD, '-c', ANDAMIO])
    check('el andamio carga', r.status === 0, r.stderr)
    r = psql(['-d', BD, '-c', readFileSync(`${REPO}/supabase-migration-1120-avisos.sql`, 'utf8').replace(/notify pgrst[^;]*;/, '')])
    check('la 1120 debajo (avisos_enviados)', r.status === 0, r.stderr)
    const sinNotify = mig.replace(/notify pgrst[^;]*;/, '')
    r = psql(['-d', BD, '-c', sinNotify])
    check('la 1260 entra', r.status === 0, r.stderr)
    check('  …y otra vez encima', psql(['-d', BD, '-c', sinNotify]).status === 0)
    check('el aviso de antes, dentro una sola vez: franja de tipo aviso, en el móvil, con su botón', q(`select count(*), string_agg(tipo || '|' || titulo || '|' || boton_texto || '|' || boton_enlace || '|' || array_to_string(sitios, ',') || '|' || publico || '|' || publicado, ',') from avisos`).out === '1|aviso|Torneo el sábado|Apúntate|/torneos|franja|movil|true')

    const comoAdmin = `set prueba.uid = '${ADMIN}'; set prueba.admin = 'si'; set role authenticated;`
    const como = (id) => `set prueba.uid = '${id}'; set prueba.admin = 'no'; set role authenticated;`
    const comoAnon = `set prueba.uid = ''; set prueba.admin = 'no'; set role anon;`
    q(`delete from avisos`)
    let x = q(`${comoAdmin} insert into avisos (tipo, titulo, sitios, participar, recordar, publicado, publicado_at, hasta) values ('concurso', 'Gana los Funko Pop', '{popup,franja,inicio,campanita}', true, true, true, now(), now() + interval '20 hours') returning id`)
    check('el equipo crea un concurso', x.ok, x.err)
    const C = x.out.split('\n')[0]
    q(`${comoAdmin} insert into avisos (titulo, publicado) values ('Un borrador', false)`)
    q(`${comoAdmin} insert into avisos (titulo, publicado, desde) values ('Programado', true, now() + interval '2 days')`)
    q(`${comoAdmin} insert into avisos (titulo, publicado, desde, hasta) values ('Terminado', true, now() - interval '3 days', now() - interval '1 day')`)
    check('la gente ve solo lo que está en marcha (sin cuenta y con cuenta)', q(`${comoAnon} select string_agg(titulo, ',') from avisos`).out === 'Gana los Funko Pop' && q(`${como(ANE)} select string_agg(titulo, ',') from avisos`).out === 'Gana los Funko Pop')
    check('  …y el equipo, todos', q(`${comoAdmin} select count(*) from avisos`).out === '4')
    check('alguien que no es del equipo no crea ni cambia', !q(`${como(ANE)} insert into avisos (titulo, publicado) values ('Spam', true)`).ok && q(`${como(ANE)} update avisos set titulo = 'x' returning id`).out === '')
    check('un sitio raro, sin sitios o un enlace raro, no', !q(`${comoAdmin} insert into avisos (titulo, sitios) values ('x', '{banner}')`).ok && !q(`${comoAdmin} insert into avisos (titulo, sitios) values ('x', '{}')`).ok && !q(`${comoAdmin} insert into avisos (titulo, boton_enlace) values ('x', 'javascript:alert(1)')`).ok && !q(`${comoAdmin} insert into avisos (titulo, imagen) values ('x', 'http://x/a.png')`).ok)
    check('  …ni «hasta» antes de «desde»', !q(`${comoAdmin} insert into avisos (titulo, desde, hasta) values ('x', now(), now() - interval '1 hour')`).ok)

    // Cifras
    q(`${comoAnon} select aviso_contar('${C}', 'visto')`); q(`${como(ANE)} select aviso_contar('${C}', 'visto')`); q(`${comoAnon} select aviso_contar('${C}', 'clic')`); q(`${comoAnon} select aviso_contar('${C}', 'cerrado')`)
    q(`${comoAnon} select aviso_contar('${C}', 'hackeo')`)
    const T = q(`select id from avisos where titulo = 'Terminado'`).out
    q(`${comoAnon} select aviso_contar('${T}', 'visto')`)
    check('las cifras suman sin guardar quién (2 vistos, 1 clic, 1 cerrado)', q(`select vistos || '|' || clics || '|' || cerrados from aviso_cifras where aviso_id = '${C}'`).out === '2|1|1')
    check('  …un aviso terminado o una cosa rara no suman', q(`select count(*) from aviso_cifras where aviso_id = '${T}'`).out === '0')
    check('  …y solo las lee el equipo', q(`${como(ANE)} select count(*) from aviso_cifras`).out === '0' && q(`${comoAdmin} select count(*) from aviso_cifras`).out === '1')

    // Me apunto
    check('sin cuenta no se apunta nadie', /permission denied/.test(q(`${comoAnon} select aviso_apuntarme('${C}')`).err))
    x = q(`${como(ANE)} select aviso_apuntarme('${C}')`)
    check('Ane se apunta', x.ok && JSON.parse(x.out).total === 1 && JSON.parse(x.out).ya === false, x.err)
    x = q(`${como(ANE)} select aviso_apuntarme('${C}')`)
    check('  …dos veces es una («ya»)', x.ok && JSON.parse(x.out).ya === true && JSON.parse(x.out).total === 1)
    check('una tienda no participa', /tienda/.test(q(`${como(TIENDA)} select aviso_apuntarme('${C}')`).err))
    check('en un aviso sin «Me apunto» o terminado, no', /no hay que apuntarse/.test(q(`${como(ANE)} select aviso_apuntarme('${T}')`).err))
    q(`${comoAdmin} update avisos set participar = true where id = '${T}'`)
    check('  …(terminado)', /terminado/.test(q(`${como(ANE)} select aviso_apuntarme('${T}')`).err))
    check('cuántos van y si estás tú', JSON.parse(q(`${como(ANE)} select aviso_participacion('${C}')`).out).yo === true && JSON.parse(q(`${comoAnon} select aviso_participacion('${C}')`).out).yo === false && JSON.parse(q(`${comoAnon} select aviso_participacion('${C}')`).out).total === 1)
    check('lo de cada uno lo ve él; la lista, el equipo', q(`${como(JON)} select count(*) from aviso_participantes`).out === '0' && q(`${como(ANE)} select count(*) from aviso_participantes`).out === '1')
    check('  …la función de la lista es solo del equipo', /solo el equipo/.test(q(`${como(ANE)} select * from admin_aviso_participantes('${C}')`).err) && q(`${comoAdmin} select string_agg(username, ',') from admin_aviso_participantes('${C}')`).out === 'ane')

    // Sortear
    check('sortear sin nadie apuntado avisa', /nadie/.test(q(`${comoAdmin} select admin_aviso_sortear('${T}')`).err))
    q(`${como(MIKEL)} select aviso_apuntarme('${C}')`)
    x = q(`${comoAdmin} select admin_aviso_sortear('${C}')`)
    const g1 = x.ok && JSON.parse(x.out).ganador.username
    check('el equipo sortea entre los dos apuntados', x.ok && ['ane', 'mikel'].includes(g1) && JSON.parse(x.out).total === 2, x.err)
    x = q(`${comoAdmin} select admin_aviso_sortear('${C}')`)
    check('  …y sortear otra vez deja fuera al de antes', x.ok && JSON.parse(x.out).ganador.username !== g1 && q(`select count(*) from avisos where id = '${C}' and ganador_id is not null and sorteado_at is not null`).out === '1')
    check('  …alguien que no es del equipo, no', /solo el equipo/.test(q(`${como(ANE)} select admin_aviso_sortear('${C}')`).err))

    // La campanita: al publicar, los programados y el recordatorio
    const madrid = (h) => `(date_trunc('day', now() at time zone 'Europe/Madrid') + interval '${h} hours') at time zone 'Europe/Madrid'`
    q(`update avisos set hasta = ${madrid(18)} + interval '20 hours' where id = '${C}'`)
    check('avisar a la campanita es solo del equipo', /solo el equipo/.test(q(`${como(ANE)} select admin_aviso_avisar('${C}')`).err) && /permission denied/.test(q(`${comoAnon} select admin_aviso_avisar('${C}')`).err))
    x = q(`${comoAdmin} select admin_aviso_avisar('${C}')`)
    check('al publicar: a todos menos a quien lo apagó y a la tienda (3)', x.ok && JSON.parse(x.out).personas === 3 && q(`select string_agg(u.username, ',' order by u.username) from user_notifications n join user_profiles u on u.id = n.recipient_id`).out === 'ane,mikel,pingu', x.err || x.out)
    check('  …con su título, su texto y el enlace que abre el pop-up', q(`select distinct title || '|' || link from user_notifications`).out === `Gana los Funko Pop|/?aviso=${C}`)
    check('  …una sola vez', JSON.parse(q(`${comoAdmin} select admin_aviso_avisar('${C}')`).out).ya === true && q(`select count(*) from user_notifications`).out === '3')
    q(`update avisos set avisado_at = avisado_at - interval '2 days' where id = '${C}'`)
    check('la pasada de cada hora no es de la gente', /permission denied/.test(q(`${como(ANE)} select avisos_al_dia()`).err))
    check('de noche no avisa (a las 3)', q(`set role service_role; select avisos_al_dia(${madrid(3)} + interval '1 day')`).out === '0' && q(`select recordado_at is null from avisos where id = '${C}'`).out === 't')
    check('a más de 30 horas del final, tampoco', q(`set role service_role; select avisos_al_dia(${madrid(11)} - interval '1 day')`).out === '0')
    x = q(`set role service_role; select avisos_al_dia(${madrid(18)})`)
    check('a las 18, con menos de 30 horas: «se acaba pronto» a quien no se apuntó (pingu)', x.ok && x.out === '1' && q(`select string_agg(u.username || ':' || n.title || ':' || n.body, ',') from user_notifications n join user_profiles u on u.id = n.recipient_id where n.title like 'Se acaba%'`).out === 'pingu:Se acaba pronto: Gana los Funko Pop:Aún estás a tiempo de apuntarte.', x.err || x.out)
    check('  …una sola vez, y queda apuntado', q(`set role service_role; select avisos_al_dia(${madrid(19)})`).out === '0' && q(`select personas from avisos_enviados where titulo like 'Se acaba pronto%'`).out === '1')
    q(`${comoAdmin} insert into avisos (tipo, titulo, sitios, publicado, desde) values ('evento', 'Torneo de Navidad', '{franja,campanita}', true, ${madrid(9)} + interval '1 day')`)
    check('un programado que ya ha salido: a las 9 no (de noche)…', q(`set role service_role; select avisos_al_dia(${madrid(9)} + interval '1 day 30 minutes')`).out === '0')
    check('  …a las 10, sí (3, sin la tienda)', q(`set role service_role; select avisos_al_dia(${madrid(10)} + interval '1 day 5 minutes')`).out === '3' && q(`select count(*) from user_notifications where title = 'Torneo de Navidad'`).out === '3')
    q(`${comoAdmin} insert into avisos (tipo, titulo, sitios, publicado) values ('mantenimiento', 'Esta noche la web irá lenta', '{franja,campanita}', true)`)
    check('el de mantenimiento también le llega a la tienda (4)', JSON.parse(q(`${comoAdmin} select admin_aviso_avisar((select id from avisos where tipo = 'mantenimiento'))`).out).personas === 4)
    q(`${comoAdmin} insert into avisos (titulo, sitios, publicado, publico) values ('Crea tu cuenta', '{popup,campanita}', true, 'sin_cuenta')`)
    check('uno «sin cuenta» no va a la campanita de nadie', JSON.parse(q(`${comoAdmin} select admin_aviso_avisar((select id from avisos where publico = 'sin_cuenta'))`).out).personas === 0)

    // Cubo
    check('el cubo es público y con tope', q(`select public, file_size_limit from storage.buckets where id = 'avisos'`).out === 't|3145728')
    check('solo el equipo sube la imagen', q(`${comoAdmin} insert into storage.objects (bucket_id, name) values ('avisos', 'x.webp') returning id`).ok && !q(`${como(ANE)} insert into storage.objects (bucket_id, name) values ('avisos', 'y.webp')`).ok)
    check('borrar el aviso se lleva sus cifras y sus apuntados', q(`${comoAdmin} delete from avisos where id = '${C}'`).ok && q(`select (select count(*) from aviso_cifras) + (select count(*) from aviso_participantes)`).out === '0')

    // Sentencia a sentencia (el SQL Editor, la 631)
    const BD2 = 'prueba_1260b'
    psql(['-c', `drop database if exists ${BD2}`]); psql(['-c', `create database ${BD2}`])
    const r2 = psql(['-d', BD2, '-c', ANDAMIO])
    psql(['-d', BD2, '-c', readFileSync(`${REPO}/supabase-migration-1120-avisos.sql`, 'utf8').replace(/notify pgrst[^;]*;/, '')])
    psql(['-d', BD2, '-c', `create or replace function is_admin() returns boolean language sql as $f$ select false $f$`])
    check('el andamio en otra base', r2.status === 0, r2.stderr)
    // Se parte por los `;` de fin de línea que no están dentro de un cuerpo $$.
    const sentencias = []
    { let actual = '', dentro = false
      for (const linea of sinNotify.split('\n')) {
        if (/^\s*--/.test(linea) && !actual.trim()) continue
        actual += linea + '\n'
        if ((linea.match(/\$\$/g) || []).length % 2) dentro = !dentro
        if (!dentro && /;\s*$/.test(linea)) { sentencias.push(actual.trim()); actual = '' }
      }
      if (actual.trim()) sentencias.push(actual.trim()) }
    let malas = 0
    for (const s of sentencias) { const rr = psql(['-d', BD2, '-c', s]); if (rr.status !== 0) { malas++; console.log('     ', rr.stderr.slice(0, 160)) } }
    check(`sentencia a sentencia, cada una en su conexión (${sentencias.length})`, malas === 0)
  }
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
