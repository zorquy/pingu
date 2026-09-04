import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { contarPalmares, hitosMerecidos, siguienteHito, esLogroDeTorneo, HITOS } from '/home/user/pingu/js/torneos/palmares.js'

// Tanda 262: medallas de torneo por HITOS y la vitrina del perfil.
//
// De donde viene: PINGU vio en su perfil «Torneos jugados: 1Podio»,
// pegado y sin forma de chapa. Eran dos cosas — un separador que
// faltaba y, la de fondo, que las reglas de esas chapas vivían en
// css/torneos.css, que la ficha de una persona NO carga.
//
// Y la decisión de producto: medallas por hitos acumulados (cinco
// torneos, tres campeonatos) y no una por cada torneo, que con veinte
// al año no distingue a nadie.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Contar el palmarés ──')
{
  const t = (podium) => ({ podium })
  const yo = 'user-1'
  check('sin torneos, todo a cero',
    JSON.stringify(contarPalmares([], yo)) === JSON.stringify({ jugados: 0, podios: 0, campeonatos: 0 }))
  // El primer puesto es CAMPEONATO y no cuenta además como podio: si no,
  // un campeón se llevaría las dos medallas por lo mismo.
  const campeon = contarPalmares([t([yo, 'otro', 'otro2'])], yo)
  check('ganar cuenta como campeonato', campeon.campeonatos === 1, JSON.stringify(campeon))
  check('y NO también como podio', campeon.podios === 0, JSON.stringify(campeon))
  const segundo = contarPalmares([t(['otro', yo])], yo)
  check('ser segundo es podio', segundo.podios === 1 && segundo.campeonatos === 0, JSON.stringify(segundo))
  const fuera = contarPalmares([t(['a', 'b', 'c'])], yo)
  check('quedar fuera del podio solo suma jugado', fuera.jugados === 1 && fuera.podios === 0 && fuera.campeonatos === 0, JSON.stringify(fuera))
  // Un torneo sin podio congelado (se terminó antes de la tanda 217)
  // sigue contando como jugado en vez de tirar el conteo entero.
  const sinPodio = contarPalmares([{ id: 'x' }, t([yo])], yo)
  check('un torneo sin podio no rompe la cuenta', sinPodio.jugados === 2 && sinPodio.campeonatos === 1, JSON.stringify(sinPodio))
}

console.log('\n── 2. Qué hitos toca dar ──')
{
  check('con un torneo, solo Competidor',
    JSON.stringify(hitosMerecidos({ jugados: 1 })) === JSON.stringify(['torneo_jugado']))
  const cinco = hitosMerecidos({ jugados: 5 })
  check('con cinco llega Veterano', cinco.includes('torneo_veterano'), cinco.join(', '))
  check('pero todavía no «De la casa»', !cinco.includes('torneo_habitual'), cinco.join(', '))
  check('con diez sí', hitosMerecidos({ jugados: 10 }).includes('torneo_habitual'))
  // Los acumulados NO sustituyen a los de antes: quien llega a diez
  // conserva Competidor y Veterano, que es lo que hace que la vitrina
  // cuente una historia en vez de un solo icono.
  const diez = hitosMerecidos({ jugados: 10 })
  check('y se conservan los anteriores', diez.includes('torneo_jugado') && diez.includes('torneo_veterano'), diez.join(', '))

  check('un podio da su medalla', hitosMerecidos({ jugados: 1, podios: 1 }).includes('torneo_podio'))
  check('un campeonato da la corona', hitosMerecidos({ jugados: 1, campeonatos: 1 }).includes('torneo_campeon'))
  check('tres campeonatos dan Tricampeón', hitosMerecidos({ jugados: 3, campeonatos: 3 }).includes('torneo_tricampeon'))
  check('dos todavía no', !hitosMerecidos({ jugados: 2, campeonatos: 2 }).includes('torneo_tricampeon'))
  check('el top cut es aparte del podio', hitosMerecidos({ jugados: 1, topCut: true }).includes('torneo_top_cut'))
  check('y sin él no se da', !hitosMerecidos({ jugados: 1 }).includes('torneo_top_cut'))
  check('sin haber jugado nada, ninguna', hitosMerecidos({}).length === 0, hitosMerecidos({}).join(', '))
}

