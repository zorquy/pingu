// Tanda 1429 — Los planes de las tiendas, contra PostgreSQL de verdad y
// ejecutando la migración dos veces, cada vez con -f entero:
//   · una tienda nueva nace con 60 días de Tienda+ (y fundadora si entra antes
//     del 1 de marzo de 2027); las que ya había, fundadoras con sus 60 días;
//   · el plan que vale: prueba → Tienda+; pagado en el futuro → el suyo;
//     nada → Gratis; sin fila → Tienda+ (no se cierra por un fallo nuestro);
//   · la tabla es privada: la tienda lee la suya, nadie más (el equipo sí), y
//     nadie la escribe a pelo;
//   · «Me quedo con…» solo lo dice una tienda, y solo con un plan que existe;
//   · `admin_tienda_plan` solo el equipo, y cambia solo lo que le pasan;
//   · la campanita a 7 días y al acabar, una vez cada una, de 10 a 22 de Madrid,
//     y solo el servidor la llama.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_1429'
const MIG = `${REPO}/supabase-migration-1429-planes-de-tienda.sql`
const mig = readFileSync(MIG, 'utf8')
check('la migración no usa tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig.replace(/\$\$[\s\S]*?\$\$/g, '')))

const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0)
if (hay.status !== 0) process.exit(1)
psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
const base = psql(['-d', BD, '-c', `do $$ begin create role anon; exception when duplicate_object then null; end $$;
  do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
  do $$ begin create role service_role; exception when duplicate_object then null; end $$;
  create schema if not exists auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create or replace function auth.uid() returns uuid language sql as $f$ select nullif(current_setting('prueba.uid', true), '')::uuid $f$;
  create or replace function auth.role() returns text language sql as $f$ select nullif(current_setting('prueba.rol', true), '') $f$;
  create or replace function public.is_admin() returns boolean language sql as $f$ select current_setting('prueba.admin', true) = 'si' $f$;
  grant usage on schema public to anon, authenticated, service_role;
  create table user_profiles (id uuid primary key, username text, display_name text, tipo text not null default 'persona');
  create table tiendas (user_id uuid primary key references user_profiles(id), ciudad text, de_pruebas boolean not null default false, updated_at timestamptz default now());
  create table user_notifications (id uuid primary key default gen_random_uuid(), recipient_id uuid not null, type text not null, title text not null, body text, link text, created_at timestamptz not null default now());
  grant select on user_profiles, tiendas to anon, authenticated;
  insert into user_profiles values ('00000000-0000-0000-0000-00000000000a', 'vieja', 'Tienda Vieja', 'tienda'),
    ('00000000-0000-0000-0000-00000000000b', 'ane', 'Ane', 'persona');
  insert into tiendas (user_id) values ('00000000-0000-0000-0000-00000000000a');`])
check('el andamio', base.status === 0, base.stderr)

const corre = (vez) => { const r = psql(['-d', BD, '-f', MIG]); check(`la migración corre (vez ${vez})`, r.status === 0, r.stderr) }
corre(1)
// En el SQL Editor cada sentencia va por su lado: la segunda pasada también
// tiene que poder (las `create policy` con su `drop` delante, las `if not exists`).
corre(2)

const VIEJA = '00000000-0000-0000-0000-00000000000a'
const ANE = '00000000-0000-0000-0000-00000000000b'
const NUEVA = '00000000-0000-0000-0000-00000000000c'
// Como quién: uid, rol de Postgres, admin, rol de Supabase.
const como = (uid, sql, { admin = false, rol = 'authenticated', supa = rol } = {}) => {
  const pre = `set prueba.uid = '${uid || ''}'; set prueba.admin = '${admin ? 'si' : 'no'}'; set prueba.rol = '${supa}'; set role ${rol};`
  const r = psql(['-At', '-d', BD, '-c', pre + sql])
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() }
}
const q = (sql) => como(null, sql, { rol: 'postgres', supa: 'service_role' })

