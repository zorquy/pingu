// Tanda 376 — los intercambios: donde le ganamos a HoloNook.
//
// Su propio tutorial dice «HoloNook no tiene chat: los cambios se hablan
// por fuera» y te manda a X o a Instagram. PokeDoc tiene foro y mensajes
// propios, así que el cambio se cierra DENTRO — y eso es lo único que no
// se puede copiar de una tarde.
//
// Tres cosas que esta prueba mira y no supone:
//   · La DOBLE COINCIDENCIA (los dos tenéis algo del otro) va primero, y
//     va marcada. Es la única que se cierra de un mensaje.
//   · Se agrupa por PERSONA y no por carta: seis cartas de alguien son
//     un mensaje, no seis.
//   · «No has apuntado nada» y «no hay nadie» son dos estados distintos
//     y la pantalla dice cuál es (la lección de la 319).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

// Desde la 645 los campos de «Tu copia» arrancan PLEGADOS detrás de
// «Editar»: antes de tocar uno hay que desplegarlos (leerlos no hace falta).
async function desplegarCopia(page) {
  const b = page.locator('#mcEdEditar')
  if ((await b.count()) && (await b.isVisible()) && (await b.getAttribute('aria-expanded')) !== 'true') {
    await b.click()
    await page.waitForTimeout(150)
  }
}


let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 240) : ''}`)
}
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')
const BASE = 'http://localhost:8892'
const limpio = (t) => String(t || '').replace(/\s+/g, ' ').trim()
const browser = await chromium.launch()

const CARTA = '<svg xmlns="http://www.w3.org/2000/svg" width="245" height="342"><rect width="245" height="342" fill="#f7d354"/></svg>'

const PERFILES = [
  { id: 'admin-1', username: 'pingu', display_name: 'Pingu' },
  { id: 'user-2', username: 'bea', display_name: 'Bea' },
  { id: 'user-3', username: 'carlos', display_name: 'Carlos' },
]

async function abrir({ coleccion = [], deseos = [], pestania = 'cambios' } = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1200 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 220)))
  await page.route('**/assets.tcgdex.net/**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: CARTA }))
  await page.route('**/api.tcgdex.net/**', (r) => r.fulfill({ contentType: 'application/json', body: '{}' }))
  await page.addInitScript(([perfiles, col, des]) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_PERFILES__ = perfiles
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'Escarlata y Púrpura', market: 'WEST', serie_id: 'sv', serie_name: 'Escarlata y Púrpura', tcg_online_code: 'SVI', card_count_official: 10 }]
    window.__FAKE_CARTAS__ = [...Array(6)].map((_, i) => ({
      id: `sv1-${i + 1}`, set_id: 'sv1', local_id: String(i + 1),
      name: `Carta ${i + 1}`, name_es: `Carta ${i + 1}`, name_search: `carta ${i + 1}`,
      image_path: `x/${i + 1}`, market: 'WEST', rarity: 'Rare',
    }))
    window.__FAKE_COLECCION__ = col
    window.__FAKE_DESEOS__ = des
  }, [PERFILES, coleccion, deseos])
  await page.goto(`${BASE}/mi-coleccion.html?ver=${pestania}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2800)
  return { page, errores }
}

const linea = (o) => ({
  id: o.id, user_id: o.user_id, card_id: o.card_id, market: 'WEST',
  idioma: o.idioma || 'es', estado: o.estado || 'NM', variante: o.variante || 'normal',
  cantidad: o.cantidad ?? 1, cambio: o.cambio ?? 0, gradeo: null,
  valor_manual: null, precio_compra: null, notas: null,
  created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
})
const deseo = (o) => ({
  id: o.id, user_id: o.user_id, card_id: o.card_id,
  idioma: o.idioma ?? null, prioridad: o.prioridad ?? 1, notas: null,
  created_at: new Date().toISOString(),
})

