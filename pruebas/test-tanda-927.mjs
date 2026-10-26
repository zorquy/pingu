// Tanda 927 — La expansión como Dex (la D de la propuesta 925, «adelante
// con lo recomendado»):
//   1. Lo que tienes, en la carta: el ✓ en el CENTRO; arriba a la derecha,
//      cuántas si son dos o más, y una insignia por cada versión tuya que no
//      sea la de la carta («R+» la reverse).
//   2. Una fila: buscar, «Cuadrícula ▾», «Apilar» y «Filtros». La vista y las
//      variantes salen de la hoja de filtros.
//   3. La vista: Cuadrícula (la rejilla de siempre, por defecto), Lista (con
//      tus versiones y el precio) y Archivador, que ahora son HOJAS que se
//      pasan, con los bolsillos por página y «saltarse la primera página»; se
//      recuerda.
//   4. Apilar es un interruptor: pulsado, una casilla por carta; quitado,
//      una por versión.
//   5. En los filtros, «Repetidas» y «Versión».
//   6. En el móvil, el buscador encima y los tres mandos debajo, sin
//      desbordar; el archivador, de una hoja.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const limpio = (t) => String(t || '').replace(/\s+/g, ' ').trim()

console.log('── 0. Lo estático ──')
{
  const html = readFileSync(join(RAIZ, 'mi-coleccion.html'), 'utf8')
  const panel = html.slice(html.indexOf('id="mcAlbumPanelFiltros"'), html.indexOf('id="mcAlbumFiltrosVer"'))
  check('la vista y Apilar ya NO están en la hoja de filtros', !/id="mcAlbumVista"/.test(panel) && !/id="mcVistaVariantes"/.test(panel))
  const fila = html.slice(html.indexOf('<div class="mc-album-busca">'), html.indexOf('id="mcAlbumQuitar"'))
  check('  …van en la fila del buscador, en su orden: buscar, vista, apilar, filtros', /id="mcAlbumBuscar"[\s\S]*id="mcAlbumVista"[\s\S]*id="mcVistaVariantes"[\s\S]*id="mcAlbumAbrirFiltros"/.test(fila))
  check('«Repetidas» y «Versión» en los filtros', /id="mcAlbumRepetidas"/.test(panel) && /id="mcAlbumVersion"/.test(panel))
  check('los ajustes del archivador en la hoja de la vista', /id="mcAlbumVistaHoja"[\s\S]{0,2400}id="mcAlbumBolsillos"[\s\S]{0,800}id="mcAlbumPrimera"[\s\S]{0,800}id="mcAlbumArchivadorAplicar"/.test(html))
  check('cartas.html sale del generador con lo mismo', /id="mcAlbumBolsillos"/.test(readFileSync(join(RAIZ, 'cartas.html'), 'utf8')))
  const js = readFileSync(join(RAIZ, 'js/mi-coleccion.js'), 'utf8')
  check('sin la cuadrícula «sin funda» de antes', !/function celdaDeCuadriculaHtml/.test(js) && !/mc-tengo-version/.test(js))
}

