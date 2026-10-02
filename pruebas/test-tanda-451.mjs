// Tanda 451 — la franja de arriba NO es el nombre.
//
// PINGU escaneó este Reshiram:
//
//     BÁSICO   Reshiram EX              pv180 🔥
//
// …y en el buscador le quedó «BÁSICO Reshiram EX pv180·». Cero resultados.
//
// La franja de arriba de una carta es la FILA ENTERA y lleva tres cosas: a
// la izquierda la FASE, en medio el nombre, y a la derecha los PUNTOS DE
// VIDA con su etiqueta y el símbolo del tipo. El OCR las lee las tres
// porque las tres están ahí. Y recortar más estrecho no vale: están a la
// MISMA altura que el nombre, no encima ni debajo.
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs'
import { nombreDeLaFranja, numeroDeLaFranja, IDIOMAS_ESCANER } from '/home/user/pingu/js/mi-coleccion/escaner.js'

let fallos = 0
const ok = (b, msg, extra = '') => {
  console.log(`  ${b ? 'ok  ' : 'FALLA'} ${msg}${extra ? `  ${extra}` : ''}`)
  if (!b) fallos++
}
const BASE = 'http://localhost:8892'

// ═══════════════════════════════════════════════════════════════════
console.log('\n── 1. Lo que sobra de la franja de arriba ──')
{
  // EL CASO DE PINGU, tal cual salió de su móvil.
  ok(nombreDeLaFranja('BÁSICO Reshiram EX pv180·') === 'Reshiram EX',
    'el caso que lo empezó todo', nombreDeLaFranja('BÁSICO Reshiram EX pv180·'))

  // Las fases y las etiquetas de PV de los SIETE idiomas que ofrece el
  // escáner: tú puedes tener la web en español y estar escaneando una
  // japonesa, así que limpiar solo el español dejaría las otras seis con
  // el mismo fallo.
  const casos = [
    ['BASIC Reshiram EX HP180', 'Reshiram EX'],
    ['BASIS Reshiram EX KP 180', 'Reshiram EX'],
    ['BASE Reshiram EX PV180', 'Reshiram EX'],
    ['Reshiram EX PS 180', 'Reshiram EX'],
    ['FASE 2 Charizard ex PV 330', 'Charizard ex'],
    ['Stage 2 Charizard ex HP330', 'Charizard ex'],
    ['Niveau 1 Dracaufeu PV 130', 'Dracaufeu'],
    ['MEGA Mewtwo EX pv 220', 'Mewtwo EX'],
    ['たね リザードン HP120', 'リザードン'],
  ]
  for (const [crudo, esperado] of casos) {
    ok(nombreDeLaFranja(crudo) === esperado, `«${crudo}»`, nombreDeLaFranja(crudo))
  }

  // Los puntos de vida SIN etiqueta: siempre son múltiplos de diez. Un
  // número que fuera parte de un nombre no va suelto ni es múltiplo de
  // diez, así que no se lo lleva por delante.
  ok(nombreDeLaFranja('Reshiram EX 180') === 'Reshiram EX', 'un «180» suelto son los PV', nombreDeLaFranja('Reshiram EX 180'))
  ok(nombreDeLaFranja('Porygon2') === 'Porygon2', 'pero «Porygon2» se queda entero', nombreDeLaFranja('Porygon2'))
  ok(nombreDeLaFranja('Zygarde 50%') === 'Zygarde 50%', 'y «Zygarde 50%» también', nombreDeLaFranja('Zygarde 50%'))

  // El «EX» y el «ex» SON parte del nombre y distinguen una carta de otra:
  // quitarlos como si fueran adorno mezclaría el Mewtwo normal con el EX.
  ok(/EX/.test(nombreDeLaFranja('BÁSICO Mewtwo EX pv170')), 'el EX no se toca')
  ok(/ex/.test(nombreDeLaFranja('BÁSICO Charizard ex pv330')), 'y el ex en minúsculas tampoco')

  // UN LIMPIADOR QUE SE LLEVA EL NOMBRE ENTERO ES PEOR QUE NO LIMPIAR:
  // buscar de más da resultados raros; buscar la cadena vacía no da nada.
  ok(nombreDeLaFranja('BÁSICO pv180') === 'BÁSICO pv180', 'si no queda nada, se devuelve lo de antes', nombreDeLaFranja('BÁSICO pv180'))
  ok(nombreDeLaFranja('') === '' && nombreDeLaFranja(null) === '', 'y el vacío sigue vacío')
}

