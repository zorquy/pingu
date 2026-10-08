// Tanda 558 — la franja de una carta japonesa lleva CUATRO cosas más.
//
// PINGU, con la captura: escaneó una リザードンex y en el buscador quedó
//
//   «己進化 リザードン ex シダードか テ テキス…»
//
// y cero resultados. La 557 arregló que el japonés no casara por culpa de
// `NFD`; esto es lo OTRO, y es de la franja: el OCR lee bien, pero lee
// ADEMÁS lo que hay alrededor del nombre.
//
// En orden, eso que quedó es: la FASE mal leída (el «2» de 2進化 sale como
// 己, que es la confusión más común del OCR con ese glifo), el NOMBRE, un
// trozo de «リザードから進化» —de quién evoluciona, en una línea debajo— y
// el principio del texto de la habilidad.
//
// ── POR QUÉ ESO ES CERO Y NO «UN POCO PEOR» ──
//
// La búsqueda exige TODAS las palabras: un `like` por cada una. Basta con
// que el OCR cuele una basura para que no case NADA, aunque el nombre esté
// perfecto. En occidental la franja solo lleva fase + nombre + PS, y por
// eso colaba.
import { nombreDeLaFranja, numeroDeLaFranja } from '/home/user/pingu/js/mi-coleccion/escaner.js'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}

console.log('── 1. La franja de PINGU, tal cual ──')
{
  // Lo que se ve en la captura, con el resto que no cabía en el buscador.
  const FRANJA = '己進化 リザードン ex HP330 リザードから進化 テラスタル このポケモンは、ベンチにいるかぎり、ワザのダメージを受けない。'
  check('sale el nombre y nada más', nombreDeLaFranja(FRANJA) === 'リザードン', nombreDeLaFranja(FRANJA))
}

console.log('── 2. Las cuatro cosas que se cuelan, una a una ──')
{
  // La FASE, la lea como la lea el OCR: 2, 己, 乙… cualquier cosa de hasta
  // dos caracteres pegada a 進化 al principio.
  for (const fase of ['2進化', '己進化', '乙進化', '1進化', 'たね']) {
    const r = nombreDeLaFranja(`${fase} リザードン HP330`)
    check(`la fase «${fase}» se va`, r === 'リザードン', r)
  }
  // DE QUIÉN EVOLUCIONA. Es literal y no puede ser parte de un nombre:
  // «から進化» solo aparece en esa línea.
  check('«◯◯から進化» se va entero', nombreDeLaFranja('フシギソウ フシギダネから進化') === 'フシギソウ', nombreDeLaFranja('フシギソウ フシギダネから進化'))
  // Los PS, que en japonés van pegados a «HP».
  check('los PS se van', nombreDeLaFranja('ピカチュウ HP60') === 'ピカチュウ', nombreDeLaFranja('ピカチュウ HP60'))
  // Y la etiqueta de mecánica de la esquina.
  check('«テラスタル» se va', nombreDeLaFranja('リザードン テラスタル') === 'リザードン', nombreDeLaFranja('リザードン テラスタル'))
}

console.log('── 3. EL PRIMERO, no el más largo ──')
{
  // Esto fue mi primer intento y estaba mal: si la franja pilla el
  // principio del texto de la habilidad —y lo pilla, porque el recorte es
  // generoso a propósito—, esa frase es MÁS LARGA que el nombre y gana.
  // «このポケモンは、ベンチにいるかぎり» mide 17 y «リザードン» mide 5.
  const con = 'リザードン このポケモンは、ベンチにいるかぎり、ワザのダメージを受けない。'
  check('una frase larga no le gana al nombre', nombreDeLaFranja(con) === 'リザードン', nombreDeLaFranja(con))
  // El nombre es lo PRIMERO que se lee: va arriba y a la izquierda, y lo
  // único que puede ir antes es la fase, que ya se ha quitado.
  check('y el nombre corto se respeta', nombreDeLaFranja('たね イーブイ HP70 このポケモンは、') === 'イーブイ', nombreDeLaFranja('たね イーブイ HP70 このポケモンは、'))
}

console.log('── 4. Y el occidental NO cambia ──')
{
  // La otra mitad, que es la que hace que esto sea una prueba: estas
  // reglas solo entran si la franja lleva kanji. Lo de siempre sigue igual.
  check('Reshiram', nombreDeLaFranja('BÁSICO Reshiram EX PV180') === 'Reshiram EX', nombreDeLaFranja('BÁSICO Reshiram EX PV180'))
  check('Charizard', nombreDeLaFranja('Fase 2 Charizard ex HP 330') === 'Charizard ex', nombreDeLaFranja('Fase 2 Charizard ex HP 330'))
  check('Basic en inglés', nombreDeLaFranja('Basic Pikachu HP 60') === 'Pikachu', nombreDeLaFranja('Basic Pikachu HP 60'))
  // Y si la limpieza se lo llevara TODO, se devuelve lo de antes: un
  // limpiador que deja la cadena vacía es peor que no limpiar.
  check('si no queda nada, vuelve lo de antes', nombreDeLaFranja('たね') === 'たね', nombreDeLaFranja('たね'))
  check('y una franja vacía no rompe', nombreDeLaFranja('') === '' && nombreDeLaFranja(null) === '')
}

