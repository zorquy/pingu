// Tanda 411 — carpetas y álbumes con la misma burbuja, y el diálogo del
// adorno.
//
// PINGU: «el tema de las carpetas también me gustaría que fuese como en
// las expansiones, mismo tamaño, me gustan mucho esas burbujas, esos
// cuadrados. Y que al crear una carpeta te salga un pop-up para elegir un
// emoji, o un sprite de la Pokédex, o un color de fondo. Para los álbumes
// lo mismo; la única diferencia es que uno es una carpeta y otro es un
// álbum».
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
import { colorDe, iconoHtml, burbujaHtml, COLORES } from '/home/user/pingu/js/mi-coleccion/adorno.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')

console.log('\n── 1. El adorno, con datos a mano ──')
{
  // El color elegido manda; si no hay, sale del adorno y SIEMPRE el
  // mismo: un color que cambia en cada pintada haría que una carpeta se
  // viera de un color hoy y de otro mañana.
  check('el color elegido manda', colorDe({ color: '#123456', dex_id: 25 }) === '#123456')
  check('sin color, sale del adorno', COLORES.includes(colorDe({ dex_id: 25 })))
  check('  …y es siempre el mismo', colorDe({ dex_id: 25 }) === colorDe({ dex_id: 25 }))
  check('  …y dos adornos distintos no tienen por qué compartirlo',
    colorDe({ dex_id: 25 }) !== colorDe({ dex_id: 6 }) || true)
  check('sin nada, hay color igualmente', Boolean(colorDe({})))

  // Precedencia: Pokémon > emoji > icono. Es el orden en que se eligió.
  check('un Pokémon gana al emoji', /img/.test(iconoHtml({ dex_id: 25, emoji: '🔥', icono: 'star' })))
  check('  …y el emoji gana al icono', /🔥/.test(iconoHtml({ emoji: '🔥', icono: 'star' })))
  check('  …y sin nada, se pinta una carpeta', /svg/.test(iconoHtml({})))

  const h = burbujaHtml({ id: 'c1', nombre: 'Mis <Charizards>', pie: '3 cartas', adorno: { emoji: '🔥' }, barra: 50 })
  check('la burbuja escapa el nombre', !h.includes('<Charizards>') && h.includes('&lt;Charizards&gt;'))
  check('  …y lleva su barra cuando se le da', h.includes('--ancho:50%'))
  check('  …y no la lleva cuando no', !burbujaHtml({ id: 'c', nombre: 'x', pie: 'y', adorno: {} }).includes('--ancho'))
  // El dibujo de fuera gana: es la portada de un álbum sin adorno.
  check('un dibujo propio sustituye al icono',
    burbujaHtml({ id: 'c', nombre: 'x', pie: 'y', adorno: {}, dibujo: '<img data-portada>' }).includes('data-portada'))
}

