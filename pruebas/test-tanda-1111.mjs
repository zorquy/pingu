// Tanda 1111 — un reto no sale con una carta sin foto (PINGU, con el dorso en
// la carta 2 del reto #91 de «¿De qué expansión es?»: «si hay alguna carta
// sin imagen, que no se pueda entrar al juego»).
//
// Lo que se mira:
//   · lo puro: la foto se PREGUNTA a la cadena, y solo un «no» de todas sus
//     direcciones deja una carta fuera (no contestar no es un no);
//   · los cinco retos con cartas eligen solo cartas con foto;
//   · `revisar`: el día guardado cambia las cartas sin foto (en «¿De qué
//     expansión es?», solo esa ronda) y lo reescribe; sin `revisar`, nada;
//   · en el navegador: con una foto rota se pide la revisión y se juega con
//     lo arreglado (lo contestado de una ronda que cambió vuelve a jugarse);
//     si el servidor dice que sigue sin foto, el reto no se abre.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 260) : ''}`)
}
const hoy = new Date().toISOString().slice(0, 10)
const idsDe = (ruta) => decodeURIComponent(/id=in\.\(([^)]*)\)/.exec(ruta)?.[1] || '').split(',').map((x) => x.replace(/"/g, ''))
// Un doble de la CDN: solo las direcciones con «/buena/» tienen foto.
const rotas = new Set()
const probar = async (u) => /\/buena\//.test(u) && ![...rotas].some((id) => u.includes(`/${id}/`))

console.log('── 1. Lo puro ──')
const F = await import(`${RAIZ}/netlify/lib/fotos-reto.mjs`)
{
  const buena = { id: 'a', market: 'WEST', image_path: 'buena/a' }
  const rota = { id: 'b', market: 'WEST', image_path: 'rota/b' }
  check('con una dirección que la da, hay foto', (await F.fotoContesta(buena, { probar })) === true)
  check('si todas dicen que no, no la hay', (await F.fotoContesta(rota, { probar })) === false)
  check('si alguna no contesta, no se sabe (y no se tira)', (await F.fotoContesta(rota, { probar: async () => null })) === null)
  check('sin ninguna dirección, no la hay', (await F.fotoContesta({ id: 'c', market: 'JP' }, { probar })) === false)
  check('conFoto quita las que no y deja el orden', (await F.conFoto([rota, buena, null], { probar })).map((c) => c.id).join() === 'a')
  check('sinFoto da los ids de las que no', (await F.sinFoto([rota, buena], { probar })).join() === 'b')
  check('?revisar=1 se lee de la petición', F.revisarDePeticion(new Request('https://x/f?revisar=1')) && !F.revisarDePeticion(new Request('https://x/f')))
}

console.log('── 2. ¿De qué expansión es? ──')
{
  const { elegirExpansion } = await import(`${RAIZ}/netlify/functions/que-expansion.mjs`)
  const SETS = Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, market: 'WEST', name: `Set ${i}`, serie_id: i < 6 ? 'base' : 'neo', release_date: `20${String(i).padStart(2, '0')}-01-01`, oculto: false }))
  // Una de cada tres, con la foto rota.
  const CARTAS = Array.from({ length: 40 }, (_, i) => ({ id: `k${i}`, market: 'WEST', set_id: `s${i % 12}`, image_path: `${i % 3 === 0 ? 'rota' : 'buena'}/k${i}`, tcg_sets: { name: `Set ${i % 12}` } }))
  const hacer = (guardadas) => {
    const cambios = []
    return {
      cambios,
      pedir: async (ruta, o = {}) => {
        if (ruta.startsWith('tcg_sets')) return { datos: SETS }
        if (ruta.startsWith('retos_reto_del_dia')) return { datos: guardadas.length ? [{ datos: guardadas[0].datos }] : [] }
        if (o.cabeceras?.prefer === 'count=exact') return { datos: [], total: CARTAS.length }
        const off = /offset=(\d+)/.exec(ruta)
        if (off) return { datos: [CARTAS[Number(off[1])]] }
        return { datos: CARTAS.filter((c) => idsDe(ruta).includes(c.id)) }
      },
      guardar: async (t, f) => guardadas.push(f),
      actualizar: async (t, filtro, c) => { cambios.push([t, filtro, c]); guardadas[0] = { datos: c.datos } },
    }
  }
  const g = []
  const d = hacer(g)
  const r = await elegirExpansion({ dia: hoy, pedir: d.pedir, guardar: d.guardar, actualizar: d.actualizar, probar })
  check('elige cinco, todas con foto', r.rondas?.length === 5 && r.rondas.every((x) => x.carta.image_path.startsWith('buena/')), JSON.stringify(r.rondas?.map((x) => x.carta.id)))
  const antes = r.rondas.map((x) => x.carta.id)
  // La carta de la ronda 2 se queda sin foto (como el XY Trainer Kit).
  rotas.add(antes[1])
  const sin = await elegirExpansion({ dia: hoy, pedir: d.pedir, guardar: d.guardar, actualizar: d.actualizar, probar })
  check('sin revisar, el día guardado no se toca', sin.rondas.map((x) => x.carta.id).join() === antes.join() && d.cambios.length === 0 && sin.sinFoto === undefined)
  const rev = await elegirExpansion({ dia: hoy, pedir: d.pedir, guardar: d.guardar, actualizar: d.actualizar, probar, revisar: true })
  const despues = rev.rondas.map((x) => x.carta.id)
  check('revisado: solo cambia la carta de la ronda 2', despues[1] !== antes[1] && [0, 2, 3, 4].every((i) => despues[i] === antes[i]), `${antes.join()} → ${despues.join()}`)
  check('  …por una con foto, de otra expansión, con la suya entre las opciones', !rotas.has(despues[1]) && rev.rondas[1].carta.image_path.startsWith('buena/') && new Set(rev.rondas.map((x) => x.set_id)).size === 5 && rev.rondas[1].opciones.some((s) => s.id === rev.rondas[1].set_id))
  check('  …y se reescribe el día, apuntando qué ronda cambió', d.cambios.length === 1 && d.cambios[0][1] === `juego=eq.expansion&day=eq.${hoy}` && d.cambios[0][2].datos.cambiadas.join() === '1' && d.cambios[0][2].datos.rondas[1].card_id === despues[1])
  check('  …y dice que no queda ninguna sin foto', Array.isArray(rev.sinFoto) && rev.sinFoto.length === 0)
  const otra = await elegirExpansion({ dia: hoy, pedir: d.pedir, guardar: d.guardar, actualizar: d.actualizar, probar, revisar: true })
  check('revisar otra vez, ya arreglado, no cambia nada', otra.rondas.map((x) => x.carta.id).join() === despues.join() && d.cambios.length === 1)
  // Si no hay con qué cambiarla, lo dice (y el navegador cierra el reto).
  const g2 = [{ datos: { rondas: r.rondas.map((x) => ({ card_id: x.carta.id, set_ids: x.opciones.map((s) => s.id) })) } }]
  const d2 = hacer(g2)
  const todasRotas = async () => false
  const nada = await elegirExpansion({ dia: hoy, pedir: d2.pedir, guardar: d2.guardar, actualizar: d2.actualizar, probar: todasRotas, revisar: true })
  check('sin cartas con foto para cambiarla: «sinFoto» con las que quedan', nada.sinFoto?.length === 5 && d2.cambios.length === 0, JSON.stringify(nada.sinFoto))
  rotas.clear()
}