const browser = await chromium.launch()
const semilla = (extra) => {
  window.__FAKE_SESSION__ = 'user-1'
  try {
    localStorage.setItem('pokedoc-instalar-no', String(Date.now()))
    if (extra?.borrar) { localStorage.removeItem('mc-album-vista'); localStorage.removeItem('mc-album-archivador'); localStorage.removeItem('mc-split') }
  } catch {}
  window.__FAKE_SETS__ = [{ id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv', market: 'WEST', release_date: '2024-11-08', card_count_official: 18, card_count_total: 18 }]
  window.__FAKE_CARTAS__ = Array.from({ length: 18 }, (_, i) => ({ id: `sv8-${i + 1}`, market: 'WEST', set_id: 'sv8', local_id: String(i + 1), name: `Carta ${i + 1}`, name_es: `Carta ${i + 1}`, image_path: `sv/sv8/${i + 1}`, rarity: 'Common', category: 'Pokemon', dex_ids: [i + 1], variants: { normal: true, reverse: i < 10 }, tcg_sets: { id: 'sv8', name: 'Chispas Fulgurantes', serie_id: 'sv' } }))
  window.__FAKE_PRECIOS__ = Array.from({ length: 18 }, (_, i) => ({ card_id: `sv8-${i + 1}`, cm_id_product: 100 + i, cm_low_es: 0.5 + i * 3, cm_low: 0.5 + i * 3, checked_at: new Date().toISOString() }))
  // La 2 dos veces en normal, la 5 en normal y en reverse, la 7 SOLO en
  // reverse; la 1 y la 17, una normal.
  window.__FAKE_COLECCION__ = [
    ...[1, 2, 5, 17].map((n) => ({ id: `l${n}`, user_id: 'user-1', card_id: `sv8-${n}`, market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: n === 2 ? 2 : 1 })),
    { id: 'r5', user_id: 'user-1', card_id: 'sv8-5', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'reverse', cantidad: 1 },
    { id: 'r7', user_id: 'user-1', card_id: 'sv8-7', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'reverse', cantidad: 1 },
  ]
}
async function abrir({ movil = false, ctx = null } = {}) {
  const nuevo = !ctx
  ctx ||= await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES', serviceWorkers: 'block' } : { viewport: { width: 1440, height: 1000 }, locale: 'es-ES', serviceWorkers: 'block' })
  if (nuevo) {
    await ctx.addInitScript(semilla, null)
    await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|r2\.limitlesstcg|raw\.githubusercontent|api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
    await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  }
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=album&set=sv8`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.querySelectorAll('#mcAlbum [data-carta]').length > 0, null, { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(1000)
  return { page, ctx, errores }
}
const casilla = (n) => `#mcAlbum .mc-bolsillo-enlace[data-carta="sv8-${n}"]`

console.log('── 1. Lo que tienes, en la carta ──')
const pc = await abrir()
{
  const { page } = pc
  const r = await page.evaluate(() => {
    const de = (n) => document.querySelector(`#mcAlbum .mc-bolsillo-enlace[data-carta="sv8-${n}"]`)
    const centro = (el) => { const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 } }
    const marca = de(1).querySelector('.mc-tengo-marca')
    const c1 = centro(de(1)), m1 = centro(marca)
    const ins = (n) => [...(de(n)?.querySelectorAll('.mc-insignia') || [])].map(((el) => el.querySelector('[data-dibujo]')?.dataset.dibujo || el.querySelector('img.icono-bola')?.getAttribute('src').match(/([\w-]+)\.png/)?.[1] || el.textContent.trim()))
    return {
      rotulo: document.getElementById('mcAlbumVistaRotulo')?.textContent.trim(),
      casillas: document.querySelectorAll('#mcAlbum .mc-album-rejilla .mc-bolsillo').length,
      centrada: Math.abs(c1.x - m1.x) < 3 && Math.abs(c1.y - m1.y) < 3,
      esquina: m1.x > c1.x && m1.y > c1.y,
      tamMarca: marca.getBoundingClientRect().width,
      ins1: ins(1), ins2: ins(2), ins5: ins(5), ins7: ins(7), ins3: ins(3),
      marca3: Boolean(de(3).querySelector('.mc-tengo-marca')),
      n2: de(2).querySelector('.mc-insignia-n')?.textContent.trim(),
      etiqueta5: de(5).getAttribute('aria-label'),
      etiqueta7: de(7).getAttribute('aria-label'),
    }
  })
  check('por defecto, la Cuadrícula de siempre: 18 casillas con funda', r.rotulo === 'Cuadrícula' && r.casillas === 18, JSON.stringify(r))
  // Desde la 1020 (D2 de «PokeDoc como app») el ✓ va en la esquina de abajo a la derecha y mide 24: en una expansión completa, 250 círculos de 48 en medio del dibujo eran demasiado.
  check('el ✓ va en la esquina de abajo a la derecha, de 24 px (1020)', !r.centrada && r.esquina && r.tamMarca === 24, JSON.stringify(r))
  check('con una sola copia, ninguna insignia', r.ins1.length === 0, JSON.stringify(r.ins1))
  check('con dos, la insignia «2» (en verde, la de la cuenta)', r.n2 === '2' && r.ins2.join() === '2', JSON.stringify(r.ins2))
  check('normal + reverse: «2» y el dibujo de la reverse (930)', r.ins5.join() === '2,reverse', JSON.stringify(r.ins5))
  check('solo la reverse: el ✓ y su dibujo', r.ins7.join() === 'reverse', JSON.stringify(r.ins7))
  check('la que no tienes, sin marca', !r.marca3 && r.ins3.length === 0)
  check('lo que se lee en voz alta lo dice: «con Reverse holo»', /tienes 2, con Reverse holo/.test(r.etiqueta5) && /tienes 1, con Reverse holo/.test(r.etiqueta7), `${r.etiqueta5} | ${r.etiqueta7}`)
}

console.log('── 2. Una fila: buscar, vista, apilar y filtros ──')
{
  const { page } = pc
  const r = await page.evaluate(() => {
    const caja = (id) => { const b = document.getElementById(id).getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right), h: Math.round(b.height) } }
    return { buscar: caja('mcAlbumBuscar'), vista: caja('mcAlbumVista'), apilar: caja('mcVistaVariantes'), filtros: caja('mcAlbumAbrirFiltros') }
  })
  const misma = (a, b) => Math.abs((a.t + a.b) / 2 - (b.t + b.b) / 2) < 6
  check('los cuatro en la misma fila', misma(r.buscar, r.vista) && misma(r.vista, r.apilar) && misma(r.apilar, r.filtros), JSON.stringify(r))
  check('  …en ese orden, de izquierda a derecha', r.buscar.r <= r.vista.l && r.vista.r <= r.apilar.l && r.apilar.r <= r.filtros.l, JSON.stringify(r))
  // Con el ratón son controles densos (la 312): los 44 van con el dedo, abajo.
  check('  …y los tres botones, de la misma altura', r.vista.h === r.apilar.h && r.apilar.h === r.filtros.h && r.vista.h >= 32, JSON.stringify(r))
  const ap = await page.evaluate(() => ({ p: document.getElementById('mcVistaVariantes').getAttribute('aria-pressed'), t: document.getElementById('mcVistaVariantesRotulo').textContent.trim() }))
  check('«Apilar» puesto por defecto (pulsado = una casilla por carta)', ap.p === 'true' && ap.t === 'Apilar', JSON.stringify(ap))
}

