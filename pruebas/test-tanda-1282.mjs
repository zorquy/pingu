// Tanda 1282 — EL ROL DE REDACCIÓN, contra PostgreSQL.
//
// PINGU: un colaborador de confianza (Deckmasters) publica sus guías sin
// pasar por revisión, y el rol es otro que el de «Redacción de noticias»:
// vale para guías y noticias. Lo que se prueba es la BASE, que es quien
// decide: quién publica, quién no, que nadie se dé el rol, la caja «También
// en…», que no llegue el correo de «la hemos aprobado» a quien se publica
// lo suyo y que la cuenta de guías del tema sume.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_1282'
const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }

const ADMIN = '00000000-0000-0000-0000-00000000000a'
const DM = '00000000-0000-0000-0000-0000000000d1' // Redacción
const NOT = '00000000-0000-0000-0000-0000000000b2' // Redacción de noticias
const ANA = '00000000-0000-0000-0000-0000000000c3' // nadie
// Como quién se escribe: el uid, y si es del equipo.
const como = (uid, admin = false) => `select set_config('prueba.uid', '${uid}', false), set_config('prueba.admin', '${admin ? 'si' : 'no'}', false);`

console.log('── La migración, contra PostgreSQL ──')
const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433 (si no, pg_ctl -D /var/tmp/pg364 -o "-p 5433 -k /var/tmp" start)', hay.status === 0)
if (hay.status === 0) {
  psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
  let r = psql(['-d', BD, '-c', `do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    create schema if not exists auth;
    create or replace function auth.uid() returns uuid language sql as $f$ select nullif(current_setting('prueba.uid', true), '')::uuid $f$;
    create or replace function public.is_admin() returns boolean language sql as $f$ select current_setting('prueba.admin', true) = 'si' $f$;
    grant usage on schema public, auth to anon, authenticated;
    create table user_profiles (id uuid primary key, username text, display_name text, avatar_url text, banner_url text,
      is_admin boolean not null default false, is_moderator boolean not null default false, is_tournament_admin boolean not null default false,
      is_news_writer boolean not null default false, is_banned boolean not null default false, is_muted boolean not null default false,
      is_pro boolean not null default false, forum_title text, forum_title_color text, total_xp int not null default 0, level int not null default 1);
    grant select, insert, update on user_profiles to anon, authenticated;
    create or replace function public.nivel_de_xp(p int) returns int language sql immutable as $f$ select 1 $f$;
    create or replace function public.url_de_imagen_segura(p_url text) returns boolean language sql immutable as $f$ select p_url is null or p_url ~ '^https://' $f$;
    create table user_notifications (id serial, recipient_id uuid, type text, title text, body text, link text);
    create table correos (para uuid, tipo text, asunto text);
    create or replace function public.email_preview(p_texto text, p_largo int default 140) returns text language sql as $f$ select left(p_texto, p_largo) $f$;
    create or replace function public.enqueue_email(p_user uuid, p_tipo text, p_asunto text, p_cuerpo text, p_link text, p_clave text) returns void language sql as $f$ insert into correos values (p_user, p_tipo, p_asunto) $f$;
    create table categories (id uuid primary key, name text, guide_count int not null default 0);
    create table guides (id uuid primary key default gen_random_uuid(), title text, slug text, kind text not null default 'guide',
      review_status text not null default 'draft', published_at timestamptz, xp_reward int default 20, guide_rarity text default 'bronze',
      is_pro boolean default false, author_id uuid, category_id uuid, rejection_reason text);`])
  check('el andamio carga', r.status === 0, r.stderr)

  const mig = readFileSync(`${REPO}/supabase-migration-1282-redaccion.sql`, 'utf8')
  check('la migración no usa tablas temporales (la 631)', !/temp(orary)?\s+table/i.test(mig))
  r = psql(['-d', BD, '-c', mig.replace(/notify pgrst[^;]*;/, '')])
  check('la 1282 entra', r.status === 0, r.stderr)
  r = psql(['-d', BD, '-c', mig.replace(/notify pgrst[^;]*;/, '')])
  check('  …y entra dos veces (se puede repetir)', r.status === 0, r.stderr)
  r = psql(['-d', BD, '-c', `create trigger guide_review_email after insert or update of review_status on guides for each row execute function public.on_guide_review_email();
    insert into user_profiles (id, username, is_admin, is_news_writer, is_writer) values
      ('${ADMIN}', 'pingu', true, false, false), ('${DM}', 'deckmasters', false, false, true),
      ('${NOT}', 'luisfe', false, true, false), ('${ANA}', 'ana', false, false, false);
    insert into categories (id, name) values ('00000000-0000-0000-0000-0000000000e1', 'Estrategia');`])
  check('las cuatro personas y un tema', r.status === 0, r.stderr)

  const guia = (autor, kind = 'guide', extra = '') => q(`${como(autor)} insert into guides (title, slug, kind, review_status, author_id, category_id${extra ? ', tambien_en_url, tambien_en_nombre' : ''})
    values ('Una guía', 'g-${Math.random().toString(36).slice(2, 8)}', '${kind}', 'draft', '${autor}', '00000000-0000-0000-0000-0000000000e1'${extra}) returning id`).out.split('\n').pop()
  const publicar = (autor, id) => q(`${como(autor)} update guides set review_status = 'approved' where id = '${id}' returning published_at is not null`)

  console.log('── Quién publica sin revisión ──')
  {
    const g = guia(DM)
    const p = publicar(DM, g)
    check('Redacción publica SU GUÍA', p.ok && p.out.endsWith('t'), p.err)
    const n = guia(DM, 'news')
    const pn = publicar(DM, n)
    check('  …y su noticia', pn.ok && pn.out.endsWith('t'), pn.err)
    check('  …y la noticia se queda noticia', q(`select kind from guides where id = '${n}'`).out === 'news')
    const g2 = guia(NOT)
    const p2 = publicar(NOT, g2)
    check('Redacción de NOTICIAS no publica una guía (va a la cola, como antes)', !p2.ok && /estado de revisión/.test(p2.err), p2.out)
    const n2 = guia(NOT, 'news')
    check('  …pero sí su noticia', publicar(NOT, n2).ok)
    const g3 = guia(ANA)
    check('Alguien sin rol no publica su guía', !publicar(ANA, g3).ok)
    check('  …pero la manda a revisión', q(`${como(ANA)} update guides set review_status = 'pending' where id = '${g3}'`).ok)
    const n3 = guia(ANA, 'news')
    check('  …y una «noticia» suya nace como guía', q(`select kind from guides where id = '${n3}'`).out === 'guide')
    const yaPub = q(`${como(DM)} update guides set review_status = 'draft' where id = '${g}'`)
    check('Redacción no despublica lo suyo publicado', !yaPub.ok)
    const fecha = q(`${como(DM)} update guides set published_at = '2020-01-01' where id = '${g}' returning published_at::date::text`)
    check('  …ni le cambia la fecha de publicación', fecha.ok && !fecha.out.endsWith('2020-01-01'), fecha.out + fecha.err)
  }

  console.log('── Que nadie se dé el rol ──')
  {
    const yo = q(`${como(ANA)} update user_profiles set is_writer = true where id = '${ANA}' returning is_writer`)
    check('alguien se pone is_writer en su fila y no se queda', yo.ok && yo.out.endsWith('f'), yo.out + yo.err)
    const nuevo = q(`${como('00000000-0000-0000-0000-0000000000f9')} set role authenticated; insert into user_profiles (id, username, is_writer) values ('00000000-0000-0000-0000-0000000000f9', 'listo', true) returning is_writer`)
    check('una fila NUEVA que nace con is_writer nace sin él', nuevo.ok && nuevo.out.endsWith('f'), nuevo.out + nuevo.err)
    const dar = q(`${como(ADMIN, true)} update user_profiles set is_writer = true where id = '${NOT}' returning is_writer`)
    check('el equipo sí se lo da a alguien', dar.ok && dar.out.endsWith('t'), dar.err)
    q(`${como(ADMIN, true)} update user_profiles set is_writer = false where id = '${NOT}'`)
  }

  console.log('── «También en…» ──')
  {
    const g = guia(DM, 'guide', `, 'https://deckmasters.es/dragapult', ' Deckmasters '`)
    const f = q(`select tambien_en_url || '|' || tambien_en_nombre from guides where id = '${g}'`)
    check('Redacción pone el enlace y el nombre (recortado)', f.out === 'https://deckmasters.es/dragapult|Deckmasters', f.out)
    const g2 = guia(ANA, 'guide', `, 'https://spam.example', 'Spam'`)
    check('alguien sin rol no lo pone al crear', q(`select coalesce(tambien_en_url, 'nada') from guides where id = '${g2}'`).out === 'nada')
    q(`${como(ANA)} update guides set tambien_en_url = 'https://spam.example' where id = '${g2}'`)
    check('  …ni al editar', q(`select coalesce(tambien_en_url, 'nada') from guides where id = '${g2}'`).out === 'nada')
    q(`${como(DM)} update guides set tambien_en_url = 'javascript:alert(1)', tambien_en_nombre = 'X' where id = '${g}'`)
    check('una dirección que no es https no entra (y el nombre se va con ella)', q(`select coalesce(tambien_en_url, 'nada') || '|' || coalesce(tambien_en_nombre, 'nada') from guides where id = '${g}'`).out === 'nada|nada')
    q(`${como(DM)} update guides set tambien_en_url = 'https://a.es/"><script>', tambien_en_nombre = 'X' where id = '${g}'`)
    check('  …ni una con comillas o «<»', q(`select coalesce(tambien_en_url, 'nada') from guides where id = '${g}'`).out === 'nada')
    const largo = q(`${como(DM)} update guides set tambien_en_url = 'https://a.es', tambien_en_nombre = repeat('x', 90) where id = '${g}' returning length(tambien_en_nombre)`)
    check('el nombre, como mucho 40 letras', largo.out.endsWith('40'), largo.out)
  }

  console.log('── El correo de «la hemos aprobado» ──')
  {
    q('delete from correos')
    const g = guia(DM)
    publicar(DM, g)
    check('a quien se publica lo suyo no le llega', q(`select count(*) from correos where tipo = 'guide_approved'`).out === '0')
    const g2 = guia(ANA)
    q(`${como(ANA)} update guides set review_status = 'pending' where id = '${g2}'`)
    check('mandarla a revisión avisa al equipo', q(`select count(*) from correos where tipo = 'guide_submitted'`).out === '1')
    q(`${como(ADMIN, true)} update guides set review_status = 'approved', published_at = now() where id = '${g2}'`)
    check('y si la aprueba el equipo, a su autora le llega', q(`select count(*) from correos where tipo = 'guide_approved' and para = '${ANA}'`).out === '1')
  }

  console.log('── La cuenta de guías del tema ──')
  {
    const antes = Number(q(`select guide_count from categories`).out)
    const real = Number(q(`select count(*) from guides where published_at is not null`).out)
    check('la cuenta es la de las publicadas', antes === real, `${antes} contra ${real}`)
    const g = guia(DM)
    publicar(DM, g)
    check('  …y sube al publicar Redacción', Number(q(`select guide_count from categories`).out) === real + 1)
    q(`delete from guides where id = '${g}'`)
    check('  …y baja al borrar', Number(q(`select guide_count from categories`).out) === real)
  }
  psql(['-c', `drop database if exists ${BD}`])
}

console.log('── La web ──')
{
  const ed = readFileSync(`${REPO}/js/editor-guia.js`, 'utf8')
  check('el editor sabe de Redacción (is_writer)', /is_writer/.test(ed))
  check('  …y a Redacción le dice «Publicar guía»', /Publicar guía/.test(ed))
  const us = readFileSync(`${REPO}/admin/js/usuarios-admin.js`, 'utf8')
  check('/admin → Usuarios tiene el rol «Redacción» con su migración', /col: 'is_writer', nombre: 'Redacción'/.test(us) && /1282-redaccion/.test(us))
  check('  …y su chip', /id: 'redaccion'/.test(us))
  const g = readFileSync(`${REPO}/js/guia.js`, 'utf8')
  check('la guía pinta la caja «También en…»', /tambien_en_url/.test(g))
  check('  …y no pide is_writer en la consulta del autor sin respaldo (la 624)', !/select\(`id, display_name, username, avatar_url, \$\{COLUMNAS_RANGO\}, is_writer`\)/.test(g))
}

console.log(fails ? `❌ ${fails} fallan` : '✅ TODO BIEN')
process.exit(fails ? 1 : 0)