console.log('── Nacer ──')
{
  const v = q(`select fundadora, round(extract(epoch from prueba_hasta - now()) / 86400) from tienda_planes where tienda_id = '${VIEJA}'`).out
  check('la que ya estaba: fundadora con 60 días', v === 't|60', v)
  q(`insert into user_profiles values ('${NUEVA}', 'nueva', 'Tienda Nueva', 'tienda'); insert into tiendas (user_id) values ('${NUEVA}')`)
  const n = q(`select fundadora, round(extract(epoch from prueba_hasta - now()) / 86400), plan from tienda_planes where tienda_id = '${NUEVA}'`).out
  const fundadoraHoy = new Date() < new Date('2027-03-01T00:00:00Z')
  check('una tienda nueva nace con 60 días (fundadora si entra antes del 1 de marzo)', n === `${fundadoraHoy ? 't' : 'f'}|60|gratis`, n)
}

console.log('── El plan que vale ──')
{
  const de = (id) => q(`select public.tienda_plan_de('${id}')`).out
  check('en prueba: Tienda+', de(VIEJA) === 'tienda_mas', de(VIEJA))
  q(`update tienda_planes set prueba_hasta = now() - interval '1 day', pagado_hasta = now() + interval '10 days', plan = 'tienda' where tienda_id = '${VIEJA}'`)
  check('pagado en el futuro: el suyo', de(VIEJA) === 'tienda', de(VIEJA))
  q(`update tienda_planes set pagado_hasta = now() - interval '1 day' where tienda_id = '${VIEJA}'`)
  check('pagado ya vencido y sin prueba: Gratis', de(VIEJA) === 'gratis', de(VIEJA))
  check('sin fila: Tienda+ (no se cierra por un fallo nuestro)', de('00000000-0000-0000-0000-0000000000ff') === 'tienda_mas')
  const mio = como(VIEJA, `select public.tienda_mi_plan()->>'plan', public.tienda_mi_plan()->>'pagado', public.tienda_mi_plan()->>'fundadora'`).out
  check('tienda_mi_plan, la suya', mio === 'gratis|tienda|true', mio)
  const persona = como(ANE, `select coalesce(public.tienda_mi_plan()::text, 'nada')`).out
  check('tienda_mi_plan de una persona: nada', persona === 'nada', persona)
}

console.log('── Privada ──')
{
  const suya = como(VIEJA, `select count(*) from tienda_planes`).out
  check('la tienda ve solo su fila', suya === '1', suya)
  const otra = como(ANE, `select count(*) from tienda_planes`).out
  check('una persona no ve ninguna', otra === '0', otra)
  const equipo = como(ANE, `select count(*) from tienda_planes`, { admin: true }).out
  check('el equipo las ve todas', equipo === '2', equipo)
  const escribe = como(VIEJA, `update tienda_planes set plan = 'tienda_mas', pagado_hasta = now() + interval '1 year' where tienda_id = '${VIEJA}'`)
  check('nadie la escribe a pelo (ni la propia tienda)', !escribe.ok, escribe.err)
}

console.log('── Me quedo con… ──')
{
  const r = como(VIEJA, `select public.tienda_me_quedo('tienda'); select se_queda from tienda_planes where tienda_id = '${VIEJA}'`)
  check('la tienda dice «me quedo con Tienda»', r.ok && r.out.endsWith('tienda'), r.err || r.out)
  check('…y no le cambia el plan que vale', q(`select public.tienda_plan_de('${VIEJA}')`).out === 'gratis')
  const mal = como(VIEJA, `select public.tienda_me_quedo('oro')`)
  check('un plan que no existe, no', !mal.ok && /no existe/.test(mal.err), mal.err)
  const persona = como(ANE, `select public.tienda_me_quedo('tienda')`)
  check('una persona, no', !persona.ok && /Solo una cuenta de tienda/.test(persona.err), persona.err)
}

