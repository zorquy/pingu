// Tanda 1122 — los correos editables: lo puro (la plantilla con los textos
// del equipo: asunto con {asunto}, texto de arriba, botón y pie, y lo vacío
// como siempre), que la función de envío y la de tiendas los leen, y la
// migración contra PostgreSQL (la tabla solo para el equipo y la prueba a la
// cola con su tope). Dos veces encima y sin tablas temporales.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── Lo puro ──')
{
  const m = await import(`${REPO}/js/email-plantilla.js`)
  const fila = { type: 'private_message', subject: 'Ibai te ha enviado un mensaje', preview: '¿Jugamos el jueves?', link: '/mensajes' }
  const base = m.renderFilaDeCola(fila, { siteUrl: 'https://pokedoc.es' })
  const igual = m.renderFilaDeCola(fila, { siteUrl: 'https://pokedoc.es', textos: { private_message: { asunto: '  ', intro: '', cta: null, pie: '' } } })
  check('sin textos propios (o vacíos), el correo de siempre', base.subject === 'Ibai te ha enviado un mensaje' && igual.html === base.html && igual.text === base.text)
  const r = m.renderFilaDeCola(fila, { siteUrl: 'https://pokedoc.es', textos: { private_message: { asunto: 'PokeDoc · {asunto}', intro: 'Tienes <algo> nuevo.', cta: 'Contestar', pie: 'Porque te escribieron.' } } })
  check('el asunto como plantilla: {asunto} es el de cada aviso', r.subject === 'PokeDoc · Ibai te ha enviado un mensaje', r.subject)
  check('el texto de arriba, escapado, en el HTML y en el texto plano', /Tienes &lt;algo&gt; nuevo\./.test(r.html) && /Tienes <algo> nuevo\.\n\n«¿Jugamos el jueves\?»/.test(r.text))
  check('el botón y el pie propios', />Contestar</.test(r.html) && /Contestar: https:\/\/pokedoc\.es\/mensajes/.test(r.text) && /Porque te escribieron\./.test(r.html))
  check('sin {asunto}, el asunto entero', m.renderFilaDeCola(fila, { siteUrl: 'https://pokedoc.es', textos: { private_message: { asunto: 'Tienes un mensaje' } } }).subject === 'Tienes un mensaje')
  check('un salto de línea en el asunto no rompe la cabecera', !/[\r\n]/.test(m.renderFilaDeCola(fila, { siteUrl: 'https://pokedoc.es', textos: { private_message: { asunto: 'A\r\nBcc: x@y.z {asunto}' } } }).subject))
  check('solo el tipo de la fila: los textos de otro tipo no entran', m.renderFilaDeCola(fila, { siteUrl: 'https://pokedoc.es', textos: { forum_reply: { cta: 'Otro' } } }).html === base.html)
  const dig = m.EJEMPLOS_DE_CORREO.find((e) => e.type === 'weekly_digest')
  const d = m.renderFilaDeCola(dig, { siteUrl: 'https://pokedoc.es', textos: { weekly_digest: { asunto: '{asunto} 📬', cta: 'Al foro' } } })
  check('el resumen semanal también (asunto y botón)', d.subject === 'Lo mejor de PokeDoc esta semana 📬' && />Al foro</.test(d.html))
  const envio = readFileSync(`${REPO}/netlify/functions/send-emails.mjs`, 'utf8')
  check('la función de envío lee los textos una vez por pasada y se los pasa', /rest\('correo_textos\?select=tipo,asunto,intro,cta,pie', clave\)/.test(envio) && /renderFilaDeCola\(fila, \{ siteUrl, unsubscribeUrl, textos \}\)/.test(envio))
  const { correoDeDecision } = await import(`${REPO}/netlify/functions/tienda-decidir.mjs`)
  const t = correoDeDecision({ estado: 'aceptada', nombre: 'Cartas Norte', contacto: 'Ane', token: 'tk' }, 'https://pokedoc.es', { cta: 'Dar de alta la tienda' })
  check('y el correo de las tiendas', />Dar de alta la tienda</.test(t.html))
}

