// Tanda 1067 — la cuenta de tienda, solo por invitación: lo puro
// (tiendas-puro.js), el correo de cada decisión y la función de Netlify
// `tienda-decidir` con un fetch de mentira, y la migración contra
// PostgreSQL de verdad: pedir, decidir, la invitación, el alta y la guarda
// del tipo de cuenta, dos veces encima y sin tablas temporales.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── Lo puro ──')
{
  const P = await import(`${REPO}/js/tiendas-puro.js`)
  check('validarSolicitud: sin nombre', P.validarSolicitud({ nombre: 'x', ciudad: 'Bilbao', email: 'a@b.es' }) === 'Escribe el nombre de la tienda.')
  check('  …sin ciudad', /ciudad/.test(P.validarSolicitud({ nombre: 'Rincón', ciudad: '', email: 'a@b.es' })))
  check('  …email malo', /email/.test(P.validarSolicitud({ nombre: 'Rincón', ciudad: 'Bilbao', email: 'a@b' })))
  check('  …y bien', P.validarSolicitud({ nombre: 'Rincón', ciudad: 'Bilbao', email: ' tienda@ejemplo.es ' }) === null)
  const T = '6f1d2c0a-1111-2222-3333-444455556666'
  check('tokenDeAlta: el de la dirección', P.tokenDeAlta(`?i=${T.toUpperCase()}`, null) === T)
  check('  …el apuntado si la dirección no lo trae', P.tokenDeAlta('', T) === T)
  check('  …la dirección manda sobre el apuntado', P.tokenDeAlta(`?i=${T}`, '00000000-0000-0000-0000-000000000000') === T)
  check('  …y algo que no es un token, nada', P.tokenDeAlta('?i=hola', 'x') === null)
  check('FORMA_DE_USUARIO: rincon, mazo-norte y 3a sí', ['rincon', 'mazo-norte', '3a1'].every((u) => P.FORMA_DE_USUARIO.test(u)))
  check('  …-rincon, ri, con espacio, mayúsculas o acentos no', ['-rincon', 'ri', 'el rincon', 'Rincon', 'rincón', 'rincon-'].every((u) => !P.FORMA_DE_USUARIO.test(u)))
  check('caraDelPanel: sin sesión, entrar', P.caraDelPanel({ sesion: null, perfil: null }) === 'tdEntrar')
  check('  …una tienda, su panel', P.caraDelPanel({ sesion: {}, perfil: { tipo: 'tienda', is_admin: true } }) === 'tdPanel')
  check('  …el equipo, la explicación', P.caraDelPanel({ sesion: {}, perfil: { tipo: 'persona', is_admin: true } }) === 'tdEquipo')
  check('  …una persona (o sin la migración: sin `tipo`), cerrado', P.caraDelPanel({ sesion: {}, perfil: { tipo: 'persona' } }) === 'tdCerrado' && P.caraDelPanel({ sesion: {}, perfil: {} }) === 'tdCerrado')
  const pasos = P.primerosPasos({ ciudad: 'Bilbao' })
  check('primerosPasos: la cuenta hecha, los datos por hacer sin dirección', pasos[0].hecho && !pasos[1].hecho && pasos[1].ir === 'datos')
  check('  …con dirección, hechos', P.primerosPasos({ ciudad: 'Bilbao', direccion: 'Calle 1' })[1].hecho)
  check('  …sin fila de tienda no revienta', P.primerosPasos(null).length === 4)
  check('cuentaDeSolicitudes', JSON.stringify(P.cuentaDeSolicitudes([{ estado: 'pendiente' }, { estado: 'pendiente' }, { estado: 'usada' }, { estado: 'raro' }])) === '{"pendiente":2,"aceptada":0,"usada":1,"rechazada":0}')
  check('invitacionCaducada', P.invitacionCaducada({ estado: 'aceptada', caduca: '2026-01-01' }, Date.parse('2026-02-01')) && !P.invitacionCaducada({ estado: 'aceptada', caduca: '2026-03-01' }, Date.parse('2026-02-01')) && !P.invitacionCaducada({ estado: 'usada', caduca: '2026-01-01' }, Date.parse('2026-02-01')))
}

