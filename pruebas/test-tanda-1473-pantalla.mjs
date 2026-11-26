// Tanda 1473 — Arena limpia: la ficha y tu mesa. La cabecera con el banner, la
// imagen y cuatro datos iguales; cuatro pestañas fijas del mismo ancho (antes
// de empezar, dos); tu mesa fuera de la fila (la barra de encima) y «cara a
// cara» con tu rival.
import { chromium, contexto, BASE } from './fixtures-app.mjs'
import { datosArena, sembrarArena } from './fixture-arena.mjs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'

let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── Lo puro ──')
{
  const { datosDeFicha } = await import(`${REPO}/js/torneos/arena-ficha.js`)
  const ahora = new Date(2026, 10, 26, 12, 0).getTime()
  const base = { format: 'standard', swiss_rounds: 5, top_cut_size: 8, swiss_bo: 1, round_time_minutes: 50, max_players: 64, start_at: new Date(2026, 10, 30, 17, 0).toISOString() }
  const a = datosDeFicha({ ...base, status: 'registration_open' }, { activos: 24, ahora })
  check('abierto: cuatro datos, en orden', a.map((d) => d.rotulo).join(',') === 'Cuándo,Formato,Jugadores,Estado')
  check('…«lun 30 · 17:00, en 4 d…», «5 + top 8», «24/64 · quedan 40», «Abierto»', /^lun 30 · 17:00$/.test(a[0].b) && /^en 4 d/.test(a[0].s) && a[1].b === '5 + top 8' && a[2].b === '24/64' && /quedan 40/.test(a[2].s) && a[3].b === 'Abierto', JSON.stringify(a))
  const j = datosDeFicha({ ...base, status: 'in_progress' }, { activos: 16, ronda: { round_number: 3, phase: 'swiss' }, ahora })
  check('en juego: «16 jugando» y «Ronda 3 de 5 · en juego» (vivo)', j[2].b === '16' && j[2].s === 'jugando' && j[3].b === 'Ronda 3' && /de 5/.test(j[3].s) && j[3].clase === 'vivo', JSON.stringify(j))
  const f = datosDeFicha({ ...base, status: 'finished' }, { activos: 16, campeon: 'ikergbt', ahora })
  check('terminado: «Terminado · ganó ikergbt»', f[3].b === 'Terminado' && f[3].s === 'ganó ikergbt', JSON.stringify(f[3]))
}

// Un torneo en juego, ronda 3 de 5, con tu mesa 4 contra erika (los dos con
// check-in hecho) y las rondas 1 y 2 cerradas.
function datos() {
  const d = datosArena()
  const ahora = Date.now()
  const IDS = ['user-1', 'user-2', 'p2', 'p3', 'p4', 'user-3', 'v7', 'v8']
  const NOM = ['pingu', 'jesus-bless', 'enege', 'srpaquito', 'soyfedeegb', 'ikergbt', 'misty', 'erika']
  d.torneos.unshift({ id: 't-vivo', slug: 'vivo', name: 'RyuCards Weekly', status: 'in_progress', format: 'standard', modalidad: 'online', swiss_rounds: 5, swiss_bo: 1, top_cut_size: 0, checkin_minutes: 5, round_time_minutes: 50, max_players: 32, start_at: new Date(ahora - 95 * 6e4).toISOString(), admin_id: 'user-3', pairing_seed: 's', image_url: '/fotos/carta2.svg', banner_url: '/fotos/foto3.svg' })
  const rv = (n, st, min) => ({ id: `rv${n}`, tournament_id: 't-vivo', round_number: n, phase: 'swiss', status: st, started_at: new Date(ahora - min * 6e4).toISOString(), ends_at: new Date(ahora - min * 6e4 + 50 * 6e4).toISOString() })
  d.RONDAS.push(rv(1, 'finished', 95), rv(2, 'finished', 48), rv(3, 'active', 19))
  IDS.forEach((u, i) => d.insc.push({ id: `iv${i}`, tournament_id: 't-vivo', user_id: u, status: 'active', tcg_live_username: `TCG_${NOM[i]}` }))
  const par = { 1: [[0, 7], [1, 6], [2, 5], [3, 4]], 2: [[0, 3], [1, 2], [4, 7], [5, 6]], 3: [[1, 3], [2, 4], [5, 6], [0, 7]] }
  for (const n of [1, 2, 3]) par[n].forEach(([a, b], k) => {
    const id = `mv${n}-${k + 1}`
    const fin = n < 3
    d.MESAS.push({ id, round_id: `rv${n}`, table_number: k + 1, player_a_id: IDS[a], player_b_id: IDS[b], status: fin ? 'finished' : 'active', check_in_a_at: new Date(ahora - 18 * 6e4).toISOString(), check_in_b_at: new Date(ahora - 17 * 6e4).toISOString() })
    if (fin) d.RES.push({ match_id: id, result: 'a_wins', winner_id: IDS[a] })
  })
  d.PERFILES = [...d.PERFILES.filter((p) => !IDS.includes(p.id)), ...IDS.map((id, i) => ({ id, username: NOM[i] }))]
  return d
}
const b = await chromium.launch()
async function abrir({ movil = false, ruta } = {}) {
  const ctx = await contexto(b, movil, 'user-1')
  await ctx.addInitScript(sembrarArena, datos())
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3500)
  await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()))
  return { ctx, page, errores }
}
const pestanas = (page) => page.evaluate(() => [...document.querySelectorAll('#torneoPestanas [data-pestana]')].filter((p) => p.getClientRects().length).map((p) => ({ id: p.dataset.pestana, w: Math.round(p.getBoundingClientRect().width), on: p.classList.contains('activa') })))

