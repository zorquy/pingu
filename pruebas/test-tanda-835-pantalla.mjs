// Tanda 835 — los retos diarios, rehechos con la maqueta que aprobó PINGU, y
// tres nuevos. PINGU: «¿Qué carta es? no tiene mucho sentido: descubres la
// carta la primera y te da como rojo, no te dice acertado; deberían dar
// experiencia y tener logros; y la interfaz, que es una mierda ahora mismo».
//
// Lo puro, las funciones que eligen el día, y cada pantalla en el navegador
// con la XP que contesta la base (el doble) y sin cuenta.
import { readFileSync } from 'node:fs'
import { chromium, devices } from '/opt/node22/lib/node_modules/playwright/index.mjs'

const RAIZ = '/home/user/pingu'
const BASE = process.env.PD_BASE || 'http://localhost:8892'
let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')
const hoy = new Date().toISOString().slice(0, 10)

console.log('── 1. Lo puro ──')
const qe = await import(`${RAIZ}/js/quien-es.js`)
const fam = await import(`${RAIZ}/js/familias-pokemon.js`)
const op = await import(`${RAIZ}/js/ordena-precio.js`)
const qx = await import(`${RAIZ}/js/que-expansion.js`)
const xp = await import(`${RAIZ}/js/retos-xp.js`)
const cd = await import(`${RAIZ}/js/carta-del-dia.js`)
{
  check('las familias: Gastly–Haunter–Gengar, Pichu–Pikachu; Bulbasaur no es Charmander', fam.mismaFamilia([92], [94]) && fam.mismaFamilia([172], [25]) && !fam.mismaFamilia([1], [4]) && fam.CADENA_POR_DEX.length === 1025)
  const dias = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 9, 14 + i)).toISOString().slice(0, 10))
  const bien = dias.every((d) => {
    const o = qe.opcionesDelDia(d)
    const b = qe.pokemonDelDia(d)
    return o.length === 4 && new Set(o).size === 4 && o.includes(b) && new Set(o.map(fam.cadenaDe)).size === 4 && o.every((x) => x >= 1 && x <= 1025)
  })
  check('«¿Quién es?»: cuatro opciones distintas, con la buena y de cuatro familias, 30 días seguidos', bien)
  check('  …la buena no está siempre en el mismo sitio', new Set(dias.map((d) => qe.opcionesDelDia(d).indexOf(qe.pokemonDelDia(d)))).size > 1)
  check('  …el mismo día da lo mismo, y el estreno es el #1', qe.opcionesDelDia(hoy).join() === qe.opcionesDelDia(hoy).join() && qe.numeroDelDia('2026-08-01') === 1)
  check('  …el texto: «1/3» a la primera, y «X/3» sin acertar', /· 1\/3/.test(qe.textoParaCompartir({ dia: hoy, fallos: [], acertada: true })) && /X\/3\n🟥🟥🟥/.test(qe.textoParaCompartir({ dia: hoy, fallos: [1, 2, 3], acertada: false })))
  const c = (id, precio, foto = true) => ({ id, precio, image_path: foto ? 'x' : null })
  const sirven = op.cartasQueSirven([c('a', 10), c('b', 10.5), c('c', 0.5), c('d', 20, false), c('e', 30), c('f', 12), c('g', 50), c('h', 100)])
  check('«Ordena»: sin baratas, sin foto y sin dos a menos de un 15 % (10 y 10,50 no se distinguen; 10 y 12, sí)', sirven.map((x) => x.id).join() === 'a,e,f,g', sirven.map((x) => x.id).join())
  check('  …el orden bueno y qué está en su sitio', op.ordenBueno(sirven).join() === 'a,f,e,g' && op.enSuSitio(['a', 'e', 'f', 'g'], sirven).join() === 'true,false,false,true')
  const sets = [['b1', 'base', '1999-01-09'], ['b2', 'base', '1999-06-16'], ['b3', 'base', '1999-10-10'], ['b4', 'base', '2000-04-24'], ['g1', 'gym', '2000-08-14'], ['n1', 'neo', '2000-12-16']].map(([id, serie_id, release_date]) => ({ id, serie_id, release_date }))
  const o = qx.opcionesDeExpansion(sets[1], sets, hoy, 0)
  check('«¿De qué expansión?»: la buena y tres de su era (ninguna de otra si hay de la suya)', o.length === 4 && o.some((s) => s.id === 'b2') && o.every((s) => s.serie_id === 'base'), JSON.stringify(o.map((s) => s.id)))
  const o2 = qx.opcionesDeExpansion(sets[4], sets, hoy, 1)
  check('  …y si su era no da para tres, las más cercanas en fecha', o2.length === 4 && o2.some((s) => s.id === 'g1') && o2.some((s) => s.id === 'n1'), JSON.stringify(o2.map((s) => s.id)))
  check('el menú lee del navegador cómo va cada uno', xp.resumenLocal('carta', { dia: hoy, intentos: [{}, {}], acertada: true }, hoy)?.texto === 'Acertada en 2' && xp.resumenLocal('caro', { dia: hoy, respuestas: [true, true] }, hoy)?.hecho === false && xp.resumenLocal('carta', { dia: '2000-01-01', intentos: [{}] }, hoy) === null)
  check('«mejor que el X %» solo con cinco o más', xp.mejorQue({ 3: 2, 4: 1 }, 4) === null && xp.mejorQue({ 1: 2, 2: 2, 4: 1, 5: 5 }, 4) === 40)
  // El fallo que vio PINGU: una fila que acierta el nombre en verde entera.
  check('acertar el nombre con otra impresión es verde entero al compartir', cd.filaEmoji(cd.compararDetallado({ name: 'Gengar', rarity_en: 'Rare', types: ['Psychic'], tcg_sets: { serie_id: 'sm' } }, { name: 'Gengar', rarity_en: 'Rare Prime', types: ['Psychic'], tcg_sets: { serie_id: 'hgss' } })) === '🟩🟩🟩🟩')
  const d = cd.compararDetallado({ name: 'Haunter', dex_ids: [93], rarity_en: 'Uncommon', types: ['Psychic'], tcg_sets: { serie_id: 'hgss', release_date: '2011-02-09' } }, { name: 'Gengar', dex_ids: [94], rarity_en: 'Rare', types: ['Psychic'], tcg_sets: { serie_id: 'hgss', release_date: '2010-12-03' } }, { familia: fam.mismaFamilia })
  check('  …Haunter por Gengar: nombre «casi», era y tipo sí, rareza «casi» y «más rara»', d.nombre.estado === 'casi' && d.era.estado === 'si' && d.tipo.estado === 'si' && d.rareza.estado === 'casi' && d.rareza.flecha === 'rara', JSON.stringify(d))
  const e = cd.compararDetallado({ name: 'X', tcg_sets: { serie_id: 'gym', release_date: '2000-08-14' } }, { name: 'Y', tcg_sets: { serie_id: 'hgss', release_date: '2010-12-03' } })
  check('  …y la flecha de la era: la buena es más nueva', e.era.estado === 'no' && e.era.flecha === 'nueva')
}