console.log('── 4. Apilar ──')
{
  const { page } = pc
  await page.click('#mcVistaVariantes')
  await page.waitForTimeout(300)
  const r = await page.evaluate(() => ({
    p: document.getElementById('mcVistaVariantes').getAttribute('aria-pressed'),
    casillas: document.querySelectorAll('#mcAlbum .mc-bolsillo').length,
    rev7: document.querySelector('#mcAlbum .mc-bolsillo-enlace[data-carta="sv8-7"][data-variante="reverse"]')?.closest('.mc-bolsillo')?.classList.contains('tengo'),
    nor7: document.querySelector('#mcAlbum .mc-bolsillo-enlace[data-carta="sv8-7"][data-variante="normal"]')?.closest('.mc-bolsillo')?.classList.contains('tengo'),
    chapa: document.querySelector('#mcAlbum .mc-bolsillo-enlace[data-carta="sv8-7"][data-variante="reverse"] .mc-chapa-variante')?.textContent.trim(),
    chapaDibujo: document.querySelector('#mcAlbum .mc-bolsillo-enlace[data-carta="sv8-7"][data-variante="reverse"] .mc-chapa-variante [data-dibujo]')?.dataset.dibujo,
    insV: document.querySelectorAll('#mcAlbum .mc-bolsillo-enlace[data-variante] .mc-insignia:not(.mc-insignia-n)').length,
  }))
  check('quitado: una casilla por versión (18 + 10 reverse)', r.p === 'false' && r.casillas === 28, JSON.stringify(r))
  check('  …la reverse de la 7 es tuya y la normal no, cada una con su chapa', r.rev7 === true && r.nor7 === false && r.chapa === 'Reverse holo' && r.chapaDibujo === 'reverse', JSON.stringify(r))
  check('  …y sin insignias de versión: la casilla YA es de una versión', r.insV === 0, JSON.stringify(r))
  await page.click('#mcVistaVariantes')
  await page.waitForTimeout(300)
  check('pulsado otra vez: vuelven las 18', await page.evaluate(() => document.querySelectorAll('#mcAlbum .mc-bolsillo').length) === 18)
}