console.log('\n── 3. Lo que falta para el siguiente ──')
{
  const con3 = siguienteHito({ jugados: 3 })
  check('con tres torneos, faltan dos para Veterano', con3?.id === 'torneo_veterano' && con3.faltan === 2, JSON.stringify(con3))
  const con9 = siguienteHito({ jugados: 9 })
  check('con nueve, uno para «De la casa»', con9?.id === 'torneo_habitual' && con9.faltan === 1, JSON.stringify(con9))
  check('sin ninguno, el primero', siguienteHito({ jugados: 0 })?.id === 'torneo_jugado')
  check('con diez ya no queda ninguno', siguienteHito({ jugados: 10 }) === null)
  // Solo mira los de PARTICIPAR: los podios y los campeonatos no se
  // pueden prometer, así que no se ofrecen como meta.
  check('los podios no salen de meta', siguienteHito({ jugados: 10, podios: 0 }) === null)
}

console.log('\n── 4. Separar los logros de torneo del resto ──')
{
  check('los de torneo se reconocen', HITOS.every((h) => esLogroDeTorneo(h.id)))
  check('y los del foro no se cuelan', !esLogroDeTorneo('foro_charlatan'))
  check('ni un id vacío', !esLogroDeTorneo('') && !esLogroDeTorneo(null))
}

// ═════════════════════════════════════════════════════════════════════
// La vitrina, ya en el navegador
// ═════════════════════════════════════════════════════════════════════
const BASE = 'http://localhost:8892'
const browser = await chromium.launch()

const LOGROS = [
  { id: 'torneo_jugado', title: 'Competidor', description: 'Jugaste un torneo hasta el final.', emoji: 'medal', rarity: 'bronze' },
  { id: 'torneo_podio', title: 'Al podio', description: 'Terminaste entre los tres primeros.', emoji: 'medal', rarity: 'silver' },
  { id: 'torneo_campeon', title: 'Campeón de torneo', description: 'Ganaste un torneo.', emoji: 'crown', rarity: 'gold' },
  { id: 'torneo_veterano', title: 'Veterano', description: 'Cinco torneos.', emoji: 'star', rarity: 'silver' },
  { id: 'foro_charlatan', title: 'Charlatán', description: 'Cien mensajes.', emoji: 'messageSquare', rarity: 'bronze' },
]
const TORNEOS = [
  { id: 't1', slug: 'copa', name: 'Copa', status: 'finished', podium: ['user-2', 'user-1', 'user-3'] },
  { id: 't2', slug: 'dos', name: 'Segunda', status: 'finished', podium: ['user-1', 'user-2'] },
]
const INSC = [
  { id: 'i1', tournament_id: 't1', user_id: 'user-1', status: 'active' },
  { id: 'i2', tournament_id: 't2', user_id: 'user-1', status: 'active' },
]

const abrir = async (ruta, semillas = {}) => {
  const page = await browser.newPage({ viewport: { width: 900, height: 800 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 170)))
  await page.addInitScript((s) => {
    for (const [k, v] of Object.entries(s)) window[k] = v
  }, semillas)
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2200)
  return { page, errores }
}

console.log('\n── 5. La vitrina en la ficha de alguien ──')
{
  const { page, errores } = await abrir('/usuario?u=Ash', {
    __FAKE_SESSION__: 'user-2', __FAKE_LOGROS__: LOGROS, __FAKE_TORNEOS__: TORNEOS, __FAKE_INSCRIPCIONES__: INSC,
  })
  check('sin errores de JavaScript', errores.length === 0, errores[0] || '')
  // Ash tiene tres logros de torneo (los siembra el doble) y uno de foro.
  check('salen sus tres medallas', (await page.locator('.palmares-medalla').count()) === 3, String(await page.locator('.palmares-medalla').count()))
  const titulos = await page.locator('.palmares-medalla').evaluateAll((ns) => ns.map((n) => n.getAttribute('title')))
  check('cada una dice qué es y cómo se gana', titulos.every((t) => /—/.test(t || '')), JSON.stringify(titulos))
  check('el logro del FORO no se cuela', !titulos.some((t) => /Charlatán/.test(t || '')), JSON.stringify(titulos))
  check('ni una que no ha ganado', !titulos.some((t) => /Veterano/.test(t || '')), JSON.stringify(titulos))
  // El oro se distingue del bronce sin leer: es media gracia de la vitrina.
  check('la corona va marcada como oro', (await page.locator('.palmares-medalla.rarity-gold').count()) === 1)

  // Y ahora lo que de verdad falló la primera vez: que los estilos
  // LLEGUEN. Las chapas de antes tenían sus reglas escritas... en
  // css/torneos.css, que esta página no carga. La clase estaba puesta y
  // no se veía nada. Así que se mira el estilo calculado, no la clase.
  const forma = await page.locator('.palmares-medalla').first().evaluate((n) => {
    const s = getComputedStyle(n)
    return { radio: s.borderRadius, ancho: s.width }
  })
  check('la medalla tiene forma (llega el CSS)', forma.radio !== '0px' && forma.ancho !== 'auto', JSON.stringify(forma))
  // Y el ORO en concreto: con «alguna se ve distinta» bastaba con que la
  // plata cambiara, y la corona podía quedarse igual que el bronce.
  const pinta = (sel) =>
    page.locator(sel).first().evaluate((n) => {
      const s = getComputedStyle(n)
      return `${s.borderColor}|${s.backgroundColor}`
    })
  const oro = await pinta('.palmares-medalla.rarity-gold')
  const bronce = await pinta('.palmares-medalla.rarity-bronze')
  const plata = await pinta('.palmares-medalla.rarity-silver')
  check('la corona de oro no se ve como el bronce', oro !== bronce, `oro=${oro} bronce=${bronce}`)
  check('ni la plata', plata !== bronce, `plata=${plata} bronce=${bronce}`)
  await page.close()
}