console.log('\n── 1. La doble coincidencia va primero y va marcada ──')
{
  // Yo doy la 1 y busco la 2.
  // BEA da la 2 y busca la 1 → RECÍPROCO.
  // CARLOS da la 2 y no busca nada mío → no recíproco.
  const { page, errores } = await abrir({
    coleccion: [
      linea({ id: 'm1', user_id: 'admin-1', card_id: 'sv1-1', cantidad: 3, cambio: 2 }),
      linea({ id: 'b1', user_id: 'user-2', card_id: 'sv1-2', cantidad: 4, cambio: 3 }),
      linea({ id: 'c1', user_id: 'user-3', card_id: 'sv1-2', cantidad: 2, cambio: 1 }),
    ],
    deseos: [
      deseo({ id: 'd1', user_id: 'admin-1', card_id: 'sv1-2', prioridad: 3 }),
      deseo({ id: 'd2', user_id: 'user-2', card_id: 'sv1-1' }),
    ],
  })
  check('sin errores', errores.length === 0, errores.join(' | '))
  const gente = page.locator('.mc-cambio-bloque').first().locator('.mc-cambio-persona')
  check('salen las dos personas que la dan', (await gente.count()) === 2, String(await gente.count()))
  check('la recíproca va PRIMERA', /Bea/.test(limpio(await gente.first().textContent())),
    limpio(await gente.first().textContent()).slice(0, 80))
  check('  …y lleva su chapa', (await gente.first().locator('.mc-chapa-reciproco').count()) === 1)
  check('  …y la otra no', (await gente.nth(1).locator('.mc-chapa-reciproco').count()) === 0,
    limpio(await gente.nth(1).textContent()).slice(0, 80))
  // Y el marco se ve de verdad, no solo la chapa: se mide el borde.
  const borde = await gente.first().evaluate((e) => getComputedStyle(e).borderTopColor)
  const bordeOtra = await gente.nth(1).evaluate((e) => getComputedStyle(e).borderTopColor)
  check('  …y se distingue en el marco', borde !== bordeOtra, `${borde} vs ${bordeOtra}`)

  // Y arriba se dice cuántas hay, que es lo que hace volver.
  check('la cabecera cuenta los cambios directos', /1 cambio directo/.test(limpio(await page.locator('.mc-cambio-cab').textContent())),
    limpio(await page.locator('.mc-cambio-cab').textContent()).slice(0, 140))

  // Y la otra dirección: Bea busca lo que doy.
  const buscan = page.locator('.mc-cambio-bloque').nth(1).locator('.mc-cambio-persona')
  check('la otra dirección también sale', (await buscan.count()) === 1, String(await buscan.count()))
  check('  …con Bea', /Bea/.test(limpio(await buscan.first().textContent())))
  await page.close()
}

console.log('\n── 2. Se agrupa por PERSONA, no por carta ──')
{
  // Bea da CUATRO cartas que busco. Eso es una tarjeta y un mensaje, no
  // cuatro: un cambio se habla con una persona.
  const { page } = await abrir({
    coleccion: [1, 2, 3, 4].map((n) => linea({ id: `b${n}`, user_id: 'user-2', card_id: `sv1-${n}`, cantidad: 2, cambio: 1 })),
    deseos: [1, 2, 3, 4].map((n) => deseo({ id: `d${n}`, user_id: 'admin-1', card_id: `sv1-${n}` })),
  })
  const gente = page.locator('.mc-cambio-bloque').first().locator('.mc-cambio-persona')
  check('una sola tarjeta', (await gente.count()) === 1, String(await gente.count()))
  check('  …con las cuatro cartas dentro', (await gente.first().locator('.mc-cambio-carta').count()) === 4,
    String(await gente.first().locator('.mc-cambio-carta').count()))
  check('  …y lo dice', /4 cartas que buscas/.test(limpio(await gente.first().textContent())),
    limpio(await gente.first().textContent()).slice(0, 120))
  check('  …y un solo botón de escribir', (await gente.first().locator('[data-escribir]').count()) === 1)
  await page.close()
}

console.log('\n── 3. El mensaje se deja ESCRITO, no enviado ──')
{
  const { page } = await abrir({
    coleccion: [linea({ id: 'b1', user_id: 'user-2', card_id: 'sv1-2', cantidad: 2, cambio: 1 })],
    deseos: [deseo({ id: 'd1', user_id: 'admin-1', card_id: 'sv1-2' })],
  })
  await page.locator('[data-escribir]').first().click()
  await page.waitForTimeout(1800)
  // Lleva a los mensajes de la casa —no a X ni a Instagram— con el
  // borrador puesto y SIN enviar.
  check('lleva a los mensajes de PokeDoc', /\/mensajes\.html/.test(page.url()), page.url())
  const caja = page.locator('#msgBody')
  const texto = await caja.inputValue().catch(() => '')
  check('  …con el mensaje ya escrito', /He visto que das estas cartas/.test(texto), texto.slice(0, 120))
  check('  …nombrando la carta', /Carta 2/.test(texto), texto.slice(0, 160))
  check('  …y sin enviarlo', (await page.locator('.mensaje, .msg-mine, [data-mensaje]').count()) === 0)
  // Y `texto` se quita de la dirección: recargar no puede volver a
  // plantar el borrador encima de lo que estuvieras escribiendo.
  check('  …y la dirección se limpia', !/texto=/.test(page.url()), page.url())
  await page.close()
}

