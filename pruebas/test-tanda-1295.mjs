// Tanda 1295 — `mi_numero`, contra PostgreSQL de verdad: tu puesto entre los
// que van contando a los que van «sin decirlo»; pasar a «sin decirlo» no te
// mueve; sin ir, null; y lo demás de `evento_json` sigue igual.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_1295'
const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
const sinNotify = (m) => m.replace(/notify pgrst[^;]*;/g, '')
const m1192 = sinNotify(readFileSync(`${REPO}/supabase-migration-1192-eventos.sql`, 'utf8'))
const mig = readFileSync(`${REPO}/supabase-migration-1295-eventos-mi-numero.sql`, 'utf8')
check('la migración no usa tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0, hay.stderr)
if (hay.status === 0) {
  psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
  const U = (n) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`
  const ADMIN = '00000000-0000-0000-0000-00000000ad01'
  let r = psql(['-d', BD, '-c', `do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    create schema if not exists auth; create table auth.users (id uuid primary key);
    grant usage on schema auth to anon, authenticated;
    create or replace function auth.uid() returns uuid language sql as $f$ select nullif(current_setting('prueba.uid', true), '')::uuid $f$;
    create or replace function is_admin() returns boolean language sql as $f$ select current_setting('prueba.admin', true) = 'si' $f$;
    revoke all on function is_admin() from public; grant execute on function is_admin() to authenticated;
    grant usage on schema public to anon, authenticated;
    create table user_profiles (id uuid primary key, username text, display_name text, avatar_url text);
    grant select on user_profiles to anon, authenticated;
    insert into auth.users values ('${ADMIN}'), ('${U(1)}'), ('${U(2)}'), ('${U(3)}'), ('${U(4)}');
    insert into user_profiles (id, username) values ('${ADMIN}', 'pingu'), ('${U(1)}', 'u1'), ('${U(2)}', 'u2'), ('${U(3)}', 'u3'), ('${U(4)}', 'u4');`])
  check('el andamio carga', r.status === 0, r.stderr)
  check('la 1192 entra', psql(['-d', BD, '-c', m1192]).status === 0)
  const como = (u) => `set prueba.uid = '${u}'; set prueba.admin = 'no'; set role authenticated;`
  check('  …con un evento', q(`set prueba.uid = '${ADMIN}'; set prueba.admin = 'si'; set role authenticated; insert into eventos (slug, nombre, empieza) values ('ib', 'Iberian', now() + interval '5 days')`).ok)
  const id = q(`select id from eventos where slug = 'ib'`).out
  // Llegan en orden: u1, u2 (sin decirlo), u3, u4.
  for (const [u, oculto] of [[1, false], [2, true], [3, false], [4, false]]) {
    q(`${como(U(u))} select evento_voy('${id}', true, ${oculto})`)
    q(`update evento_asistentes set created_at = now() + interval '${u} minutes' where user_id = '${U(u)}'`)
  }
  const ficha = (u) => JSON.parse(q(`${u ? como(u) : 'set prueba.uid = \'\'; set role anon;'} select evento_ficha('ib')`).out || 'null')
  check('antes de la 1295 no hay mi_numero', !('mi_numero' in ficha(U(3))))

  const sentencias = sinNotify(mig).split(/;\s*\n(?=(?:create|revoke|grant|drop|alter|notify|--|\s*$))/i).map((x) => x.trim()).filter((x) => x && !/^(--[^\n]*\n?)+$/.test(x))
  let todas = true
  for (let vuelta = 0; vuelta < 2; vuelta++) for (const st of sentencias) { const x = psql(['-d', BD, '-c', /\$\$\s*$/.test(st) || !st.endsWith(';') ? st + ';' : st]); if (x.status !== 0) { todas = false; console.log(x.stderr) } }
  check('la 1295 entra sentencia a sentencia, y otra vez encima', todas, sentencias.length)

  const f3 = ficha(U(3))
  check('u3 es el nº 3 (cuenta a u2, que va sin decirlo)', f3.mi_numero === 3, f3.mi_numero)
  check('  …y en caras solo salen 3 (u2 no)', f3.caras.length === 3 && f3.van === 4, JSON.stringify([f3.caras.length, f3.van]))
  check('u2 (sin decirlo) sabe que es el nº 2', ficha(U(2)).mi_numero === 2)
  check('u1, el nº 1', ficha(U(1)).mi_numero === 1)
  check('pasar a «sin decirlo» no te mueve de puesto', q(`${como(U(4))} select evento_voy('${id}', true, true)`).ok && ficha(U(4)).mi_numero === 4)
  check('quien no va: 0 (la web lo trata como «no se sabe»)', ficha(ADMIN).mi_numero === 0, ficha(ADMIN).mi_numero)
  check('sin sesión: 0', ficha(null).mi_numero === 0)
  check('lo de antes sigue: van, voy, oculto y sin creado_por', f3.van === 4 && f3.voy === true && f3.oculto === false && !('creado_por' in f3))
  check('la agenda también lo lleva', JSON.parse(q(`${como(U(3))} select eventos_lista()`).out)[0].mi_numero === 3)
  check('evento_json sigue sin poderse llamar a pelo', /permission denied/.test(q(`${como(U(1))} select evento_json(e, 5) from eventos e`).err))
  psql(['-c', `drop database if exists ${BD}`])
}
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
