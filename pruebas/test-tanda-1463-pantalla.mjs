// Tandas 1462–1463 — /torneos más visual (propuesta «Torneos más visuales»,
// PINGU: «adelante con todo lo recomendado»):
//   1462 · un color por tipo (chapas `.chapa-tipo` con `data-tipo-torneo`),
//          cuatro mandos en la fila (Todos · Online · En persona + lupa +
//          calendario), fuera Oficiales/Ligas/Terminados/Los míos, y la fecha
//          de cada fila teñida de su tipo.
//   1463 · «Lo próximo» en tres carteles (la liga en curso es uno, con tu
//          puesto y «Manda tu lista»), sin franja aparte, «en juego» en la
//          cifra; con menos de tres, el hueco con «Crea uno»; en el móvil, un
//          carrusel que no ensancha la página; y nunca «No hay ningún torneo
//          por jugar» con una liga en marcha.
import { chromium, contexto, BASE } from './fixtures-app.mjs'
import { datosArena, sembrarArena } from './fixture-arena.mjs'
const REPO = process.env.PD_RAIZ || '/home/user/pingu'

let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }

console.log('── Lo puro ──')
{
  const { ordenarProximos } = await import(`${REPO}/js/torneos/agenda-puro.js`)
  const a = { id: 'a', status: 'registration_open', start_at: '2026-12-01T10:00:00Z' }
  const liga = { id: 'l', status: 'in_progress', start_at: '2026-10-01T10:00:00Z' }
  const orden = ordenarProximos([a, liga], { cuando: (t) => (t.id === 'l' ? '2026-12-05T10:00:00Z' : t.start_at), enJuego: () => false })
  check('una liga entre jornadas va por la fecha de su próxima jornada', orden.map((t) => t.id).join() === 'a,l', orden.map((t) => t.id).join())
  check('y sin decir nada, lo en juego va delante (como antes)', ordenarProximos([a, liga]).map((t) => t.id).join() === 'l,a')
}

const b = await chromium.launch()
async function abrir({ movil = false, tema = 'dark', datos = {} } = {}) {
  const ctx = await contexto(b, movil, 'user-1')
  await ctx.addInitScript((t) => { try { localStorage.setItem('pokedoc-theme', t) } catch {} }, tema)
  await ctx.addInitScript(sembrarArena, datosArena(datos))
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 200)))
  await page.goto(`${BASE}/torneos`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3200)
  await page.evaluate(() => document.querySelectorAll('dialog[open]').forEach((d) => d.close()))
  return { ctx, page, errores }
}

