// Tanda 821 (VE6) — lo que tarda de verdad cada página, en nuestra tabla.
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
const RAIZ = '/home/user/pingu'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
// El módulo importa supabase.js (con su cliente de verdad): en node basta un
// navegador mínimo para que cargue.
globalThis.navigator ||= { userAgent: 'node' }
const v = await import(`${RAIZ}/js/vitales.js`)
console.log('── Lo puro ──')
check('la fila: enteros, acotados y el CLS por mil', JSON.stringify(v.filaDeVitales({ path: '/foro', lcp: 2345.6, inp: 88.2, cls: 0.1234, movil: true })) === JSON.stringify({ path: '/foro', lcp_ms: 2346, inp_ms: 88, cls_mil: 123, movil: true }))
check('  …sin nada medido, no hay fila', v.filaDeVitales({ path: '/', lcp: null, inp: null, cls: NaN }) === null)
check('  …y un valor absurdo se acota a lo que deja la tabla', v.filaDeVitales({ path: '/', lcp: 9e9 }).lcp_ms === 120000)
check('la nota, con los umbrales de Google', v.notaDeVital('lcp', 2400) === 'bien' && v.notaDeVital('lcp', 3000) === 'regular' && v.notaDeVital('inp', 600) === 'mal' && v.notaDeVital('cls', 0.05) === 'bien' && v.notaDeVital('lcp', null) === '')

console.log('\n── En una página de mentira ──')
const pagina = ({ webdriver = false } = {}) => {
  const obs = []
  const oyentes = {}
  const win = {
    PerformanceObserver: class { constructor(cb) { this.cb = cb } observe(o) { obs.push({ ...o, cb: this.cb }) } },
    document: { visibilityState: 'visible', addEventListener: (t, f) => { oyentes[t] = f } },
    location: { pathname: '/guia/como-empezar', search: '' },
    matchMedia: () => ({ matches: true }),
  }
  Object.defineProperty(globalThis.navigator, 'webdriver', { value: webdriver, configurable: true })
  const emitir = (type, entradas) => obs.filter((o) => o.type === type).forEach((o) => o.cb({ getEntries: () => entradas }))
  const esconder = () => { win.document.visibilityState = 'hidden'; oyentes.visibilitychange?.() }
  return { win, emitir, esconder, obs }
}
{
  const p = pagina()
  const enviadas = []
  check('fuera de la muestra no mide nada', v.medirVitales({ win: p.win, azar: () => 0.9, enviar: (f) => enviadas.push(f) }) === false && p.obs.length === 0)
}
{
  const p = pagina()
  const enviadas = []
  const midio = v.medirVitales({ win: p.win, azar: () => 0.1, enviar: (f) => enviadas.push(f) })
  check('dentro de la muestra observa LCP, toques y saltos', midio && ['largest-contentful-paint', 'event', 'layout-shift'].every((t) => p.obs.some((o) => o.type === t && o.buffered)))
  p.emitir('largest-contentful-paint', [{ startTime: 1200 }, { startTime: 1800 }])
  p.emitir('event', [{ interactionId: 1, duration: 120 }, { interactionId: 0, duration: 900 }, { interactionId: 2, duration: 260 }])
  p.emitir('layout-shift', [{ value: 0.05, hadRecentInput: false }, { value: 0.5, hadRecentInput: true }, { value: 0.02 }])
  p.esconder()
  p.esconder()
  check('al esconderse manda UNA fila con lo último: LCP, el peor toque y los saltos sin tocar', enviadas.length === 1 && enviadas[0].lcp_ms === 1800 && enviadas[0].inp_ms === 260 && enviadas[0].cls_mil === 70 && enviadas[0].movil === true && enviadas[0].path === '/guia/como-empezar', JSON.stringify(enviadas))
}
{
  const p = pagina({ webdriver: true })
  check('un robot no se mide', v.medirVitales({ win: p.win, azar: () => 0, enviar: () => {} }) === false)
}
{
  const app = readFileSync(`${RAIZ}/js/app.js`, 'utf8')
  check('app.js lo carga aparte (import), sin bajarlo en la portada', /import\('\.\/vitales\.js'\)\.then\(\(m\) => m\.medirVitales\(\)\)/.test(app))
  const admin = readFileSync(`${RAIZ}/admin/js/admin.js`, 'utf8')
  check('/admin lo pinta desde la base (vitales_resumen) y dice si falta la migración', /rpc\('vitales_resumen'/.test(admin) && /supabase-migration-vitales\.sql/.test(admin))
}
console.log('\n── La migración, contra PostgreSQL ──')
{
  const PG = ['-h', '/var/tmp', '-p', '5433', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q']
  const q = (sql, db = 'postgres') => spawnSync('psql', [...PG, '-d', db, '-At', '-c', sql], { encoding: 'utf8' })
  const hay = q('select 1')
  if (hay.status !== 0) check('hay un PostgreSQL en /var/tmp:5433', false, hay.stderr)
  else {
    q('drop database if exists prueba821'); q('create database prueba821')
    const pre = `do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
create schema if not exists auth; create or replace function auth.uid() returns uuid language sql as $f$ select nullif(current_setting('prueba.uid', true), '')::uuid $f$;
create or replace function is_admin() returns boolean language sql as $f$ select current_setting('prueba.admin', true) = 'si' $f$;
grant usage on schema public to anon, authenticated;`
    const r0 = spawnSync('psql', [...PG, '-d', 'prueba821', '-c', pre], { encoding: 'utf8' })
    const sql = readFileSync(`${RAIZ}/supabase-migration-vitales.sql`, 'utf8').replace(/notify pgrst[^;]*;/, '')
    const r1 = spawnSync('psql', [...PG, '-d', 'prueba821', '-c', sql], { encoding: 'utf8' })
    check('la migración entra (y entra dos veces)', r0.status === 0 && r1.status === 0 && spawnSync('psql', [...PG, '-d', 'prueba821', '-c', sql], { encoding: 'utf8' }).status === 0, r1.stderr)
    const ins = q(`set role anon; insert into page_vitals (path, lcp_ms, inp_ms, cls_mil, movil) values ('/foro', 1500, 100, 20, true), ('/foro', 3500, 300, 200, false), ('/foro', 5000, 700, 300, true);`, 'prueba821')
    check('cualquiera apunta', ins.status === 0, ins.stderr)
    const leeAnon = q(`set role anon; select count(*) from page_vitals`, 'prueba821')
    check('  …pero no lee (sin permiso)', leeAnon.status !== 0 || leeAnon.stdout.trim() === '0', leeAnon.stdout + leeAnon.stderr)
    const malo = q(`set role anon; insert into page_vitals (path, lcp_ms) values ('/x', -5)`, 'prueba821')
    check('  …y una cifra imposible se rechaza', malo.status !== 0)
    const resumen = q(`set prueba.admin = 'si'; set role authenticated; select path || '|' || visitas || '|' || lcp_p75 || '|' || inp_p75 || '|' || cls_p75 || '|' || movil_pct from vitales_resumen(7)`, 'prueba821')
    check('el equipo lee el p75 por página', resumen.stdout.trim() === '/foro|3|4250|500|0.250|67', resumen.stdout + resumen.stderr)
    const noAdmin = q(`set prueba.admin = 'no'; set role authenticated; select count(*) from vitales_resumen(7)`, 'prueba821')
    check('  …y alguien que no es del equipo, nada', noAdmin.stdout.trim() === '0', noAdmin.stdout + noAdmin.stderr)
    q('drop database if exists prueba821')
  }
}
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