console.log('\n── 6. El resumen de debajo ──')
{
  const { page } = await abrir('/usuario?u=Ash', {
    __FAKE_SESSION__: 'user-2', __FAKE_LOGROS__: LOGROS, __FAKE_TORNEOS__: TORNEOS, __FAKE_INSCRIPCIONES__: INSC,
  })
  const texto = await page.locator('.torneo-palmares').innerText()
  // El fallo que lo empezó todo: «Torneos jugados: 1Podio», pegado.
  check('se lee con separadores', /2 torneos · 1 campeonato · 1 podio/.test(texto), JSON.stringify(texto))
  check('y dice qué falta para la siguiente', /a 3 de Veterano/.test(texto), JSON.stringify(texto))
  check('y no hay nada pegado', !/\d[A-Za-zÁÉÍÓÚÑáéíóúñ]/.test(texto), JSON.stringify(texto))
  await page.close()
}

console.log('\n── 6b. Y cabe en una línea, también en el móvil ──')
{
  // Estuvo dentro de la columna del nombre, que en un móvil comparte
  // sitio con el avatar de 96 px: el resumen se partía en TRES renglones
  // y las medallas salían descolgadas en el centro. Y estuvo dentro de
  // .profile-hero-body, que en escritorio no hace wrap: ahí aplastaba la
  // columna del nombre hasta dejarlo en vertical, una letra por línea.
  for (const [donde, ancho] of [['móvil', 393], ['escritorio', 1100]]) {
    const page = await browser.newPage({ viewport: { width: ancho, height: 900 } })
    await page.addInitScript((s) => {
      for (const [k, v] of Object.entries(s)) window[k] = v
    }, { __FAKE_SESSION__: 'user-2', __FAKE_LOGROS__: LOGROS, __FAKE_TORNEOS__: TORNEOS, __FAKE_INSCRIPCIONES__: INSC })
    await page.goto(`${BASE}/usuario?u=Ash`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2200)
    const alto = (sel) => page.locator(sel).first().evaluate((n) => n.getBoundingClientRect().height)
    // Una línea de texto de 13-14 px mide unos 20. Se admiten DOS en un
    // móvil de 393 px —con cuatro datos y ese ancho, partir una vez es
    // razonable—; lo que no se admite es lo de antes: tres renglones
    // rompiendo «campeonato» y dejando «Veterano» solo en el último.
    check(`${donde}: el resumen no pasa de dos renglones`, (await alto('.torneo-palmares')) < 50, String(await alto('.torneo-palmares')))
    // Y el nombre sigue siendo un nombre y no una columna de letras: con
    // «Ash» en vertical el <h2> medía más de 100 px de alto.
    check(`${donde}: el nombre no se pone en vertical`, (await alto('.profile-hero-info h2')) < 40, String(await alto('.profile-hero-info h2')))
    // La fila del palmarés va DEBAJO del bloque del avatar, no dentro.
    const fuera = await page.evaluate(() => !document.querySelector('.profile-hero-body .palmares-fila'))
    check(`${donde}: la fila va fuera del bloque del avatar`, fuera)
    await page.close()
  }
}

console.log('\n── 7. Quien no ha jugado ningún torneo ──')
{
  const { page, errores } = await abrir('/usuario?u=Misty', {
    __FAKE_SESSION__: 'user-1', __FAKE_LOGROS__: LOGROS, __FAKE_TORNEOS__: TORNEOS, __FAKE_INSCRIPCIONES__: INSC,
  })
  check('sin errores', errores.length === 0, errores[0] || '')
  check('no sale vitrina', (await page.locator('.palmares-medalla').count()) === 0)
  check('ni resumen vacío', (await page.locator('.torneo-palmares').count()) === 0)
  await page.close()
}

await browser.close()
console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