console.log('── 3. Los otros cuatro ──')
{
  // Parejas.
  const P = await import(`${RAIZ}/netlify/functions/parejas.mjs`)
  const CP = Array.from({ length: 40 }, (_, i) => ({ id: `p${i}`, market: 'WEST', name: `Poke ${i}`, name_en: `Poke ${i}`, image_path: `${i % 2 ? 'buena' : 'rota'}/p${i}` }))
  const gp = []
  const cp = []
  const pedirP = async (ruta, o = {}) => {
    if (ruta.startsWith('retos_reto_del_dia')) return { datos: gp.length ? [{ datos: gp[0].datos }] : [] }
    if (o.cabeceras?.prefer === 'count=exact') return { datos: [], total: CP.length }
    const off = /offset=(\d+)/.exec(ruta)
    if (off) return { datos: [{ id: CP[Number(off[1])].id }] }
    return { datos: CP.filter((c) => idsDe(ruta).includes(c.id)) }
  }
  P.olvidarCuenta?.()
  const rp = await P.elegirParejas({ dia: hoy, pedir: pedirP, guardar: async (t, f) => gp.push(f), actualizar: async (t, fl, c) => { cp.push(c); gp[0] = { datos: c.datos } }, probar })
  check('Parejas: seis, todas con foto', rp.cartas?.length === 6 && rp.cartas.every((c) => c.image_path.startsWith('buena/')), JSON.stringify(rp).slice(0, 160))
  rotas.add(rp.cartas[3].id)
  const rp2 = await P.elegirParejas({ dia: hoy, pedir: pedirP, guardar: async () => {}, actualizar: async (t, fl, c) => { cp.push(c); gp[0] = { datos: c.datos } }, probar, revisar: true })
  check('  …revisado con una rota: otra mesa entera, con foto, y se reescribe', rp2.cartas.length === 6 && !rp2.cartas.some((c) => rotas.has(c.id) || !c.image_path.startsWith('buena/')) && cp.length === 1 && cp[0].datos.card_ids.join() === rp2.cartas.map((c) => c.id).join() && rp2.sinFoto?.length === 0)
  rotas.clear()

  // Ordena y Más caro (precios + cartas).
  const precios = Array.from({ length: 24 }, (_, i) => ({ card_id: `c${i}`, cm_trend: [5, 9, 30, 120, 44, 70, 300, 12, 15, 18, 22, 26, 60, 90, 150, 200, 250, 400, 2, 3, 7, 11, 1.5, 600][i] }))
  const cartas = precios.map((p, i) => ({ id: p.card_id, market: 'WEST', image_path: `${i % 3 === 0 ? 'rota' : 'buena'}/${p.card_id}` }))
  const conPrecios = (tabla) => {
    const g = []
    const cambios = []
    return {
      g, cambios,
      pedir: async (ruta, o = {}) => {
        if (ruta.startsWith(tabla)) return { datos: g.length ? [tabla === 'mas_caro_del_dia' ? { card_ids: g[0].card_ids } : { datos: g[0].datos }] : [] }
        if (o.cabeceras?.prefer === 'count=exact') return { datos: [], total: precios.length }
        const off = /offset=(\d+)/.exec(ruta)
        if (ruta.startsWith('tcg_card_prices?select=card_id&') && off) return { datos: [precios[Number(off[1])]] }
        if (ruta.startsWith('tcg_card_prices')) return { datos: precios.filter((p) => idsDe(ruta).includes(p.card_id)) }
        if (ruta.startsWith('tcg_cards')) return { datos: cartas.filter((c) => idsDe(ruta).includes(c.id)) }
        return { datos: [] }
      },
      guardar: async (t, f) => g.push(f),
      actualizar: async (t, fl, c) => { cambios.push([t, fl, c]); g[0] = t === 'mas_caro_del_dia' ? { card_ids: c.card_ids } : { datos: c.datos } },
    }
  }
  const O = await import(`${RAIZ}/netlify/functions/ordena-precio.mjs`)
  const o = conPrecios('retos_reto_del_dia')
  const ro = await O.elegirOrdena({ dia: hoy, ...o, probar })
  check('Ordena: cuatro, todas con foto', ro.cartas?.length === 4 && ro.cartas.every((c) => c.image_path.startsWith('buena/')), JSON.stringify(ro).slice(0, 160))
  rotas.add(ro.cartas[0].id)
  const ro2 = await O.elegirOrdena({ dia: hoy, ...o, probar, revisar: true })
  check('  …revisado: otras cuatro con foto, reescritas', ro2.cartas.length === 4 && !ro2.cartas.some((c) => rotas.has(c.id)) && o.cambios.length === 1 && o.cambios[0][2].datos.card_ids.join() === ro2.cartas.map((c) => c.id).join())
  rotas.clear()
  const M = await import(`${RAIZ}/netlify/functions/mas-caro.mjs`)
  const m = conPrecios('mas_caro_del_dia')
  const rm = await M.elegirMasCaro({ dia: hoy, ...m, probar })
  check('Más caro: seis, todas con foto', rm.cartas?.length === 6 && rm.cartas.every((c) => c.image_path.startsWith('buena/')), JSON.stringify(rm).slice(0, 160))
  check('  …y pide image_tcggo (la foto de TCGGO entra en la cadena)', /image_tcggo/.test(M.COLUMNAS_CARTA))
  rotas.add(rm.cartas[2].id)
  const rm2 = await M.elegirMasCaro({ dia: hoy, ...m, probar, revisar: true })
  check('  …revisado: otras seis con foto, reescritas en su tabla', rm2.cartas.length === 6 && !rm2.cartas.some((c) => rotas.has(c.id)) && m.cambios.length === 1 && m.cambios[0][0] === 'mas_caro_del_dia' && m.cambios[0][1] === `day=eq.${hoy}`)
  rotas.clear()

  // ¿Qué carta es?
  const C = await import(`${RAIZ}/netlify/functions/carta-del-dia.mjs`)
  const CC = Array.from({ length: 30 }, (_, i) => ({ id: `q${i}`, market: 'WEST', name: `Q${i}`, image_path: `${i % 4 === 3 ? 'buena' : 'rota'}/q${i}` }))
  let delDia = []
  const cambiosC = []
  const pedirC = async (ruta, o = {}) => {
    if (ruta.startsWith('carta_del_dia')) return { datos: /day=eq\.(\d{4}-\d\d-\d\d)/.exec(ruta)?.[1] === hoy ? delDia : [] }
    if (o.cabeceras?.prefer === 'count=exact') return { datos: [], total: CC.length }
    const off = /offset=(\d+)/.exec(ruta)
    if (off) return { datos: [CC[Number(off[1])]] }
    const id = /id=eq\.([^&]+)/.exec(ruta)
    if (id) return { datos: CC.filter((c) => c.id === decodeURIComponent(id[1])) }
    return { datos: [] }
  }
  const rc = await C.elegirCartaDelDia({ dia: hoy, pedir: pedirC, guardar: async (t, f) => { delDia = [{ card_id: f.card_id }] }, actualizar: async (t, fl, c) => { cambiosC.push(c); delDia = [{ card_id: c.card_id }] }, probar })
  check('¿Qué carta es?: la primera con foto desde su sitio', rc.carta?.image_path.startsWith('buena/'), JSON.stringify(rc).slice(0, 160))
  rotas.add(rc.carta.id)
  const rc2 = await C.elegirCartaDelDia({ dia: hoy, pedir: pedirC, guardar: async () => {}, actualizar: async (t, fl, c) => { cambiosC.push(c); delDia = [{ card_id: c.card_id }] }, probar, revisar: true })
  check('  …revisada sin foto: otra, con foto, y se reescribe el día', rc2.carta.id !== rc.carta.id && rc2.carta.image_path.startsWith('buena/') && !rotas.has(rc2.carta.id) && cambiosC.length === 1 && cambiosC[0].card_id === rc2.carta.id && rc2.sinFoto?.length === 0)
  rotas.clear()
}