console.log('── 3. La vista ──')
{
  const { page } = pc
  await page.click('#mcAlbumVista')
  await page.waitForTimeout(300)
  const menu = await page.evaluate(() => [...document.querySelectorAll('#mcAlbumVistaMenu [data-vista]')].map((b) => ({ id: b.dataset.vista, t: b.innerText.replace(/\s+/g, ' ').trim(), sel: b.getAttribute('aria-checked') })))
  check('tres vistas, cada una con su explicación, y la puesta marcada', menu.map((m) => m.id).join() === 'cuadricula,lista,archivador' && menu.every((m) => m.t.split(' ').length > 3) && menu[0].sel === 'true', JSON.stringify(menu))
  check('  …sin los ajustes del archivador con la cuadrícula puesta', await page.evaluate(() => document.getElementById('mcAlbumArchivadorAjustes').getBoundingClientRect().height === 0))
  await page.click('#mcAlbumVistaMenu [data-vista="lista"]')
  await page.waitForTimeout(300)
  const l = await page.evaluate(() => {
    const fila = (n) => document.querySelector(`#mcAlbum .mc-album-fila[data-carta="sv8-${n}"]`)
    return {
      abierta: document.getElementById('mcAlbumVistaHoja').open,
      filas: document.querySelectorAll('#mcAlbum .mc-album-lista .mc-album-fila').length,
      precio: fila(3)?.querySelector('.mc-album-fila-precio')?.textContent.trim(),
      ins5: [...(fila(5)?.querySelectorAll('.mc-insignia') || [])].map(((el) => el.querySelector('[data-dibujo]')?.dataset.dibujo || el.querySelector('img.icono-bola')?.getAttribute('src').match(/([\w-]+)\.png/)?.[1] || el.textContent.trim())).join(),
      cuenta5: fila(5)?.querySelector('.mc-album-fila-cuenta')?.textContent.trim(),
      rotulo: document.getElementById('mcAlbumVistaRotulo').textContent.trim(),
    }
  })
  check('Lista: se cierra la hoja y sale una fila por carta', !l.abierta && l.filas === 18 && l.rotulo === 'Lista', JSON.stringify(l))
  check('  …con lo que vale y tus versiones', /€/.test(l.precio || '') && l.ins5 === 'reverse' && l.cuenta5 === '×2', JSON.stringify(l))

  await page.click('#mcAlbumVista')
  await page.waitForTimeout(300)
  await page.click('#mcAlbumVistaMenu [data-vista="archivador"]')
  await page.waitForTimeout(400)
  const a = await page.evaluate(() => ({
    abierta: document.getElementById('mcAlbumVistaHoja').open,
    ajustes: document.getElementById('mcAlbumArchivadorAjustes').getBoundingClientRect().height > 0,
    bolsillos: [...document.querySelectorAll('#mcAlbumBolsillos [data-bolsillos]')].map((b) => b.dataset.bolsillos + (b.getAttribute('aria-checked') === 'true' ? '*' : '')).join(),
    hojas: document.querySelectorAll('#mcAlbum .mc-exp-archivador .mc-hoja').length,
    porHoja: [...document.querySelectorAll('#mcAlbum .mc-exp-archivador .mc-hoja')].map((h) => h.querySelectorAll('.mc-bolsillo-enlace').length).join(),
    texto: document.querySelector('#mcAlbum .mc-exp-paginas span')?.textContent.trim(),
  }))
  check('Archivador: la hoja se queda abierta con sus ajustes', a.abierta && a.ajustes, JSON.stringify(a))
  check('  …bolsillos 4, 9, 12, 16, 20 y 25, con 9 puesto', a.bolsillos === '4,9*,12,16,20,25', a.bolsillos)
  check('  …y detrás, dos hojas abiertas de nueve', a.hojas === 2 && a.porHoja === '9,9' && a.texto === 'Página 1-2 de 2', JSON.stringify(a))
  await page.click('#mcAlbumBolsillos [data-bolsillos="4"]')
  await page.waitForTimeout(300)
  await page.click('#mcAlbumPrimera [data-primera="saltar"]')
  await page.waitForTimeout(300)
  const s = await page.evaluate(() => {
    const hojas = [...document.querySelectorAll('#mcAlbum .mc-exp-archivador .mc-hoja')]
    return {
      portada: hojas[0]?.classList.contains('mc-hoja-portada'),
      tapa: hojas[0]?.textContent.includes('Chispas Fulgurantes'),
      segunda: [...(hojas[1]?.querySelectorAll('.mc-bolsillo-enlace') || [])].map((x) => x.dataset.carta.split('-')[1]).join(),
      texto: document.querySelector('#mcAlbum .mc-exp-paginas span')?.textContent.trim(),
      antes: document.querySelector('#mcAlbum .mc-exp-paginas [data-pasar="-1"]')?.disabled,
    }
  })
  check('4 bolsillos y «Saltarla»: la tapa por dentro y las cartas a la derecha', s.portada && s.tapa && s.segunda === '1,2,3,4', JSON.stringify(s))
  check('  …tapa + 5 hojas = 6 páginas, y «‹» apagada en la primera', s.texto === 'Página 1-2 de 6' && s.antes === true, JSON.stringify(s))
  await page.click('#mcAlbumArchivadorAplicar')
  await page.waitForTimeout(200)
  check('«Aplicar» cierra la hoja', await page.evaluate(() => !document.getElementById('mcAlbumVistaHoja').open))
  await page.click('#mcAlbum .mc-exp-paginas [data-pasar="1"]')
  await page.waitForTimeout(300)
  const p2 = await page.evaluate(() => ({
    texto: document.querySelector('#mcAlbum .mc-exp-paginas span')?.textContent.trim(),
    cartas: [...document.querySelectorAll('#mcAlbum .mc-exp-archivador .mc-bolsillo-enlace')].map((x) => x.dataset.carta.split('-')[1]).join(),
    cab: [...document.querySelectorAll('#mcAlbum .mc-hoja-cabecera')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()).join(' | '),
  }))
  check('«›» pasa el pliego: 5 a 12, en las hojas 2 y 3', p2.texto === 'Página 3-4 de 6' && p2.cartas === '5,6,7,8,9,10,11,12' && /Página 2/i.test(p2.cab) && /Página 3/i.test(p2.cab), JSON.stringify(p2))
  await page.click('#mcAlbum .mc-hoja-esquina-antes')
  await page.waitForTimeout(300)
  check('  …y la esquina de la izquierda vuelve atrás', await page.evaluate(() => document.querySelector('#mcAlbum .mc-exp-paginas span')?.textContent.trim()) === 'Página 1-2 de 6')
  // Se recuerda, en otra página del mismo navegador.
  const otra = await abrir({ ctx: pc.ctx })
  const g = await otra.page.evaluate(() => ({
    rotulo: document.getElementById('mcAlbumVistaRotulo').textContent.trim(),
    portada: Boolean(document.querySelector('#mcAlbum .mc-hoja-portada')),
    porHoja: document.querySelectorAll('#mcAlbum .mc-exp-archivador .mc-hoja:not(.mc-hoja-portada) .mc-bolsillo-enlace').length,
  }))
  check('se recuerda: Archivador, 4 bolsillos y la primera saltada', g.rotulo === 'Archivador' && g.portada && g.porHoja === 4, JSON.stringify(g))
  await otra.page.close()
}

