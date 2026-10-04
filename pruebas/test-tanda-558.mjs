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

console.log('── 5. El número de abajo sigue saliendo ──')
{
  // La carta de la captura es la 066/108.
  check('«066/108» → 066', numeroDeLaFranja('066/108 R') === '066', numeroDeLaFranja('066/108 R'))
  check('con el ilustrador al lado', numeroDeLaFranja('22/99 · Illus. Shizurow') === '22', numeroDeLaFranja('22/99 · Illus. Shizurow'))
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
