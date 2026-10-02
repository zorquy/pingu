// La función que lee una carta (tanda 447), probada SIN gastar peticiones
// contra el proveedor: `leerCarta` recibe la clave y el `fetch`
// inyectados, que es el patrón de las demás funciones del repo.
import { leerCarta, leerFranja, limpiar, esRecorte, IDIOMAS } from '/home/user/pingu/netlify/functions/leer-carta.mjs'

let fallos = 0
const ok = (b, msg, extra = '') => {
  console.log(`  ${b ? 'ok  ' : 'FALLA'} ${msg}${extra ? `  ${extra}` : ''}`)
  if (!b) fallos++
}

const FRANJA = 'data:image/jpeg;base64,' + 'A'.repeat(200)
const respuesta = (texto) => ({
  ok: true,
  json: async () => ({ ParsedResults: [{ ParsedText: texto }], IsErroredOnProcessing: false }),
})

// ── Lo que se valida antes de gastar una petición ──
{
  const nunca = () => { throw new Error('no debería llamarse') }
  let r = await leerCarta({ nombre: 'hola', codigo: FRANJA }, { clave: 'k', fetchImpl: nunca })
  ok(r.estado === 400, 'sin los dos recortes, 400 y no se llama al proveedor', String(r.estado))
  r = await leerCarta({ nombre: FRANJA, codigo: 'data:image/png;base64,AAAA' }, { clave: 'k', fetchImpl: nunca })
  ok(r.estado === 400, 'un PNG no es un recorte nuestro', String(r.estado))
  const gordo = 'data:image/jpeg;base64,' + 'A'.repeat(900 * 1024)
  r = await leerCarta({ nombre: gordo, codigo: FRANJA }, { clave: 'k', fetchImpl: nunca })
  ok(r.estado === 413, 'y un recorte de veinte megas no se le manda a nadie', String(r.estado))
}

// ── Sin clave lo DICE, y lo dice de una forma que el navegador distingue ──
{
  const r = await leerCarta({ nombre: FRANJA, codigo: FRANJA }, { clave: '', fetchImpl: () => { throw new Error('no') } })
  ok(r.estado === 503 && r.datos.sinConfigurar === true, 'sin OCR_API_KEY: 503 con `sinConfigurar`')
  ok(/OCR_API_KEY/.test(r.datos.detalle || ''), 'y el detalle dice qué falta', r.datos.detalle)
}

// ── El camino bueno ──
{
  const pedidos = []
  const r = await leerCarta({ nombre: FRANJA, codigo: FRANJA, idioma: 'es' }, {
    clave: 'clave-de-prueba',
    fetchImpl: async (url, opc) => {
      pedidos.push({ url, cuerpo: new URLSearchParams(opc.body), clave: opc.headers.apikey })
      return respuesta(pedidos.length === 1 ? 'Charizard ex\r\n' : '  SSP   125/191  illus. Kodama ')
    },
  })
  ok(r.estado === 200, 'dos franjas leídas: 200', String(r.estado))
  ok(r.datos.textos.nombre === 'Charizard ex', 'el nombre llega aplanado a una línea', JSON.stringify(r.datos.textos.nombre))
  ok(r.datos.textos.codigo === 'SSP 125/191 illus. Kodama', 'y el código sin espacios dobles', JSON.stringify(r.datos.textos.codigo))
  ok(pedidos.length === 2, 'una petición por franja, no una por fotograma', String(pedidos.length))
  ok(pedidos.every((p) => p.clave === 'clave-de-prueba'), 'la clave va en la cabecera, no en la URL')
  ok(pedidos.every((p) => !String(p.url).includes('clave-de-prueba')), 'y la URL no la lleva nunca')
  ok(pedidos[0].cuerpo.get('language') === 'spa', 'el idioma elegido viaja', pedidos[0].cuerpo.get('language'))
  ok(pedidos[0].cuerpo.get('isOverlayRequired') === 'false', 'sin la retícula de palabras, que solo engorda la respuesta')
  ok(pedidos[0].cuerpo.get('base64Image') === FRANJA, 'la imagen va tal cual, en base64')
}

