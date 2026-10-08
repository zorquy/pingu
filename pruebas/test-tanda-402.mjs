// Tanda 402 — carpetas para ordenar tu colección.
//
// PINGU, enseñando Dex: «carpetas, y dentro de las carpetas otras
// subcarpetas, para ordenar tu colección por carpetas o lo que quieras
// hacer, listas distintas o lo que sea».
//
// Lo que esta prueba mira y no supone:
//   · Que el árbol no PIERDE carpetas. Una huérfana —madre borrada a
//     medias— se cuelga de la raíz en vez de desaparecer: una carpeta
//     que no se ve es una carpeta que no se puede recuperar.
//   · Que no se puede ofrecer un ciclo. La base lo rechaza, pero
//     ofrecerlo en un desplegable es ofrecer un error.
//   · Que la base impide el ciclo a UNO y a DOS saltos, y que borrar una
//     carpeta NO se lleva las cartas.
//   · Y que «no tienes carpetas» y «las carpetas no están activadas» son
//     mensajes distintos: lo primero se arregla creando una, lo segundo
//     ejecutando un SQL.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')

console.log('\n── 1. El árbol, sin navegador ──')
{
  const { arbolDeCarpetas, madresPosibles, hondura } =
    await import('/home/user/pingu/js/mi-coleccion/carpetas.js')
  const cs = [
    { id: 'a', parent_id: null, nombre: 'Vintage', orden: 1 },
    { id: 'b', parent_id: 'a', nombre: 'XY', orden: 0 },
    { id: 'c', parent_id: 'b', nombre: 'Full Art', orden: 0 },
    { id: 'd', parent_id: null, nombre: 'Modern', orden: 0 },
    { id: 'e', parent_id: 'no-existe', nombre: 'Huérfana', orden: 0 },
  ]
  const t = arbolDeCarpetas(cs)
  check('se anidan', t.find((x) => x.id === 'a')?.hijas.map((h) => h.id).join() === 'b')
  check('y hondo', t.find((x) => x.id === 'a')?.hijas[0].hijas.map((h) => h.id).join() === 'c')
  check('se ordenan por su orden', t.map((x) => x.id).slice(0, 2).join() === 'd,e', t.map((x) => x.id).join())
  // Una huérfana no puede desaparecer: sin verla no se puede ni borrar.
  check('una huérfana se cuelga de la raíz', t.some((x) => x.id === 'e'))

  // Ni ella misma ni sus descendientes: ofrecerlas sería ofrecer un error.
  const madres = madresPosibles(cs, 'a').map((x) => x.id).sort().join()
  check('no se ofrece como madre de sí misma ni de sus hijas', madres === 'd,e', madres)
  check('la hondura sirve para la sangría', hondura(cs, 'c') === 2, String(hondura(cs, 'c')))
}

console.log('\n── 2. Lo que impide la base ──')
{
  const sql = leer('supabase-migration-carpetas.sql')
  // Un `check` no vale: solo ve la fila que se escribe, y esto hay que
  // mirarlo SUBIENDO por el árbol.
  check('hay un disparador contra los ciclos', /create trigger collection_folders_sin_ciclos/.test(sql))
  check('  …que sube por los padres', /while v_padre is not null loop/.test(sql))
  // Si ya hubiera un ciclo de antes, el bucle no terminaría nunca.
  check('  …con tope, por si ya hubiera un ciclo', /v_vueltas > 50/.test(sql))
  // Borrar una carpeta se lleva sus hijas, pero NO las cartas: una carta
  // vive en tu colección, no en la carpeta.
  check('las hijas caen con la madre',
    /parent_id uuid references public\.collection_folders \(id\) on delete cascade/.test(sql))
  check('y el contenido es una tabla aparte', /create table if not exists public\.collection_folder_cards/.test(sql))
  // El dueño del contenido se mira a TRAVÉS de la carpeta: así no hay una
  // segunda copia del user_id que pueda decir otra cosa.
  check('la política mira el dueño por la carpeta',
    /exists \(select 1 from public\.collection_folders f where f\.id = folder_id and f\.user_id = auth\.uid\(\)\)/.test(sql))
  // Y el grant, que es lo que costó la tanda 388.
  check('carpetas_resumen se le da a quien tiene sesión',
    /grant execute on function public\.carpetas_resumen\(\) to authenticated/.test(sql))
}

console.log('\n── 3. En la pantalla ──')
{
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1280, height: 1000 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 160)))
  await page.addInitScript(() => {
    window.__FAKE_SETS__ = [{ id: 'sv1', name: 'SV', market: 'WEST',
      card_count_official: 2, card_count_total: 2, release_date: '2023-01-01' }]
    window.__FAKE_CARTAS__ = [{ id: 'sv1-1', set_id: 'sv1', local_id: '1', name: 'A',
      image_path: 'x/1', market: 'WEST', variants: { normal: true } }]
    window.__FAKE_COLECCION__ = [{ id: 'l1', card_id: 'sv1-1', cantidad: 1, idioma: 'es', estado: 'nueva', variante: 'normal' }]
  })
  await page.goto('http://localhost:8892/mi-coleccion.html?ver=carpetas', { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(3000)
  check('sin errores', errores.length === 0, errores.join(' | '))
  // El `?ver=` tiene su lista de pestañas permitidas: una pestaña nueva
  // que no esté en ella no se abre por enlace y el panel se queda
  // escondido, sin dar error.
  check('el enlace directo abre la pestaña',
    !(await page.locator('#mcPanelCarpetas').getAttribute('class'))?.includes('hidden'))
  const texto = (await page.locator('#mcCarpetasPanel').textContent())?.replace(/\s+/g, ' ') || ''
  // Desde la 759 no hay sección de carpetas (PINGU: «es mejor dejar solo
  // álbumes»): sin ninguna, este hueco no dice nada y lo de abajo son los
  // álbumes, con su «Empezar un álbum».
  check('sin carpetas, el hueco no dice nada (las carpetas se fueron, 759)', texto.trim() === '', texto.slice(0, 120))
  // Y NO dice «no están activadas», que es otra cosa: eso se arregla
  // ejecutando un SQL y lo otro creando una carpeta.
  check('  …y no lo confunde con «no están activadas»', !/no están activadas/.test(texto))
  check('ni botón de crear carpetas: lo que se empieza es un álbum', (await page.locator('#mcCarpetaNueva').count()) === 0 && (await page.locator('#mcAlbNuevoAbrir').count()) === 1)
  await browser.close()
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
