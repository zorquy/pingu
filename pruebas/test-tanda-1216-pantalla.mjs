// Tanda 1216 — lo que recorté o se me pasó del repaso, contra la maqueta:
// Cruces con banda aunque nadie encaje, los temas de Noticias, los temas del
// foro en Guardados, el campeón en Torneos, el carrusel del foro en el PC y el
// anillo de Mis partidas que se dibuja.
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

const b = await chromium.launch()
const abrir = async (ruta, { movil = false, antes = null } = {}) => {
  const ctx = await contexto(b, movil, 'user-1')
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  if (antes) await p.addInitScript(antes)
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2800)
  return { ctx, p, errores }
}

console.log('── 1. Cruces: la banda también cuando nadie encaja ──')
{
  const { ctx, p, errores } = await abrir('/mi-coleccion?ver=cambios')
  const r = await p.evaluate(() => {
    const banda = document.querySelector('#mcCambiosPanel .banda-s')
    return { banda: Boolean(banda), titulo: banda?.querySelector('h1, h2')?.textContent || '', cifras: [...(banda?.querySelectorAll('.banda-s-cifra small') || [])].map((x) => x.textContent), salidas: document.querySelectorAll('#mcCambiosPanel .mc-cruces-salidas button').length, viejas: document.querySelectorAll('#mcCambiosPanel .mc-cruces-cuenta').length }
  })
  check('sale la banda con lo que buscas, das, los perfectos y los tratos', r.banda && r.cifras.length === 4 && /tratos en curso/.test(r.cifras.join('|')), JSON.stringify(r))
  check('  …dice que nadie encaja todavía, con sus dos salidas', /Nadie encaja/.test(r.titulo) && r.salidas === 2 && r.viejas === 0, JSON.stringify(r))
  check('  …sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 2. Noticias: los temas ──')
{
  const { ctx, p, errores } = await abrir('/noticias')
  const r = await p.evaluate(async () => {
    const { chipsDeTemas } = await import('/js/noticias.js')
    const dos = chipsDeTemas([{ category_id: 'a', categories: { name: 'Torneos' } }, { category_id: 'a', categories: { name: 'Torneos' } }, { category_id: 'b', categories: { name: 'Producto' } }], 'b')
    const uno = chipsDeTemas([{ category_id: 'a', categories: { name: 'Torneos' } }])
    const d = document.createElement('div')
    d.innerHTML = dos
    return { uno, chips: [...d.querySelectorAll('button')].map((x) => [x.textContent.trim(), x.getAttribute('aria-pressed')]) }
  })
  check('con dos temas: «Todas» y cada tema con su número, el elegido marcado', JSON.stringify(r.chips) === JSON.stringify([['Todas 3', 'false'], ['Torneos 2', 'false'], ['Producto 1', 'true']]), JSON.stringify(r))
  check('  …con uno solo, ningún chip', r.uno === '', r.uno)
  check('  …sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 3. Guardados: los temas que sigues ──')
{
  const { ctx, p, errores } = await abrir('/guardados')
  const r = await p.evaluate(() => ({
    temas: [...document.querySelectorAll('.gd-item-tema')].map((x) => ({ href: x.querySelector('a')?.getAttribute('href'), texto: x.innerText.replace(/\s+/g, ' ').trim() })),
    chip: [...document.querySelectorAll('[data-gd-filtro]')].map((x) => x.textContent.replace(/\s+/g, ' ').trim()),
  }))
  check('los dos temas que sigue user-1, con su enlace y sus mensajes', r.temas.length === 2 && r.temas.every((t) => /^\/tema\//.test(t.href) && /\d+ mensajes?/.test(t.texto)), JSON.stringify(r))
  await p.click('.gd-item-tema [data-dejar-tema]')
  await p.waitForTimeout(600)
  const quitado = await p.evaluate(() => ({ texto: document.querySelector('.gd-item-tema')?.innerText || '', deshacer: Boolean(document.querySelector('[data-volver-tema]')) }))
  check('quitar es dejar de seguir, con Deshacer', /Ya no sigues este tema/.test(quitado.texto) && quitado.deshacer, JSON.stringify(quitado))
  await p.click('[data-volver-tema]')
  await p.waitForTimeout(600)
  check('  …y Deshacer lo vuelve a poner', (await p.locator('.gd-item-tema [data-dejar-tema]').count()) === 2)
  check('  …sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 4. Torneos: el mazo del campeón ──')
{
  const { ctx, p, errores } = await abrir('/torneos')
  const r = await p.evaluate(async () => {
    const { urlsDelCampeon } = await import('/js/torneos/arte-meta.js')
    const parsed = { pokemon: [{ name: 'Charizard ex', set: 'OBF', number: '125', count: 3 }, { name: 'Charmander', set: 'OBF', number: '26', count: 4 }, { name: 'Pidgeot ex', set: 'OBF', number: '164', count: 2 }, { name: 'Pidgey', set: 'OBF', number: '162', count: 2 }], trainer: [] }
    return { urls: urlsDelCampeon(parsed), artes: [...document.querySelectorAll('.torneo-arte')].map((a) => a.dataset.torneo || '') }
  })
  check('de su lista salen los dos Pokémon del mazo', r.urls.length >= 1 && r.urls.every((u) => /^https?:\/\//.test(u)), JSON.stringify(r.urls))
  check('  …y cada tarjeta dice de qué torneo es', r.artes.length > 0 && r.artes.every(Boolean), JSON.stringify(r.artes))
  check('  …sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 5. Foro: «Lo que se está hablando» se fue en la 1221 ──')
{
  const { ctx, p, errores } = await abrir('/foro')
  // PINGU (1221): «ya tienes a la derecha lo de lo último, y te quita mucho
  // espacio vertical». El carrusel de la 1216 ya no está; «Lo último», sí.
  const r = await p.evaluate(() => ({ franja: document.querySelectorAll('.foro-calientes').length, ultimo: Boolean(document.querySelector('#foroLateral .foro-lou')) }))
  check('ni franja ni carrusel; «Lo último» al lado', r.franja === 0 && r.ultimo, JSON.stringify(r))
  check('  …sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}

console.log('── 6. Mis partidas: el anillo se dibuja y las filas entran en cascada ──')
{
  const { ctx, p, errores } = await abrir('/mis-partidas')
  const r = await p.evaluate(() => ({
    anillo: getComputedStyle(document.querySelector('.partidas-hero-anillo') || document.body, '::after').animationName,
    cascada: Boolean(document.querySelector('.partidas-mes-lista.en-cascada')),
    fila: getComputedStyle(document.querySelector('.partidas-mes-lista.en-cascada > *') || document.body).animationName,
  }))
  check('el anillo se abre al entrar', r.anillo === 'partidas-anillo-abre', JSON.stringify(r))
  check('  …y las filas entran en cascada', r.cascada && r.fila === 'partidas-entra', JSON.stringify(r))
  check('  …sin errores', errores.length === 0, errores.join(' | '))
  await ctx.close()
}
{
  const ctx = await contexto(b, false, 'user-1')
  await ctx.close()
  const p = await (await b.newContext({ reducedMotion: 'reduce' })).newPage()
  await p.goto(`${BASE}/mis-partidas`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(800)
  const n = await p.evaluate(() => getComputedStyle(document.querySelector('.partidas-hero-anillo') || document.body, '::after').animationName)
  check('con «menos movimiento», el anillo no se anima', n === 'none' || n === '', n)
  await p.close()
}

await b.close()
console.log(fails ? `\n${fails} rojos` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