// ── El japonés y el chino NO van por el motor 2 ──
// El motor 2 lee mejor el alfabeto latino pero no sabe CJK: se los salta
// devolviendo texto VACÍO, sin dar error. Mandar una carta japonesa por
// él daría «no he reconocido el nombre» para siempre.
{
  ok(IDIOMAS.ja.motor === 1 && IDIOMAS.zh.motor === 1, 'japonés y chino, por el motor 1')
  ok(IDIOMAS.es.motor === 2 && IDIOMAS.en.motor === 2, 'los latinos, por el 2, que lee mejor')
  ok(Object.keys(IDIOMAS).join(',') === 'es,en,ja,zh,de,fr,it', 'los siete de la pantalla del escáner, ni uno más ni uno menos', Object.keys(IDIOMAS).join(','))
  const pedidos = []
  await leerCarta({ nombre: FRANJA, codigo: FRANJA, idioma: 'ja' }, {
    clave: 'k',
    fetchImpl: async (url, opc) => { pedidos.push(new URLSearchParams(opc.body)); return respuesta('リザードン') },
  })
  ok(pedidos[0].get('OCREngine') === '1' && pedidos[0].get('language') === 'jpn', 'una carta japonesa va con jpn y motor 1')
}

// ── Un idioma que no existe no revienta: se cae al español ──
{
  const pedidos = []
  const r = await leerCarta({ nombre: FRANJA, codigo: FRANJA, idioma: 'klingon' }, {
    clave: 'k',
    fetchImpl: async (url, opc) => { pedidos.push(new URLSearchParams(opc.body)); return respuesta('x') },
  })
  ok(r.estado === 200 && pedidos[0].get('language') === 'spa', 'un idioma desconocido se lee en español y no falla')
}

// ── Que el proveedor falle NO es que la carta esté mal encuadrada ──
// Si los dos mensajes fueran el mismo, la gente repetiría la foto veinte
// veces contra un servicio caído.
{
  let r = await leerCarta({ nombre: FRANJA, codigo: FRANJA }, {
    clave: 'k', fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({}) }),
  })
  ok(r.estado === 502, 'si el proveedor devuelve 503, nosotros 502', String(r.estado))
  ok(/no contesta/.test(r.datos.error), 'y el mensaje habla del lector, no de la carta', r.datos.error)

  // `IsErroredOnProcessing` llega con un 200: un `res.ok` a secas se lo
  // tragaría y devolveríamos texto vacío como si todo hubiera ido bien.
  r = await leerCarta({ nombre: FRANJA, codigo: FRANJA }, {
    clave: 'k',
    fetchImpl: async () => ({ ok: true, json: async () => ({ IsErroredOnProcessing: true, ErrorMessage: ['Apikey no válida'] }) }),
  })
  ok(r.estado === 502, 'un error del OCR con un 200 por delante TAMBIÉN es un fallo', String(r.estado))
  ok(/Apikey/.test(r.datos.detalle || ''), 'y se cuenta qué dijo', r.datos.detalle)
}

// ── Sin texto no se inventa nada ──
{
  const r = await leerCarta({ nombre: FRANJA, codigo: FRANJA }, {
    clave: 'k', fetchImpl: async () => respuesta(''),
  })
  ok(r.estado === 200 && r.datos.textos.nombre === '', 'una franja ilegible devuelve cadena vacía, no null')
}

// ── La lista de idiomas está DOS veces, y se vigila ──
// `IDIOMAS` aquí es copia de `IDIOMAS_ESCANER` del cliente: la función de
// Netlify no puede importar un módulo del navegador. Copiar siete líneas
// es más barato que partir el fichero, pero una copia sin vigilar se
// separa y no da error — es lo de `IDIOMA_POR_MERCADO` de la tanda 322.
// Lo que pasaría: añades un idioma al desplegable, la carta se escanea en
// otro, y sale «no he reconocido el nombre» sin más explicación.
{
  const { IDIOMAS_ESCANER } = await import('/home/user/pingu/js/mi-coleccion/escaner.js')
  const enPantalla = IDIOMAS_ESCANER.map((i) => i.id).join(',')
  ok(enPantalla === Object.keys(IDIOMAS).join(','), 'los idiomas del desplegable son los que el servidor sabe leer', `${enPantalla} vs ${Object.keys(IDIOMAS).join(',')}`)
}

// ── Piezas sueltas ──
{
  ok(limpiar('a\r\n\nb   c ') === 'a b c', 'limpiar aplana a una línea', JSON.stringify(limpiar('a\r\n\nb   c ')))
  ok(esRecorte(FRANJA) && !esRecorte('data:image/jpeg;base64,AA') && !esRecorte(null), 'esRecorte pide JPEG y un mínimo de bytes')
  ok(typeof leerFranja === 'function', 'leerFranja se exporta para poder cambiar de proveedor sin tocar lo demás')
}

console.log(fallos ? `\n❌ ${fallos} FALLOS` : '\n✅ TODO BIEN')
process.exit(fallos ? 1 : 0)