console.log('\n── 2. Lo que se pide para comparar, y las piezas que faltaban ──')
{
  const juego = leer('js/carta-del-dia-juego.js')
  const col = /const COLUMNAS_INTENTO = '([^']+)'/.exec(juego)?.[1] || ''
  // El doble devuelve la fila entera pida lo que pida: esto es lo que hace
  // que en producción el tipo y la rareza lleguen (la lección de la 523).
  check('el buscador de «¿Qué carta es?» pide tipo, rareza (con rarity_en), familia y fecha', ['types', 'rarity', 'rarity_en', 'dex_ids', 'release_date'].every((k) => new RegExp(`\\b${k}\\b`).test(col)) && /columnas: COLUMNAS_INTENTO/.test(juego), col)
  check('  …y la carta del día trae su familia', /dex_ids/.test(leer('netlify/functions/carta-del-dia.mjs')))
  const bm = await import(`${RAIZ}/js/barra-movil.js`)
  check('las tres páginas nuevas son de Aprender (con la burbuja)', ['quien-es', 'ordena-precio', 'que-expansion'].every((p) => bm.SECCION_DE.Aprender.includes(p)))
  const sm = leer('netlify/functions/sitemap.mjs')
  check('  …y del mapa del sitio', ["'/quien-es'", "'/ordena-precio'", "'/que-expansion'"].every((r) => sm.includes(r)))
  for (const [p, t] of [['quien-es', '¿Quién es ese Pokémon?'], ['ordena-precio', 'Ordena por precio'], ['que-expansion', '¿De qué expansión es?']]) {
    const h = leer(`${p}.html`)
    check(`  ${p}: su título, su canónica, su descripción y la hoja común`, h.includes(`<title>${t} — PokeDoc</title>`) && h.includes(`href="https://pokedoc.es/${p}"`) && /<meta name="description" content="[^"]{60,}"/.test(h) && /css\/retos-juego\.css/.test(h) && !/mas-caro/.test(h.split('<main')[1]))
  }
  check('el de preguntas también se apunta en la tabla de los retos (para el día perfecto), sin cobrar dos veces', /guardarResultado\('reto'/.test(leer('js/curso.js')) && /if p_juego = 'reto' then[\s\S]{0,400}return 0;/.test(leer('supabase-migration-retos-xp.sql')))
}