console.log('── 5. El número, Y A ANCHO COMPLETO ──')
{
  // La segunda captura de PINGU: la búsqueda ya funcionaba pero salían 23
  // Charizards. «No coge el número, supongo».
  //
  // Y no lo cogía: el OCR japonés devuelve las cifras y la barra como las
  // IMPRIME una carta japonesa —«０６６／１０８», a ancho completo— y `\d` no
  // casa con ０ ni `\/` con ／. De una carta japonesa salía NULL.
  check('«066/108» → 066', numeroDeLaFranja('066/108 R') === '066', numeroDeLaFranja('066/108 R'))
  check('A ANCHO COMPLETO también', numeroDeLaFranja('０６６／１０８ R') === '066', String(numeroDeLaFranja('０６６／１０８ R')))
  check('  …y con la barra sola a ancho completo', numeroDeLaFranja('066／108') === '066', String(numeroDeLaFranja('066／108')))
  check('  …y con el código del set delante', numeroDeLaFranja('SV3 ０６６／１０８') === '066', String(numeroDeLaFranja('SV3 ０６６／１０８')))
  check('con el ilustrador al lado', numeroDeLaFranja('22/99 · Illus. Shizurow') === '22', numeroDeLaFranja('22/99 · Illus. Shizurow'))
  // El copyright lleva un año de CUATRO cifras y no se confunde con el
  // número de la carta.
  check('el año del copyright no cuela', numeroDeLaFranja('©2023 Pokémon 066/108') === '066', String(numeroDeLaFranja('©2023 Pokémon 066/108')))
  check('y si no hay número, se dice que no hay', numeroDeLaFranja('Illus. Akira Egawa') === null)
  // NFKC aquí SÍ y en `normalizeSearch` NO, y la diferencia importa: esto
  // no compara contra la base, EXTRAE un número de un texto leído por una
  // máquina (la 557 explica por qué allí lo rompería).
  const fuente = readFileSync('/home/user/pingu/js/mi-coleccion/escaner.js', 'utf8')
  check('se normaliza a ancho normal antes de leer', /normalize\('NFKC'\)/.test(fuente))
  // SIN LOS COMENTARIOS: `js/texto.js` explica en un comentario POR QUÉ no
  // usa NFKC, y buscar la cadena a pelo daba la guarda por rota. Al barrer
  // código, todo lo que CONTIENE la cadena cuenta, no solo lo que ES (la
  // trampa de la 312, que ya ha picado tres veces).
  const sinComentarios = readFileSync('/home/user/pingu/js/texto.js', 'utf8')
    .replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
  check('  …y `normalizeSearch` sigue SIN NFKC', !/NFKC/.test(sinComentarios))
  check('  …con NFC, que es lo que hace la base', /normalize\('NFC'\)/.test(sinComentarios))
}

console.log('── 5b. Y se DICE lo que se ha leído ──')
{
  // Sin esto, «no he podido leer el número» y «lo he leído y no casaba» se
  // ven exactamente igual: una lista larga de cartas parecidas. PINGU vio
  // 23 Charizards y tuvo que adivinar cuál de las dos cosas era.
  const mc = readFileSync('/home/user/pingu/js/mi-coleccion.js', 'utf8')
  // Desde la 754 el disparo se parte en recortar y `leerYBuscar` (lo usan
  // también las fotos de la galería): lo leído se dice en las dos.
  const trozo = ['async function dispararEscaner', 'async function leerYBuscar'].map((f) => mc.split(f)[1]?.split('\n}')[0] || '').join('\n')
  check('se enseña lo leído', /He leído/.test(trozo))
  check('  …y dice si no se pudo leer el número', /no he podido leer el número/.test(trozo))
  check('  …y si el número no casaba', /no casaba con ninguna/.test(trozo))
}

console.log('── 6. La red de debajo: una sola palabra ──')
{
  // La limpieza quita lo que SE SABE que no es el nombre; esto es para lo
  // que no se sabe. Si con todas las palabras no sale nada, se prueba con
  // la más larga — mismo criterio que con el número: lo preciso primero.
  const mc = readFileSync('/home/user/pingu/js/mi-coleccion.js', 'utf8')
  const trozo = mc.split('UN ÚLTIMO INTENTO CON UNA SOLA PALABRA')[1]?.split('} catch')[0] || ''
  check('existe el último intento', trozo.length > 0, 'no está')
  check('  …solo si no ha salido nada', /querySelector\('\.mc-resultado'\)/.test(trozo), trozo.slice(0, 120))
  check('  …y se queda con la palabra más larga', /b\.length > a\.length/.test(trozo), trozo.slice(0, 200))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
