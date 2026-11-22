// Tanda 1415 — «Quién tiene lo que buscas» en la ficha de un evento, contra
// PostgreSQL.
//   · `evento_cruces`: solo si has dicho «Voy»; salen los que van (no los que
//     van «sin decirlo», ni los baneados, ni los que no van) que DAN cartas de
//     tu La quiero (con su idioma si lo pediste) o BUSCAN cartas que das.
//   · Lo que está comprometido en un trato no cuenta (`cambio_libres_de`).
//   · Permisos: anon no la llama; la interna, nadie desde fuera.
//   · `eventos_vispera`: entre las 18 y las 21 de Madrid, a los que van a un
//     evento de mañana y tienen algo allí; una vez; respeta las preferencias.
//   · Sin tablas temporales y repetible.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── la función programada ──')
{
  const { procesar } = await import(`${REPO}/netlify/functions/avisos-recordatorio.mjs`)
  const llamar = async (vispera) => {
    const rutas = []
    const r = await procesar({ env: { SUPABASE_SERVICE_ROLE_KEY: 'k' }, fetchImpl: async (u) => { rutas.push(u.split('/').pop()); if (u.includes('avisos_al_dia')) return new Response('1'); if (u.includes('eventos_vispera')) return vispera(); return new Response('') } })
    return { r, rutas }
  }
  const bien = await llamar(() => new Response('3'))
  check('cada hora llama también a la víspera y apunta cuántos', bien.rutas.join() === 'avisos_al_dia,eventos_vispera,scrydex_estado' && bien.r.vispera === 3, JSON.stringify(bien))
  const sin = await llamar(() => new Response('{"code":"PGRST202"}', { status: 404 }))
  check('sin la migración, lo dice sin fallar lo demás', sin.r.ok && sin.r.avisadas === 1 && /1415/.test(sin.r.vispera), JSON.stringify(sin.r))
}

const mig = readFileSync(`${REPO}/supabase-migration-1415-evento-cruces.sql`, 'utf8')
check('sin tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args, input) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000, input })
const BD = 'prueba_1415'
const q = (s, como = null) => {
  const pre = como ? `set request.jwt.claim.sub = '${como}';` : 'reset request.jwt.claim.sub;'
  const r = psql(['-At', '-d', BD, '-c', `${pre} ${s}`])
  return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() }
}
const U = (n) => `00000000-0000-0000-0000-00000000000${n}`
const [A, B, C, D, E, F, G, H] = [1, 2, 3, 4, 5, 6, 7, 8].map(U)
const EV = '10000000-0000-0000-0000-000000000001'
const EV2 = '10000000-0000-0000-0000-000000000002'

