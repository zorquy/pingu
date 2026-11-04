// Tandas 1217–1221 — toda la web como la portada (la propuesta aprobada por
// PINGU página a página): lo que cambió en cada pantalla y lo que PINGU pidió
// distinto de la maqueta. Se mira con los fixtures de la app, en el PC y en
// el móvil donde la regla es «en el móvil no».
import { chromium, contexto, BASE } from './fixtures-app.mjs'

let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'

const b = await chromium.launch()
const abrir = async (ruta, { movil = false, extra = null, espera = 2800 } = {}) => {
  const ctx = await contexto(b, movil, 'user-1', extra)
  const p = await ctx.newPage()
  const errores = []
  p.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(espera)
  return { ctx, p, errores }
}
const visible = (p, sel) => p.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden' }, sel)

console.log('── 1217 · Cruces: Todos · Perfectos · En curso, y la banda solo en el PC ──')
{
  const { ctx, p, errores } = await abrir('/mi-coleccion?ver=cambios')
  const filtros = await p.$$eval('[data-cruces-filtro]', (bs) => bs.map((x) => x.dataset.crucesFiltro).join())
  check('los chips son Todos, Perfectos y En curso', filtros === 'todos,perfectos,curso', filtros)
  check('  …la banda se ve en el PC', await visible(p, '#mcCambiosPanel .banda-s'))
  check('  …sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, p } = await abrir('/mi-coleccion?ver=cambios', { movil: true })
  check('en el móvil la banda de Deseos y cambios no ocupa sitio', !(await visible(p, '#mcCambiosPanel .banda-s')))
  await ctx.close()
}

console.log('── 1219 · El dibujo del Pokémon no arrastra la portada ──')
{
  const fs = await import('node:fs')
  const glosario = fs.readFileSync(`${RAIZ}/js/glosario.js`, 'utf8')
  check('el Glosario pide el dibujo a arte-pokemon.js, no a guia-portada.js', /arte-pokemon\.js/.test(glosario) && !/guia-portada\.js/.test(glosario))
  const { pokemonDe } = await import(`${RAIZ}/js/arte-pokemon.js`)
  check('  …y el mismo slug da siempre el mismo Pokémon', pokemonDe('como-empezar') === pokemonDe('como-empezar') && Number.isInteger(pokemonDe('x')))
}

console.log('── 1221 · Foro: sin «Lo que se está hablando», con la banda en el PC ──')
{
  const { ctx, p, errores } = await abrir('/foro.html')
  const r = await p.evaluate(() => ({
    franja: document.querySelectorAll('.foro-calientes, .foro-caliente').length,
    banda: document.querySelector('.foro-cabecera')?.classList.contains('banda-s'),
    cifras: [...document.querySelectorAll('.foro-banda-cifras small')].map((x) => x.textContent).join('|'),
    temas: document.querySelector('.foro-banda-cifras b')?.textContent,
    buscador: Boolean(document.querySelector('.foro-banda #foroBuscador')),
    ultimo: Boolean(document.querySelector('#foroLateral .foro-lou')),
  }))
  check('no queda la franja de «Lo que se está hablando»', r.franja === 0, JSON.stringify(r))
  check('  …la cabecera es la banda con temas, mensajes y por aquí hoy', r.banda && r.cifras === 'temas|mensajes|por aquí hoy' && /^\d/.test(r.temas || ''), JSON.stringify(r))
  check('  …con el buscador dentro, y «Lo último» al lado', r.buscador && r.ultimo, JSON.stringify(r))
  check('  …sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, p } = await abrir('/foro.html', { movil: true })
  const r = await p.evaluate(() => {
    const cab = document.querySelector('.foro-cabecera')
    const cs = cab ? getComputedStyle(cab) : null
    return { fondo: cs?.backgroundImage || '', cifras: getComputedStyle(document.querySelector('.foro-banda-cifras') || document.body).display, lou: Boolean(document.querySelector('#foroLateral .foro-lou')) }
  })
  check('en el móvil la cabecera no lleva banda (ni fondo ni cifras)', r.fondo === 'none' && r.cifras === 'none', JSON.stringify(r))
  check('  …y «Lo último» sale al final de la lista', await visible(p, '#foroLateral .foro-lou'), JSON.stringify(r))
  await ctx.close()
}

console.log('── 1221 · Mensajes: chips y «Proponer cambio» en la cabecera ──')
const conMensajes = () => {
  const hace = (h) => new Date(Date.now() - h * 3600e3).toISOString()
  const F = (window.__FAKE_FILAS__ ||= {})
  const extra = { fijada_at: null, archivada_at: null }
  F.conversation_participants = [
    { conversation_id: 'conv-1', user_id: 'user-1', last_read_at: hace(30), ...extra }, { conversation_id: 'conv-1', user_id: 'user-2', last_read_at: hace(1), ...extra },
    { conversation_id: 'conv-2', user_id: 'user-1', last_read_at: hace(1), ...extra }, { conversation_id: 'conv-2', user_id: 'extra-3', last_read_at: hace(60), ...extra },
  ]
}
for (const movil of [false, true]) {
  const { ctx, p, errores } = await abrir('/mensajes.html', { movil, extra: `(${conMensajes.toString()})()` })
  const chips = await p.$$eval('[data-msg-filtro]', (bs) => bs.map((x) => x.dataset.msgFiltro).join())
  check(`[${movil ? 'móvil' : 'PC'}] chips Todas, Sin leer, Tratos y Tiendas`, chips === 'todas,sin-leer,tratos,tiendas', chips)
  const antes = await p.$$eval('.msg-fila', (fs) => fs.filter((f) => !f.hidden).length)
  await p.click('[data-msg-filtro="sin-leer"]')
  await p.waitForTimeout(200)
  const despues = await p.$$eval('.msg-fila', (fs) => fs.filter((f) => !f.hidden).map((f) => f.dataset.nombre).join())
  check(`[${movil ? 'móvil' : 'PC'}]   …«Sin leer» deja solo las que tienen algo sin leer`, antes === 2 && despues === 'misty', `${antes} → ${despues}`)
  await p.click('[data-msg-filtro="tiendas"]')
  await p.waitForTimeout(200)
  check(`[${movil ? 'móvil' : 'PC'}]   …y «Tiendas» sin ninguna lo dice`, await visible(p, '.msg-filtro-vacio'))
  check(`[${movil ? 'móvil' : 'PC'}]   …sin errores`, !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, p, errores } = await abrir('/mensajes.html?c=conv-1', { extra: `(${conMensajes.toString()})()` })
  const r = await p.evaluate(() => ({ boton: document.querySelector('.msg-cabecera #msgProponer')?.textContent.trim(), repetido: document.querySelectorAll('#msgPropuestas [data-cp-nueva]').length }))
  check('en una conversación, «Proponer cambio» va en la cabecera y no se repite debajo', r.boton === 'Proponer cambio' && r.repetido === 0, JSON.stringify(r))
  check('  …sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 1221 · Torneos: «Ver» y el día en la chapa ──')
{
  const { ctx, p, errores } = await abrir('/torneos.html')
  const r = await p.evaluate(() => ({
    recuadro: document.querySelectorAll('.torneo-tarjeta .torneo-fecha-bloque').length,
    cuando: [...document.querySelectorAll('.torneo-etiqueta-cuando')].map((x) => x.textContent),
    acciones: [...document.querySelectorAll('.torneo-pie-accion')].map((a) => [a.textContent.trim(), a.getAttribute('aria-label') || '']),
  }))
  check('sin el recuadro del día; el día va en la chapa de la hora', r.recuadro === 0 && r.cuando.length > 0 && r.cuando.every((x) => /^\d{1,2} \S+ · \d{2}:\d{2}$/.test(x)), JSON.stringify(r.cuando))
  const ver = r.acciones.filter(([t]) => t === 'Ver')
  check('  …«Ver» como botón, con lo largo para el lector y empezando por «Ver»', ver.length > 0 && ver.every(([, a]) => /^Ver /.test(a)), JSON.stringify(r.acciones))
  check('  …sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 1221 · Meta: la banda con sus cifras y el abanico ──')
const conMeta = `window.__RPC_RESPUESTAS__ = Object.assign(window.__RPC_RESPUESTAS__ || {}, {
  meta_totales: () => [{ torneos: 38, jugadores: 1840, oficiales: 2, online: 30, pokedoc: 6, ultima_lectura: new Date().toISOString() }],
  meta_resumen: () => [['dragapult-ex','Dragapult ex',['dragapult','gengar'],41,24],['charizard-ex','Charizard ex',['charizard','pidgeot'],33,19],['gardevoir-ex','Gardevoir ex',['gardevoir','kirlia'],22,13]].map(([arquetipo,nombre,iconos,mazos,cuota]) => ({ arquetipo, nombre, iconos, mazos, top8: 4, cuota, cuota_anterior: cuota - 1, victorias: 50, derrotas: 40, empates: 2, porcentaje_victorias: 52 })),
})`
{
  const { ctx, p, errores } = await abrir('/meta', { extra: conMeta })
  const r = await p.evaluate(() => ({ listas: document.getElementById('metaNListas')?.textContent, torneos: document.getElementById('metaNTorneos')?.textContent, dias: document.getElementById('metaNDias')?.textContent, abanico: document.querySelectorAll('#metaAbanico .meta-abanico-carta').length }))
  check('listas (la suma de los mazos), torneos y el periodo', r.listas === '96' && r.torneos === '38' && r.dias === '14 d', JSON.stringify(r))
  check('  …y los tres primeros en abanico', r.abanico === 3, JSON.stringify(r))
  check('  …sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}
{
  const { ctx, p } = await abrir('/meta', { movil: true, extra: conMeta })
  check('en el móvil, sin cifras ni abanico (la fila de siempre)', !(await visible(p, '.meta-banda-cifras')) && !(await visible(p, '#metaAbanico')))
  await ctx.close()
}

console.log('── 1221 · Mis mazos: banda y el hueco para otro ──')
{
  const { ctx, p, errores } = await abrir('/mazos', { espera: 3500 })
  const r = await p.evaluate(() => ({ mazos: document.getElementById('mzNMazos')?.textContent, tarjetas: document.querySelectorAll('.cm-mazo-tarjeta').length, hueco: Boolean(document.querySelector('.mz-nuevo-hueco[href="/constructor?nuevo=1"]')), sprites: document.querySelectorAll('.cm-mazo-portada.con-sprites').length }))
  check('la banda cuenta los mazos', r.mazos === String(r.tarjetas) && r.tarjetas > 0, JSON.stringify(r))
  check('  …cada mazo con sus Pokémon (sacados de su lista)', r.sprites === r.tarjetas, JSON.stringify(r))
  check('  …y al final, el hueco «+ Nuevo mazo»', r.hueco, JSON.stringify(r))
  check('  …sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 1221 · Avisos: banda y el icono de su sección ──')
{
  const { ctx, p, errores } = await abrir('/avisos')
  const r = await p.evaluate(() => ({
    sin: document.getElementById('avNSinLeer')?.textContent,
    filas: document.querySelectorAll('#avLista .nav-bell-item').length,
    iconos: [...document.querySelectorAll('#avLista .av-ico')].map((x) => x.dataset.seccion),
    fechas: [...document.querySelectorAll('#avLista .nav-bell-item-date')].map((x) => x.textContent),
  }))
  check('la banda dice cuántos sin leer', /^\d+$/.test(r.sin || ''), JSON.stringify(r))
  check('  …cada aviso con el icono de su sección', r.filas > 0 && r.iconos.length === r.filas, JSON.stringify(r))
  check('  …y la sección en la línea de la fecha', r.fechas.every((f) => / · /.test(f)), JSON.stringify(r.fechas))
  check('  …sin errores', !errores.length, errores.join(' | '))
  await ctx.close()
}

await b.close()
console.log(fails ? `\n❌ ${fails} FALLAN` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