console.log('── El correo y tienda-decidir ──')
{
  const F = await import(`${REPO}/netlify/functions/tienda-decidir.mjs`)
  const si = F.correoDeDecision({ estado: 'aceptada', nombre: 'El Rincón', contacto: 'Ane', token: 'tok-1' }, 'https://pokedoc.es')
  check('aceptada: asunto con la tienda, botón y enlace al alta', /El Rincón ya puede entrar/.test(si.subject) && /Crear la cuenta de la tienda/.test(si.html) && si.html.includes('https://pokedoc.es/alta-tienda?i=tok-1'), si.subject)
  check('  …en texto también, con «Hola, Ane» y los 14 días', /Hola, Ane/.test(si.text) && /14 días/.test(si.text) && si.text.includes('/alta-tienda?i=tok-1'))
  check('  …con la etiqueta «Tiendas»', /Tiendas/.test(si.html))
  const no = F.correoDeDecision({ estado: 'rechazada', nombre: 'El Rincón', contacto: null }, 'https://pokedoc.es')
  check('rechazada: corto y amable, sin enlace de alta', /«Hola: gracias/.test(no.text) && /De momento no podemos abrir más tiendas/.test(no.text) && !no.html.includes('alta-tienda'))
  check('enlaceDeAlta quita la barra del final', F.enlaceDeAlta('https://pokedoc.es/', 'x') === 'https://pokedoc.es/alta-tienda?i=x')

  const llamadas = []
  const fetchDe = ({ admin = true, rpc = { status: 200, body: { id: 's1', estado: 'aceptada', nombre: 'El Rincón', email: 'tienda@ejemplo.es', contacto: 'Ane', token: 'tok-9' } } } = {}) => async (url, op = {}) => {
    llamadas.push({ url, body: op.body, auth: op.headers?.authorization })
    const r = (status, body) => ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) })
    if (url.endsWith('/auth/v1/user')) return r(200, { id: 'admin-1' })
    if (url.includes('/rest/v1/user_profiles')) return r(200, [{ is_admin: admin }])
    if (url.includes('/rpc/tienda_decidir')) return r(rpc.status, rpc.body)
    return r(404, {})
  }
  let enviado = null
  const enviar = async (msg) => { enviado = msg; return { enviado: true, motivo: null } }
  const no403 = await F.decidir({ token: 't', id: 's1', aceptar: true, env: {}, fetchImpl: fetchDe({ admin: false }), enviar })
  check('decidir: quien no es del equipo, 403 y sin correo', !no403.ok && no403.estado === 403 && !enviado)
  const ok = await F.decidir({ token: 'tok-admin', id: 's1', aceptar: true, env: { SITE_URL: 'https://pokedoc.es' }, fetchImpl: fetchDe(), enviar })
  const rpcLlamada = llamadas.find((l) => l.url.includes('/rpc/tienda_decidir'))
  check('  …decide la BASE con el token del admin', rpcLlamada?.auth === 'Bearer tok-admin' && JSON.parse(rpcLlamada.body).p_aceptar === true && JSON.parse(rpcLlamada.body).p_id === 's1')
  check('  …manda el correo a la tienda y devuelve el enlace', ok.ok && ok.correo === 'enviado' && enviado?.to === 'tienda@ejemplo.es' && ok.enlace === 'https://pokedoc.es/alta-tienda?i=tok-9', JSON.stringify(ok))
  const sinCorreo = await F.decidir({ token: 't', id: 's1', aceptar: true, env: {}, fetchImpl: fetchDe(), enviar: async () => ({ enviado: false, motivo: 'Falta configurar EMAIL_API_KEY en Netlify.' }) })
  check('  …si el correo no sale: decidida igual, con el motivo y el enlace', sinCorreo.ok && sinCorreo.correo === 'no_salio' && /EMAIL_API_KEY/.test(sinCorreo.motivo) && !!sinCorreo.enlace)
  const falla = await F.decidir({ token: 't', id: 's1', aceptar: true, env: {}, fetchImpl: fetchDe({ rpc: { status: 400, body: { message: 'Esa tienda ya tiene su cuenta.' } } }), enviar })
  check('  …un no de la base llega tal cual', !falla.ok && falla.motivo === 'Esa tienda ya tiene su cuenta.')

  const C = await import(`${REPO}/netlify/lib/correo-suelto.mjs`)
  check('configDeCorreo: sin clave, dice cuál falta', C.configDeCorreo({ EMAIL_PROVIDER: 'resend' }).falta === 'EMAIL_API_KEY')
  check('  …un proveedor que no existe, también', /no vale/.test(C.configDeCorreo({ EMAIL_PROVIDER: 'palomas' }).falta))
  let http = null
  const r1 = await C.enviarCorreoSuelto({ to: 'a@b.es', subject: 's', html: 'h', text: 't' }, { EMAIL_PROVIDER: 'resend', EMAIL_API_KEY: 'k' }, { sendEmail: async (prov, msg) => { http = { prov, msg } } })
  check('enviarCorreoSuelto: por HTTP con la configuración de siempre', r1.enviado && http?.prov === 'resend' && http.msg.to === 'a@b.es' && http.msg.apiKey === 'k')
  const r2 = await C.enviarCorreoSuelto({ to: 'a@b.es' }, { EMAIL_PROVIDER: 'resend', EMAIL_API_KEY: 'k' }, { sendEmail: async () => { throw new Error('resend respondió 500') } })
  check('  …un fallo del proveedor vuelve como motivo, no como excepción', !r2.enviado && /500/.test(r2.motivo))
  let smtp = null
  const r3 = await C.enviarCorreoSuelto({ to: 'a@b.es' }, { EMAIL_PROVIDER: 'smtp' }, { smtpDesdeEntorno: async () => ({ host: 'h', auth: { user: 'u' } }), sendViaSmtp: async (cfg, msg) => { smtp = { cfg, msg } } })
  check('  …y por SMTP', r3.enviado && smtp?.cfg.host === 'h' && smtp.msg.to === 'a@b.es')
  const r4 = await C.enviarCorreoSuelto({ to: 'a@b.es' }, { EMAIL_PROVIDER: 'smtp' }, { smtpDesdeEntorno: async () => null })
  check('  …SMTP sin configurar: lo dice', !r4.enviado && /SMTP_HOST/.test(r4.motivo))

  const E = await import(`${REPO}/js/email-plantilla.js`)
  const ej = E.EJEMPLOS_DE_CORREO.filter((e) => e.type.startsWith('tienda_'))
  check('los dos correos tienen su ejemplo en /admin → Correos, con verbo y motivo', ej.length === 2 && ej.every((e) => E.TEXTOS_POR_TIPO[e.type]?.cta && E.familiaDeTipo(e.type)?.etiqueta === 'Tiendas'))
}

