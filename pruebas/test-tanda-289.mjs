// Tanda 289: una noticia no es una guía, y no la firma nadie.
//
// PINGU, mirando el hilo de actividad: «PINGU ha publicado la guía El
// Binder Collection del 30 aniversario se retrasa hasta diciembre» — y
// era una noticia. Y justo debajo, la misma noticia otra vez porque el
// hilo del foro que abre sola contaba como un tema suyo.
//
// Y la decisión de fondo: una noticia es del SITIO, no de quien la
// teclea. Ni firma, ni avatar, ni cupo de nadie.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 150) : ''}`)
}

// NOTA de la tanda 316: la portada dejó de repetir en «En la comunidad»
// lo que ya está pintado más arriba —la noticia del banner, las cuatro
// guías nuevas y los temas de «Ahora en el foro»—. Así que aquí las
// semillas tienen que dejar SOBRANTES: lo que se mira en el hilo de
// actividad tiene que ser algo que no esté también en pantalla.
const BASE = 'http://localhost:8892'
const browser = await chromium.launch()
const abrir = async (ruta, semillas) => {
  const page = await browser.newPage({ viewport: { width: 1150, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 170)))
  await page.addInitScript((s) => { for (const [k, v] of Object.entries(s)) window[k] = v }, semillas)
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(1800)
  return { page, errores }
}

console.log('\n── 1. Una noticia no se anuncia como una guía ──')
{
  const { page, errores } = await abrir('/', {
    // DOS noticias desde la tanda 316: la más reciente es la del banner
    // de la portada y la actividad ya no la repite, así que la que se
    // mira aquí tiene que ser OTRA. Con una sola, el bloque de actividad
    // se quedaba vacío y se recogía — que es justo lo que la 316 quería.
    __FAKE_NOTICIAS__: [
      { title: 'La del banner, que no se repite' },
      { title: 'El Binder Collection se retrasa hasta diciembre' },
    ],
    __FAKE_GUIAS__: [],
    __FAKE_TEMAS__: [],
  })
  const fila = page.locator('#homeActivityFeed .activity-item').first()
  const texto = (await fila.textContent())?.replace(/\s+/g, ' ').trim()
  check('no dice «ha publicado la guía»', !/publicado la guía/.test(texto || ''), texto)
  // Desde la tanda 312 el tipo va en una CHAPA y no en un «Nueva
  // noticia:» delante del titular — cinco filas seguidas empezaban por
  // lo mismo. Lo que esta prueba defiende no era la frase, era que la
  // fila diga QUÉ es: se comprueba la chapa, que es donde vive ahora.
  check('dice que es una noticia', (await fila.locator('.activity-tipo').count()) === 1, texto)
  check('  …y la chapa lo dice', /^Noticia/i.test((await fila.locator('.activity-tipo').textContent()) || ''), texto)
  check('con el titular', /Binder Collection/.test(texto || ''))
  // El enlace bueno es /noticias/<slug>, no el de guía.
  const href = await fila.locator('a').last().getAttribute('href')
  check('y lleva a la noticia', href === '/noticias/noticia-2', href)
  check('sin errores', errores.length === 0, errores.join(' | '))
  await page.close()
}

console.log('\n── 2. Y no la firma nadie ──')
{
  // Que ponga «PINGU ha publicado» hace que una noticia parezca la
  // opinión de alguien en vez de lo que ha pasado.
  const { page } = await abrir('/', {
    // La primera es la del banner; la segunda, la que se mira aquí.
    __FAKE_NOTICIAS__: [{ title: 'La del banner' }, { title: 'Noticia de prueba' }],
    __FAKE_GUIAS__: [],
    __FAKE_TEMAS__: [],
  })
  const fila = page.locator('#homeActivityFeed .activity-item').first()
  check('no sale el nombre de nadie', (await fila.locator('.activity-name').count()) === 0)
  check('ni su avatar', (await fila.locator('a.activity-avatar').count()) === 0)
  check('sino la marca de la casa', (await fila.locator('.activity-avatar-casa').count()) === 1)
  await page.close()
}

console.log('\n── 3. Una guía SÍ la firma quien la escribe ──')
{
  // Lo de la firma es el pago de escribir una guía: no se toca.
  const { page } = await abrir('/', {
    // CINCO: «Guías nuevas» se queda con cuatro y la quinta es la que
    // llega al hilo de actividad.
    __FAKE_GUIAS__: Array.from({ length: 5 }, (_, i) => ({ title: `Cómo saber si una carta es falsa ${i + 1}` })),
    __FAKE_NOTICIAS__: [],
    __FAKE_TEMAS__: [],
  })
  const fila = page.locator('#homeActivityFeed .activity-item').first()
  const texto = (await fila.textContent())?.replace(/\s+/g, ' ').trim()
  check('sigue diciendo «ha publicado la guía»', /ha publicado la guía/.test(texto || ''), texto)
  check('con el nombre de quien la escribió', (await fila.locator('.activity-name').count()) === 1)
  check('y su avatar', (await fila.locator('a.activity-avatar').count()) === 1)
  const href = await fila.locator('a').last().getAttribute('href')
  // Cuál de las cinco sobra depende del orden del doble; lo que importa
  // es que la fila lleve a la guía y no a otra parte.
  check('y lleva a la guía', /^\/guia\.html\?slug=guia-\d+$/.test(href || ''), href)
  await page.close()
}

