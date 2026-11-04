// Tanda 1224 — la reputación en los cambios. Dos mitades:
//   · `reputacion_de` contra PostgreSQL de verdad: cuenta solo los tratos
//     HECHOS (los dos lo confirmaron), lo que dijo EL OTRO (bien/problema) y
//     el tipo según la propuesta que lo cerró (un «Cambio hecho» de Mensajes,
//     sin propuesta, es un cambio); la puede llamar cualquiera, también sin
//     cuenta, y la migración entra dos veces seguidas;
//   · en el navegador, los niveles y el rótulo (`nivelDe`, `textoDeConfianza`)
//     y la tarjeta del perfil: «De fiar» con 5 y ningún problema, «Muy de
//     fiar» con 20 y el 95 %, y los problemas nunca en número (el %).
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const REPO = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

console.log('── 1. reputacion_de, contra PostgreSQL ──')
const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
const psql = (args) => spawnSync('psql', [...PG, ...args], { encoding: 'utf8', timeout: 60000 })
const BD = 'prueba_1224'
const q = (s) => { const r = psql(['-At', '-F', '|', '-d', BD, '-c', s]); return { ok: r.status === 0, out: (r.stdout || '').trim(), err: (r.stderr || '').trim() } }
const mig = readFileSync(`${REPO}/supabase-migration-1224-reputacion.sql`, 'utf8')
check('la migración no usa tablas temporales', !/create\s+temp(orary)?\s+table/i.test(mig))
const hay = psql(['-c', 'select 1'])
check('hay un PostgreSQL en /var/tmp:5433', hay.status === 0, hay.stderr)
if (hay.status === 0) {
  psql(['-c', `drop database if exists ${BD}`]); psql(['-c', `create database ${BD}`])
  const U = '00000000-0000-0000-0000-0000000000a1'
  const L = '00000000-0000-0000-0000-0000000000a2'
  const K = '00000000-0000-0000-0000-0000000000a3'
  // Las columnas de las tablas, como en cambios-hechos (795) y la 942.
  let r = psql(['-d', BD, '-c', `do $$ begin create role anon; exception when duplicate_object then null; end $$;
    do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
    grant usage on schema public to anon, authenticated;
    create table trade_confirmations (id uuid primary key default gen_random_uuid(), user_a uuid not null, user_b uuid not null, hecho_a_at timestamptz, hecho_b_at timestamptz,
      valoracion_a text check (valoracion_a in ('bien', 'problema')), valoracion_b text check (valoracion_b in ('bien', 'problema')), created_at timestamptz not null default now());
    create table trade_offers (id uuid primary key default gen_random_uuid(), de uuid not null, para uuid not null, estado text not null default 'enviada', confirmacion uuid);
    create table trade_offer_items (id uuid primary key default gen_random_uuid(), oferta uuid not null references trade_offers (id) on delete cascade, quien uuid not null);
    create table achievement_definitions (id text primary key, title text, description text, emoji text, rarity text, xp_reward int, is_active boolean, condition jsonb);
    revoke all on trade_confirmations, trade_offers, trade_offer_items from anon, authenticated;`])
  check('el andamio carga', r.status === 0, r.stderr)
  r = psql(['-d', BD, '-c', mig])
  check('la 1224 entra', r.status === 0, r.stderr)
  check('  …y otra vez encima', psql(['-d', BD, '-c', mig]).status === 0)
  // U (user_a o user_b según el caso) con Lucía y con KaruMi:
  //   c1 cambio (dan los dos), Lucía dice bien, 3 nov
  //   c2 venta (solo da U), KaruMi dice bien, 1 nov
  //   c3 compra (solo da KaruMi), KaruMi dice problema, 23 oct
  //   c4 «Cambio hecho» de Mensajes, sin propuesta ni valoración, 10 oct
  //   c5 solo lo confirmó U: no cuenta
  //   c6 entre Lucía y KaruMi: no es de U
  //   y U dijo «problema» de Lucía en c1: eso es de Lucía, no de U.
  r = psql(['-d', BD, '-c', `
    insert into trade_confirmations (id, user_a, user_b, hecho_a_at, hecho_b_at, valoracion_a, valoracion_b) values
      ('00000000-0000-0000-0000-0000000000c1', '${U}', '${L}', '2026-11-03', '2026-11-03', 'problema', 'bien'),
      ('00000000-0000-0000-0000-0000000000c2', '${K}', '${U}', '2026-11-01', '2026-11-01', 'bien', null),
      ('00000000-0000-0000-0000-0000000000c3', '${U}', '${K}', '2026-10-23', '2026-10-23', null, 'problema'),
      ('00000000-0000-0000-0000-0000000000c4', '${L}', '${U}', '2026-10-10', '2026-10-10', null, null),
      ('00000000-0000-0000-0000-0000000000c5', '${U}', '${L}', '2026-09-01', null, null, 'bien'),
      ('00000000-0000-0000-0000-0000000000c6', '${L}', '${K}', '2026-09-02', '2026-09-02', 'bien', 'bien');
    insert into trade_offers (id, de, para, estado, confirmacion) values
      ('00000000-0000-0000-0000-0000000000f1', '${U}', '${L}', 'hecha', '00000000-0000-0000-0000-0000000000c1'),
      ('00000000-0000-0000-0000-0000000000f2', '${K}', '${U}', 'hecha', '00000000-0000-0000-0000-0000000000c2'),
      ('00000000-0000-0000-0000-0000000000f3', '${U}', '${K}', 'hecha', '00000000-0000-0000-0000-0000000000c3');
    insert into trade_offer_items (oferta, quien) values
      ('00000000-0000-0000-0000-0000000000f1', '${U}'), ('00000000-0000-0000-0000-0000000000f1', '${L}'),
      ('00000000-0000-0000-0000-0000000000f2', '${U}'), ('00000000-0000-0000-0000-0000000000f2', '${U}'),
      ('00000000-0000-0000-0000-0000000000f3', '${K}');`])
  check('los tratos de prueba entran', r.status === 0, r.stderr)
  const de = (quien, rol = 'anon') => q(`set role ${rol}; select hechos, bien, problemas, cambios, ventas, compras, primero::date, ultimo::date from reputacion_de('${quien}')`)
  let x = de(U)
  check('sin cuenta se puede leer (anon)', x.ok, x.err)
  const [hechos, bien, problemas, cambios, ventas, compras, primero, ultimo] = x.out.split('|')
  check('cuenta solo los hechos de U: 4', hechos === '4', x.out)
  check('  …lo que dijo EL OTRO: 2 bien y 1 problema', bien === '2' && problemas === '1', x.out)
  check('  …por tipo: 2 cambios (uno sin propuesta), 1 venta, 1 compra', cambios === '2' && ventas === '1' && compras === '1', x.out)
  check('  …el primero y el último', primero === '2026-10-10' && ultimo === '2026-11-03', x.out)
  x = de(L, 'authenticated')
  check('Lucía: 3 hechos (c1, c4 y c6), el bien de KaruMi y el problema que dijo U', x.ok && x.out.split('|').slice(0, 3).join() === '3,1,1', x.out + x.err)
  x = de('00000000-0000-0000-0000-0000000000ff')
  check('quien no ha cerrado nada: 0 y sin fechas', x.ok && x.out === '0|0|0|0|0|0||', x.out)
  x = q(`select id, condition->>'type', condition->>'count' from achievement_definitions order by id`)
  check('los tres logros', x.out === 'cambios_1|trades_done_count|1\ncambios_10|trades_done_count|10\nmuy_de_fiar|trades_trusted|1', x.out)
  psql(['-c', `drop database if exists ${BD}`])
}