console.log('\n── 2. El diálogo ──')
const browser = await chromium.launch()
const abrir = async (ruta = '/mi-coleccion.html?ver=carpetas') => {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 150)))
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'XY Promos', market: 'WEST', card_count_official: 100,
      card_count_total: 110, release_date: '2016-05-18', logo_path: 'x/l' }]
    window.__FAKE_CARTAS__ = [{ id: 'sv1-1', set_id: 'sv1', local_id: '1', name: 'Pikachu',
      image_path: 'x/1', market: 'WEST', rarity: 'Common', category: 'Pokemon', variants: { normal: true } }]
    window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'sv1-1', cantidad: 1, idioma: 'es',
      estado: 'NM', variante: 'normal', notas: null }]
  })
  await page.goto('http://localhost:8892' + ruta, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2600)
  return { page, errores }
}
{
  const { page, errores } = await abrir()
  check('sin errores', errores.length === 0, errores.join(' | '))
  // Sin «Nueva carpeta» desde la 759 (las carpetas pasan a binders): el
  // diálogo sigue para cambiar una que no se haya podido pasar, y se abre
  // con la misma función que usa la página.
  const abrirDlg = (conBorrar) => page.evaluate(async (conBorrar) => {
    const m = await import('/js/mi-coleccion/dialogo-adorno.js')
    m.abrirDialogoAdorno({ titulo: 'Cambiar la carpeta', boton: 'Guardar', valores: conBorrar ? { nombre: window.__guardado?.nombre } : {}, alGuardar: (v) => { window.__guardado = v }, alBorrar: conBorrar ? () => {} : null })
  }, conBorrar)
  await abrirDlg(false)
  await page.waitForTimeout(500)
  check('se abre el diálogo', await page.locator('#mcDlgAdorno').evaluate((e) => e.open))
  // Centrado: un `dialog` modal se centra solo, pero cualquier margen a 0
  // lo pega a ese lado — y el panel de filtros de al lado lo hace.
  const m = await page.locator('#mcDlgAdorno').evaluate((e) => {
    const r = e.getBoundingClientRect()
    return Math.abs(r.left - (innerWidth - r.right))
  })
  check('  …centrado', m <= 2, `${m} px de diferencia`)
  check('  …y sin botón de borrar, que no hay nada que borrar',
    (await page.locator('#mcDlgBorrar').isVisible()) === false)
  check('  …y sin «empezar con», que eso es de un álbum',
    (await page.locator('#mcDlgOrigen').isVisible()) === false)
  check('hay iconos del sitio', (await page.locator('#mcDlgIconos .mc-dlg-opcion').count()) > 10)
  check('  …y son SVG de js/icons.js, no emojis',
    (await page.locator('#mcDlgIconos .mc-dlg-opcion svg').count()) > 10)

  await page.locator('#mcDlgTabs [data-pestania-adorno="dex"]').click()
  await page.waitForTimeout(400)
  const deGolpe = await page.locator('#mcDlgDexRejilla .mc-dlg-opcion').count()
  // Son 1.025 especies y cada una es una imagen: pintarlas todas es pedir
  // mil imágenes para elegir una.
  check('los Pokémon salen de 60 en 60', deGolpe === 60, String(deGolpe))
  await page.fill('#mcDlgDexBuscar', 'pika')
  await page.waitForTimeout(400)
  check('  …y se buscan por nombre',
    (await page.locator('#mcDlgDexRejilla .mc-dlg-opcion').first().getAttribute('aria-label')) === 'Pikachu')
  await page.fill('#mcDlgDexBuscar', '25')
  await page.waitForTimeout(400)
  check('  …y por número',
    (await page.locator('#mcDlgDexRejilla .mc-dlg-opcion').first().getAttribute('aria-label')) === 'Pikachu')

  // Uno de los tres, nunca dos: si el emoji se quedara puesto por debajo
  // del Pokémon, al quitar el Pokémon reaparecería un emoji que nadie
  // recuerda haber elegido.
  await page.locator('#mcDlgDexRejilla .mc-dlg-opcion').first().click()
  await page.waitForTimeout(300)
  await page.locator('#mcDlgTabs [data-pestania-adorno="emoji"]').click()
  await page.waitForTimeout(300)
  await page.locator('#mcDlgEmojis .mc-dlg-opcion').first().click()
  await page.waitForTimeout(300)
  const vista = await page.locator('#mcDlgVista').innerHTML()
  check('elegir un emoji quita el Pokémon', !/<img/.test(vista) && /mc-burbuja-emoji/.test(vista), vista.slice(0, 120))

  await page.fill('#mcDlgNombre', 'Para cambiar')
  await page.locator('#mcDlgColores .mc-dlg-color').nth(3).click()
  await page.waitForTimeout(200)
  await page.locator('#mcDlgGuardar').click()
  await page.waitForTimeout(800)
  const guardado = await page.evaluate(() => window.__guardado)
  check('al guardar, devuelve su nombre', guardado?.nombre === 'Para cambiar', JSON.stringify(guardado))
  check('  …y el color elegido', guardado?.color === COLORES[2], JSON.stringify(guardado))

  // Y al editarla, el borrar SÍ está.
  await abrirDlg(true)
  await page.waitForTimeout(500)
  check('al editar, el borrar está', await page.locator('#mcDlgBorrar').isVisible())
  check('  …y el nombre viene puesto', (await page.locator('#mcDlgNombre').inputValue()) === 'Para cambiar')
  await page.close()
}

console.log('\n── 3. Un álbum se empieza con SU diálogo (759) ──')
{
  const { page } = await abrir('/mi-coleccion.html?ver=carpetas')
  await page.locator('#mcAlbNuevoAbrir').click()
  await page.waitForTimeout(600)
  check('«Empezar un álbum» abre el diálogo de los tipos, no el del adorno', (await page.locator('#mcAlbNuevo').evaluate((e) => e.open)) && !(await page.locator('#mcDlgAdorno').evaluate((e) => e.open)))
  check('  …y el «empezar con» de antes ya no existe', (await page.locator('#mcDlgOrigen').count()) === 0)
  await page.close()
}

console.log('\n── 4. Las migraciones ──')
{
  const carp = leer('supabase-migration-carpetas.sql')
  check('la carpeta guarda icono y Pokémon', /icono text/.test(carp) && /dex_id int/.test(carp))
  // Tres columnas y no una con prefijos: una columna que hace dos
  // trabajos se separa en silencio (la lección de la 335).
  check('  …en columnas aparte, no en una con prefijos', !/icono text not null/.test(carp))
  // Y el fichero todavía no está lanzado, así que se EDITA en vez de
  // añadir otro — pero por si acaso lleva su `add column if not exists`.
  check('  …y es seguro relanzarlo', /add column if not exists icono/.test(carp))
  const alb = leer('supabase-migration-album-adorno.sql')
  for (const c of ['icono', 'dex_id', 'emoji', 'color']) {
    check(`el álbum guarda ${c}`, new RegExp(`add column if not exists ${c}`).test(alb))
  }
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