console.log('\n── 4. La misma noticia no sale dos veces ──')
{
  // El hilo del foro de una noticia lo abre el mismo botón de publicar:
  // no es un tema que haya abierto nadie. Contarlo aparte llenaba el
  // hilo con la misma noticia dos veces seguidas.
  const { page } = await abrir('/', {
    __FAKE_NOTICIAS__: [
      { title: 'La del banner' },
      { title: 'Se retrasa el Binder Collection', forum_thread_id: 'tema-1' },
    ],
    __FAKE_GUIAS__: [],
    // El hilo va con un id que NO está entre los que pinta «Ahora en el
    // foro»… salvo que sea de los cuatro más nuevos. Como solo hay uno,
    // lo estaría: lo importante aquí es que no salga como tema, y eso se
    // comprueba igual.
    __FAKE_TEMAS__: [{ id: 'tema-1', title: 'Noticia: Se retrasa el Binder Collection' }],
  })
  const filas = await page.locator('#homeActivityFeed .activity-item').allTextContents()
  const juntas = filas.join(' | ').replace(/\s+/g, ' ')
  check('solo una entrada', filas.length === 1, juntas)
  check('y es la de la noticia',
    (await page.locator('#homeActivityFeed .activity-tipo').count()) === 1, juntas)
  check('no la del hilo del foro', !/ha abierto un tema/.test(juntas), juntas)
  await page.close()
}

console.log('\n── 5. La consulta pide lo que hace falta ──')
{
  // El doble devuelve la fila entera mire lo que mire el `select`, así
  // que un `select` al que le falte una columna no se notaría aquí —
  // pero en producción sí: sin `kind` toda noticia volvería a ser una
  // guía, y sin `forum_thread_id` volvería a salir dos veces. El doble
  // apunta las columnas que se le piden, y eso es lo que se mira.
  const { page } = await abrir('/', {
    __FAKE_NOTICIAS__: [{ title: 'Una noticia', forum_thread_id: 'tema-1' }],
    __FAKE_GUIAS__: [],
    __FAKE_TEMAS__: [{ id: 'tema-1', title: 'Noticia: Una noticia' }],
  })
  const pedidas = await page.evaluate(() => window.__CONSULTAS__.columnas.guides || [])
  check('se pide el tipo al listar lo publicado', pedidas.some((c) => /published_at/.test(c) && /\bkind\b/.test(c)), pedidas.join(' | '))
  check('y el hilo que abrió la noticia', pedidas.some((c) => /forum_thread_id/.test(c)), pedidas.join(' | '))
  check('y el tipo también al buscarlas por id', pedidas.some((c) => /^id, title, slug, kind$/.test(c)), pedidas.join(' | '))
  await page.close()
}

console.log('\n── 6. Un tema normal del foro sigue saliendo ──')
{
  const { page } = await abrir('/', {
    __FAKE_NOTICIAS__: [],
    __FAKE_GUIAS__: [],
    // CINCO temas, y el que se mira va el PRIMERO —el doble los siembra
    // del más viejo al más nuevo, y «Ahora en el foro» pinta los cuatro
    // más nuevos—. Y de OTRA persona: el hilo de actividad deja como
    // mucho tres eventos por cabeza para que no lo llene alguien solo,
    // y si los cinco temas fueran del mismo, los tres que sobreviven
    // serían justo los que ya están pintados arriba.
    __FAKE_TEMAS__: [
      { id: 'tema-9', title: '¿Qué mazo llevo al regional?', author_id: 'user-2' },
      ...Array.from({ length: 4 }, (_, i) => ({ id: `tema-${i + 1}`, title: `Tema de relleno ${i + 1}` })),
    ],
  })
  const texto = (await page.locator('#homeActivityFeed').textContent())?.replace(/\s+/g, ' ')
  check('con su persona delante', /ha abierto un tema en el foro/.test(texto || ''), texto)
  check('y su título', /regional/.test(texto || ''))
  await page.close()
}

console.log('\n── 7. La ficha de la noticia tampoco la firma nadie ──')
{
  const { page } = await abrir('/guia?slug=noticia-1', {
    __FAKE_NOTICIAS__: [{ title: 'Se retrasa el Binder Collection' }],
  })
  const firma = (await page.locator('.guide-author').textContent())?.replace(/\s+/g, ' ').trim()
  check('pone «Noticia de PokeDoc»', /Noticia de ?PokeDoc/.test(firma || ''), firma)
  check('y no «Publicada por»', !/Publicada por/.test(firma || ''), firma)
  await page.close()
}

console.log('\n── 8. Una guía sigue llevando su firma ──')
{
  const { page } = await abrir('/guia?slug=guia-1', { __FAKE_GUIAS__: [{ title: 'Una guía cualquiera' }] })
  const firma = (await page.locator('.guide-author').textContent())?.replace(/\s+/g, ' ').trim()
  check('pone quién la publicó', /Publicada por/.test(firma || ''), firma)
  await page.close()
}

await browser.close()
console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
