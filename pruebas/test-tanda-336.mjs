// Tanda 336 — las marcas de regulación, desde /admin.
//
// Las marcas legales de Estándar viven en `site_settings` y **rotan cada
// abril**. Hasta ahora solo se podían cambiar desde el SQL Editor: un
// ajuste que hay que tocar una vez al año y que no tiene pantalla se
// queda viejo sin que nada dé error, y el síntoma es de los peores que
// hay — la web diciéndole a alguien que un mazo legal no lo es.
//
// Así que la pantalla no solo deja cambiarlas: CANTA cuando ha pasado un
// abril desde la última vez, y cuenta cuántas cartas quedarían legales
// antes de guardar, para que una letra mal escrita se vea aquí y no en
// el mazo de alguien.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const BASE = 'http://localhost:8892'
const limpio = (t) => String(t || '').replace(/\s+/g, ' ').trim()
const browser = await chromium.launch()

// Cartas con marca, para que la cuenta tenga algo que contar.
const CARTAS = [
  { id: 'a-1', set_id: 's1', market: 'WEST', local_id: '1', name: 'Una', regulation_mark: 'H' },
  { id: 'a-2', set_id: 's1', market: 'WEST', local_id: '2', name: 'Dos', regulation_mark: 'I' },
  { id: 'a-3', set_id: 's1', market: 'WEST', local_id: '3', name: 'Tres', regulation_mark: 'I' },
  { id: 'a-4', set_id: 's1', market: 'WEST', local_id: '4', name: 'Cuatro', regulation_mark: 'D' },
  // Y una del catálogo JAPONÉS con marca legal. Sin ella, quitar el
  // filtro de mercado no cambiaría el número y la prueba no vería nada:
  // el rigor lo cantó. Los catálogos asiáticos son otra cosa y no
  // pueden inflar la cuenta que se mira para decidir.
  { id: 'jp-1', set_id: 's1', market: 'JP', local_id: '1', name: 'Japonesa', regulation_mark: 'H' },
]