console.log('── 2. Los niveles y el rótulo, en el navegador ──')
const b = await chromium.launch()
{
  const page = await b.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e)))
  await page.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  const r = await page.evaluate(async () => {
    const m = await import('/js/cambios-hechos.js')
    const t = (c, o) => m.textoDeConfianza(c, o)
    const n = (c) => m.nivelDe(c)
    return {
      cero: [t({ hechos: 0, bien: 0, problemas: 0 }), t({ hechos: 0, bien: 0, problemas: 0 }, { nuevo: true }), t(null, { nuevo: true })],
      uno: t({ hechos: 1, bien: 1, problemas: 0 }),
      tres: t({ hechos: 3, bien: 1, problemas: 0 }),
      fiar: [n({ hechos: 5, bien: 4, problemas: 0 }), t({ hechos: 5, bien: 4, problemas: 0 })],
      conProblema: [n({ hechos: 6, bien: 5, problemas: 1 }), t({ hechos: 6, bien: 5, problemas: 1 })],
      muy: [n({ hechos: 20, bien: 19, problemas: 1 }), t({ hechos: 20, bien: 19, problemas: 1 })],
      casiMuy: n({ hechos: 20, bien: 18, problemas: 2 }),
      // Sin la migración 1224 (cambios_de: hechos y bien, sin problemas).
      viejo: [n({ hechos: 5, bien: 5 }), n({ hechos: 5, bien: 3 }), t({ hechos: 2, bien: 2 })],
      tarjeta: m.tarjetaDeReputacionHtml({ hechos: 14, bien: 14, problemas: 0, cambios: 6, ventas: 5, compras: 3, primero: '2026-03-02T10:00:00Z', ultimo: '2026-11-01T10:00:00Z' }, { ahora: Date.parse('2026-11-04T10:00:00Z') }),
      sinTratos: m.tarjetaDeReputacionHtml({ hechos: 0 }),
    }
  })
  check('sin tratos no se dice nada… salvo donde se pide («Nuevo en los cambios»)', r.cero[0] === '' && r.cero[1] === 'Nuevo en los cambios' && r.cero[2] === '', JSON.stringify(r.cero))
  check('«1 trato · todos bien»', r.uno === '1 trato · todos bien', r.uno)
  check('sin todas valoradas no dice «todos bien»: «3 tratos»', r.tres === '3 tratos', r.tres)
  check('5 sin problemas: «De fiar · 5 tratos»', r.fiar.join('|') === 'fiar|De fiar · 5 tratos', r.fiar)
  check('con un problema: sin nivel y en tanto por ciento, nunca «1 problema»', r.conProblema.join('|') === 'tratos|6 tratos · 83 % bien', r.conProblema)
  check('20 y el 95 %: «Muy de fiar»; con el 90 %, no', r.muy.join('|') === 'muy|Muy de fiar · 20 tratos' && r.casiMuy === 'tratos', JSON.stringify(r.muy) + r.casiMuy)
  check('sin la migración vale lo de antes (todos bien = de fiar)', r.viejo.join('|') === 'fiar|tratos|2 tratos · todos bien', r.viejo)
  check('la tarjeta: nivel, lo que falta, por tipo y fechas', /De fiar/.test(r.tarjeta) && /Faltan 6 para «Muy de fiar»/.test(r.tarjeta) && /<b>6<\/b><small>Cambios<\/small>/.test(r.tarjeta) && /<b>5<\/b><small>Ventas<\/small>/.test(r.tarjeta) && /<b>3<\/b><small>Compras<\/small>/.test(r.tarjeta) && /hace 3 días/.test(r.tarjeta) && /desde marzo de 2026/.test(r.tarjeta), r.tarjeta.replace(/\s+/g, ' ').slice(0, 300))
  check('  …y sin tratos no hay tarjeta', r.sinTratos === '')
  check('sin errores', !errores.length, errores.join(' | '))
  await page.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