console.log('── 5. Repetidas y Versión ──')
{
  const { page } = pc
  // De vuelta a la cuadrícula para contar casillas.
  await page.click('#mcAlbumVista')
  await page.click('#mcAlbumVistaMenu [data-vista="cuadricula"]')
  await page.waitForTimeout(300)
  await page.click('#mcAlbumAbrirFiltros')
  await page.waitForTimeout(300)
  check('la hoja de filtros ya no lleva «Cómo se ven»', await page.evaluate(() => !document.querySelector('#mcAlbumPanelFiltros #mcAlbumVista') && !/Cómo se ven/.test(document.getElementById('mcAlbumPanelFiltros').textContent)))
  await page.click('#mcAlbumRepetidas')
  await page.waitForTimeout(300)
  const rep = await page.evaluate(() => ({ ids: [...document.querySelectorAll('#mcAlbum [data-carta]')].map((a) => a.dataset.carta).join(), cuenta: document.getElementById('mcAlbumFiltrosCuenta').textContent.trim(), todas: document.getElementById('mcAlbumTodas').getAttribute('aria-pressed') }))
  check('«Repetidas»: las que tienes dos o más veces (la 2 y la 5)', rep.ids === 'sv8-2,sv8-5' && rep.cuenta === '1' && rep.todas === 'false', JSON.stringify(rep))
  await page.click('#mcAlbumTodas')
  await page.waitForTimeout(200)
  const opciones = await page.evaluate(() => [...document.querySelectorAll('#mcAlbumGrupoVersion [data-valor]')].map((b) => b.textContent.trim()).join())
  check('«Versión»: Todas, Normal y Reverse holo (las que hay en el set)', opciones === 'Todas,Normal,Reverse holo', opciones)
  await page.click('#mcAlbumGrupoVersion [data-valor="reverse"]')
  await page.waitForTimeout(300)
  const n1 = await page.evaluate(() => document.querySelectorAll('#mcAlbum [data-carta]').length)
  check('  …Reverse: las 10 que existen en reverse', n1 === 10, n1)
  await page.click('#mcAlbumSoloTengo')
  await page.waitForTimeout(300)
  const n2 = await page.evaluate(() => [...document.querySelectorAll('#mcAlbum [data-carta]')].map((a) => a.dataset.carta).join())
  check('  …con «Las tengo»: las que tienes EN reverse (la 5 y la 7)', n2 === 'sv8-5,sv8-7', n2)
  await page.click('#mcAlbumFiltrosLimpiar')
  await page.waitForTimeout(300)
  check('«Borrar todo» quita también la versión y vuelven las 18', await page.evaluate(() => document.querySelectorAll('#mcAlbum [data-carta]').length === 18 && !document.getElementById('mcAlbumVersion').value))
  check('sin errores en la página (PC)', pc.errores.length === 0, pc.errores.join(' | '))
}
await pc.ctx.close()