console.log('── Antes de empezar ──')
{
  const { ctx, page, errores } = await abrir({ ruta: '/torneo?slug=copa-diciembre' })
  const r = await page.evaluate(() => ({
    datos: [...document.querySelectorAll('#torneoDatos .tficha-dato b')].map((b) => b.textContent.trim()),
    avatar: document.getElementById('torneoAvatar')?.textContent.trim(),
    tipo: document.getElementById('torneoCabecera')?.dataset.tipoTorneo,
    cuenta: getComputedStyle(document.getElementById('torneoCuenta')).display,
  }))
  const p = await pestanas(page)
  check('cuatro datos en la cabecera', r.datos.length === 4 && r.datos[3] === 'Abierto', r.datos.join(' | '))
  check('sin imagen, las iniciales («CP») y el color de su tipo', r.avatar === 'CP' && r.tipo === 'online', `${r.avatar} ${r.tipo}`)
  check('la pastilla de la cuenta ya no sale (va en «Cuándo»)', r.cuenta === 'none', r.cuenta)
  check('dos pestañas, Resumen y Jugadores, del mismo ancho', p.map((x) => x.id).join(',') === 'torneo,jugadores' && Math.abs(p[0].w - p[1].w) <= 2, JSON.stringify(p))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── En juego, PC ──')
{
  const { ctx, page, errores } = await abrir({ ruta: '/torneo?slug=vivo' })
  const p = await pestanas(page)
  const r = await page.evaluate(() => ({
    avatar: document.querySelector('#torneoAvatar img')?.getAttribute('src'),
    banner: document.getElementById('torneoBanner')?.getAttribute('src'),
    estado: document.querySelector('#torneoDatos .tficha-dato:last-child')?.textContent.replace(/\s+/g, ' ').trim(),
    mesa: !document.querySelector('[data-panel="jugar"]')?.classList.contains('hidden'),
    cara: document.querySelector('.torneo-cara-a-cara')?.textContent.replace(/\s+/g, ' ').trim(),
  }))
  check('la imagen y el banner del torneo', r.avatar === '/fotos/carta2.svg' && r.banner === '/fotos/foto3.svg', JSON.stringify(r))
  check('el estado: «Ronda 3 de 5 · en juego»', /Ronda 3/.test(r.estado) && /de 5/.test(r.estado), r.estado)
  check('cuatro pestañas: Resumen, Clasificación, Rondas, Mazos', p.map((x) => x.id).join(',') === 'torneo,clasificacion,rondas,meta', p.map((x) => x.id).join(','))
  check('…del mismo ancho', Math.max(...p.map((x) => x.w)) - Math.min(...p.map((x) => x.w)) <= 2, p.map((x) => x.w).join(','))
  check('juegas: la ficha se abre en tu mesa (sin pestaña de «Tu mesa»)', r.mesa && !p.some((x) => x.id === 'jugar'))
  check('cara a cara: erika, su puesto y lo que hizo en la anterior', /^erika va \d+\.º con \d-\d-\d · en la anterior (ganó a|perdió con) /.test(r.cara || ''), r.cara)
  await page.click('#torneoPestanas [data-pestana="clasificacion"]')
  await page.waitForTimeout(800)
  const barra = await page.evaluate(() => {
    const c = document.getElementById('torneoBarraViva')
    return { visible: Boolean(c && !c.classList.contains('hidden') && c.getClientRects().length), mia: c?.classList.contains('con-mia'), texto: c?.textContent.replace(/\s+/g, ' ').trim() }
  })
  check('en Clasificación, la barra de tu mesa: «Tu mesa 4 · contra erika» y «Ir a tu mesa»', barra.visible && barra.mia && /Tu mesa 4 · contra erika/.test(barra.texto) && /Ir a tu mesa/.test(barra.texto), JSON.stringify(barra))
  await page.click('#torneoPestanas [data-pestana="meta"]')
  await page.waitForTimeout(600)
  const vacia = await page.evaluate(() => document.querySelector('[data-panel="meta"] .torneo-panel-vacio')?.getClientRects().length ? document.querySelector('[data-panel="meta"] .torneo-panel-vacio').textContent.trim() : '')
  check('Mazos sin listas a la vista: la pestaña sigue y dice cuándo se llena', /cuando el torneo termine/.test(vacia), vacia)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── En juego, móvil ──')
{
  const { ctx, page, errores } = await abrir({ movil: true, ruta: '/torneo?slug=vivo&ver=clasificacion' })
  const p = await pestanas(page)
  const r = await page.evaluate(() => ({
    ancho: document.documentElement.scrollWidth - innerWidth,
    datos: [...document.querySelectorAll('#torneoDatos .tficha-dato')].map((d) => Math.round(d.getBoundingClientRect().width)),
    tabla: document.querySelector('#torneoPestanas [data-pestana="clasificacion"] .torneo-tab-corto')?.textContent.trim(),
  }))
  check('no ensancha la página', r.ancho <= 0, r.ancho)
  check('los cuatro datos, en dos filas de dos iguales', r.datos.length === 4 && Math.max(...r.datos) - Math.min(...r.datos) <= 2, r.datos.join(','))
  check('las cuatro pestañas, iguales; Clasificación se llama «Tabla»', p.length === 4 && Math.max(...p.map((x) => x.w)) - Math.min(...p.map((x) => x.w)) <= 2 && r.tabla === 'Tabla', JSON.stringify(p))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ todo bien')
process.exit(fails ? 1 : 0)
