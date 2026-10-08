// Tanda 477 — dentro de una carpeta se ve como dentro de una expansión.
//
// PINGU: «yo quizá mejoraría visualmente el apartado de carpetas porque se
// ve un poco pocho. Lo haría… como tiene Dex… las carpetas tienen
// subcarpetas… el menú de cada carpeta es lo mismo que una colección».
//
// Las subcarpetas ya existían (tanda 411) — lo que faltaba era la
// PANTALLA: dentro de una carpeta no había ni título, ni menú, ni
// buscador, y «Nueva carpeta» era un botón azul suelto que, estando
// dentro, creaba una SUBcarpeta sin que ninguna palabra lo dijera.
//
// Y una cosa que esta tanda arregla de paso, más gorda de lo que parece:
// **el doble de Supabase no tenía carpetas**. `listarCarpetas` daba un
// 42P01, el cliente lo lee como «falta la migración» y la pestaña salía
// vacía en TODAS las pruebas. O sea que esta pantalla no la había probado
// nadie nunca, y nada lo cantaba porque el vacío es un estado legítimo de
// ella.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}
const BASE = process.env.PD_BASE || 'http://localhost:8892'
const browser = await chromium.launch()

const abrir = async (ancho = 390) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 1100 }, hasTouch: ancho < 600, isMobile: ancho < 600 })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 180)))
  await page.route('**assets.tcgdex.net/**', (r) => r.abort())
  await page.route('**limitlesstcg**', (r) => r.abort())
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'Escarlata y Púrpura', serie_id: 'sv', market: 'WEST',
      card_count_official: 6, card_count_total: 6, logo_path: 'x/l' }]
    const NOMBRES = ['Pikachu', 'Charizard', 'Bulbasaur', 'Squirtle', 'Eevee', 'Snorlax']
    window.__FAKE_CARTAS__ = NOMBRES.map((n, i) => ({
      id: `sv1-${i + 1}`, market: 'WEST', set_id: 'sv1', local_id: String(i + 1), name: n,
      image_path: `x/${i + 1}`, rarity: 'Rare', category: 'Pokemon', variants: { normal: true },
    }))
    window.__FAKE_COLECCION__ = window.__FAKE_CARTAS__.map((c, i) => ({
      id: `l${i}`, card_id: c.id, market: 'WEST', cantidad: 1, idioma: 'es', estado: 'NM',
      variante: 'normal', created_at: new Date().toISOString(),
    }))
    // Desde la 759 las carpetas pasan a binders solas; lo de aquí es lo que
    // queda cuando NO se puede (la base no deja crear el álbum: la RLS
    // devuelve vacío sin error). Entonces las carpetas se quedan, y tienen
    // que verse y abrirse como siempre.
    window.__SIN_PERMISO__ = ['user_albums']
    // Una carpeta con una SUBcarpeta dentro y tres cartas, que es el caso
    // que la pantalla tiene que saber contar.
    window.__FAKE_CARPETAS__ = [
      { id: 'f1', nombre: 'Vintage', parent_id: null, icono: 'star', orden: 0 },
      { id: 'f2', nombre: 'Base Set', parent_id: 'f1', icono: 'cards', orden: 0 },
      { id: 'f3', nombre: 'Mis Charizards', parent_id: null, icono: 'flame', orden: 1 },
    ]
    window.__FAKE_CARPETA_CARTAS__ = [
      { folder_id: 'f1', line_id: 'l0' }, { folder_id: 'f1', line_id: 'l1' },
      { folder_id: 'f2', line_id: 'l2' },
    ]
  })
  await page.goto(`${BASE}/mi-coleccion.html?ver=carpetas`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3400)
  return { page, errores }
}

const { page, errores } = await abrir()

console.log('── 1. La lista de carpetas ──')
check('sin errores', errores.length === 0, errores.join(' | '))
check('salen las dos de primer nivel', (await page.locator('#mcCarpetasPanel [data-abrir]').count()) === 2,
  String(await page.locator('#mcCarpetasPanel [data-abrir]').count()))
// «Nueva carpeta» es una chapa, no un botón azul: es un mando más, y un
// `btn-primary` solo en una pantalla dice «esto es lo que hay que hacer
// aquí», que no es verdad cuando ya tienes carpetas.
// 759: no se crean carpetas, y si no se han podido pasar no se borran.
check('sin «Nueva carpeta»: lo que se crea son álbumes', (await page.locator('#mcCarpetaNueva').count()) === 0)
check('  …y las carpetas siguen en la base', (await page.evaluate(() => window.__TABLAS__.collection_folders.length)) === 3)
check('fuera no hay ni título ni buscador',
  (await page.locator('#mcCarpetaBarra').isHidden()) && (await page.locator('#mcCarpetaBuscadorCaja').isHidden()))
// El resumen cuenta lo de la carpeta Y lo de sus subcarpetas: una carpeta
// que solo contiene carpetas no está vacía.
const pieVintage = await page.locator('#mcCarpetasPanel [data-abrir="f1"]').textContent()
check('«Vintage» dice que tiene una subcarpeta', /1 subcarpeta/.test(pieVintage), pieVintage.replace(/\s+/g, ' '))
check('  …y cuenta también las cartas de dentro', /3 cartas/.test(pieVintage), pieVintage.replace(/\s+/g, ' '))