console.log('── 6. En el móvil ──')
{
  const m = await abrir({ movil: true })
  const { page } = m
  const r = await page.evaluate(() => {
    const caja = (id) => { const b = document.getElementById(id).getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right) } }
    return { buscar: caja('mcAlbumBuscar'), vista: caja('mcAlbumVista'), apilar: caja('mcVistaVariantes'), filtros: caja('mcAlbumAbrirFiltros'), ancho: innerWidth, desborda: document.documentElement.scrollWidth > innerWidth }
  })
  check('el buscador encima y los tres mandos debajo, en una fila', r.buscar.b <= r.vista.t && Math.abs(r.vista.t - r.apilar.t) < 4 && Math.abs(r.apilar.t - r.filtros.t) < 4, JSON.stringify(r))
  check('  …sin salirse de la pantalla', !r.desborda && r.filtros.r <= r.ancho, JSON.stringify(r))
  check('  …y con el dedo miden 44 de alto', [r.vista, r.apilar, r.filtros].every((x) => x.b - x.t >= 44), JSON.stringify(r))
  await page.click('#mcAlbumVista')
  await page.waitForTimeout(300)
  await page.click('#mcAlbumVistaMenu [data-vista="archivador"]')
  await page.waitForTimeout(300)
  await page.click('#mcAlbumArchivadorAplicar')
  await page.waitForTimeout(300)
  const a = await page.evaluate(() => ({ hojas: document.querySelectorAll('#mcAlbum .mc-exp-archivador .mc-hoja').length, texto: document.querySelector('#mcAlbum .mc-exp-paginas span')?.textContent.trim(), desborda: document.documentElement.scrollWidth > innerWidth }))
  check('el archivador en el móvil: una hoja a la vez', a.hojas === 1 && a.texto === 'Página 1 de 2' && !a.desborda, JSON.stringify(a))
  check('sin errores en la página (móvil)', m.errores.length === 0, m.errores.join(' | '))
  await m.ctx.close()
}