console.log('── La migración, contra PostgreSQL ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
  const BD = 'prueba_1122'
  const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
  const mig = readFileSync(`${REPO}/supabase-migration-1122-correos.sql`, 'utf8')
  check('la migración no usa tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
  const hay = psql(['-c', 'select 1'])
  check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0, hay.stderr)
  if (hay.status === 0) {
    psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
    const ADMIN = '00000000-0000-0000-0000-00000000ad01'
    const ANE = '00000000-0000-0000-0000-0000000000a1'
    let r = psql(['-d', BD, '-c', `do $$ begin create role anon; exception when duplicate_object then null; end $$;
      do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
      create schema if not exists auth; create table auth.users (id uuid primary key);
      grant usage on schema auth to anon, authenticated;
      create or replace function auth.uid() returns uuid language sql as $f$ select nullif(current_setting('prueba.uid', true), '')::uuid $f$;
      create or replace function is_admin() returns boolean language sql as $f$ select current_setting('prueba.admin', true) = 'si' $f$;
      grant usage on schema public to anon, authenticated;
      create table email_outbox (id uuid primary key default gen_random_uuid(), recipient_id uuid not null references auth.users(id), type text not null, subject text not null, preview text, link text, thread_key text, status text not null default 'pending', attempts int not null default 0, created_at timestamptz not null default now());
      alter table email_outbox enable row level security;
      insert into auth.users values ('${ADMIN}'), ('${ANE}');`])
    check('el andamio carga', r.status === 0, r.stderr)
    const sinNotify = mig.replace(/notify pgrst[^;]*;/, '')
    r = psql(['-d', BD, '-c', sinNotify])
    check('la 1122 entra', r.status === 0, r.stderr)
    check('  …y otra vez encima', psql(['-d', BD, '-c', sinNotify]).status === 0)
    const comoAdmin = `set prueba.uid = '${ADMIN}'; set prueba.admin = 'si'; set role authenticated;`
    const comoAne = `set prueba.uid = '${ANE}'; set prueba.admin = 'no'; set role authenticated;`
    let x = q(`${comoAdmin} insert into correo_textos (tipo, cta) values ('private_message', 'Contestar') returning tipo`)
    check('el equipo guarda un texto', x.ok && x.out === 'private_message', x.err)
    check('  …lo lee y lo cambia', q(`${comoAdmin} update correo_textos set pie = 'Porque sí' where tipo = 'private_message' returning cta || '|' || pie`).out === 'Contestar|Porque sí')
    check('alguien que no es del equipo no lo lee', q(`${comoAne} select count(*) from correo_textos`).out === '0')
    check('  …ni lo escribe', !q(`${comoAne} insert into correo_textos (tipo, cta) values ('forum_reply', 'Spam')`).ok)
    check('  …ni sin sesión', !q(`set role anon; select count(*) from correo_textos`).ok)
    check('«Volver al de siempre» es borrar la fila', q(`${comoAdmin} delete from correo_textos where tipo = 'private_message' returning tipo`).out === 'private_message')
    x = q(`${comoAdmin} select admin_correo_prueba('private_message', 'Ibai te ha enviado un mensaje', '¿Jugamos?', '/mensajes')`)
    check('la prueba entra en la cola, para quien la pide', x.ok && q(`select recipient_id || '|' || type || '|' || subject || '|' || status || '|' || (thread_key like 'prueba:%') from email_outbox`).out === `${ADMIN}|private_message|Ibai te ha enviado un mensaje|pending|true`, x.err)
    for (let i = 0; i < 4; i++) q(`${comoAdmin} select admin_correo_prueba('forum_reply', 'Prueba ${i}', null, null)`)
    check('a la sexta en una hora, no', /cinco pruebas/.test(q(`${comoAdmin} select admin_correo_prueba('forum_reply', 'Otra', null, null)`).err) && q(`select count(*) from email_outbox`).out === '5')
    check('alguien que no es del equipo, no', /solo el equipo/.test(q(`${comoAne} select admin_correo_prueba('forum_reply', 'X', null, null)`).err))
    check('  …ni sin sesión', /permission denied/.test(q(`set role anon; select admin_correo_prueba('forum_reply', 'X', null, null)`).err))
    psql(['-c', `drop database if exists ${BD}`])
  }
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