console.log('\n── 2. Dentro se ve como una expansión ──')
await page.click('#mcCarpetasPanel [data-abrir="f1"]')
await page.waitForTimeout(1000)
check('la miga dice de dónde vienes', (await page.locator('#mcCarpetaVolver').textContent()).trim() === 'Álbumes')
// Forma CORTA: el nombre lo dice el título grande de debajo, y repetirlo
// en la miga era decir lo mismo dos veces en dos renglones seguidos.
check('  …y no repite el nombre', (await page.locator('#mcCarpetaMigas .mc-miga-aqui').count()) === 0)
check('el título es el de la carpeta', (await page.locator('#mcCarpetaTitulo').textContent()) === 'Vintage')
check('hay buscador', await page.locator('#mcCarpetaBuscadorCaja').isVisible())
// Dentro, lo que se crea es una SUBcarpeta y eso vive en el ⋮: dos
// botones que crean cosas distintas con el mismo rótulo es justo cómo se
// pulsa el que no era.
check('sale la subcarpeta', (await page.locator('#mcCarpetasPanel [data-abrir="f2"]').count()) === 1)
check('y las dos cartas de la carpeta', (await page.locator('#mcCarpetaCartas .mc-carta').count()) === 2,
  String(await page.locator('#mcCarpetaCartas .mc-carta').count()))

console.log('\n── 3. El ⋮ de la carpeta ──')
const menu = page.locator('#mcCarpetaMenu')
check('empieza cerrado', (await menu.evaluate((n) => n.open)) === false)
await page.click('#mcCarpetaMenu > summary')
await page.waitForTimeout(400)
const opciones = await page.locator('#mcCarpetaMenu .mc-menu-opcion').allTextContents()
check('tiene una opción (sin «Nueva subcarpeta» desde la 759)', opciones.length === 1, JSON.stringify(opciones))
check('  …con su nombre escrito', /Cambiar la carpeta/.test(opciones[0]),
  JSON.stringify(opciones))
// El cierre va por CLASE desde esta tanda: antes colgaba del
// identificador del menú de una expansión, así que este se habría quedado
// abierto para siempre.
await page.click('#mcCarpetaEditar')
await page.waitForTimeout(500)
check('al elegir, se cierra', (await menu.evaluate((n) => n.open)) === false)
check('  …y abre el diálogo de cambiar', await page.locator('#mcDlgAdorno').isVisible())
check('  …con el nombre de ESTA carpeta', (await page.inputValue('#mcDlgNombre')) === 'Vintage',
  await page.inputValue('#mcDlgNombre'))
await page.click('#mcDlgCancelar')
await page.waitForTimeout(400)

console.log('\n── 4. El buscador filtra lo de dentro ──')
await page.fill('#mcCarpetaBuscar', 'Charizard')
await page.waitForTimeout(600)
check('queda una', (await page.locator('#mcCarpetaCartas .mc-carta').count()) === 1,
  String(await page.locator('#mcCarpetaCartas .mc-carta').count()))
await page.fill('#mcCarpetaBuscar', 'Mewtwo')
await page.waitForTimeout(600)
check('sin resultados no queda ninguna', (await page.locator('#mcCarpetaCartas .mc-carta').count()) === 0)
// Y el vacío DICE CUÁL de los dos vacíos es: una carpeta sin cartas no es
// lo mismo que una búsqueda sin resultados, y la frase de la primera
// mandaba a la ficha de una carta cuando el problema era lo escrito.
const vacio = await page.locator('#mcCarpetaCartas').textContent()
check('  …y lo dice con las palabras de una búsqueda', /encaja con lo que buscas/.test(vacio), vacio.trim().slice(0, 90))

console.log('\n── 5. Al salir se olvida lo buscado ──')
// Un filtro que sobrevive a la pantalla que lo puso deja la siguiente
// medio vacía sin decir por qué.
await page.click('#mcCarpetaVolver')
await page.waitForTimeout(800)
check('vuelve a la lista', (await page.locator('#mcCarpetasPanel [data-abrir]').count()) === 2)
await page.click('#mcCarpetasPanel [data-abrir="f1"]')
await page.waitForTimeout(1000)
check('al volver a entrar, el buscador está vacío', (await page.inputValue('#mcCarpetaBuscar')) === '')
check('  …y están las dos cartas otra vez', (await page.locator('#mcCarpetaCartas .mc-carta').count()) === 2)

console.log('\n── 6. Los bloques no se pegan ──')
// No se pisaban, pero sin un hueco entre ellos se leen como una sola cosa
// revuelta, que es exactamente lo que PINGU llama «pocho».
const huecos = await page.evaluate(() => {
  const r = (s) => document.querySelector(s)?.getBoundingClientRect()
  const b = r('#mcCarpetasPanel .mc-burbujas')
  const c = r('#mcCarpetaCartas')
  const a = r('#mcBloqueAlbumes')
  return { burbujasACartas: Math.round(c.top - b.bottom), cartasAAlbumes: Math.round(a.top - c.bottom) }
})
check('entre las subcarpetas y las cartas', huecos.burbujasACartas >= 12, JSON.stringify(huecos))
check('y entre las cartas y los álbumes', huecos.cartasAAlbumes >= 12, JSON.stringify(huecos))

console.log('\n── 7. Sin errores ──')
check('ninguno', errores.length === 0, errores.join(' | '))
await page.close()
await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
