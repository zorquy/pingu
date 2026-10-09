// Tanda 798 — las «casi» de la propuesta: NU3 lo que te falta de un mazo,
// NU4 la confianza en Mercado y Cruces, NU6 el álbum de un ilustrador, NU9
// la región entera y los 100 cambios, PA13 el cruce en los mensajes, MV12 la
// carta que crece en el Mercado, y la sonda de /admin que daba «Falta» de
// funciones que estaban puestas.
import { readFileSync } from 'node:fs'
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const RAIZ = process.env.PD_RAIZ || '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')

console.log('── 1. En el código ──')
const mazos = leer('js/mazos.js')
check('cada mazo pregunta cuánto falta, con su caja', /data-coste>¿Cuánto me falta\?</.test(mazos) && /data-coste-caja aria-live="polite"/.test(mazos))
check('el coste sale del mismo cálculo que el constructor', /costeDeResueltas\(/.test(mazos))
check('la confianza va en el Mercado y en los Cruces', /class="mc-confianza" data-confianza=/.test(leer('js/mi-coleccion/mercado.js')) && /class="mc-confianza" data-confianza=/.test(leer('js/mi-coleccion/tablon.js')) && /m\.ponerConfianza\(document\.querySelector\('\.mc-cruces'\)\)/.test(leer('js/mi-coleccion.js')))
check('el Mercado crece la carta hacia la foto de su ficha', /crecerDesde\(f\.querySelector\('img'\), \(\) => abrirFicha\(f\.dataset\.mercFicha\), \{ destino: '#mcMercadoFicha \.mc-prodf-foto img' \}\)/.test(leer('js/mi-coleccion/mercado.js')))
check('el cruce de los mensajes sale solo si hay algo', /pintarCruce\(document\.getElementById\('msgCruce'\), otherProfile, session, \{ soloSiHay: true \}\)/.test(leer('js/mensajes.js')))
check('el cruce trae su hoja', /hojaInyectada\('css\/cruce-persona\.css'\)/.test(leer('js/cruce-persona.js')) && !/\.perfil-cruce/.test(leer('css/perfil.css')))
const mig = leer('supabase-migration-logros-coleccion-2.sql')
const gam = leer('js/gamification.js')
for (const t of ['collection_pokedex_regions', 'trades_done_count']) {
  check(`el logro ${t} lo cuenta la web y lo rotula /admin`, mig.includes(`"type": "${t}"`) && gam.includes(`case '${t}'`) && new RegExp(`${t}: '`).test(leer('admin/js/admin.js')))
}
check('la migración se puede repetir', /on conflict \(id\) do update/.test(mig))
const sc = leer('js/schema-check.js')
check('la sonda de funciones va por GET y sin filas', /supabase\.rpc\(nombre, args, \{ head: true, get: true \}\)/.test(sc))
check('ya no se sondea un disparador ni una función con parámetros obligatorios', !/rpc: 'intercambios_avisar'/.test(sc) && !/rpc: 'match_log_mazo_propio'/.test(sc) && /tabla: 'match_log', columna: 'user_deck_id'/.test(sc))

check('la portada se encuadra arriba, al centro o abajo', /<select id="mgCoverFoco">/.test(leer('editor-guia.html')) && /if \(portadaOriginal\) subirPortada\(\)/.test(leer('js/editor-guia.js')))

console.log('── 2. En el navegador ──')
const b = await chromium.launch()
{
  const p = await b.newPage()
  await p.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(1200)
  const r = await p.evaluate(async () => {
    const lc = await import('/js/logros-coleccion.js')
    const kanto = new Set(Array.from({ length: 151 }, (_, i) => i + 1))
    const casi = new Set([...kanto].filter((n) => n !== 150))
    const dos = new Set([...kanto, ...Array.from({ length: 99 }, (_, i) => 152 + i)])
    const st = lc.statsDeColeccion ? lc.statsDeColeccion.length : -1
    const sc = await import('/js/schema-check.js')
    const rp = await import('/js/recorte-portada.js')
    return {
      arriba: rp.cajaDeRecorte(1080, 1920, 16 / 9, 'arriba').y,
      abajo: rp.cajaDeRecorte(1080, 1920, 16 / 9, 'abajo').y,
      izq: rp.cajaDeRecorte(4000, 1000, 16 / 9, 'arriba').x,
      kanto: lc.regionesCompletas(kanto),
      casi: lc.regionesCompletas(casi),
      dos: lc.regionesCompletas(dos),
      vacio: lc.regionesCompletas(new Set()),
      st,
      falta: sc.veredictoDeSonda({ code: 'PGRST202', message: 'Could not find the function' }).estado,
      otra: sc.veredictoDeSonda({ code: '25006', message: 'read-only' }).estado,
    }
  })
  check('una región cuenta solo entera', r.kanto === 1 && r.casi === 0 && r.dos === 1 && r.vacio === 0, JSON.stringify(r))
  check('el encuadre mueve el recorte', r.arriba === 0 && r.abajo === 1312 && r.izq === 0, JSON.stringify(r))
  check('la sonda: falta solo con PGRST202', r.falta === 'falta' && r.otra === 'ok', JSON.stringify(r))
  // ponerConfianza rellena las cajas vacías con lo que dicen los cambios.
  const c = await p.evaluate(async () => {
    document.body.insertAdjacentHTML('beforeend', '<div id="t798"><p class="mc-confianza" data-confianza="u-1"></p><p class="mc-confianza" data-confianza="u-1"></p></div>')
    const m = await import('/js/cambios-hechos.js')
    await m.ponerConfianza(document.getElementById('t798'))
    const ps = [...document.querySelectorAll('#t798 [data-confianza]')]
    return { textos: ps.map((x) => x.textContent), escondida: getComputedStyle(ps[0]).display }
  })
  check('la confianza se pide y se pinta sin romper', Array.isArray(c.textos) && c.textos.length === 2 && c.textos[0] === c.textos[1], JSON.stringify(c))
  await p.close()
}
{
  // La sonda entera: la función que la base no conoce da «falta», la que
  // contesta con cualquier otro error (solo lectura) se da por puesta.
  const p = await b.newPage()
  await p.addInitScript(() => {
    window.__RPC_ERRORES__ = {
      coleccion_seguidos_y_mis_deseos: { code: 'PGRST202', message: 'Could not find the function public.coleccion_seguidos_y_mis_deseos in the schema cache' },
      intercambios_mercado: { code: '25006', message: 'cannot execute in a read-only transaction' },
    }
  })
  await p.goto(`${BASE}/index.html`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(800)
  const r = await p.evaluate(async () => {
    const { checkSchema } = await import('/js/schema-check.js')
    const { resultados } = await checkSchema()
    const de = (fn) => resultados.find((x) => x.rpc === fn)?.estado
    return { seguidos: de('coleccion_seguidos_y_mis_deseos'), mercado: de('intercambios_mercado') }
  })
  check('la sonda entera: falta la que no existe, y no la que está', r.seguidos === 'falta' && r.mercado === 'ok', JSON.stringify(r))
  await p.close()
}
await b.close()
console.log(fails ? `\n${fails} FALLAN` : '\nTodo en verde')
process.exit(fails ? 1 : 0)
