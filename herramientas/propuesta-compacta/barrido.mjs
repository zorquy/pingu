// Barrido de la propuesta «Menos cosas antes del contenido» (PINGU,
// 2026-10-26): la primera pantalla de cada página en el iPhone y dónde
// empieza lo que se viene a ver (el primer elemento de `contenido`).
//   node barrido.mjs [filtro]  → antes/<id>.png + barrido.json
import { mkdirSync, writeFileSync } from 'node:fs'
import { chromium, contexto, BASE } from './comun.mjs'
const AQUI = new URL('.', import.meta.url).pathname
mkdirSync(`${AQUI}antes`, { recursive: true })
export const PAGINAS = [
  ['portada', '/', '.hoy-bloque, .portada-bloque, main section'],
  ['aprender', '/aprender', '.guia-tarjeta, .guide-card'],
  ['retos', '/retos', '.reto-ficha, .retos-ficha, .reto-tarjeta'],
  ['glosario', '/glosario', '.glosario-termino, dl dt, .termino'],
  ['noticias', '/noticias', '.noticia-tarjeta, article'],
  ['lanzamientos', '/lanzamientos', '.lanz-fila, .lanzamiento, article'],
  ['guardados', '/guardados', '.guardado, .guia-fila, li'],
  ['novedades', '/novedades', '.nov-entrada, .novedad, li'],
  ['panel', '/mi-coleccion', '.mc-panel-valor, .mc-cartera, .mc-loseta'],
  ['expansiones', '/mi-coleccion?ver=album', '.mc-set, .mc-estanteria-set, .mc-set-fila'],
  ['pokedex', '/mi-coleccion?ver=pokedex', '.pdx-region, .pdx-especie, .pdx-celda'],
  ['albumes', '/mi-coleccion?ver=carpetas', '.mc-albt, .mc-album'],
  ['productos', '/mi-coleccion?ver=productos', '.mc-set, .prod-set, .mc-prod'],
  ['mercado', '/mi-coleccion?ver=mercado', '.mc-merc-carta, .mc-mercado-rejilla > *'],
  ['quiero', '/mi-coleccion?ver=quiero', '.mc-quiero-rejilla > *, .mc-deseo'],
  ['doy', '/mi-coleccion?ver=cambios', '.mc-doy-rejilla > *, .mc-doy'],
  ['buscar-mc', '/mi-coleccion?ver=buscar', '.mc-busca-resultados > *, .mc-carta'],
  ['catalogo', '/cartas', '.mc-set, .mc-estanteria-set'],
  ['foro', '/foro', '.foro-tarjeta, .foro-fila, .board'],
  ['comunidad', '/usuarios', '.usuario-fila, .persona, .user-card'],
  ['mensajes', '/mensajes', '.conv-fila, .conversacion'],
  ['torneos', '/torneos', '.torneo-tarjeta, .tor-tarjeta, article'],
  ['mazos', '/mazos', '.mazo-tarjeta, .deck-card, article'],
  ['partidas', '/mis-partidas', '.partida, .partidas-fila, .mp-tarjeta'],
  ['meta', '/meta', '.meta-fila, .arquetipo, .meta-arq'],
  ['laboratorio', '/laboratorio', '.lab-mesa, .mesa'],
  ['repeticiones', '/repeticiones', '.rep-tablero, .rep-lista, .rep-fila'],
  ['perfil', '/perfil', '.vitrina, .perfil-pestanias'],
  ['ajustes', '/ajustes', '.ajustes-bloque, section'],
  ['buscar', '/buscar', '.bs-resultados > *, .bs-seccion'],
  ['evento', '/evento', '.evento-lista, .evento-carta'],
  ['constructor', '/constructor?mazo=mazo-1', '.ctor-carta, .constructor-carta'],
]
const filtro = process.argv[2]
const b = await chromium.launch()
const salida = []
for (const [id, ruta, contenido] of PAGINAS) {
  if (filtro && !id.includes(filtro)) continue
  const ctx = await contexto(b, true, 'user-1')
  const page = await ctx.newPage()
  try {
    await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded', timeout: 20000 })
    await page.waitForTimeout(3500)
    const r = await page.evaluate((sel) => {
      const vis = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 4 && r.height > 4 && s.visibility !== 'hidden' && s.display !== 'none' }
      const el = [...document.querySelectorAll(sel)].find(vis)
      const top = el ? Math.round(el.getBoundingClientRect().top) : null
      return { top, pct: top == null ? null : Math.round((top / innerHeight) * 100), alto: innerHeight }
    }, contenido)
    await page.screenshot({ path: `${AQUI}antes/${id}.png` })
    salida.push({ id, ruta, ...r })
    console.log(`${id.padEnd(14)} ${r.pct == null ? '  ¿?' : String(r.pct).padStart(3) + ' %'}  ${ruta}`)
  } catch (e) {
    console.log(`${id} ERROR ${String(e).slice(0, 100)}`)
  }
  await ctx.close()
}
await b.close()
if (!filtro) writeFileSync(`${AQUI}barrido.json`, JSON.stringify(salida, null, 1))