console.log('── El equipo ──')
{
  const no = como(VIEJA, `select public.admin_tienda_plan('${VIEJA}', '{"plan":"tienda_mas"}')`)
  check('una tienda no se pone el plan', !no.ok && /Solo el equipo/.test(no.err), no.err)
  const si = como(ANE, `select public.admin_tienda_plan('${VIEJA}', jsonb_build_object('plan', 'tienda', 'pagado_hasta', (now() + interval '30 days')::text))->>'vale'`, { admin: true })
  check('el equipo pone Tienda pagado 30 días, y vale ya', si.ok && si.out === 'tienda', si.err || si.out)
  const nota = como(ANE, `select public.admin_tienda_plan('${VIEJA}', '{"nota":"Ko-fi, pagó el 3"}')->>'plan'`, { admin: true }).out
  check('cambiar solo la nota no toca el plan', nota === 'tienda', nota)
  const persona = como(ANE, `select public.admin_tienda_plan('${ANE}', '{"plan":"tienda"}')`, { admin: true })
  check('a una persona no se le pone plan', !persona.ok && /no es una tienda/.test(persona.err), persona.err)
  const malo = como(ANE, `select public.admin_tienda_plan('${VIEJA}', '{"plan":"oro"}')`, { admin: true })
  check('un plan que no existe lo para la base', !malo.ok, malo.err)
}

console.log('── La campanita ──')
{
  // NUEVA: le quedan 5 días. Madrid a las 12.
  const desde = (h) => `((date_trunc('day', now() at time zone 'Europe/Madrid') + interval '${h} hours') at time zone 'Europe/Madrid')`
  q(`update tienda_planes set prueba_hasta = ${desde(12)} + interval '5 days', aviso_7_at = null, aviso_fin_at = null where tienda_id = '${NUEVA}'`)
  const noServidor = como(NUEVA, `select public.tiendas_planes_al_dia()`)
  check('una tienda no puede llamarla', !noServidor.ok && /Solo el servidor/.test(noServidor.err), noServidor.err)
  const noche = q(`select public.tiendas_planes_al_dia(${desde(23)})`).out
  check('de noche no avisa', noche === '0', noche)
  const una = q(`select public.tiendas_planes_al_dia(${desde(12)})`).out
  const notis = q(`select title from user_notifications where recipient_id = '${NUEVA}'`).out
  check('a 5 días: un aviso, con los días que quedan', una === '1' && /acaba en 5 días/.test(notis), `${una} · ${notis}`)
  const otra = q(`select public.tiendas_planes_al_dia(${desde(13)})`).out
  check('y no lo repite', otra === '0', otra)
  q(`update tienda_planes set prueba_hasta = ${desde(14)} - interval '1 hour' where tienda_id = '${NUEVA}'`)
  const fin = q(`select public.tiendas_planes_al_dia(${desde(14)})`).out
  const ultima = q(`select title from user_notifications where recipient_id = '${NUEVA}' order by created_at desc limit 1`).out
  check('el día que acaba: «ha acabado», una vez', fin === '1' && /ha acabado/.test(ultima), `${fin} · ${ultima}`)
  // Alargar la prueba desde /admin vuelve a avisar a sus 7 días.
  como(ANE, `select public.admin_tienda_plan('${NUEVA}', jsonb_build_object('prueba_hasta', (${desde(15)} + interval '6 days')::text))`, { admin: true })
  const otraVez = q(`select public.tiendas_planes_al_dia(${desde(15)})`).out
  check('alargada desde /admin: vuelve a avisar', otraVez === '1', otraVez)
  // Una que ya ha pagado más allá de la prueba no recibe «acaba tu prueba».
  q(`update tienda_planes set prueba_hasta = ${desde(16)} + interval '3 days', pagado_hasta = ${desde(16)} + interval '40 days', aviso_7_at = null where tienda_id = '${VIEJA}'`)
  const pagada = q(`select public.tiendas_planes_al_dia(${desde(16)})`).out
  check('una que ya pagó no recibe el aviso de la prueba', pagada === '0', pagada)
}

psql(['-c', `drop database if exists ${BD}`])
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