console.log('\n── 4. «No has apuntado nada» no es «no hay nadie» ──')
{
  // Sin deseos y sin dar nada: la pantalla tiene que decir QUÉ hacer, no
  // «no hay nadie» (que sería mentira y encima desanima).
  const { page } = await abrir({ coleccion: [linea({ id: 'm1', user_id: 'admin-1', card_id: 'sv1-1', cantidad: 3 })] })
  const t = limpio(await page.locator('#mcCambiosPanel').textContent())
  // La 415 cambió CÓMO se dice —tres pasos en vez de dos tablones
  // vacíos—, pero lo que se comprueba es lo mismo: que dice qué hacer y
  // no «no hay nadie», que sería mentira y encima desanima.
  check('sin lista de búsqueda, se dice qué hacer', /Apunta lo que buscas/.test(t), t.slice(0, 160))
  check('  …y sin dar nada, también', /Marca lo que das/.test(t), t.slice(0, 300))
  check('  …y no se dice «no hay nadie»', !/Todavía no hay nadie/.test(t), t.slice(0, 200))
  await page.close()
}

console.log('\n── 5. Con lista pero sin nadie enfrente, ahí sí ──')
{
  const { page } = await abrir({
    coleccion: [linea({ id: 'm1', user_id: 'admin-1', card_id: 'sv1-1', cantidad: 3, cambio: 2 })],
    deseos: [deseo({ id: 'd1', user_id: 'admin-1', card_id: 'sv1-2' })],
  })
  const t = limpio(await page.locator('#mcCambiosPanel').textContent())
  check('ahora sí se dice que no hay nadie', /Todavía no hay nadie que dé lo que buscas/.test(t), t.slice(0, 200))
  check('  …y lo que das sale listado', /das 2 de 3/.test(t), t.slice(0, 400))
  await page.close()
}

console.log('\n── 6. El idioma: «me da igual» no es «en español» ──')
{
  // Busco la 2 EN ESPAÑOL. Bea la da en inglés → no casa. Carlos en
  // español → casa. Es la diferencia que decide si el cambio sirve.
  const { page } = await abrir({
    coleccion: [
      linea({ id: 'b1', user_id: 'user-2', card_id: 'sv1-2', idioma: 'en', cantidad: 2, cambio: 1 }),
      linea({ id: 'c1', user_id: 'user-3', card_id: 'sv1-2', idioma: 'es', cantidad: 2, cambio: 1 }),
    ],
    deseos: [deseo({ id: 'd1', user_id: 'admin-1', card_id: 'sv1-2', idioma: 'es' })],
  })
  const gente = page.locator('.mc-cambio-bloque').first().locator('.mc-cambio-persona')
  check('solo sale quien la tiene en el idioma que busco', (await gente.count()) === 1, String(await gente.count()))
  check('  …y es Carlos', /Carlos/.test(limpio(await gente.first().textContent())),
    limpio(await gente.first().textContent()).slice(0, 80))
  check('  …con sus señas', /Español · Near Mint/.test(limpio(await gente.first().textContent())),
    limpio(await gente.first().textContent()).slice(0, 160))
  await page.close()
}

