// Tanda 1199 — PINGU, con una captura de Comunidad en el iPhone: «el menú
// deslizante de la comunidad se rompe al deslizar». Dos fallos a la vez:
//   · La fila de pestañas (Gente · Sus guías · Actividad) medía 36 px y lo de
//     dentro 39: la franja táctil de 44 de cada chip (1038) se salía 4 px.
//     Con `overflow-x: auto` eso la hace desplazable TAMBIÉN en vertical, y el
//     iPhone la arrastraba hacia arriba al deslizarla: pestañas cortadas por la
//     mitad. Pasaba en seis filas; ahora ninguna se mueve en vertical.
//   · En la app instalada, deslizar la fila de lado enseñaba la Poké Ball de
//     «tirar para refrescar»: un gesto de lado, o que empieza en una fila que
//     se desliza, no es tirar.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const b = await chromium.launch()

console.log('── 1. Ninguna fila que se desliza de lado se mueve en vertical ──')
{
  const RUTAS = { '/usuarios': '#communityTabs', '/foro/general': '.foro-vistas', '/mi-coleccion?ver=cartas': '#mcMandos', '/perfil': '#profileTabs', '/avisos': '#avChips', '/buscar?q=pika': '#bsChips', '/eventos': null, '/foro': null, '/mi-coleccion?ver=deseos': null }
  const ctx = await contexto(b, true, 'user-1')
  const page = await ctx.newPage()
  for (const [ruta, sel] of Object.entries(RUTAS)) {
    await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1200)
    const malos = await page.evaluate(() => [...document.querySelectorAll('body *')].filter((e) => {
      const s = getComputedStyle(e)
      return /auto|scroll/.test(s.overflowX) && !/hidden|clip/.test(s.overflowY) && e.scrollWidth > e.clientWidth + 1 && e.scrollHeight > e.clientHeight + 1 && e.clientHeight > 0 && e.clientHeight < 200
    }).map((e) => `${e.tagName.toLowerCase()}${e.id ? '#' + e.id : ''}.${[...e.classList].join('.')} (${e.scrollHeight}/${e.clientHeight})`))
    check(`${ruta}: ninguna fila lateral con desplazamiento vertical`, !malos.length, malos.join(' | '))
    if (sel) {
      const r = await page.$eval(sel, (f) => {
        f.scrollTop = 40
        const c = f.querySelector('.com-chip, .chip-filtro, .tab-btn, .mc-chip-mando, .seg-btn, a, button')
        const fr = f.getBoundingClientRect(), cr = c.getBoundingClientRect()
        return { top: f.scrollTop, dentro: cr.top - fr.top >= 4 && fr.bottom - cr.bottom >= 4 }
      })
      check(`  …${sel} no se deja bajar y la franja táctil le cabe dentro`, r.top === 0 && r.dentro, JSON.stringify(r))
    }
  }
  await page.goto(`${BASE}/usuarios`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  await page.screenshot({ path: '/tmp/1199-gente.png', clip: { x: 0, y: 0, width: 390, height: 260 } })
  await ctx.close()
}

