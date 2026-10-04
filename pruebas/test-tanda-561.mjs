// Tanda 561 — el OCR se come el dakuten: «リサードン» por «リザードン».
//
// El aviso de la 558b, otra vez haciendo su trabajo: «He leído: リサードン ·
// el nº 2 no casaba con ninguna». Un carácter cambiado —サ por ザ— y el
// `like` se va a cero.
//
// Es EL error más común leyendo japonés: el dakuten (las dos comillitas) y
// el handakuten (el circulito) son dos marcas minúsculas encima de un kana,
// y en una foto a pulso se pierden o se inventan. Y hasta aquí eso se veía
// como «esa carta no está en el catálogo», que es otra cosa.
//
// ── POR QUÉ ESTO Y NO UNA BÚSQUEDA POR PARECIDO ──
//
// `pg_trgm` está instalado y sería lo natural. Pero los trigramas de
// «リサードン» y «リザードン» comparten UNO de tres: el parecido sale en
// torno a 0,2 y habría que bajar el listón hasta donde entra ruido. Esto
// es exacto: modela el error que el OCR comete de verdad —pierde marcas,
// no inventa otros kana— en vez de medir un parecido genérico.
import { variantesDeMarcas, normalizeSearch } from '/home/user/pingu/js/texto.js'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}

console.log('── 1. La carta de PINGU ──')
{
  const v = variantesDeMarcas('リサードン')
  check('entre las variantes está la buena', v.includes('リザードン'), JSON.stringify(v))
  // El original va PRIMERO: lo más probable es que lo leído esté bien, y
  // quien las prueba se queda con la primera que encuentre algo.
  check('y lo leído va primero', v[0] === 'リサードン', JSON.stringify(v))
}

console.log('── 2. Las dos marcas, en los dos sentidos ──')
{
  // Perdida: el OCR no vio la marca.
  check('ヒカチュウ → ピカチュウ (handakuten)', variantesDeMarcas('ヒカチュウ').includes('ピカチュウ'))
  check('  …y también ビカチュウ, que no se sabe cuál era', variantesDeMarcas('ヒカチュウ').includes('ビカチュウ'))
  // Inventada: el OCR vio una marca que no estaba (una mota, un brillo).
  check('ゼニガメ → セニガメ y al revés', variantesDeMarcas('ゼニガメ').includes('セニガメ'))
  // DOS marcas perdidas pasa de verdad: «フシギダネ» leído «フシキタネ».
  check('フシキタネ → フシギダネ (dos marcas)', variantesDeMarcas('フシキタネ', 40).includes('フシギダネ'), JSON.stringify(variantesDeMarcas('フシキタネ', 40).slice(0, 10)))
  // Hiragana también: hay cartas con el nombre en hiragana.
  check('はね → ばね/ぱね', variantesDeMarcas('はね').includes('ばね') && variantesDeMarcas('はね').includes('ぱね'))
}

console.log('── 3. Lo que NO puede hacer ──')
{
  // Un nombre occidental no tiene marcas que cambiar: ni una variante, ni
  // una consulta de más.
  check('un nombre occidental no genera variantes', variantesDeMarcas('Charizard ex').length === 1, JSON.stringify(variantesDeMarcas('Charizard ex')))
  check('ni uno vacío', variantesDeMarcas('').length === 1)
  // El tope existe para que esto no se convierta en una lista enorme: cada
  // variante es una condición en la consulta.
  check('hay tope', variantesDeMarcas('ハヒフヘホカキクケコ', 5).length <= 6, String(variantesDeMarcas('ハヒフヘホカキクケコ', 5).length))
  // Y no se duplican: el mismo cambio por dos caminos sale una vez.
  const v = variantesDeMarcas('ササ')
  check('sin repetidas', new Set(v).size === v.length, JSON.stringify(v))
  // Las variantes se comparan como lo guarda la base, así que tienen que
  // salir COMPUESTAS (la lección de la 557).
  check('salen compuestas, como en la base', variantesDeMarcas('リサードン').every((x) => normalizeSearch(x) === x.normalize('NFC').toLowerCase()))
}

console.log('── 4. Una consulta, no trece ──')
{
  const mc = readFileSync('/home/user/pingu/js/mi-coleccion.js', 'utf8')
  const buscar = mc.split('async function buscarCartas')[1]?.split('\n}')[0] || ''
  check('las variantes van en un `or`', /\.or\(/.test(buscar) && /variantes/.test(buscar), buscar.slice(0, 160))
  // La coma y el paréntesis son la sintaxis del propio `or`: un nombre con
  // una coma partiría la condición en dos.
  check('  …y se limpia la sintaxis del `or`', /replace\(\/\[%_\*,\(\)\]\/g/.test(buscar), buscar.slice(0, 200))
  // Esto va AL FINAL de todo: es lo más flojo que se hace, y si algo casó
  // antes ni se pregunta.
  const escaner = mc.split('LAS MARCAS QUE EL OCR SE COME')[1]?.split('showToast')[0] || ''
  check('solo si no ha salido nada antes', /querySelector\('\.mc-resultado'\)/.test(escaner), escaner.slice(0, 120))
  check('  …y solo si el nombre es japonés', /tieneCJK\(nombreLeido\)/.test(escaner))
  check('  …y se dice que se ha aflojado', /dakuten/.test(escaner))
  // Y que el DOBLE entienda ese `or`: si lo simplificara, una prueba de
  // pantalla saldría verde sobre algo que en producción no funciona (la
  // lección de la 437 y la 521). Aquí es al revés —el doble ya lo
  // entiende— pero conviene que quede atado.
  const doble = readFileSync('/tmp/wt-pruebas/herramientas/stub-supabase.js', 'utf8')
  const suOr = doble.split('or: (expresion)')[1]?.split('return consulta')[0] || ''
  check('el doble entiende `like` dentro de un `or`', /op === 'like'/.test(suOr), suOr.slice(0, 120))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
