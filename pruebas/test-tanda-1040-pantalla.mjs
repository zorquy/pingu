// Tanda 1040 — Comunidad, Jugar y Perfil, contenido primero (la tercera de
// «PokeDoc, contenido primero»; PINGU: «haz todo lo recomendado»). Y la regla
// de las tres tandas, escrita en CLAUDE.md: en una página de LISTA, en un
// iPhone de 844 px, lo que se viene a ver empieza antes del 35 % (296 px).
import { chromium, contexto } from '../herramientas/propuesta-compacta/comun.mjs'

const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => { if (!ok) fails++; console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`) }
const TOPE = 296

const b = await chromium.launch()
async function abrir(ruta, movil = true) {
  const ctx = await contexto(b, movil, 'user-1', () => { try { localStorage.setItem('pokedoc-instalar-no', String(Date.now())) } catch {} })
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  return { ctx, page, errores }
}
const empieza = (page, sel) => page.evaluate((sel) => { const el = [...document.querySelectorAll(sel)].find((e) => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 }); return el ? Math.round(el.getBoundingClientRect().top) : Infinity }, sel)
const soloLector = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return 'no está'; const cs = getComputedStyle(e); const r = e.getBoundingClientRect(); return r.width <= 1 && cs.position === 'absolute' && /inset\(50%\)/.test(cs.clipPath) ? true : `${Math.round(r.width)}×${Math.round(r.height)} ${cs.position}` }, sel)
const visto = (page, sel) => page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); return r.width > 2 && r.height > 2 && getComputedStyle(e).visibility !== 'hidden' }, sel)
const filas = (page, sel) => page.evaluate((sel) => new Set([...document.querySelectorAll(sel)].filter((x) => x.getBoundingClientRect().width > 0).map((x) => Math.round(x.getBoundingClientRect().top + x.getBoundingClientRect().height / 2))).size, sel)

console.log('── 0. La regla: en las páginas de lista, el contenido antes de 296 px ──')
const LISTAS = [
  ['/aprender', '#apLista .guia-tarjeta, #apLista .guia-fila'],
  ['/glosario', '.glosario-termino'],
  ['/novedades', '#nvDestacadas .nv-dest'],
  ['/lanzamientos', '#proximoDestacado .lanzamiento-destacado'],
  ['/mi-coleccion?ver=quiero', 'article.mc-deseo-baldosa, #mcPanelQuiero .empty-state'],
  ['/cartas', '#mcEstanteriaRejilla'],
  ['/foro', '.foro-calientes, .foro-seccion'],
  ['/usuarios', '.com-podio, .com-persona'],
  ['/torneos', '.torneos-rejilla > *'],
  ['/mis-partidas', '#partidasHero'],
  ['/laboratorio', 'section.lp-bloque'],
  ['/repeticiones', '#repTexto'],
]
for (const [ruta, sel] of LISTAS) {
  const { ctx, page, errores } = await abrir(ruta)
  const top = await empieza(page, sel)
  check(`${ruta}: lo primero, a ${top} px`, top <= TOPE && !errores.length, errores.join(' | '))
  await ctx.close()
}

console.log('── 1. Foro: los foros en filas de una línea, sin chips ──')
{
  const { ctx, page } = await abrir('/foro')
  check('sin chips de sección', (await page.locator('.foro-chips-secciones').count()) === 0)
  check('«Foro» no ocupa sitio', (await soloLector(page, '#foroTitulo')) === true, await soloLector(page, '#foroTitulo'))
  const f = await page.evaluate(() => [...document.querySelectorAll('.foro-seccion > .foro-fila')].map((x) => ({ alto: Math.round(x.getBoundingClientRect().height), ancho: Math.round(x.getBoundingClientRect().width) })))
  check('cada foro es una fila a lo ancho, de menos de 72 px', f.length >= 4 && f.every((x) => x.alto <= 72 && x.ancho > 300), JSON.stringify(f))
  await ctx.close()
}

console.log('── 2. Comunidad: el podio en una fila de tres ──')
{
  const { ctx, page } = await abrir('/usuarios')
  check('el podio, los tres en la misma fila', (await filas(page, '.com-puesto')) === 1)
  check('sin «La comunidad» ni «Gente de PokeDoc» a la vista', (await soloLector(page, '.page-header.cab-lista')) === true && (await soloLector(page, '#ctab-users > .seccion-cabecera')) === true)
  check('«+N XP» sin «este mes» (lo dice el rótulo)', !(await visto(page, '.com-largo')))
  await ctx.close()
}

console.log('── 3. Torneos: una sola fila con el calendario y «+» delante ──')
{
  const { ctx, page } = await abrir('/torneos')
  const r = await page.evaluate(() => {
    const n = document.querySelector('.torneo-pestanas-chips')
    const acc = n?.querySelector('.torneos-heroe-acciones')
    const crear = document.getElementById('btnNuevoTorneo').getBoundingClientRect()
    const tops = new Set([...n.children].map((x) => Math.round(x.getBoundingClientRect().top + x.getBoundingClientRect().height / 2)))
    return { dentro: Boolean(acc), filas: tops.size, crear: [Math.round(crear.width), Math.round(crear.height)], semana: document.getElementById('torneosSemana')?.getBoundingClientRect().height || 0 }
  })
  check('el calendario y «+» van delante de los chips, en UNA fila', r.dentro && r.filas <= 2, JSON.stringify(r))
  check('«Crear torneo» es un «+» de 44', r.crear[0] === 44 && r.crear[1] === 44 && (await page.getAttribute('#btnNuevoTorneo', 'aria-label')) === 'Crear torneo', JSON.stringify(r.crear))
  check('sin la semana', r.semana === 0)
  await page.click('#torneosVistaIcono')
  await page.waitForTimeout(400)
  check('en el calendario, el icono vuelve a la cabecera y se ve', await visto(page, '#torneosVistaIcono'))
  await ctx.close()
  const pc = await abrir('/torneos', false)
  check('en el PC, «Crear torneo» con su texto y la semana', /Crear torneo/.test(await pc.page.innerText('#btnNuevoTorneo')) && (await visto(pc.page, '#torneosSemana')))
  await pc.ctx.close()
}

console.log('── 4. Mis partidas: el resumen en dos filas y «Desde una repetición» dentro ──')
{
  const { ctx, page } = await abrir('/mis-partidas?ver=sueltas')
  const h = await page.evaluate(() => ({ alto: Math.round(document.getElementById('partidasHero').getBoundingClientRect().height), forma: document.querySelectorAll('#partidasHero .partidas-forma').length }))
  check('el resumen mide menos de 260 px y no lleva las últimas diez', h.alto < 260 && h.forma === 0, JSON.stringify(h))
  check('«Desde una repetición» no es un botón suelto', !(await visto(page, '#btnDesdeRepeticion')))
  await page.click('#btnApuntarPartida')
  await page.waitForTimeout(300)
  check('  …sale dentro de «Apuntar una partida»', await visto(page, '#partidaForm #btnDesdeRepeticion'))
  await page.click('#btnDesdeRepeticion')
  await page.waitForTimeout(300)
  check('  …y abre lo de la repetición', await visto(page, '#desdeRepForm'))
  const filasAltas = await page.evaluate(() => [...document.querySelectorAll('.partidas-fila-mazos')].map((x) => Math.round(x.getBoundingClientRect().height)).filter((a) => a > 120))
  check('las filas de partida no llevan hueco vacío (220 px de antes)', !filasAltas.length, JSON.stringify(filasAltas))
  await ctx.close()
}

console.log('── 5. Laboratorio y Repeticiones ──')
{
  const { ctx, page } = await abrir('/laboratorio')
  check('sin cabecera a la vista', (await soloLector(page, '.lp-cabecera')) === true)
  const m = await page.evaluate(() => [...document.querySelectorAll('.lp-mazo')].map((x) => { const r = x.getBoundingClientRect(); const p = x.querySelector('.lp-mazo-probar').getBoundingClientRect(); return { alto: Math.round(r.height), dentro: p.right <= r.right + 1, misma: Math.abs(p.top + p.height / 2 - (r.top + r.height / 2)) < 8 } }))
  check('cada mazo en una fila con «Editar» y «Probar» dentro', m.length >= 1 && m.every((x) => x.dentro && x.misma && x.alto < 100), JSON.stringify(m))
  check('nada se sale de lado', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))
  await ctx.close()
  const r = await abrir('/repeticiones')
  check('sin la cabecera ni el párrafo largo', (await soloLector(r.page, '.rep-cabecera')) === true && !(await visto(r.page, '.rep-pegar > .rep-pegar-ayuda')))
  check('una línea y «¿Cómo se copia?» plegado', (await visto(r.page, '.rep-pegar-corta')) && !(await r.page.locator('.rep-como').getAttribute('open') !== null))
  const alto = await r.page.evaluate(() => Math.round(document.getElementById('repTexto').getBoundingClientRect().height))
  check('el cuadro mide 140', alto === 140, String(alto))
  await r.ctx.close()
}

console.log('── 6. Constructor: sin migas, cabecera de 88 y lo de menos dentro de «⋯» ──')
{
  const { ctx, page, errores } = await abrir('/constructor?mazo=mazo-1')
  check('sin errores', !errores.length, errores.join(' | '))
  check('sin «Mis mazos» arriba', !(await visto(page, '.cm-pagina > .breadcrumb')))
  const alto = await page.evaluate(() => Math.round(document.getElementById('cmHero').getBoundingClientRect().height))
  check('la cabecera del mazo mide 88', alto === 88, String(alto))
  check('«¿Cuánto me falta?» y «Guardado» viven en «⋯»', (await page.evaluate(() => ['cmCoste', 'cmEstadoGuardado'].every((id) => document.getElementById(id)?.closest('#cmMenuHerramientas')))))
  await ctx.close()
  const pc = await abrir('/constructor?mazo=mazo-1', false)
  check('en el PC siguen en la cabecera', await pc.page.evaluate(() => ['cmCoste', 'cmEstadoGuardado'].every((id) => document.getElementById(id)?.closest('.cm-hero-chapas'))))
  await pc.ctx.close()
}

console.log('── 7. Perfil: la cabecera más baja ──')
{
  const { ctx, page } = await abrir('/perfil')
  const r = await page.evaluate(() => {
    const m = (s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().height) : null }
    const bio = document.querySelector('.profile-bio')
    const lh = bio ? parseFloat(getComputedStyle(bio).lineHeight) || 20 : 0
    return { banner: m('.profile-hero-banner, .profile-hero-banner-vacio'), avatar: m('.profile-hero-avatar'), bioLineas: bio ? Math.round(bio.getBoundingClientRect().height / lh) : 0 }
  })
  check('banner de 88, avatar de 72 y la bio en una línea', r.banner === 88 && r.avatar === 72 && r.bioLineas <= 1, JSON.stringify(r))
  const v = await page.evaluate(() => [...document.querySelectorAll('#perfilVitrina .vitrina-compartir, #perfilVitrina .vitrina-editar')].map((x) => ({ w: Math.round(x.getBoundingClientRect().width), h: Math.round(x.getBoundingClientRect().height), et: x.getAttribute('aria-label') })))
  check('«Compartir» y «Cambiar» en iconos de 44, con su etiqueta', v.length === 2 && v.every((x) => x.w === 44 && x.h >= 44 && x.et), JSON.stringify(v))
  check('«Vitrina» no se repite (ya lo dice la pestaña)', (await soloLector(page, '#perfilVitrina .vitrina-cabeza .section-title')) === true)
  await ctx.close()
}

await b.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTodo en orden')
process.exit(fails ? 1 : 0)