console.log('── 4. En el navegador (¿De qué expansión es?) ──')
{
  const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#5b8fd1"/></svg>'
  const set = (i) => ({ id: `s${i}`, market: 'WEST', name: `Expansión ${i}`, release_date: `20${10 + i}-01-01` })
  const ronda = (n, carta, rota = false) => ({ carta: { id: carta, market: 'WEST', set_id: `s${n}`, local_id: carta, image_path: rota ? `x/rota-${carta}` : `x/${carta}`, tcg_sets: { name: `Expansión ${n}`, serie_id: 'x' } }, set_id: `s${n}`, opciones: [set(n), set(n + 10), set(n + 20), set(n + 30)] })
  const ROTAS = [0, 1, 2, 3, 4].map((n) => ronda(n, `c${n}`, n === 1))
  const ARREGLADAS = ROTAS.map((r, i) => (i === 1 ? ronda(7, 'c7') : r))
  const abrir = async ({ revisado, guardado = null }) => {
    const browser = await chromium.launch()
    // Sin service worker: el de la web pide las fotos él, y `route` no le llega.
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 900 }, serviceWorkers: 'block' })
    const pedidas = []
    await ctx.route('**/.netlify/functions/que-expansion**', (r) => {
      const rev = r.request().url().includes('revisar=1')
      pedidas.push(rev ? 'revisar' : 'normal')
      r.fulfill({ contentType: 'application/json', body: JSON.stringify(rev ? revisado : { dia: hoy, numero: 91, rondas: ROTAS }) })
    })
    await ctx.route(/assets\.tcgdex\.net|limitlesstcg|pokemontcg|tcggo|scrydex/, (r) => (r.request().url().includes('rota-') || !r.request().url().includes('assets.tcgdex') ? r.fulfill({ status: 404, body: '' }) : r.fulfill({ contentType: 'image/svg+xml', body: SVG })))
    await ctx.addInitScript((g) => {
      window.__FAKE_SESSION__ = 'none'
      if (g && !sessionStorage.getItem('puesto')) { localStorage.setItem('pokedoc-que-expansion', JSON.stringify(g)); sessionStorage.setItem('puesto', '1') }
    }, guardado)
    const page = await ctx.newPage()
    const errores = []
    page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
    await page.goto(`${BASE}/que-expansion.html`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2500)
    return { browser, page, pedidas, errores }
  }
  // Ya había contestado la 1 (bien) y la 2 (a ciegas, con el dorso).
  const v = await abrir({ revisado: { dia: hoy, numero: 91, rondas: ARREGLADAS, sinFoto: [] }, guardado: { dia: hoy, elegidas: ['s0', 's1'] } })
  check('con la foto de la ronda 2 rota, pide la revisión', v.pedidas.join() === 'normal,revisar', v.pedidas.join())
  check('  …y juega con lo arreglado: la ronda 2 es la carta nueva', (await v.page.locator('#qxCarta img').getAttribute('src'))?.includes('/x/c7/'), await v.page.locator('#qxCarta').innerHTML())
  check('  …lo contestado de la ronda que cambió vuelve a jugarse (la 1 se queda)', /carta 2 de 5/.test(await v.page.locator('#qxSub').innerText()) && (await v.page.locator('#qxPasos .rj-paso.si').count()) === 1, await v.page.locator('#qxSub').innerText())
  check('  …y entre las opciones está la suya', (await v.page.locator('#qxOpciones [data-set="s7"]').count()) === 1)
  check('  …sin errores', v.errores.length === 0, v.errores.join(' | '))
  await v.browser.close()
  // El servidor dice que sigue sin foto: no se entra.
  const n = await abrir({ revisado: { dia: hoy, numero: 91, rondas: ROTAS, sinFoto: ['c1'] } })
  check('si el servidor dice que sigue sin foto, el reto no se abre y lo dice', /no tiene foto y la estamos cambiando/.test(await n.page.locator('.empty-state').innerText().catch(() => '')) && (await n.page.locator('.qx-tablero.hidden').count()) === 1)
  await n.browser.close()
  // Todo con foto: ni se pide revisar.
  const bien = await (async () => {
    const browser = await chromium.launch()
    const ctx = await browser.newContext({ serviceWorkers: 'block' })
    const pedidas = []
    await ctx.route('**/.netlify/functions/que-expansion**', (r) => { pedidas.push(r.request().url()); r.fulfill({ contentType: 'application/json', body: JSON.stringify({ dia: hoy, numero: 91, rondas: ARREGLADAS }) }) })
    await ctx.route(/assets\.tcgdex\.net/, (r) => r.fulfill({ contentType: 'image/svg+xml', body: SVG }))
    await ctx.addInitScript(() => { window.__FAKE_SESSION__ = 'none' })
    const page = await ctx.newPage()
    await page.goto(`${BASE}/que-expansion.html`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    const r = { pedidas, tablero: await page.locator('#qxOpciones .qx-opcion').count() }
    await browser.close()
    return r
  })()
  check('con todas las fotos, ni se pide revisar y se juega', bien.pedidas.length === 1 && !bien.pedidas[0].includes('revisar') && bien.tablero === 4, JSON.stringify(bien))
}

console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