console.log('── 7. Una «normal» que no existe (PINGU, con el 30 aniversario) ──')
{
  // El 30 aniversario solo existe en holo (922), y las copias de antes de la
  // 564 se guardaron en «normal». Tienen que contar como la holo: sin la «N»
  // y con su ✓ también al separar. Y el botón dice «Separar» separado.
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 }, locale: 'es-ES', serviceWorkers: 'block' })
  await ctx.addInitScript(() => {
    window.__FAKE_SESSION__ = 'user-1'
    try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {}
    window.__FAKE_SETS__ = [{ id: '30th', name: '30th Celebration', serie_id: 'me', market: 'WEST', release_date: '2026-09-16', card_count_official: 6, card_count_total: 6 }]
    window.__FAKE_CARTAS__ = Array.from({ length: 6 }, (_, i) => ({ id: `30th-${i + 1}`, market: 'WEST', set_id: '30th', local_id: String(i + 1), name: `Carta ${i + 1}`, name_es: `Carta ${i + 1}`, image_path: `me/30th/${i + 1}`, rarity: 'Rare Holo', category: 'Pokemon', dex_ids: [i + 1], tcg_sets: { id: '30th', name: '30th Celebration', serie_id: 'me' } }))
    window.__FAKE_COLECCION__ = [
      { id: 'a', user_id: 'user-1', card_id: '30th-1', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 1 },
      { id: 'b', user_id: 'user-1', card_id: '30th-2', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'normal', cantidad: 1 },
      { id: 'c', user_id: 'user-1', card_id: '30th-2', market: 'WEST', idioma: 'es', estado: 'NM', variante: 'holo', cantidad: 1 },
    ]
  })
  await ctx.route(/assets\.tcgdex\.net|images\.tcggo\.com|r2\.limitlesstcg|raw\.githubusercontent|api\.tcgdex\.net/, (r) => r.fulfill({ status: 200, contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"/>' }))
  await ctx.route(/\/\.netlify\/functions\//, (r) => r.fulfill({ status: 404, contentType: 'application/json', body: '{}' }))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.goto(`${BASE}/mi-coleccion.html?ver=album&set=30th`, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => document.querySelectorAll('#mcAlbum [data-carta]').length > 0, null, { timeout: 10000 }).catch(() => {})
  await page.waitForTimeout(1000)
  const ap = await page.evaluate(() => {
    const de = (n) => document.querySelector(`#mcAlbum .mc-bolsillo-enlace[data-carta="30th-${n}"]`)
    const ins = (n) => [...(de(n)?.querySelectorAll('.mc-insignia') || [])].map(((el) => el.querySelector('[data-dibujo]')?.dataset.dibujo || el.querySelector('img.icono-bola')?.getAttribute('src').match(/([\w-]+)\.png/)?.[1] || el.textContent.trim())).join()
    return { t1: Boolean(de(1)?.querySelector('.mc-tengo-marca')), i1: ins(1), i2: ins(2), rotulo: document.getElementById('mcVistaVariantesRotulo').textContent.trim() }
  })
  check('apilado: la «normal» de una carta solo holo es la holo, sin insignia «N»', ap.t1 && ap.i1 === '' && ap.i2 === '2' && ap.rotulo === 'Apilar', JSON.stringify(ap))
  await page.click('#mcVistaVariantes')
  await page.waitForTimeout(500)
  const sep = await page.evaluate(() => ({
    rotulo: document.getElementById('mcVistaVariantesRotulo').textContent.trim(),
    pulsado: document.getElementById('mcVistaVariantes').getAttribute('aria-pressed'),
    casillas: [...document.querySelectorAll('#mcAlbum .mc-bolsillo-enlace')].map((a) => `${a.dataset.carta.split('-')[1]}:${a.dataset.variante}:${a.closest('.mc-bolsillo').classList.contains('tengo') ? 'si' : 'no'}:${a.querySelector('.mc-insignia-n')?.textContent || ''}`).join(' '),
  }))
  check('separado, el botón dice «Separar» (y no está pulsado)', sep.rotulo === 'Separar' && sep.pulsado === 'false', JSON.stringify(sep))
  check('  …una casilla holo por carta, y las tuyas con su ✓ (la 2, con «2»)', sep.casillas === '1:holo:si: 2:holo:si:2 3:holo:no: 4:holo:no: 5:holo:no: 6:holo:no:', sep.casillas)
  await page.click('#mcAlbum .mc-bolsillo-enlace[data-carta="30th-1"]')
  await page.waitForTimeout(1200)
  const ficha = await page.evaluate(() => [...document.querySelectorAll('#mcEditor .mc-version-check')].map((c) => c.closest('[data-version]')?.dataset.version + ':' + (c.classList.contains('si') ? 'si' : 'no')).join())
  check('  …y la ficha marca la holo como tuya', /holo:si/.test(ficha) && !/normal/.test(ficha), ficha)
  // La hoja de añadir en el PC (PINGU, con la Illumise): la fila de
  // idiomas la ensanchaba y salía una barra de desplazamiento debajo.
  await page.click('#mcEdCerrar').catch(() => page.keyboard.press('Escape'))
  await page.waitForTimeout(500)
  await page.click('#mcAlbum .mc-bolsillo-enlace[data-carta="30th-3"]')
  await page.waitForTimeout(1200)
  await page.click('#mcEdMas')
  await page.waitForTimeout(900)
  const hoja = await page.evaluate(() => { const d = document.getElementById('mcAnadirDialogo'); return { open: d.open, sw: d.scrollWidth, cw: d.clientWidth, idiomas: document.querySelectorAll('#mcAdIdiomas .mc-idioma-chip').length, version: document.getElementById('mcAdElegir')?.offsetParent ? 'eligiendo' : 'puesta' } })
  check('la hoja de añadir no se ensancha: sin barra debajo', hoja.open && hoja.sw <= hoja.cw + 1 && hoja.idiomas >= 6, JSON.stringify(hoja))
  check('sin errores (30 aniversario)', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

await browser.close()
console.log(fails ? `\n✗ ${fails} fallos` : '\n✓ Todo bien')
process.exit(fails ? 1 : 0)
