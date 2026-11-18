// Tanda 1394 — «Tu torneo» en Inicio: portada_hoy() trae el podio congelado
// y cuándo se cerró cada uno de tus torneos. Contra PostgreSQL, sobre la base
// de la 1017 (su andamio y su migración), y la 1394 sentencia a sentencia
// como el SQL Editor (631). Y lo puro (`podioDe`) con lo que devuelve.
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
const BD = 'prueba_1394'
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

console.log('── 1. La 1394 contra PostgreSQL ──')
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
  check('(base) la 1017 pasa sentencia a sentencia', !errores.length && sentencias.length >= 18, errores.join(' || ') || String(sentencias.length))
  r = psql(['-d', BD, '-f', join(REPO, 'supabase-migration-1017-portada-consultas.sql')])
  check('  …y otra vez encima', r.status === 0, r.stderr)
  psql(['-d', BD, '-c', 'alter table public.tournaments add column if not exists podium jsonb'])
  const m1394 = leer('supabase-migration-1394-portada-podio.sql')
  const s1394 = sentenciasDe(m1394)
  const err1394 = []
  for (const s of s1394) {
    const x = psql(['-d', BD, '-c', s])
    if (x.status !== 0) err1394.push(`${s.slice(0, 70)}… → ${x.stderr.slice(0, 220)}`)
  }
  check('la 1394 pasa sentencia a sentencia, cada una en su conexión', !err1394.length && s1394.length >= 3, err1394.join(' || ') || String(s1394.length))
  r = psql(['-d', BD, '-f', join(REPO, 'supabase-migration-1394-portada-podio.sql')])
  check('  …y otra vez encima', r.status === 0, r.stderr)
  check('  …y su comprobación dice que trae el podio', sql(`select position('podium' in pg_get_functiondef('public.portada_hoy()'::regprocedure)) > 0`) === 't')
  sql(`insert into public.tournaments (id, slug, name, start_at, status, format, podium, updated_at) values
      ('00000000-0000-0000-0001-0000000000c1', 'copa', 'Copa', now() - interval '1 day', 'finished', 'standard', '["${A}", "${B}"]', now() - interval '2 hours'),
      ('00000000-0000-0000-0001-0000000000c2', 'vieja', 'Vieja', now() - interval '20 days', 'finished', 'standard', '["${B}", "${A}"]', now() - interval '19 days');
    insert into public.tournament_registrations (tournament_id, user_id, status) values
      ('00000000-0000-0000-0001-0000000000c1', '${A}', 'active'), ('00000000-0000-0000-0001-0000000000c2', '${A}', 'active'), ('00000000-0000-0000-0001-0000000000c1', '${B}', 'active');`)
  const d = json(como(A, 'select public.portada_hoy()'))
  const copa = (d?.torneos || []).find((t) => t.slug === 'copa')
  check('portada_hoy() trae tus torneos terminados con su podio y cuándo se cerró', copa && Array.isArray(copa.podium) && copa.podium[0] === A && Boolean(copa.updated_at), JSON.stringify(copa))
  check('  …y lo demás de la 1017 sigue ahí (valor, sets, sigue, hilos)', d && 'valor' in d && 'sets' in d && 'sigue' in d && 'hilos' in d, Object.keys(d || {}).join(','))
  // Lo puro, sin el navegador: hoy.js importa cosas del DOM, así que la
  // función se lee de su texto (es pura y no usa nada de fuera salvo DIA).
  const texto = leer('js/hoy.js')
  const fuente = texto.slice(texto.indexOf('export function podioDe('), texto.indexOf('let podioDeHoy'))
  const podioDe = new Function('DIA', `${fuente.replace('export ', '')}; return podioDe`)(86_400_000)
  check('lo puro: la Copa de hace 2 h → «1.º»', JSON.stringify(podioDe(d.torneos, A)) === JSON.stringify({ slug: 'copa', name: 'Copa', puesto: 1 }), JSON.stringify(podioDe(d.torneos, A)))
  check('  …la Vieja (19 días) no cuenta', podioDe(d.torneos.filter((t) => t.slug === 'vieja'), B) === null)
  check('  …y sin podio en los datos (la migración sin ejecutar), nada', podioDe(d.torneos.map(({ podium, ...t }) => t), A) === null)
  psql(['-c', `drop database if exists ${BD}`])
}
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