console.log('── La migración, contra PostgreSQL ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const BD = 'prueba_1067'
  const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
  const mig = readFileSync(`${REPO}/supabase-migration-1067-tiendas.sql`, 'utf8')
  check('la migración no usa tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
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
      create table user_profiles (id uuid primary key, username text, display_name text, is_admin boolean not null default false, onboarding_completed boolean, created_at timestamptz not null default now());
      create unique index on user_profiles (lower(username));
      grant select, insert, update on user_profiles to anon, authenticated;
      create table user_notifications (id uuid primary key default gen_random_uuid(), recipient_id uuid not null, type text not null, title text not null, body text, link text, created_at timestamptz not null default now());
      insert into auth.users values ('00000000-0000-0000-0000-00000000ad01'), ('00000000-0000-0000-0000-0000000000b1'), ('00000000-0000-0000-0000-0000000000c1'), ('00000000-0000-0000-0000-0000000000d1');
      insert into user_profiles (id, username, is_admin, onboarding_completed) values
        ('00000000-0000-0000-0000-00000000ad01', 'pingu', true, true),
        ('00000000-0000-0000-0000-0000000000c1', 'ane', false, true),
        ('00000000-0000-0000-0000-0000000000d1', 'ocupado', false, true);`])
    check('el andamio carga', r.status === 0, r.stderr)
    const sinNotify = mig.replace(/notify pgrst[^;]*;/, '')
    r = psql(['-d', BD, '-c', sinNotify])
    check('la 1067 entra', r.status === 0, r.stderr)
    check('  …y otra vez encima', psql(['-d', BD, '-c', sinNotify]).status === 0)
    check('los perfiles de antes son «persona»', q(`select count(*) from user_profiles where tipo = 'persona'`).out === '3')

    const ANON = `set role anon;`
    const pedir = (nombre, email, extra = '') => q(`${ANON} select tienda_pedir('${nombre}', 'Bilbao', '${email}', 'Ane', '@turincon', 'media'${extra})`)
    const p1 = pedir('El Rincón del Entrenador', 'Tienda@Ejemplo.es')
    check('tienda_pedir: cualquiera, sin cuenta', p1.ok && JSON.parse(p1.out).ok === true, p1.err)
    check('  …se guarda con el email en minúsculas', q(`select email, estado, tamano from tienda_solicitudes`).out === 'tienda@ejemplo.es|pendiente|media')
    check('  …y avisa a la campanita del equipo (y solo al equipo)', q(`select recipient_id, type, link from user_notifications`).out === '00000000-0000-0000-0000-00000000ad01|tienda_solicitud|/admin/?ver=tiendas')
    check('  …otra con el mismo email no se repite (y contesta igual)', pedir('Otra', 'tienda@ejemplo.es').ok && q(`select count(*) from tienda_solicitudes`).out === '1')
    check('  …un email malo se rechaza con su motivo', /email sea correcto/.test(pedir('Otra', 'nada').err))
    check('  …un nombre de una letra, también', /nombre de la tienda/.test(pedir('X', 'x@y.es').err))
    check('  …anon no lee la tabla', !q(`${ANON} select count(*) from tienda_solicitudes`).ok)
    check('  …ni la escribe a pelo', !q(`${ANON} insert into tienda_solicitudes (nombre, ciudad, email) values ('aa', 'bb', 'c@d.es')`).ok)
    check('  …una persona con cuenta no la ve (0 filas, RLS)', q(`set prueba.uid = '00000000-0000-0000-0000-0000000000c1'; set role authenticated; select count(*) from tienda_solicitudes`).out === '0')
    check('  …el equipo sí', q(`set prueba.admin = 'si'; set role authenticated; select count(*) from tienda_solicitudes`).out === '1')

    const id = q(`select id from tienda_solicitudes`).out
    check('tienda_decidir: quien no es del equipo, no', /Solo el equipo/.test(q(`set prueba.uid = '00000000-0000-0000-0000-0000000000c1'; set role authenticated; select tienda_decidir('${id}', true)`).err))
    const ADMIN = `set prueba.uid = '00000000-0000-0000-0000-00000000ad01'; set prueba.admin = 'si'; set role authenticated;`
    const d1 = q(`${ADMIN} select tienda_decidir('${id}', true)`)
    const dj = d1.ok ? JSON.parse(d1.out) : {}
    check('  …el equipo acepta: invitación con token y 14 días', d1.ok && dj.estado === 'aceptada' && /^[0-9a-f-]{36}$/.test(dj.token) && dj.email === 'tienda@ejemplo.es', d1.err || d1.out)
    check('  …y queda apuntado quién y cuándo', q(`select decidio, decidida_el is not null, caduca::date - now()::date from tienda_solicitudes`).out === '00000000-0000-0000-0000-00000000ad01|t|14')
    const d2 = JSON.parse(q(`${ADMIN} select tienda_decidir('${id}', true)`).out)
    check('  …aceptar otra vez renueva el token (el «Reenviar»)', d2.token && d2.token !== dj.token)
    check('  …la clave de servicio también decide (la función de Netlify podría usarla)', q(`set prueba.rol = 'service_role'; set role service_role; select tienda_decidir('${id}', true) ->> 'estado'`).out === 'aceptada')
    const token = q(`select token from tienda_solicitudes`).out

    const inv = (t) => { const x = q(`${ANON} select tienda_invitacion('${t}')`); return x.ok ? JSON.parse(x.out) : { error: x.err } }
    check('tienda_invitacion: con el token, vale y dice nombre y email', inv(token).valida === true && inv(token).nombre === 'El Rincón del Entrenador' && inv(token).email === 'tienda@ejemplo.es')
    check('  …un token que no es de nadie, no_existe', inv('00000000-0000-0000-0000-000000000000').motivo === 'no_existe')
    check('  …el token viejo (renovado), tampoco', inv(dj.token).motivo === 'no_existe')

    const B = '00000000-0000-0000-0000-0000000000b1'
    const comoB = (email) => `set prueba.uid = '${B}'; set prueba.email = '${email}'; set role authenticated;`
    check('tienda_alta: anon ni la ejecuta', !q(`${ANON} select tienda_alta('${token}', 'rincon', 'El Rincón')`).ok)
    check('  …y sin usuario, pide entrar', /Entra con la cuenta/.test(q(`set role authenticated; select tienda_alta('${token}', 'rincon', 'El Rincón')`).err))
    check('  …con OTRO email, no (copiar el enlace no sirve)', /otro email/.test(q(`${comoB('otra@ejemplo.es')} select tienda_alta('${token}', 'rincon', 'El Rincón')`).err))
    check('  …un @ con mala forma, no', /letras, números y guiones/.test(q(`${comoB('TIENDA@ejemplo.es')} select tienda_alta('${token}', 'el rincon', 'El Rincón')`).err))
    check('  …un @ que ya tiene otra cuenta, no', /ya lo tiene otra cuenta/.test(q(`${comoB('tienda@ejemplo.es')} select tienda_alta('${token}', 'OCUPADO', 'El Rincón')`).err))
    const C = '00000000-0000-0000-0000-0000000000c1'
    check('  …una cuenta personal ya hecha no se convierte', /cuenta personal/.test(q(`set prueba.uid = '${C}'; set prueba.email = 'tienda@ejemplo.es'; set role authenticated; select tienda_alta('${token}', 'rincon', 'El Rincón')`).err))
    const alta = q(`${comoB('Tienda@Ejemplo.es')} select tienda_alta('${token}', 'rincon', 'El Rincón del Entrenador', 'Bilbao', 'Calle de ejemplo, 12', null)`)
    check('  …con su email (sin mirar mayúsculas): ya es tienda', alta.ok && JSON.parse(alta.out).username === 'rincon', alta.err)
    check('  …su perfil: @rincon, el nombre, tipo tienda y sin bienvenida pendiente', q(`select username, display_name, tipo, onboarding_completed from user_profiles where id = '${B}'`).out === 'rincon|El Rincón del Entrenador|tienda|t')
    check('  …su fila de tienda, con la ciudad y la web de la solicitud', q(`select ciudad, direccion, web, precio_visible from tiendas where user_id = '${B}'`).out === 'Bilbao|Calle de ejemplo, 12|@turincon|t')
    check('  …la solicitud queda usada, con quién', q(`select estado, usada_por from tienda_solicitudes`).out === `usada|${B}`)
    check('  …y el enlace ya no vale', inv(token).motivo === 'usada' && /ya no vale/.test(q(`${comoB('tienda@ejemplo.es')} select tienda_alta('${token}', 'rincon2', 'X Y')`).err))
    check('  …ni se puede volver a decidir', /ya tiene su cuenta/.test(q(`${ADMIN} select tienda_decidir('${id}', false)`).err))

    // La caducidad.
    q(`${ANON} select tienda_pedir('Mazo Norte', 'Getxo', 'hola@mazonorte.es')`)
    const id2 = q(`select id from tienda_solicitudes where email = 'hola@mazonorte.es'`).out
    const t2 = JSON.parse(q(`${ADMIN} select tienda_decidir('${id2}', true)`).out).token
    q(`update tienda_solicitudes set caduca = now() - interval '1 day' where id = '${id2}'`)
    check('caducada: la invitación lo dice', inv(t2).motivo === 'caducada')
    check('  …y el alta no pasa', /caducado/.test(q(`set prueba.uid = '00000000-0000-0000-0000-0000000000d1'; set prueba.email = 'hola@mazonorte.es'; set role authenticated; select tienda_alta('${t2}', 'mazo-norte', 'Mazo Norte')`).err))
    check('  …rechazar borra el token', q(`${ADMIN} select tienda_decidir('${id2}', false) ->> 'estado'`).out === 'rechazada' && q(`select token is null from tienda_solicitudes where id = '${id2}'`).out === 't')
    check('  …y una rechazada puede volver a pedir', q(`${ANON} select tienda_pedir('Mazo Norte', 'Getxo', 'hola@mazonorte.es')`).ok && q(`select count(*) from tienda_solicitudes where email = 'hola@mazonorte.es'`).out === '2')

    // La guarda del tipo de cuenta.
    check('nadie se pone «tienda» a sí mismo (update)', q(`set prueba.uid = '${C}'; set role authenticated; update user_profiles set tipo = 'tienda' where id = '${C}'; select tipo from user_profiles where id = '${C}'`).out.endsWith('persona'))
    check('  …ni al crear su fila', q(`insert into auth.users values ('00000000-0000-0000-0000-0000000000e1'); set prueba.uid = '00000000-0000-0000-0000-0000000000e1'; set role authenticated; insert into user_profiles (id, username, tipo) values ('00000000-0000-0000-0000-0000000000e1', 'listo', 'tienda'); select tipo from user_profiles where id = '00000000-0000-0000-0000-0000000000e1'`).out.endsWith('persona'))
    check('  …ni una tienda se lo quita', q(`set prueba.uid = '${B}'; set role authenticated; update user_profiles set tipo = 'persona' where id = '${B}'; select tipo from user_profiles where id = '${B}'`).out.endsWith('tienda'))
    check('  …un tipo que no existe, no', !q(`update user_profiles set tipo = 'banco' where id = '${C}'`).ok)
    check('  …el resto del perfil se sigue cambiando', q(`set prueba.uid = '${B}'; set role authenticated; update user_profiles set display_name = 'Rincón' where id = '${B}'; select display_name from user_profiles where id = '${B}'`).out.endsWith('Rincón'))

    // Los datos de la tienda.
    check('tiendas: se ven sin cuenta', q(`${ANON} select ciudad from tiendas`).out === 'Bilbao')
    check('  …la tienda cambia la suya', q(`set prueba.uid = '${B}'; set role authenticated; update tiendas set horario = 'L-S 10-20' where user_id = '${B}'; select horario from tiendas`).out.endsWith('L-S 10-20'))
    check('  …otra cuenta no (0 filas)', q(`set prueba.uid = '${C}'; set role authenticated; update tiendas set horario = 'nada' where user_id = '${B}'; select horario from tiendas`).out.endsWith('L-S 10-20'))
    check('  …nadie crea una fila de tienda a pelo', !q(`set prueba.uid = '${C}'; set role authenticated; insert into tiendas (user_id) values ('${C}')`).ok)

    // El tope por hora.
    q(`insert into tienda_solicitudes (nombre, ciudad, email) select 'Bot ' || g, 'Ciudad', 'bot' || g || '@x.es' from generate_series(1, 30) g`)
    check('el tope: con 30 en la última hora, la siguiente espera', /demasiadas solicitudes/.test(pedir('Una más', 'mas@x.es').err))
    psql(['-c', `drop database if exists ${BD}`])
  }
}
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