console.log('\n── 7. Apuntar y quitar una carta de la lista ──')
{
  const { page, errores } = await abrir({ coleccion: [linea({ id: 'm1', user_id: 'admin-1', card_id: 'sv1-1', cantidad: 1 })] })
  await page.fill('#mcDeseoBuscar', 'carta 3')
  await page.waitForTimeout(900)
  check('el buscador encuentra la carta', (await page.locator('[data-desear]').count()) > 0,
    String(await page.locator('[data-desear]').count()))
  await page.locator('[data-desear]').first().click()
  await page.waitForTimeout(1400)
  check('se apunta', (await page.locator('.mc-deseos .mc-fila-carta').count()) === 1,
    String(await page.locator('.mc-deseos .mc-fila-carta').count()))
  check('  …con su prioridad', (await page.locator('.mc-deseo-prioridad').count()) === 1)
  check('  …y diciendo que la ve todo el mundo',
    /la ve todo el mundo/.test(limpio(await page.locator('#mcCambiosPanel').textContent())))

  // Y no se puede apuntar dos veces la misma: el buscador la enseña
  // desactivada en vez de esconderla, que haría pensar que no existe.
  await page.fill('#mcDeseoBuscar', 'carta 3')
  await page.waitForTimeout(900)
  const b = page.locator('[data-desear]').first()
  check('  …y no se apunta dos veces', await b.isDisabled(), await b.textContent())
  check('  …diciendo por qué', /Ya la buscas/.test(limpio(await b.textContent())), limpio(await b.textContent()))

  await page.locator('[data-quitar-deseo]').first().click()
  await page.waitForTimeout(1200)
  check('y se quita', (await page.locator('.mc-deseos .mc-fila-carta').count()) === 0)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('\n── 7b. En el móvil, el nombre de la carta se lee ──')
{
  // La fila de un deseo lleva TRES cosas a la derecha —prioridad, idioma
  // y quitar— y en 390 px no caben con el nombre al lado: el nombre se
  // encogía A CERO y la fila quedaba con una miniatura y un desplegable,
  // sin decir de qué carta hablaba. `min-width: 0` no lo evita, porque
  // ese es el mínimo de la caja y lo que se pasa de rosca es el REPARTO
  // (la lección de la 320). Se MIDE, que es la otra mitad de esa
  // lección: un punto de corte elegido a ojo es una afirmación sobre un
  // ancho que nadie ha medido.
  const movil = await browser.newPage({ viewport: { width: 390, height: 1400 } })
  await movil.route('**/assets.tcgdex.net/**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: CARTA }))
  await movil.addInitScript((perfiles) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_PERFILES__ = perfiles
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'Escarlata y Púrpura', market: 'WEST', serie_id: 'sv', serie_name: 'Escarlata y Púrpura' }]
    window.__FAKE_CARTAS__ = [...Array(4)].map((_, i) => ({
      id: `sv1-${i + 1}`, set_id: 'sv1', local_id: String(i + 1),
      name: `Carta ${i + 1}`, name_es: `Carta ${i + 1}`, image_path: `x/${i}`, market: 'WEST',
    }))
    window.__FAKE_COLECCION__ = []
    window.__FAKE_DESEOS__ = [{ id: 'd1', user_id: 'admin-1', card_id: 'sv1-2', idioma: null, prioridad: 3, notas: null, created_at: new Date().toISOString() }]
  }, PERFILES)
  await movil.goto(`${BASE}/mi-coleccion.html?ver=cambios`, { waitUntil: 'domcontentloaded' })
  await movil.waitForTimeout(2800)
  const ancho = await movil.locator('.mc-deseos .mc-fila-nombre').first().evaluate((e) => Math.round(e.getBoundingClientRect().width))
  check('el nombre de la carta no se encoge a nada', ancho > 120, `${ancho}px`)
  const caja = await movil.evaluate(() => ({ doc: document.documentElement.scrollWidth, ventana: window.innerWidth }))
  check('  …y nada se sale de la pantalla', caja.doc <= caja.ventana + 1, JSON.stringify(caja))
  await movil.close()
}

console.log('\n── 8. «De esas, doy» va en la línea, no en una lista aparte ──')
{
  const { page, errores } = await abrir({
    coleccion: [linea({ id: 'm1', user_id: 'admin-1', card_id: 'sv1-1', cantidad: 3 })],
    pestania: 'cartas',
  })
  await page.locator('.mc-carta-foto').first().click()
  await page.waitForTimeout(600)
  check('el editor tiene el campo', (await page.locator('#mcEdCambio').count()) === 1)
  await desplegarCopia(page)
  await page.fill('#mcEdCambio', '2')
  // Ya no hay botón de guardar (tanda 397): se guarda solo al cambiar el
  // campo. `fill` no dispara `change`, así que se manda a mano — es lo
  // que hace el navegador al salir del campo.
  await page.locator('#mcEdCambio').dispatchEvent('change')
  await page.waitForTimeout(1200)
  // Y se cierra a mano: guardar ya no la cierra —no hay nada que
  // confirmar—, así que la ficha se queda delante tapando la rejilla.
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  // Y no se pueden dar más copias de las que tienes: el tope se recorta
  // en el cliente para no dar un error feo, y en la base porque la API
  // está abierta.
  await page.locator('.mc-carta-foto').first().click()
  await page.waitForTimeout(600)
  check('se guardó', (await page.locator('#mcEdCambio').inputValue()) === '2',
    await page.locator('#mcEdCambio').inputValue())
  await desplegarCopia(page)
  await page.fill('#mcEdCambio', '99')
  // Ya no hay botón de guardar (tanda 397): se guarda solo al cambiar el
  // campo. `fill` no dispara `change`, así que se manda a mano — es lo
  // que hace el navegador al salir del campo.
  await page.locator('#mcEdCambio').dispatchEvent('change')
  await page.waitForTimeout(1200)
  // Y se cierra a mano: guardar ya no la cierra —no hay nada que
  // confirmar—, así que la ficha se queda delante tapando la rejilla.
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  await page.locator('.mc-carta-foto').first().click()
  await page.waitForTimeout(600)
  check('  …y no se dan más de las que tienes', (await page.locator('#mcEdCambio').inputValue()) === '3',
    await page.locator('#mcEdCambio').inputValue())
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('\n── 9. En la colección de otra persona no hay pestaña de cambios ──')
{
  // Los cambios son de QUIEN MIRA, no de la colección que se mira: las
  // dos RPC van contra `auth.uid()` y «quién encaja conmigo» no
  // significa nada en la página de otro.
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })
  await page.route('**/assets.tcgdex.net/**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: CARTA }))
  await page.addInitScript((perfiles) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_PERFILES__ = perfiles.map((p) => ({ ...p, coleccion_publica: true }))
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'Escarlata y Púrpura', market: 'WEST' }]
    window.__FAKE_CARTAS__ = []
    window.__FAKE_COLECCION__ = []
  }, PERFILES)
  await page.goto(`${BASE}/mi-coleccion.html?u=bea`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  check('la pestaña no se ve', !(await page.locator('[data-pestania="cambios"]').isVisible()))
  await page.close()
}