const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0, hay.stderr)
if (hay.status === 0) {
  psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
  const base = psql(['-d', BD, '-f', '-'], `
    do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    do $$ begin create role service_role; exception when duplicate_object then null; end $$;
    create schema auth;
    create table auth.users (id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create table public.user_profiles (id uuid primary key, username text, display_name text, avatar_url text, is_banned boolean default false, notification_prefs_disabled text[] default '{}');
    create table public.eventos (id uuid primary key, nombre text, slug text, empieza timestamptz, termina timestamptz, publicado boolean default true);
    create table public.evento_asistentes (evento_id uuid references public.eventos(id), user_id uuid, oculto boolean default false, primary key (evento_id, user_id));
    create table public.user_collection (id uuid primary key default gen_random_uuid(), user_id uuid, card_id text, market text default 'WEST', idioma text default 'es', variante text, cantidad int default 1, cambio int default 0);
    create table public.user_wants (id uuid primary key default gen_random_uuid(), user_id uuid, card_id text, idioma text, variante text);
    create table public.user_notifications (id serial primary key, recipient_id uuid, type text, title text, body text, link text);
    -- Lo comprometido en un trato: aquí, la línea con cambio 9 tiene 0 libres.
    create function public.cambio_libres_de(p_linea uuid, p_cambio int, p_cantidad int) returns int language sql stable as $$ select case when p_cambio = 9 then 0 else least(p_cambio, p_cantidad) end $$;
    insert into auth.users select unnest(array['${A}','${B}','${C}','${D}','${E}','${F}','${G}','${H}']::uuid[]);
    insert into public.user_profiles (id, username, is_banned) values ('${A}','ana',false),('${B}','bea',false),('${C}','carla',false),('${D}','dani',false),('${E}','eva',false),('${F}','fer',false),('${G}','gus',true),('${H}','hugo',false);
    insert into public.eventos values ('${EV}', 'Card Show Bilbao', 'card-show-bilbao', '2026-11-23 09:00+01', null, true),
                                     ('${EV2}', 'Feria lejana', 'feria-lejana', '2026-12-20 09:00+01', null, true);
    insert into public.evento_asistentes (evento_id, user_id, oculto) values
      ('${EV}','${A}',false),('${EV}','${B}',false),('${EV}','${C}',true),('${EV}','${D}',false),('${EV}','${F}',false),('${EV}','${G}',false),('${EV}','${H}',false);
    -- Ana busca X (cualquier idioma), Z (solo en español) y W.
    insert into public.user_wants (user_id, card_id, idioma) values ('${A}','X',null),('${A}','Z','es'),('${A}','W',null);
    -- Bea da X y W; Carla (sin decirlo) da X; Gus (baneado) da X; Eva (no va) da X;
    -- Fer da Z pero en inglés; Hugo da W pero comprometida en un trato.
    insert into public.user_collection (user_id, card_id, idioma, cantidad, cambio) values
      ('${B}','X','en',2,1),('${B}','W','es',1,1),('${C}','X','es',1,1),('${G}','X','es',1,1),('${E}','X','es',1,1),('${F}','Z','en',1,1),('${H}','W','es',1,9);
    -- Dani busca Y, que Ana da; y Q, que Ana tiene pero no da.
    insert into public.user_wants (user_id, card_id) values ('${D}','Y'),('${D}','Q');
    insert into public.user_collection (user_id, card_id, cantidad, cambio) values ('${A}','Y',2,1),('${A}','Q',1,0);
  `)
  check('la base de prueba se monta', base.status === 0, base.stderr)
  const r1 = psql(['-d', BD, '-f', '-'], mig)
  check('la migración entra', r1.status === 0, r1.stderr)
  const r2 = psql(['-d', BD, '-f', '-'], mig)
  check('…y repetirla no hace daño', r2.status === 0, r2.stderr)

  console.log('── el cruce ──')
  const deAna = q(`select username || ':' || tiene_n || ':' || busca_n || ':' || tiene::text || ':' || busca::text from public.evento_cruces('${EV}') order by username`, A)
  check('salen Bea (da X y W) y Dani (busca Y)', deAna.out === `bea:2:0:[{"id": "W", "market": "WEST"}, {"id": "X", "market": "WEST"}]:[]\ndani:0:1:[]:[{"id": "Y", "market": "WEST"}]`, deAna.out + deAna.err)
  check('ni la que va sin decirlo, ni el baneado, ni la que no va, ni otro idioma, ni lo comprometido', !/carla|gus|eva|fer|hugo/.test(deAna.out))
  const orden = q(`select string_agg(username, ',') from (select username from public.evento_cruces('${EV}')) x`, A)
  check('primero quien da más de lo tuyo', orden.out === 'bea,dani', orden.out)
  const deEva = q(`select count(*) from public.evento_cruces('${EV}')`, E)
  check('sin «Voy», nada', deEva.out === '0', deEva.out + deEva.err)
  const anonimo = q(`select count(*) from public.evento_cruces('${EV}')`)
  check('sin sesión, nada', anonimo.out === '0', anonimo.out + anonimo.err)
  const perm = q(`select has_function_privilege('anon', 'public.evento_cruces(uuid)', 'execute'), has_function_privilege('authenticated', 'public.evento_cruces(uuid)', 'execute'), has_function_privilege('authenticated', 'public.evento_cruces_de(uuid, uuid)', 'execute'), has_function_privilege('authenticated', 'public.eventos_vispera(timestamptz)', 'execute'), has_function_privilege('service_role', 'public.eventos_vispera(timestamptz)', 'execute')`)
  check('permisos: anon no, con cuenta sí; la interna y la víspera, nadie de fuera (sí la función programada)', perm.out === 'f|t|f|f|t', perm.out + perm.err)
  const sec = q(`select string_agg(proname || '=' || prosecdef || '/' || array_to_string(proconfig, ','), ' ' order by proname) from pg_proc where proname in ('evento_cruces', 'evento_cruces_de', 'eventos_vispera')`)
  check('las tres son SECURITY DEFINER con search_path', sec.out === 'evento_cruces=true/search_path=public evento_cruces_de=true/search_path=public eventos_vispera=true/search_path=public' || sec.out === 'evento_cruces=t/search_path=public evento_cruces_de=t/search_path=public eventos_vispera=t/search_path=public', sec.out)

  console.log('── la víspera ──')
  const manana10 = q(`select public.eventos_vispera('2026-11-22 10:00+01')`)
  check('a las 10 de la mañana no hace nada', manana10.out === '0', manana10.out + manana10.err)
  q(`update public.user_profiles set notification_prefs_disabled = '{evento_vispera}' where id = '${D}'`)
  const tarde = q(`select public.eventos_vispera('2026-11-22 19:00+01')`)
  const avisos = q(`select string_agg(recipient_id::text || '|' || type || '|' || title || '|' || body || '|' || link, E'\\n' order by recipient_id) from public.user_notifications`)
  check('a las 19 avisa a quien tiene algo allí (Ana, Bea y Carla, que va sin decirlo; ni Dani, que lo apagó, ni Gus, baneado)', tarde.out === '3' && !avisos.out.includes(D) && !avisos.out.includes(G), tarde.out + tarde.err)
  check('el aviso de Ana cuenta los dos lados y lleva al bloque', avisos.out.includes(`${A}|evento_vispera|Mañana: Card Show Bilbao|1 de los que van da cartas de tu La quiero y 1 busca cartas que tú das. Míralo antes de ir.|/eventos/card-show-bilbao#evCruces`), avisos.out)
  check('el de Bea: Ana busca lo que ella da', avisos.out.includes(`${B}|evento_vispera|Mañana: Card Show Bilbao|1 busca cartas que tú das. Míralo antes de ir.`), avisos.out)
  const otra = q(`select public.eventos_vispera('2026-11-22 20:00+01'), (select count(*) from public.user_notifications)`)
  check('una vez: la pasada siguiente no repite', otra.out === '0|3', otra.out + otra.err)
  const lejos = q(`select count(*) from public.evento_vispera_avisos where evento_id = '${EV2}'`)
  check('un evento que no es mañana no se toca', lejos.out === '0', lejos.out)
  if (!process.env.GUARDAR) psql(['-c', `drop database if exists ${BD}`])
}

console.log(fails ? `    ❌ ${fails} fallan` : '    ✅ todo en verde')
process.exit(fails ? 1 : 0)
