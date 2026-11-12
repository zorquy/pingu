// Tanda 1296 — «Recién llegado a las tiendas» llena la fila, contra PostgreSQL:
// reparte por turnos (la más nueva de cada tienda, luego la segunda…) hasta lo
// pedido; con dos tiendas y 8 pedidas salen 8, no 4; con muchas, una de cada
// antes que la segunda de ninguna; lo de una tienda de pruebas no sale; y se
// enseña lo más nuevo primero. La migración entra dos veces y sentencia a
// sentencia.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const REPO = process.env.PD_RAIZ || '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_1296'
const q = (s) => { const r = psql(['-At', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
const mig = readFileSync(`${REPO}/supabase-migration-1296-tiendas-recien.sql`, 'utf8')
check('la migración no usa tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0, hay.stderr)
if (hay.status === 0) {
  psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
  const T = (n) => `00000000-0000-0000-0000-0000000000${String(n).padStart(2, '0')}`
  let r = psql(['-d', BD, '-c', `do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    grant usage on schema public to anon, authenticated;
    create table user_profiles (id uuid primary key, username text, display_name text, tipo text, is_banned boolean default false);
    create table tiendas (user_id uuid primary key, precio_visible boolean default true, de_pruebas boolean not null default false);
    create table tcg_cards (id text primary key, market text not null default 'WEST', name text, name_es text);
    create table tcg_products (id bigint primary key, name text);
    create table tienda_stock (id serial primary key, tienda_id uuid, card_id text, market text default 'WEST', product_id bigint,
      precio numeric, oferta_precio numeric, oferta_hasta timestamptz, visible boolean default true, unidades int default 1, entro_el timestamptz default now());
    create function tienda_precio_de(p numeric, o numeric, h timestamptz) returns numeric language sql as $f$ select coalesce(o, p) $f$;
    create function tienda_publica(t uuid) returns boolean language sql as $f$ select not coalesce((select de_pruebas from tiendas where user_id = t), false) $f$;
    insert into tcg_cards values ('c1', 'WEST', 'Pikachu', null);`])
  check('el andamio carga', r.status === 0, r.stderr)
  const sentencias = mig.replace(/notify pgrst[^;]*;/g, '').split(/;\s*\n(?=(?:create|revoke|grant|drop|alter|--|\s*$))/i).map((x) => x.trim()).filter((x) => x && !/^(--[^\n]*\n?)+$/.test(x))
  let todas = true
  for (let v = 0; v < 2; v++) for (const st of sentencias) { const x = psql(['-d', BD, '-c', /\$\$\s*$/.test(st) || !st.endsWith(';') ? st + ';' : st]); if (x.status !== 0) { todas = false; console.log(x.stderr) } }
  check('la 1296 entra sentencia a sentencia, y otra vez encima', todas, sentencias.length)

  // Dos tiendas con seis cartas cada una (como en producción hoy: pocas tiendas).
  const tienda = (n, pruebas = false) => q(`insert into user_profiles values ('${T(n)}', 't${n}', 'Tienda ${n}', 'tienda'); insert into tiendas (user_id, de_pruebas) values ('${T(n)}', ${pruebas})`)
  tienda(1); tienda(2)
  for (const n of [1, 2]) for (let i = 0; i < 6; i++) q(`insert into tienda_stock (tienda_id, card_id, precio, entro_el) values ('${T(n)}', 'c1', ${i + 1}, now() - interval '${n * 10 + i} minutes')`)
  const recien = (k) => JSON.parse(q(`set role anon; select tiendas_recien(${k})`).out || '[]')
  let l = recien(8)
  check('dos tiendas, 8 pedidas: salen 8 (antes 4)', l.length === 8, l.length)
  const de = (x) => x.tienda.username
  check('  …cuatro de cada una (por turnos)', l.filter((x) => de(x) === 't1').length === 4 && l.filter((x) => de(x) === 't2').length === 4, l.map(de).join())
  check('  …y lo más nuevo primero', l.every((x, i) => i === 0 || new Date(l[i - 1].entro_el) >= new Date(x.entro_el)))
  check('3 pedidas: 3', recien(3).length === 3)
  check('más de 24: 24 como mucho (aquí hay 12)', recien(100).length === 12)

  // Con muchas tiendas, una de cada antes que la segunda de ninguna.
  for (let n = 3; n <= 10; n++) { tienda(n); q(`insert into tienda_stock (tienda_id, card_id, precio, entro_el) values ('${T(n)}', 'c1', 1, now() - interval '${200 + n} minutes')`) }
  l = recien(8)
  check('diez tiendas, 8 pedidas: 8 tiendas distintas', new Set(l.map(de)).size === 8, l.map(de).join())
  check('  …aunque las de la 1 y la 2 sean más nuevas', l.filter((x) => de(x) === 't1').length === 1)

  // Una de pruebas no sale; lo oculto o agotado tampoco.
  tienda(11, true); q(`insert into tienda_stock (tienda_id, card_id, precio, entro_el) values ('${T(11)}', 'c1', 1, now() + interval '1 minute')`)
  q(`insert into tienda_stock (tienda_id, card_id, precio, visible, entro_el) values ('${T(1)}', 'c1', 1, false, now() + interval '2 minutes')`)
  q(`insert into tienda_stock (tienda_id, card_id, precio, unidades, entro_el) values ('${T(2)}', 'c1', 1, 0, now() + interval '3 minutes')`)
  l = recien(24)
  check('la de pruebas, lo oculto y lo agotado no salen', !l.some((x) => de(x) === 't11') && l.length === 20, l.length)
  check('el precio de una tienda que lo esconde no sale', q(`update tiendas set precio_visible = false where user_id = '${T(3)}'`).ok && recien(24).find((x) => de(x) === 't3').precio === null)
  psql(['-c', `drop database if exists ${BD}`])
}
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