console.log('── 2. Tirar para refrescar no salta al deslizar de lado ──')
{
  const ctx = await contexto(b, true, 'user-1')
  const page = await ctx.newPage()
  await page.goto(`${BASE}/usuarios`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  const r = await page.evaluate(async () => {
    const m = await import('/js/tirar-refrescar.js')
    let recargas = 0
    const marca = m.montarTirarRefrescar({ recargar: () => { recargas++ } })
    const toque = (el, tipo, x, y) => {
      const t = new Touch({ identifier: 1, target: el, clientX: x, clientY: y })
      el.dispatchEvent(new TouchEvent(tipo, { bubbles: true, cancelable: true, touches: tipo === 'touchend' ? [] : [t], changedTouches: [t] }))
    }
    const gesto = (el, pasos) => {
      const vistos = []
      toque(el, 'touchstart', pasos[0][0], pasos[0][1])
      for (const [x, y] of pasos.slice(1)) { toque(el, 'touchmove', x, y); vistos.push(marca.style.getPropertyValue('--tirado')) }
      const [x, y] = pasos.at(-1)
      toque(el, 'touchend', x, y)
      return vistos
    }
    const fila = document.getElementById('communityTabs')
    const chip = fila.querySelector('.com-chip')
    const cuerpo = document.querySelector('.page-content') || document.body
    const out = {}
    out.fila = m.dentroDeFilaLateral(chip)
    out.fuera = m.dentroDeFilaLateral(cuerpo)
    // Deslizar la fila de lado con algo de bajada (el gesto de la captura).
    out.enFila = gesto(chip, [[300, 100], [260, 120], [200, 150], [120, 190]])
    out.recargasFila = recargas
    // De lado sobre la página, fuera de la fila: tampoco.
    out.deLado = gesto(cuerpo, [[300, 400], [240, 420], [160, 440], [80, 460]])
    out.recargasLado = recargas
    // Hacia abajo de verdad: sí.
    out.abajo = gesto(cuerpo, [[200, 300], [202, 340], [204, 380], [205, 400]])
    out.recargasAbajo = recargas
    return out
  })
  check('la fila de pestañas cuenta como fila lateral, y la página no', r.fila && !r.fuera, JSON.stringify(r))
  check('deslizar la fila de pestañas (con algo de bajada) no enseña la Poké Ball ni recarga', r.enFila.every((v) => !v) && r.recargasFila === 0, JSON.stringify(r.enFila))
  check('un gesto de lado sobre la página tampoco', r.deLado.every((v) => !v) && r.recargasLado === 0, JSON.stringify(r.deLado))
  check('tirar hacia abajo de verdad sigue recargando', r.abajo.at(-1) === '1' && r.recargasAbajo === 1, JSON.stringify(r))
  await ctx.close()
}

console.log('── 3. La ficha de un evento: la dirección solo en «Dónde» ──')
{
  const sembrar = () => {
    const d = new Date(); d.setDate(d.getDate() + 4); const p = (n) => String(n).padStart(2, '0'); const dia = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
    window.__FAKE_EVENTOS__ = [{ id: 'e1', slug: 'castellon', nombre: 'CASTELLON CARD SHOW', tipo: 'card_show', publicado: true, asistentes: [], entradas: [], horario: [{ dia, desde: '10:00', hasta: '20:00' }], empieza: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 10).toISOString(), termina: new Date(d.getFullYear(), d.getMonth(), d.getDate(), 20).toISOString(), sitio: 'Carpa Multiusos', direccion: 'C/ de José Ribera Forner', ciudad: 'Oropesa del Mar', web: 'https://castelloncardshow.com', instagram: 'castelloncardshow' }]
  }
  for (const movil of [false, true]) {
    const ctx = await contexto(b, movil, 'user-1', sembrar)
    const page = await ctx.newPage()
    await page.goto(`${BASE}/eventos/castellon`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(1500)
    const r = await page.evaluate(() => ({ cab: document.querySelector('.ev-poster').textContent, datos: [...document.querySelectorAll('.ev-datos li')].map((l) => l.textContent.trim()), donde: document.querySelector('.ev-donde')?.textContent || '' }))
    // Desde la 1294 el póster dice «sitio, ciudad» bajo el nombre (como la maqueta); la DIRECCIÓN, no.
    check(`${movil ? 'móvil' : 'PC'}: el póster no repite la dirección; los datos llevan la web y el Instagram`, !/José Ribera/.test(r.cab) && r.datos.join('|') === 'castelloncardshow.com|@castelloncardshow', JSON.stringify(r.datos))
    check(`${movil ? 'móvil' : 'PC'}: …y «Dónde» la tiene con «Cómo llegar»`, /Carpa Multiusos/.test(r.donde) && /Cómo llegar/.test(r.donde))
    if (!movil) await page.screenshot({ path: '/tmp/1199-ficha.png', clip: { x: 0, y: 0, width: 1280, height: 560 } })
    await ctx.close()
  }
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