console.log('── 1462: la fila de mandos y los colores (PC) ──')
{
  const { ctx, page, errores } = await abrir()
  const fila = await page.evaluate(() => {
    const nav = document.querySelector('.torneos-filtros')
    return {
      filtros: [...nav.querySelectorAll('[data-filtro-lista]')].map((x) => x.dataset.filtroLista),
      tipos: [...nav.querySelectorAll('[data-filtro-lista][data-tipo-torneo]')].map((x) => x.dataset.tipoTorneo),
      hechos: Boolean(nav.querySelector('[data-ver-hechos]')),
      lupa: Boolean(nav.querySelector('#torneosBuscar')),
      ultimo: nav.lastElementChild?.id,
      conmutador: getComputedStyle(document.querySelector('.torneo-vista-conmutador')).display,
      colorOnline: getComputedStyle(nav.querySelector('[data-filtro-lista="online"]')).color,
      colorPersona: getComputedStyle(nav.querySelector('[data-filtro-lista="persona"]')).color,
    }
  })
  check('tres filtros: Todos, Online y En persona', fila.filtros.join() === 'todos,online,persona', fila.filtros.join())
  check('Online y En persona llevan su color (y son distintos)', fila.tipos.join() === 'online,persona' && fila.colorOnline !== fila.colorPersona, `${fila.colorOnline} / ${fila.colorPersona}`)
  check('sin «Terminados» en la fila (su botón sigue abajo)', !fila.hechos && Boolean(await page.$('.torneos-ver-hechos')))
  check('la lupa en la fila y el calendario, un botón al final', fila.lupa && fila.ultimo === 'torneosVistaIcono', fila.ultimo)
  check('el conmutador Lista/Calendario de dos ya no se ve', fila.conmutador === 'none', fila.conmutador)
  const chapas = await page.evaluate(() => [...document.querySelectorAll('.torneo-fila .chapa-tipo, .t-campeon .chapa-tipo')].map((c) => c.dataset.tipoTorneo))
  check('las filas llevan sus chapas de tipo (online, persona, oficial…)', chapas.includes('online') && chapas.includes('persona') && chapas.includes('oficial'), chapas.join())
  const losa = await page.evaluate(() => {
    const f = document.querySelector('.torneo-fila[data-tipo-torneo="persona"] .torneo-fila-fecha small')
    const g = document.querySelector('.torneo-fila[data-tipo-torneo="online"] .torneo-fila-fecha small')
    return [f && getComputedStyle(f).color, g && getComputedStyle(g).color]
  })
  check('la fecha de la fila va del color de su tipo', losa[0] && losa[1] && losa[0] !== losa[1], losa.join(' / '))
  await page.click('[data-filtro-lista="online"]')
  await page.waitForTimeout(300)
  const tras = await page.evaluate(() => [...document.querySelectorAll('#torneosAgenda .t-cartel, #torneosAgenda .torneo-fila:not(.torneo-fila-hecha)')].map((x) => x.dataset.tipoTorneo))
  check('«Online» deja solo los online (la liga también lo es)', tras.length >= 1 && tras.every((t) => t === 'online' || t === 'liga'), tras.join())
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 1463: Lo próximo en carteles y la liga que cuenta (PC) ──')
{
  const { ctx, page, errores } = await abrir()
  const r = await page.evaluate(() => ({
    titulo: document.querySelector('.t-carteles-tramo .torneos-tramo-cab')?.textContent,
    carteles: [...document.querySelectorAll('.t-carteles > .t-cartel')].map((c) => c.dataset.tipoTorneo),
    liga: document.querySelector('.t-cartel-liga')?.textContent.replace(/\s+/g, ' ') || '',
    boton: document.querySelector('.t-cartel-liga [data-lc-boton]')?.textContent.trim(),
    franja: !document.getElementById('torneosLigas') || document.getElementById('torneosLigas').hidden,
    cifra: document.getElementById('tNEnJuegoTexto')?.textContent,
    nEnJuego: document.getElementById('tNEnJuego')?.textContent,
    filas: document.querySelectorAll('#torneosAgenda .torneo-fila:not(.torneo-fila-hecha)').length,
    lado: (() => { const c = [...document.querySelectorAll('.t-carteles-tramo .t-carteles > *')].map((x) => Math.round(x.getBoundingClientRect().top)); return new Set(c).size })(),
  }))
  check('«Lo próximo» con tres carteles en una fila', r.titulo === 'Lo próximo' && r.carteles.length === 3 && r.lado === 1, `${r.titulo} ${r.carteles.join()} filas:${r.lado}`)
  check('la liga es uno de ellos, con su jornada y la tira', r.carteles.includes('liga') && /Jornada 6 · mañana/.test(r.liga) && /Jornada 6 de 10/.test(r.liga), r.liga.slice(0, 160))
  check('con tu puesto y los tres primeros', /Vas/.test(r.liga) && /enege/.test(r.liga), r.liga.slice(0, 220))
  check('y el botón que toca («Manda tu lista»)', r.boton === 'Manda tu lista', r.boton)
  check('sin la franja de ligas aparte', r.franja)
  check('la cifra dice «en juego» y cuenta la liga', r.cifra === 'en juego' && r.nEnJuego === '1', `${r.nEnJuego} ${r.cifra}`)
  check('lo de más adelante sigue en filas', r.filas === 2, r.filas)
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 1463: hoy, solo la liga ──')
{
  const { ctx, page, errores } = await abrir({ datos: { abiertos: false } })
  const r = await page.evaluate(() => ({
    texto: document.getElementById('torneosAgenda')?.textContent.replace(/\s+/g, ' ') || '',
    carteles: document.querySelectorAll('.t-carteles > .t-cartel').length,
    hueco: document.querySelector('.t-cartel-hueco')?.textContent.replace(/\s+/g, ' ').trim(),
    crear: Boolean(document.querySelector('.t-cartel-hueco [data-crear-torneo]')),
  }))
  check('nunca «No hay ningún torneo por jugar» con la liga en marcha', !/No hay ningún torneo por jugar/.test(r.texto))
  check('la liga en grande y el hueco con «Crea uno»', r.carteles === 1 && /No hay más torneos abiertos/.test(r.hueco || '') && r.crear, r.hueco)
  await page.click('.t-cartel-hueco [data-crear-torneo]')
  await page.waitForTimeout(800)
  check('«Crea uno» abre el creador', Boolean(await page.$('#torneoCrear[open]')))
  check('sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── El móvil: carrusel, lupa y nada que ensanche ──')
for (const tema of ['dark', 'light']) {
  const { ctx, page, errores } = await abrir({ movil: true, tema })
  const r = await page.evaluate(() => {
    const fila = document.querySelector('.t-carteles-tramo .t-carteles')
    return { ancho: innerWidth, doc: document.documentElement.scrollWidth, desliza: fila && getComputedStyle(fila).overflowX === 'auto' && fila.scrollWidth > fila.clientWidth, puntos: document.querySelectorAll('.t-carteles-tramo .t-carteles-puntos i').length }
  })
  check(`${tema}: la página mide lo que el móvil (390), sin ensancharse`, r.ancho === 390 && r.doc <= 391, JSON.stringify(r))
  check(`${tema}: los carteles se deslizan de lado, con sus puntos`, r.desliza && r.puntos === 3, JSON.stringify(r))
  if (tema === 'dark') {
    const lupa = await page.$('.torneos-buscar')
    const antes = await lupa.evaluate((l) => Math.round(l.getBoundingClientRect().width))
    await lupa.click()
    await page.waitForTimeout(200)
    const despues = await lupa.evaluate((l) => ({ w: Math.round(l.getBoundingClientRect().width), abierta: l.classList.contains('abierta'), foco: document.activeElement?.id }))
    check('la lupa es un botón pequeño que se abre a lo ancho y deja escribir', antes <= 44 && despues.abierta && despues.w > 200 && despues.foco === 'torneosBuscar', `${antes} → ${JSON.stringify(despues)}`)
  }
  check(`${tema}: sin errores`, !errores.length, errores.join(' | '))
  await ctx.close()
}
await b.close()
console.log(fails ? `\n❌ ${fails} FALLA(S)` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