// ═══════════════════════════════════════════════════════════════════
console.log('\n── 2. El número de la franja de abajo ──')
{
  // Viene como «22/99»: lo de delante es LA CARTA y lo de detrás cuántas
  // tiene el set. Quedarse con el 99 buscaría una carta que no es.
  ok(numeroDeLaFranja('22/99  Ilus. Shizurow') === '22', '«22/99» es la 22, no la 99', numeroDeLaFranja('22/99  Ilus. Shizurow'))
  ok(numeroDeLaFranja('SSP 125/191') === '125', 'con el código del set delante, igual', numeroDeLaFranja('SSP 125/191'))
  ok(numeroDeLaFranja('22 / 99') === '22', 'y con espacios alrededor de la barra', numeroDeLaFranja('22 / 99'))
  ok(numeroDeLaFranja('Ilus. Kodama') === null, 'y si no hay número, null y no se inventa')
}

// ═══════════════════════════════════════════════════════════════════
console.log('\n── 3. El camino entero, con el OCR falseado ──')
const navegador = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })
const semilla = () => {
  window.__FAKE_SETS__ = [{ id: 'bw9', name: 'Destinos Futuros', serie_id: 'bw', market: 'WEST', card_count_official: 99, release_date: '2012-02-08' }]
  window.__FAKE_CARTAS__ = [
    { id: 'bw9-22', market: 'WEST', set_id: 'bw9', local_id: '22', name: 'Reshiram EX', name_es: 'Reshiram EX', image_path: 'x/22', rarity: 'Ultra Rare', category: 'Pokemon', types: ['Fire'], dex_ids: [643], illustrator: 'Shizurow', variants: { normal: true } },
    { id: 'bw9-21', market: 'WEST', set_id: 'bw9', local_id: '21', name: 'Reshiram', name_es: 'Reshiram', image_path: 'x/21', rarity: 'Rare', category: 'Pokemon', types: ['Fire'], dex_ids: [643], illustrator: 'Otro', variants: { normal: true } },
  ]
  window.__FAKE_COLECCION__ = []
}
const escanear = async (textos) => {
  const p = await navegador.newPage({ viewport: { width: 420, height: 900 } })
  await p.route('**assets.tcgdex.net/**', (r) => r.abort())
  await p.route('**/.netlify/functions/leer-carta', (r) => r.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ textos, idioma: 'es' }),
  }))
  await p.addInitScript(semilla)
  await p.goto(`${BASE}/mi-coleccion.html?ver=buscar`, { waitUntil: 'domcontentloaded' })
  await p.waitForTimeout(2600)
  await p.click('#mcEscanear')
  await p.waitForTimeout(1500)
  await p.click('#mcEscanerDisparo')
  await p.waitForTimeout(2200)
  return p
}
{
  // La carta de PINGU: Reshiram EX, la 22 de Destinos Futuros.
  const p = await escanear({ nombre: 'BÁSICO Reshiram EX pv180·', codigo: '22/99  Ilus. Shizurow' })
  const campo = await p.locator('#mcBuscarTodo').inputValue()
  ok(campo === 'Reshiram EX 22', 'en el buscador queda el nombre limpio y el número', campo)
  const nums = (await p.locator('#mcBuscarResultados .mc-resultado-set').allTextContents()).map((t) => t.split('·').pop().trim())
  ok(nums.join(',') === '22', 'y sale LA carta, no veinte', nums.join(','))
  await p.close()
}
{
  // Y SI EL OCR SE EQUIVOCA EN EL NÚMERO, no se acaba en una pantalla
  // vacía: se afloja la búsqueda y el número vuelve a ser lo que era, una
  // pista para poner arriba la que probablemente es.
  const p = await escanear({ nombre: 'BÁSICO Reshiram EX pv180·', codigo: '28/99' })
  const campo = await p.locator('#mcBuscarTodo').inputValue()
  ok(campo === 'Reshiram EX', 'con un número mal leído, la búsqueda se afloja sola', campo)
  const cuantas = await p.locator('#mcBuscarResultados .mc-resultado').count()
  ok(cuantas === 1, '  …y sigue encontrando la carta', String(cuantas))
  await p.close()
}
{
  // Sin número legible tampoco se rompe nada.
  const p = await escanear({ nombre: 'BÁSICO Reshiram pv130', codigo: 'Ilus. Nadie' })
  ok((await p.locator('#mcBuscarTodo').inputValue()) === 'Reshiram', 'sin número, solo el nombre',
    await p.locator('#mcBuscarTodo').inputValue())
  ok((await p.locator('#mcBuscarResultados .mc-resultado').count()) === 2, '  …y salen las dos Reshiram')
  await p.close()
}

// La lista de idiomas de la pantalla sigue siendo la que el limpiador
// sabe tratar: si mañana se añade uno, hay que mirar su fase y su etiqueta
// de PV.
ok(IDIOMAS_ESCANER.map((i) => i.id).join(',') === 'es,en,ja,zh,de,fr,it',
  'los siete idiomas de siempre', IDIOMAS_ESCANER.map((i) => i.id).join(','))

await navegador.close()
console.log(fallos ? `\n❌ ${fallos} FALLOS` : '\n✅ TODO BIEN')
process.exit(fallos ? 1 : 0)