console.log('\n── 10. Lo que da la base y lo que se enseña ──')
{
  const sql = leer('supabase-migration-intercambios.sql')
  // Lo que pagaste por una carta NO sale del tablón. Una política sobre
  // la tabla entera lo habría soltado sin que se note: por eso el tablón
  // sale de funciones que devuelven columnas contadas.
  const cuerpoFunciones = sql.slice(sql.indexOf('intercambios_quien_tiene'))
  check('el tablón no devuelve lo que pagaste', !/precio_compra/.test(cuerpoFunciones))
  check('  …ni el valor que le pusiste', !/valor_manual/.test(cuerpoFunciones))
  check('  …ni tus notas', !/\bnotas\b/.test(cuerpoFunciones))
  // Y las políticas de la colección NO se tocan: lo que se abre es el
  // tablón, no la tabla.
  check('las políticas de la colección no se tocan', !/policy .*user_collection/.test(sql),
    (sql.match(/policy [a-z_]*user_collection[a-z_]*/) || [])[0])
  // Un baneado no sale en ninguna de las tres.
  check('un baneado no sale en el tablón', (sql.match(/is_banned/g) || []).length >= 3,
    String((sql.match(/is_banned/g) || []).length))
  // Y la copia de lo que doy sigue siendo UNA: una tabla nueva sería el
  // mismo dato dos veces.
  check('lo que doy es una columna, no una tabla', /add column if not exists cambio/.test(sql))
  check('  …y no existe una tabla de lo que doy', !/create table.*user_trades|create table.*user_offers/.test(sql))
}

console.log('\n── 11. El aviso de «alguien da una carta que buscas» ──')
{
  // Es lo que hace volver: sin él el tablón solo funciona si te acuerdas
  // de entrar a mirarlo, y nadie se acuerda.
  const sql = leer('supabase-migration-intercambios.sql')
  check('hay un disparador que avisa', /create trigger intercambios_avisar/.test(sql))
  // Va en la BASE y no en el navegador: quien marca «doy dos» no puede
  // escribir en las notificaciones de otro, y si lo mandara el
  // navegador se perdería al cerrar la pestaña antes de tiempo.
  check('  …y es de la base, no del cliente',
    !/trade_match/.test(leer('js/mi-coleccion.js')) && !/trade_match/.test(leer('js/mi-coleccion/cambios.js')))

  // Solo cuando `cambio` PASA de 0 a algo: subir de 2 a 3 copias no es
  // una noticia, y avisar de cada ajuste convierte la campanita en ruido.
  check('solo salta al EMPEZAR a dar una carta', /coalesce\(old\.cambio, 0\) > 0/.test(sql))
  // Un tope, porque una carta que buscan 500 personas metería 500 filas
  // en un solo cambio del campo.
  check('  …con tope de destinatarios', /limit 25/.test(sql))
  // Y sin duplicar: la misma persona puede tener la carta apuntada dos
  // veces (una «en español» y otra «me da igual»), y sin el `distinct`
  // le llegaban DOS avisos de un solo clic.
  check('  …y un aviso por persona, no por deseo', /distinct on \(w\.user_id\)/.test(sql))
  // Se puede apagar. Un aviso que no se puede apagar es el que hace que
  // la gente apague todos.
  check('  …y se puede apagar', /notification_prefs_disabled/.test(sql) &&
    /trade_match: /.test(leer('js/notifications.js')))
}

await browser.close()
console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
