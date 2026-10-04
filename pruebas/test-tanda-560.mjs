// Tanda 560 — «He leído: 19:054 Card Trader 111 5G».
//
// Eso es lo que dijo el aviso de la 558b cuando PINGU escaneó. Y es
// exactamente lo que había delante del objetivo: el RELOJ, el nombre de la
// app y la cobertura — el marco pilló la PANTALLA del móvil, no la carta
// que se veía dentro.
//
// No es un fallo del OCR (leyó perfectamente lo que había) ni de la
// búsqueda. Es que la foto no era de una carta. Lo que estaba mal es la
// RESPUESTA: se cerraba el escáner, se saltaba a Buscar y salía «no
// encuentro ninguna carta así» — la MISMA pantalla que cuando la carta no
// está en el catálogo. Dos cosas muy distintas con la misma cara, y la que
// tocaba era «vuelve a encuadrar».
//
// Y el aviso de la 558b es lo que convirtió esto en cinco minutos de
// trabajo en vez de otra ida y vuelta: sin él, lo único que se veía era
// una pantalla vacía.
import { pareceNombreDeCarta } from '/home/user/pingu/js/mi-coleccion/escaner.js'
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}

console.log('── 1. Lo que leyó PINGU ──')
{
  const r = pareceNombreDeCarta('19:054 Card Trader 111 5G', 'ja')
  check('no cuela como nombre de carta', r.vale === false, JSON.stringify(r))
  check('  …y se sabe POR QUÉ: es una pantalla', r.porque === 'pantalla', JSON.stringify(r))
  // El «054» es el reloj con el «4» de «4G» pegado: por eso la expresión
  // del reloj no lleva borde de palabra al final.
  check('el reloj se reconoce aunque venga pegado', pareceNombreDeCarta('19:054', 'es').porque === 'pantalla')
  check('  …y con espacios', pareceNombreDeCarta('19 : 05 Charizard', 'es').porque === 'pantalla')
}

console.log('── 2. Un nombre japonés sin japonés es un encuadre malo ──')
{
  // El nombre de una carta japonesa es kana y kanji SIEMPRE. Si se escanea
  // en japonés y no sale ninguno, o no era una carta o el idioma elegido
  // no es el de la carta — y las dos se arreglan igual: mirando.
  check('«Card Trader» en japonés, no', pareceNombreDeCarta('Card Trader', 'ja').porque === 'sin-cjk')
  check('  …y en chino tampoco', pareceNombreDeCarta('Card Trader', 'zh').porque === 'sin-cjk')
  check('pero en español sí vale', pareceNombreDeCarta('Card Trader', 'es').vale === true)
}

console.log('── 3. Lo que NO puede rechazar ──')
{
  // La otra mitad: una guarda que solo se prueba cuando salta no se está
  // probando, y aquí un falso positivo es peor que el fallo — sería no
  // dejar escanear una carta buena.
  check('リザードン en japonés', pareceNombreDeCarta('リザードン', 'ja').vale === true)
  check('フシギダネ', pareceNombreDeCarta('フシギダネ', 'ja').vale === true)
  check('Charizard ex', pareceNombreDeCarta('Charizard ex', 'es').vale === true)
  check('Reshiram EX', pareceNombreDeCarta('Reshiram EX', 'en').vale === true)
  // Un nombre con cifras SÍ existe («Porygon2», «Zygarde 50%») y no lleva
  // dos puntos: el reloj no lo toca.
  check('Porygon2', pareceNombreDeCarta('Porygon2', 'es').vale === true)
  check('Zygarde 50%', pareceNombreDeCarta('Zygarde 50%', 'es').vale === true)
  check('vacío no vale, y se dice', pareceNombreDeCarta('', 'es').porque === 'vacio')
}

console.log('── 4. Y el escáner NO se cierra ──')
{
  // Volver a abrirlo para repetir el tiro es la parte que convierte un
  // fallo de encuadre en abandonar.
  const mc = readFileSync('/home/user/pingu/js/mi-coleccion.js', 'utf8')
  const trozo = mc.split('SI ESO NO PUEDE SER UNA CARTA')[1]?.split('cerrarEscaner()')[0] || ''
  check('el juicio va ANTES de cerrar el escáner', trozo.includes('pareceNombreDeCarta'), 'el juicio va después de cerrar')
  check('  …y vuelve sin buscar', /return/.test(trozo))
  check('  …diciendo lo que ha leído', /He leído «/.test(trozo))
  check('  …y qué hacer', /Encuadra solo la carta/.test(trozo))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
