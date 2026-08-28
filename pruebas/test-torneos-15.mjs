import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'

// Tanda 221: el repaso de interfaz en móvil. Tres cosas que PINGU vio en
// su teléfono y que aquí se vigilan solas:
//   1. nada se sale del ancho de la pantalla (320–430 px),
//   2. la lista de Inscritos son COLUMNAS de verdad (las chapas de todas
//      las filas empiezan en la misma x, no cada una donde le pilla),
//   3. la tabla de mesas no obliga a arrastrar de lado: en móvil cada
//      mesa es una tarjeta con su etiqueta delante de cada dato.

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + extra : ''}`)
}

const BASE = 'http://localhost:8892'
const ANCHOS = [320, 360, 390, 430]
const browser = await chromium.launch()

const abrir = async (ruta, ancho, semillas = {}) => {
  const page = await browser.newPage({ viewport: { width: ancho, height: 800 } })
  await page.addInitScript((s) => {
    if (s.sesion) window.__FAKE_SESSION__ = s.sesion
    if (s.torneos) window.__FAKE_TORNEOS__ = s.torneos
    if (s.inscripciones) window.__FAKE_INSCRIPCIONES__ = s.inscripciones
    if (s.rondas) window.__FAKE_RONDAS__ = s.rondas
    if (s.mesas) window.__FAKE_MESAS__ = s.mesas
  }, semillas)
  await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2400)
  return page
}
const ir = async (page, pestana) => {
  await page.locator(`[data-pestana="${pestana}"]`).click()
  await page.waitForTimeout(400)
}

// Nombres largos a propósito: si algo se sale, se sale con estos.
const SEMILLA = {
  torneos: [{
    slug: 'movil', name: 'Copa de Interfaz Movil Con Nombre Largo', status: 'in_progress',
    max_players: 16, swiss_rounds: 4, top_cut_size: 4, round_time_minutes: 30, checkin_minutes: 5,
  }],
  inscripciones: ['admin-1', 'user-1', 'user-2', 'user-3'].map((u, i) => ({
    id: `i-${i}`, tournament_id: 'torneo-1', user_id: u,
    tcg_live_username: `NombreDeTCGLiveLargisimo_${u}`, registered_at: `2026-08-2${i}T10:00:00Z`,
  })),
  rondas: [{ id: 'ronda-1', tournament_id: 'torneo-1', round_number: 1, phase: 'swiss', status: 'active' }],
  mesas: [
    { id: 'mesa-1', round_id: 'ronda-1', table_number: 1, player_a_id: 'admin-1', player_b_id: 'user-1', status: 'active' },
    { id: 'mesa-2', round_id: 'ronda-1', table_number: 2, player_a_id: 'user-2', player_b_id: 'user-3', status: 'active' },
  ],
}

// El desbordamiento se mide donde de verdad duele: el documento entero.
// Se devuelve además el culpable más externo, para que el fallo diga qué
// arreglar y no solo que algo falla.
const desborde = (page) =>
  page.evaluate(() => {
    const doc = document.documentElement
    const ancho = doc.clientWidth
    const culpables = []
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || getComputedStyle(el).position === 'fixed') continue
      if (r.right > ancho + 1 || r.left < -1) {
        if (culpables.some((c) => c.contains(el))) continue
        culpables.push(el)
      }
    }
    return {
      scroll: doc.scrollWidth > ancho + 1,
      ancho,
      scrollWidth: doc.scrollWidth,
      culpables: culpables.slice(0, 3).map((e) => `${e.tagName.toLowerCase()}.${e.className || '-'}`),
    }
  })

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Nada se sale de la pantalla, en ningún ancho ──')
for (const ancho of ANCHOS) {
  const page = await abrir('/torneo?slug=movil', ancho, SEMILLA)
  const pestanas = await page.$$eval('[data-pestana]', (bs) => bs.map((b) => b.dataset.pestana))
  check(`${ancho}px · la ficha tiene pestañas`, pestanas.length >= 3, JSON.stringify(pestanas))
  for (const pestana of pestanas) {
    await ir(page, pestana)
    const d = await desborde(page)
    check(`${ancho}px · pestaña ${pestana} sin scroll lateral`, !d.scroll, `${d.scrollWidth}>${d.ancho} · ${d.culpables.join(', ')}`)
  }
  await page.close()

  const lista = await abrir('/torneos', ancho, SEMILLA)
  const dl = await desborde(lista)
  check(`${ancho}px · /torneos sin scroll lateral`, !dl.scroll, `${dl.scrollWidth}>${dl.ancho} · ${dl.culpables.join(', ')}`)
  await lista.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Inscritos: columnas de verdad, no cada fila a su aire ──')
{
  const page = await abrir('/torneo?slug=movil', 390, SEMILLA)
  await ir(page, 'torneo')
  const xs = await page.evaluate(() =>
    [...document.querySelectorAll('.torneo-inscrito:not(.torneo-inscrito-cola)')].map((fila) => {
      const chapa = fila.querySelector('.torneo-decklist-marca')
      const r = chapa && chapa.getBoundingClientRect()
      return r && r.width > 0 ? Math.round(r.left) : null
    })
  )
  const conChapa = xs.filter((x) => x !== null)
  check('hay chapas de decklist que comparar', conChapa.length >= 2, JSON.stringify(xs))
  check('todas empiezan en la misma x', new Set(conChapa).size === 1, JSON.stringify(conChapa))

  // Y ninguna fila se sale por la derecha del panel que la contiene.
  const fuera = await page.evaluate(() =>
    [...document.querySelectorAll('.torneo-inscrito')].filter((f) => {
      const p = f.parentElement.getBoundingClientRect()
      return f.getBoundingClientRect().right > p.right + 1
    }).length
  )
  check('ninguna fila se sale de su panel', fuera === 0, `${fuera} filas`)
  await page.close()

  const pc = await abrir('/torneo?slug=movil', 1200, SEMILLA)
  await ir(pc, 'torneo')
  const columnas = await pc.evaluate(() => {
    const lee = (sel) =>
      [...document.querySelectorAll('.torneo-inscrito:not(.torneo-inscrito-cola)')]
        .map((f) => {
          const el = f.querySelector(sel)
          const r = el && el.getBoundingClientRect()
          return r && r.width > 0 ? Math.round(r.left) : null
        })
        .filter((x) => x !== null)
    return { chapas: lee('.torneo-decklist-marca'), botones: lee('button') }
  })
  check('en PC las chapas comparten vertical', columnas.chapas.length >= 2 && new Set(columnas.chapas).size === 1, JSON.stringify(columnas.chapas))
  check('en PC los botones comparten vertical', columnas.botones.length >= 2 && new Set(columnas.botones).size === 1, JSON.stringify(columnas.botones))
  await pc.close()

  // Una fila con DOS chapas (decklist + paso 2, lo que ve el organizador
  // antes de la R1): en móvil las dos se apilan pegadas al margen, no
  // una a cada lado.
  const dos = await abrir('/torneo?slug=dos', 390, {
    torneos: [{ slug: 'dos', name: 'Copa Dos Chapas', status: 'registration_open', max_players: 8, swiss_rounds: 3 }],
    inscripciones: ['user-1', 'user-2'].map((u, i) => ({
      id: `d-${i}`, tournament_id: 'torneo-1', user_id: u, tcg_live_username: `TCG_${u}`,
      status: 'active', participation_confirmed_at: null, registered_at: `2026-08-2${i}T10:00:00Z`,
    })),
  })
  await ir(dos, 'torneo')
  const apiladas = await dos.evaluate(() =>
    [...document.querySelectorAll('.torneo-inscrito:not(.torneo-inscrito-cola)')].map((f) =>
      [...f.querySelectorAll('.torneo-decklist-marca')]
        .map((c) => c.getBoundingClientRect())
        .filter((r) => r.width > 0)
        .map((r) => Math.round(r.left))
    )
  )
  const conDos = apiladas.filter((xs) => xs.length >= 2)
  check('hay filas con dos chapas que mirar', conDos.length >= 1, JSON.stringify(apiladas))
  check('las dos chapas se apilan en la misma columna', conDos.every((xs) => new Set(xs).size === 1), JSON.stringify(conDos))
  await dos.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Mesas: tarjetas con etiqueta en móvil, tabla en PC ──')
{
  const page = await abrir('/torneo?slug=movil', 390, SEMILLA)
  await ir(page, 'rondas')
  const movil = await page.evaluate(() => {
    const td = document.querySelector('.torneo-mesa-num')
    if (!td) return null
    const tabla = td.closest('table')
    return {
      etiquetas: [...td.closest('tr').querySelectorAll('td')].map((c) => c.dataset.etiqueta || ''),
      apilado: getComputedStyle(td).display !== 'table-cell',
      cabeceraOculta: getComputedStyle(tabla.querySelector('thead')).display === 'none',
      tablaCabe: tabla.scrollWidth <= tabla.clientWidth + 1,
    }
  })
  check('las mesas se pintan', movil !== null)
  check('cada dato lleva su etiqueta', movil && movil.etiquetas.filter(Boolean).length >= 4, JSON.stringify(movil?.etiquetas))
  check('las celdas se apilan', movil && movil.apilado)
  check('la cabecera de la tabla se esconde', movil && movil.cabeceraOculta)
  check('la tabla no pide arrastrar de lado', movil && movil.tablaCabe)
  await page.close()

  const pc = await abrir('/torneo?slug=movil', 1200, SEMILLA)
  await ir(pc, 'rondas')
  const escritorio = await pc.evaluate(() => {
    const td = document.querySelector('.torneo-mesa-num')
    return td ? { celda: getComputedStyle(td).display, cabecera: getComputedStyle(td.closest('table').querySelector('thead')).display } : null
  })
  check('en escritorio sigue siendo una tabla', escritorio && escritorio.celda === 'table-cell' && escritorio.cabecera !== 'none', JSON.stringify(escritorio))
  await pc.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. La ficha nunca enseña «undefined» ──')
{
  // Un torneo al que le faltan columnas (una fila vieja de la base o un
  // select recortado): la caja de formato tiene que salir con números.
  const page = await abrir('/torneo?slug=pelado', 390, {
    torneos: [{ slug: 'pelado', name: 'Copa Pelada', status: 'registration_open', max_players: 8, swiss_rounds: 3 }],
  })
  const formato = await page.locator('#torneoFormato').innerText()
  check('sin «undefined» en la caja de formato', !/undefined/i.test(formato), formato.replace(/\n/g, ' · '))
  check('el check-in cae al valor por defecto', /Check-in\s*5 min/i.test(formato), formato.replace(/\n/g, ' · '))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. El repaso no es solo de torneos ──')
{
  // El barrido del sitio encontró otros dos sitios que se salían a
  // 320px: la portada (la firma de «Ahora en el foro», con nowrap y sin
  // recorte) y el 404 (su caja medía lo que pedían sus topes).
  for (const [nombre, ruta] of [['portada', '/'], ['404', '/no-existe-de-verdad']]) {
    const page = await browser.newPage({ viewport: { width: 320, height: 800 } })
    await page.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(2000)
    const d = await desborde(page)
    check(`320px · ${nombre} sin scroll lateral`, !d.scroll, `${d.scrollWidth}>${d.ancho} · ${d.culpables.join(', ')}`)
    await page.close()
  }
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. Las tarjetas de /torneos no se estrujan ──')
{
  // Este fallo NO es un desborde —la página cabía— sino lo contrario:
  // las chapas, con nowrap, se quedaban con el ancho y al título le
  // dejaban cuatro píxeles, así que caía una palabra por línea.
  const SEMILLA_LISTA = {
    torneos: [
      { id: 'torneo-1', slug: 'api', name: 'torneo api', status: 'cancelled', max_players: 16, swiss_rounds: 4, top_cut_size: 4, start_at: '2026-08-30T22:19:00Z' },
    ],
    inscripciones: [{ id: 'i-1', tournament_id: 'torneo-1', user_id: 'admin-1', status: 'dropped', tcg_live_username: 'TCG' }],
  }
  for (const ancho of [320, 390]) {
    const page = await abrir('/torneos', ancho, SEMILLA_LISTA)
    const t = await page.evaluate(() => {
      const tarjeta = document.querySelector('.torneo-tarjeta')
      if (!tarjeta) return null
      const texto = tarjeta.querySelector('.torneo-texto')
      const titulo = tarjeta.querySelector('.torneo-texto strong')
      const chapas = tarjeta.querySelector('.torneo-tarjeta-chapas')
      const alturaLinea = parseFloat(getComputedStyle(titulo).lineHeight) || 20
      return {
        anchoTarjeta: Math.round(tarjeta.getBoundingClientRect().width),
        anchoTexto: Math.round(texto.getBoundingClientRect().width),
        lineasTitulo: Math.round(titulo.getBoundingClientRect().height / alturaLinea),
        chapasDebajo: chapas ? chapas.getBoundingClientRect().top >= texto.getBoundingClientRect().bottom - 1 : false,
        chapasDentro: chapas ? chapas.getBoundingClientRect().right <= tarjeta.getBoundingClientRect().right + 1 : false,
        // Contar filas por el `top` EXACTO no vale: una chapa y un botón
        // de la misma fila se alinean al centro y difieren dos o tres
        // píxeles, y una sola fila parecía tres. Se agrupa con
        // tolerancia de media chapa.
        filasDeChapas: chapas
          ? [...chapas.children]
              .map((c) => c.getBoundingClientRect())
              .sort((a, b) => a.top - b.top)
              .reduce((filas, r) => {
                const ultima = filas[filas.length - 1]
                if (!ultima || r.top - ultima > r.height / 2) filas.push(r.top)
                return filas
              }, []).length
          : 0,
      }
    })
    check(`${ancho}px · la tarjeta se pinta`, t !== null)
    check(`${ancho}px · el texto se lleva más de la mitad`, t && t.anchoTexto > t.anchoTarjeta * 0.55, JSON.stringify(t))
    check(`${ancho}px · el título cabe en dos líneas`, t && t.lineasTitulo <= 2, `${t?.lineasTitulo} líneas`)
    check(`${ancho}px · las chapas bajan a su propia fila`, t && t.chapasDebajo, JSON.stringify(t))
    check(`${ancho}px · las chapas no se salen de la tarjeta`, t && t.chapasDentro, JSON.stringify(t))
    check(`${ancho}px · y no se desparraman en más de dos filas`, t && t.filasDeChapas >= 1 && t.filasDeChapas <= 2, `${t?.filasDeChapas} filas`)
    await page.close()
  }

  const pc = await abrir('/torneos', 1200, SEMILLA_LISTA)
  const fila = await pc.evaluate(() => {
    const tarjeta = document.querySelector('.torneo-tarjeta')
    const texto = tarjeta.querySelector('.torneo-texto').getBoundingClientRect()
    const chapas = tarjeta.querySelector('.torneo-tarjeta-chapas').getBoundingClientRect()
    return { alado: chapas.left >= texto.right - 1 }
  })
  check('en PC las chapas siguen al lado del texto', fila.alado, JSON.stringify(fila))
  await pc.close()
}

await browser.close()
console.log(fails ? `\n✘ ${fails} fallos` : '\n✔ todo verde')
process.exit(fails ? 1 : 0)