console.log('\n── 3. Las funciones que eligen el día ──')
{
  const { elegirOrdena } = await import(`${RAIZ}/netlify/functions/ordena-precio.mjs`)
  const precios = [5, 5.2, 9, 30, 120, 0.4, 44, 70, 300, 12, 15, 18, 22, 26, 60, 90, 150, 200, 250, 400, 2, 3, 7, 11].map((p, i) => ({ card_id: `c${i}`, cm_trend: p }))
  const cartas = precios.map((p) => ({ id: p.card_id, image_path: 'x', market: 'WEST' }))
  const hacer = ({ sinTabla = false } = {}) => {
    const guardadas = []
    const pedir = async (ruta, o = {}) => {
      if (ruta.startsWith('retos_reto_del_dia')) {
        if (sinTabla) throw new Error('Supabase 404: {"code":"PGRST205","message":"Could not find the table public.retos_reto_del_dia"}')
        const g = guardadas.find((x) => x.juego === 'ordena')
        return { datos: g ? [{ datos: g.datos }] : [] }
      }
      if (o.cabeceras?.prefer === 'count=exact') return { datos: [], total: precios.length }
      const off = /offset=(\d+)/.exec(ruta)
      if (ruta.startsWith('tcg_card_prices?select=card_id&') && off) return { datos: [precios[Number(off[1])]] }
      const ids = decodeURIComponent(/id=in\.\(([^)]*)\)/.exec(ruta)?.[1] || '').split(',').map((x) => x.replace(/"/g, ''))
      if (ruta.startsWith('tcg_card_prices')) return { datos: precios.filter((p) => ids.includes(p.card_id)) }
      if (ruta.startsWith('tcg_cards')) return { datos: cartas.filter((c) => ids.includes(c.id)) }
      return { datos: [] }
    }
    return { pedir, guardar: async (t, f) => { if (sinTabla) throw new Error('PGRST205 retos_reto_del_dia'); guardadas.push(f) }, guardadas }
  }
  const a = hacer()
  const r = await elegirOrdena({ dia: hoy, pedir: a.pedir, guardar: a.guardar })
  check('«Ordena» elige cuatro con precio, distinguibles, y las guarda para el día', r.cartas?.length === 4 && a.guardadas.length === 1 && a.guardadas[0].juego === 'ordena', JSON.stringify(r).slice(0, 200))
  const r2 = await elegirOrdena({ dia: hoy, pedir: a.pedir, guardar: a.guardar })
  check('  …la segunda petición lee las mismas', r2.cartas.map((c) => c.id).join() === r.cartas.map((c) => c.id).join() && a.guardadas.length === 1)
  const b = hacer({ sinTabla: true })
  const r3 = await elegirOrdena({ dia: hoy, pedir: b.pedir, guardar: b.guardar })
  check('  …y sin la migración elige igual (las mismas) y no se cae', r3.cartas?.length === 4 && r3.cartas.map((c) => c.id).join() === r.cartas.map((c) => c.id).join(), JSON.stringify(r3).slice(0, 160))

  const { elegirExpansion } = await import(`${RAIZ}/netlify/functions/que-expansion.mjs`)
  const SETS = Array.from({ length: 12 }, (_, i) => ({ id: `s${i}`, market: 'WEST', name: `Set ${i}`, serie_id: i < 6 ? 'base' : 'neo', release_date: `20${String(i).padStart(2, '0')}-01-01`, oculto: false }))
  const CARTAS = Array.from({ length: 40 }, (_, i) => ({ id: `k${i}`, set_id: `s${i % 12}`, image_path: 'x', tcg_sets: { name: `Set ${i % 12}` } }))
  const pedirX = async (ruta, o = {}) => {
    if (ruta.startsWith('tcg_sets')) return { datos: SETS }
    if (ruta.startsWith('retos_reto_del_dia')) return { datos: [] }
    if (o.cabeceras?.prefer === 'count=exact') return { datos: [], total: CARTAS.length }
    const off = /offset=(\d+)/.exec(ruta)
    if (off) return { datos: [CARTAS[Number(off[1])]] }
    const ids = decodeURIComponent(/id=in\.\(([^)]*)\)/.exec(ruta)?.[1] || '').split(',').map((x) => x.replace(/"/g, ''))
    return { datos: CARTAS.filter((c) => ids.includes(c.id)) }
  }
  const gx = []
  const rx = await elegirExpansion({ dia: hoy, pedir: pedirX, guardar: async (t, f) => gx.push(f) })
  check('«¿De qué expansión?»: cinco rondas de cinco expansiones distintas, cada una con la suya entre cuatro', rx.rondas?.length === 5 && new Set(rx.rondas.map((x) => x.carta.set_id)).size === 5 && rx.rondas.every((x) => x.opciones.length === 4 && x.opciones.some((s) => s.id === x.carta.set_id)) && gx.length === 1, JSON.stringify(rx).slice(0, 200))
}

console.log('\n── 4. En el navegador ──')
const FOTO = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#a78bfa"/></svg>'
const carta = (id, n, extra = {}) => ({ id, market: 'WEST', set_id: extra.set || 'll1', local_id: String(n), name: extra.name || `Carta ${n}`, name_es: extra.name || `Carta ${n}`, image_path: `hgss/ll1/${n}`, category: 'Pokemon', rarity: 'Rare', rarity_en: 'Rare', types: ['Psychic'], precio: extra.precio, tcg_sets: { name: extra.setName || 'Lost Link', tcg_online_code: 'LL', serie_id: 'hgss', release_date: '2010-12-03' } })
const SEIS = [carta('a1', 1, { precio: 10 }), carta('a2', 2, { precio: 20 }), carta('a3', 3, { precio: 15 }), carta('a4', 4, { precio: 40 }), carta('a5', 5, { precio: 30 }), carta('a6', 6, { precio: 50 })]
const SETS_X = [['gym2', 'Gym Challenge'], ['gym1', 'Gym Heroes'], ['base5', 'Team Rocket'], ['neo1', 'Neo Genesis']].map(([id, name]) => ({ id, market: 'WEST', name, serie_id: 'base', release_date: '2000-01-01' }))
const RONDAS_X = [0, 1, 2, 3, 4].map((i) => ({ carta: carta(`x${i}`, 10 + i, { set: 'gym2', setName: 'Gym Challenge' }), opciones: SETS_X }))
const browser = await chromium.launch()
async function abrir(pagina, { sesion = 'none', local = {}, rpc = {}, movil = false } = {}) {
  const ctx = await browser.newContext(movil ? { ...devices['iPhone 13'], locale: 'es-ES' } : { viewport: { width: 1280, height: 900 }, locale: 'es-ES' })
  await ctx.route('**/assets.tcgdex.net/**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: FOTO }))
  await ctx.route('**/official-artwork/**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: FOTO }))
  await ctx.route('**/.netlify/functions/mas-caro**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ dia: hoy, numero: 11, cartas: SEIS }) }))
  await ctx.route('**/.netlify/functions/ordena-precio**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ dia: hoy, numero: 1, cartas: SEIS.slice(0, 4) }) }))
  await ctx.route('**/.netlify/functions/que-expansion**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify({ dia: hoy, numero: 1, rondas: RONDAS_X }) }))
  await ctx.addInitScript(([s, l, rp]) => {
    window.__FAKE_SESSION__ = s
    window.__RPC_RESPUESTAS__ = rp
    if (!sessionStorage.getItem('limpio')) {
      for (const k of Object.keys(localStorage)) if (k.startsWith('pokedoc-') && k !== 'pokedoc-theme') localStorage.removeItem(k)
      for (const [k, v] of Object.entries(l)) localStorage.setItem(k, JSON.stringify(v))
      sessionStorage.setItem('limpio', '1')
    }
    navigator.share = async (d) => { window.__compartido = d; return true }
    navigator.canShare = () => true
  }, [sesion, local, rpc])
  const page = await ctx.newPage()
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.goto(`${BASE}/${pagina}.html`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1600)
  return { page, ctx, errores }
}
const GUARDADO = (x) => ({ retos_guardar: { nuevo: true, xp: x, perfecto: false, xpPerfecto: 0, racha: 1, bonoRacha: false, xpRacha: 0, totalXp: 100 + x } })

{
  // El menú, sin cuenta: seis tarjetas y el estado de lo jugado en el navegador.
  const { page, ctx, errores } = await abrir('retos', { local: { 'pokedoc-carta-del-dia': { dia: hoy, acertada: true, intentos: [{}, {}] }, 'pokedoc-mas-caro': { dia: hoy, respuestas: [true, false] } } })
  check('menú: sin errores', !errores.length, errores.join(' | '))
  // Desde la 989: baldosas que son enlaces, una línea, la píldora y la barra.
  check('  …seis retos, cada uno con su página', (await page.locator('.rt-reto').count()) === 6 && (await page.$$eval('.rt-reto', (as) => as.map((a) => a.getAttribute('href')).join())) === '/carta-del-dia,/mas-caro,/quien-es,/ordena-precio,/que-expansion,/parejas')
  check('  …la carta, «Hecho» y «Acertada en 2»; Más caro, a medias', /Acertada en 2/.test(await page.locator('#rtCartaEstado').innerText()) && /Hecho/.test(await page.locator('#rtSello-carta').innerText()) && /A medias/.test(await page.locator('#rtMasCaroEstado').innerText()))
  check('  …la píldora: 1 de 6, y el día perfecto dice que faltan cinco', /1\/6 hoy/.test(await page.locator('#rtDia').innerText()) && /te faltan 5/.test(await page.locator('#rtPerfectoTexto').innerText()))
  check('  …y sin cuenta dice que con cuenta cada reto da XP', /Crea tu cuenta/.test(await page.locator('#rtPerfectoTexto').innerText()))
  check('  …con la cuenta atrás del día', /\d\d:\d\d:\d\d/.test(await page.locator('#rtPerfectoTexto').innerText()))
  await ctx.close()
}
{
  // Con cuenta y con la migración: la base dice lo de hoy, la racha y la XP.
  const numeros = { dias: { [hoy]: 3 }, racha: 4, mejorRacha: 9, diasPerfectos: 2, jugados: 30, xpHoy: 85, cartaPrimera: 0, cartaAciertos: 6, caroPerfectos: 1, hoy: { silueta: { aciertos: 1, total: 1, intentos: 1, acertada: true, xp: 20 }, ordena: { aciertos: 1, total: 1, intentos: 2, acertada: true, xp: 15 }, expansion: { aciertos: 4, total: 5, intentos: null, acertada: false, xp: 16 } } }
  const { page, ctx, errores } = await abrir('retos', { sesion: 'admin-1', rpc: { retos_mis_numeros: numeros } })
  check('menú con cuenta: sin errores', !errores.length, errores.join(' | '))
  check('  …lo de hoy sale de la base: la silueta a la primera, ordenadas en 2, 4 de 5', /A la primera/.test(await page.locator('#rtSiluetaEstado').innerText()) && /Ordenadas en 2/.test(await page.locator('#rtOrdenaEstado').innerText()) && /4 de 5/.test(await page.locator('#rtExpansionEstado').innerText()))
  check('  …la XP de hoy y la racha en la píldora (989)', /\+85 XP/.test(await page.locator('#rtDia').innerText()) && /4 días/.test(await page.locator('#rtDia').innerText()), await page.locator('#rtDia').innerText())
  // El calendario va en el historial plegado (989): se pide al abrirlo.
  await page.click('#rtHistorial summary')
  await page.waitForTimeout(600)
  check('  …y el calendario con las cifras: 30 jugados, mejor racha 9, 2 días perfectos', /30[\s\S]*retos jugados[\s\S]*9[\s\S]*tu mejor racha[\s\S]*2[\s\S]*días perfectos/.test(await page.locator('#rtCalendario').innerText()) && (await page.locator('#rtCalendario .rt-dias .rt-dia.jugado.n2').count()) === 1)
  await ctx.close()
}
{
  // ¿Más caro?: la racha dentro del reto y lo que vale cada acierto.
  const { page, ctx, errores } = await abrir('mas-caro', { local: { 'pokedoc-mas-caro': { dia: hoy, respuestas: [true, true] } } })
  check('Más caro: sin errores', !errores.length, errores.join(' | '))
  check('  …tras dos aciertos, «Racha ×2»', await page.locator('#mcrCombo').isVisible() && /×2/.test(await page.locator('#mcrCombo').innerText()))
  // Ronda 3: A = a3 (15), B = a4 (40): «vale más».
  await page.click('#mcrAcciones [data-respuesta="mas"]')
  await page.waitForTimeout(900)
  check('  …acertar con la racha dice «+6 XP (×2)» y el precio sube hasta el de verdad', /\+6 XP \(×2\)/.test(await page.locator('#mcrVeredicto').innerText()) && /40,00/.test(await page.locator('#mcrB .mcr-precio').innerText()) && /más/.test(await page.locator('#mcrDiferencia').innerText()), await page.locator('#mcrVeredicto').innerText())
  await ctx.close()
}
{
  // ¿Quién es?, con cuenta: un fallo, el acierto, la XP que contesta la base.
  const { page, ctx, errores } = await abrir('quien-es', { sesion: 'admin-1', rpc: GUARDADO(10) })
  check('Quién es: sin errores', !errores.length, errores.join(' | '))
  const buena = qe.pokemonDelDia(hoy)
  check('  …cuatro opciones y la silueta, que vale +30 a la primera (991)', (await page.locator('.qe-opcion').count()) === 4 && /\+30 XP/.test(await page.locator('#qeBote').innerText()) && !(await page.locator('#qeEscena.revelado').count()))
  const mala = qe.opcionesDelDia(hoy).find((d) => d !== buena)
  await page.click(`.qe-opcion[data-dex="${mala}"]`)
  check('  …un fallo se pone en rojo, se apaga, y ahora vale +20 (991)', (await page.locator(`.qe-opcion.fallo[data-dex="${mala}"]`).isDisabled()) && /\+20 XP/.test(await page.locator('#qeBote').innerText()))
  await page.click(`.qe-opcion[data-dex="${buena}"]`)
  await page.waitForTimeout(700)
  check('  …el acierto revela el dibujo y lo dice', (await page.locator('#qeEscena.revelado').count()) === 1 && /¡Es /.test(await page.locator('#qeFinal').innerText()))
  const rpcs = await page.evaluate(() => window.__RPCS__.filter((r) => r.nombre === 'retos_guardar'))
  check('  …se manda a la base: silueta, hoy, 2 intentos, acertada', rpcs.length === 1 && rpcs[0].args.p_juego === 'silueta' && rpcs[0].args.p_dia === hoy && rpcs[0].args.p_intentos === 2 && rpcs[0].args.p_acertada === true, JSON.stringify(rpcs))
  check('  …y enseña la XP que contestó la base', /\+10 XP/.test(await page.locator('#qePremios').innerText()))
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1200)
  check('  …al volver sigue resuelto y no se manda otra vez', (await page.locator('#qeEscena.revelado').count()) === 1 && (await page.evaluate(() => window.__RPCS__.filter((r) => r.nombre === 'retos_guardar').length)) === 0)
  await ctx.close()
}
{
  // Ordena: tocar en orden, comprobar, las buenas se quedan.
  const { page, ctx, errores } = await abrir('ordena-precio')
  check('Ordena: sin errores', !errores.length, errores.join(' | '))
  check('  …cuatro cartas y «Comprobar» apagado hasta tener las cuatro', (await page.locator('.op-carta').count()) === 4 && (await page.locator('#opComprobar').isDisabled()))
  // Bueno: a1 (10), a3 (15), a2 (20), a4 (40). Se dice a1, a2, a3, a4: dos bien.
  for (const id of ['a1', 'a2', 'a3', 'a4']) await page.click(`.op-carta[data-id="${id}"]`)
  check('  …cada carta lleva su número', (await page.$$eval('.op-numero', (ns) => ns.map((n) => n.textContent).join())) === '1,2,3,4')
  await page.click('#opComprobar')
  await page.waitForTimeout(300)
  check('  …tras comprobar, las dos que están en su sitio se quedan fijas', (await page.locator('.op-carta.fija').count()) === 2 && /2 de 4 en su sitio/.test(await page.locator('#opSub').innerText()), await page.locator('#opSub').innerText())
  await page.click('.op-carta[data-id="a3"]')
  await page.click('.op-carta[data-id="a2"]')
  await page.click('#opComprobar')
  await page.waitForTimeout(300)
  check('  …y al acertar: «¡Ordenadas en 2!» con los precios', /¡Ordenadas en 2!/.test(await page.locator('#opFinal').innerText()) && (await page.locator('.op-precio').count()) === 4)
  check('  …sin cuenta, dice cuánto habría dado (+15)', /\+15 XP/.test(await page.locator('#opPremios').innerText()))
  await ctx.close()
}
{
  // ¿De qué expansión?: cinco rondas.
  const { page, ctx, errores } = await abrir('que-expansion', { movil: true })
  check('Expansión: sin errores', !errores.length, errores.join(' | '))
  check('  …cuatro opciones', (await page.locator('.qx-opcion').count()) === 4)
  for (const s of ['gym2', 'gym1', 'gym2', 'gym2', 'gym2']) {
    await page.click(`.qx-opcion[data-set="${s}"]`)
    await page.waitForTimeout(1600)
  }
  check('  …al acabar, «4 de 5» y el repaso de las cinco', /4 de 5/.test(await page.locator('#qxFinal').innerText()) && (await page.locator('.qx-repaso li').count()) === 5 && (await page.locator('.qx-repaso li.si').count()) === 4)
  check('  …y en el móvil no se sale a lo ancho', await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1))
  await page.click('#qxCompartir')
  await page.waitForTimeout(800)
  await page.click('[data-ch-compartir]')
  await page.waitForTimeout(1500)
  const t = (await page.evaluate(() => window.__compartido))?.text || ''
  check('  …el texto compartido: 4/5 y la tira', /4\/5/.test(t) && /🟩🟥🟩🟩🟩/.test(t), t)
  await ctx.close()
}
await browser.close()
console.log(fails ? `\n${fails} FALLOS` : '\nTODO OK')
process.exit(fails ? 1 : 0)