async function admin(ajustes) {
  const page = await browser.newPage({ viewport: { width: 1250, height: 900 } })
  const errores = []
  page.on('pageerror', (e) => errores.push(String(e).slice(0, 170)))
  await page.addInitScript((d) => {
    window.__FAKE_SESSION__ = 'admin-1'
    window.__FAKE_SETS__ = [{ id: 's1', name: 'Un set', market: 'WEST' }]
    window.__FAKE_CARTAS__ = d.cartas
    window.__FAKE_AJUSTES__ = d.ajustes
  }, { cartas: CARTAS, ajustes })
  await page.goto(`${BASE}/admin/`, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(2000)
  // La tarjeta vive en la sección «Cartas», que nace escondida: sin
  // abrirla, `fill` no puede escribir en un campo invisible.
  await page.locator('[data-section="cards"]').click()
  await page.waitForTimeout(400)
  return { page, errores }
}

const haceUnAno = new Date(Date.now() - 400 * 86400000).toISOString()
const ayer = new Date(Date.now() - 86400000).toISOString()

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Se ven, y se dice desde cuándo ──')
{
  const { page, errores } = await admin([
    { key: 'torneos_reglas', value: { marcas_legales: ['H', 'I'] }, updated_at: ayer },
  ])
  check('sin errores', errores.length === 0, errores.join(' | '))
  check('el campo trae las que hay',
    (await page.locator('#marcasLegales').inputValue()) === 'H, I',
    await page.locator('#marcasLegales').inputValue())
  const aviso = limpio(await page.locator('#marcasAviso').textContent())
  check('se dice cuáles valen ahora', /valen H, I/.test(aviso), aviso)
  check('…y desde cuándo', /puestas el/.test(aviso), aviso)
  check('y no se canta una rotación que no toca',
    !/pasado un abril/.test(aviso), aviso)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Y CANTA cuando se ha saltado un abril ──')
{
  // Esto es el motivo de la pantalla. Sin el aviso, unas marcas viejas
  // se ven exactamente igual que unas buenas.
  const { page } = await admin([
    { key: 'torneos_reglas', value: { marcas_legales: ['F', 'G'] }, updated_at: haceUnAno },
  ])
  const aviso = limpio(await page.locator('#marcasAviso').textContent())
  check('lo dice', /pasado un abril/i.test(aviso), aviso)
  check('…y dice cuáles son las sospechosas', /F, G/.test(aviso), aviso)
  check('…y se pinta como alerta, no como nota',
    (await page.locator('#marcasAviso .admin-note-alerta').count()) === 1)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. Sin fila guardada, manda el respaldo del código ──')
{
  // Y hay que decirlo: si nadie las ha guardado nunca, lo que vale es el
  // ['H','I','J'] del código, que no se puede cambiar sin desplegar.
  const { page } = await admin([])
  const aviso = limpio(await page.locator('#marcasAviso').textContent())
  check('se avisa de que manda el código', /respaldo del código/.test(aviso), aviso)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. La red contra la errata: se cuenta antes de guardar ──')
{
  const { page } = await admin([
    { key: 'torneos_reglas', value: { marcas_legales: ['H', 'I'] }, updated_at: ayer },
  ])
  await page.locator('#marcasLegales').fill('H, I')
  await page.locator('#btnComprobarMarcas').click()
  await page.waitForTimeout(700)
  const bien = limpio(await page.locator('#marcasRecuento').textContent())
  check('dice cuántas cartas quedan legales', /quedan 3 cartas legales/.test(bien), bien)
  // Y el JP con marca H se queda fuera: si se colara serían 4. Los
  // catálogos asiáticos son otro juego de cartas y no pueden inflar el
  // número que se mira para decidir.
  check('…sin contar los catálogos asiáticos', !/quedan 4 /.test(bien), bien)

  // Y en singular no se dice «1 cartas».
  await page.locator('#marcasLegales').fill('D')
  await page.locator('#btnComprobarMarcas').click()
  await page.waitForTimeout(700)
  const una = limpio(await page.locator('#marcasRecuento').textContent())
  check('con una sola, se dice en singular', /queda 1 carta legal en/.test(una), una)

  // Una letra que no lleva ninguna carta: es el fallo que esto existe
  // para cazar, y tiene que verse AQUÍ y no en el mazo de alguien.
  await page.locator('#marcasLegales').fill('K')
  await page.locator('#btnComprobarMarcas').click()
  await page.waitForTimeout(700)
  const mal = limpio(await page.locator('#marcasRecuento').textContent())
  check('una letra que no existe canta', /Ninguna carta del catálogo/.test(mal), mal)
  check('…y se pinta como alerta',
    (await page.locator('#marcasRecuento .admin-note-alerta').count()) === 1)
  // Y que la clase HAGA algo. Comprobar que está puesta no prueba que
  // pinte nada (la lección de la 313): si el canto fuera del mismo color
  // que un aviso normal, una alerta y una nota se verían igual.
  const colores = await page.evaluate(() => {
    const el = document.querySelector('#marcasRecuento .admin-note-alerta')
    const testigo = document.createElement('span')
    testigo.style.color = 'var(--danger)'
    document.body.appendChild(testigo)
    const danger = getComputedStyle(testigo).color
    testigo.style.color = 'var(--warning)'
    const warning = getComputedStyle(testigo).color
    const canto = getComputedStyle(el).borderLeftColor
    testigo.remove()
    return { canto, danger, warning }
  })
  check('…con el canto en rojo de peligro', colores.canto === colores.danger, JSON.stringify(colores))
  check('…y no en el ámbar del aviso normal', colores.canto !== colores.warning, JSON.stringify(colores))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Guardar escribe la fecha, no solo las marcas ──')
{
  // `updated_at` tiene `default now()`, que solo corre al INSERTAR, y no
  // hay disparador. Si no se escribe a mano, la fecha se queda en la del
  // día que se sembró la fila y el aviso de la rotación miente justo al
  // revés de como conviene: callándose.
  const { page } = await admin([
    { key: 'torneos_reglas', value: { marcas_legales: ['F'] }, updated_at: haceUnAno },
  ])
  await page.locator('#marcasLegales').fill('h, j')
  await page.locator('#btnGuardarMarcas').click()
  await page.waitForTimeout(900)

  const escrito = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('__escrituras__') || '[]')
      .filter((e) => e.tabla === 'site_settings')
      .at(-1)
  )
  check('se guarda en site_settings', Boolean(escrito), JSON.stringify(escrito))
  const fila = Array.isArray(escrito?.filas) ? escrito.filas[0] : escrito?.filas
  check('…en mayúsculas y sin la coma', JSON.stringify(fila?.value?.marcas_legales) === '["H","J"]',
    JSON.stringify(fila?.value))
  // La CLAVE, que es lo que hace que sirva de algo: guardarlo en otra
  // deja el botón diciendo «guardado» sin que cambie nada en la web.
  check('…bajo la clave que lee el resto de la web', fila?.key === 'torneos_reglas', String(fila?.key))
  check('…y con la fecha de hoy', Boolean(fila?.updated_at) &&
    Math.abs(Date.now() - new Date(fila.updated_at).getTime()) < 120000, String(fila?.updated_at))

  // Y guardar pasa por la misma cuenta que el botón de comprobar: si no,
  // la red contra la errata solo protege a quien se acuerde de pulsarlo.
  const recuento = limpio(await page.locator('#marcasRecuento').textContent())
  check('guardar también cuenta', /carta(s)? legal(es)? en el catálogo/.test(recuento), recuento || '(vacío)')

  // Y el aviso se apaga sin recargar: si siguiera en rojo, nadie sabría
  // si ha servido de algo.
  const aviso = limpio(await page.locator('#marcasAviso').textContent())
  check('el aviso de la rotación se apaga', !/pasado un abril/i.test(aviso), aviso)
  check('…y ya dice las nuevas', /valen H, J/.test(aviso), aviso)
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. Y el campo vacío no borra las marcas ──')
{
  // Guardar una lista vacía dejaría la web sin poder juzgar nada, y
  // `marcasLegales()` caería al respaldo del código sin que nadie lo
  // pidiera. Se para antes de escribir.
  const { page } = await admin([
    { key: 'torneos_reglas', value: { marcas_legales: ['H', 'I'] }, updated_at: ayer },
  ])
  await page.locator('#marcasLegales').fill('   ')
  await page.locator('#btnGuardarMarcas').click()
  await page.waitForTimeout(700)
  const escrito = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem('__escrituras__') || '[]').filter((e) => e.tabla === 'site_settings')
  )
  check('no se escribe nada', escrito.length === 0, JSON.stringify(escrito))
  await page.close()
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 7. Y quien las LEE sigue leyendo lo mismo ──')
{
  // La pantalla escribe donde `js/carta-legalidad.js` lee. Si una de las
  // dos cambiara de sitio o de forma, la chapa de la ficha y el revisor
  // de decklists se quedarían con el respaldo del código para siempre.
  const admin = readFileSync('/home/user/pingu/admin/js/admin.js', 'utf8')
  const lector = readFileSync('/home/user/pingu/js/carta-legalidad.js', 'utf8')
  for (const [quien, texto] of [['el lector', lector], ['la pantalla', admin]]) {
    check(`${quien} usa la clave torneos_reglas`, /'torneos_reglas'/.test(texto))
    check(`${quien} usa el campo marcas_legales`, /marcas_legales/.test(texto))
  }
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
await browser.close()
process.exit(fails === 0 ? 0 : 1)
