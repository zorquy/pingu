// Tanda 532 — los sets japoneses, con nombre que se pueda leer.
//
// PINGU, con la biblioteca japonesa delante y los logos ya puestos:
// «Scrydex guarda el nombre de los sets japoneses en occidental, y las eras
// también, así que tráete ese nombre en vez de los kanjis, porque no se
// sabe leer esto».
//
// Y viene GRATIS, en la misma respuesta que el logo: `translation.en.name`
// y `series`.
import { readFileSync, readdirSync } from 'node:fs'
import { nombreDeSet, eraDeSet } from '/home/user/pingu/js/catalogo-series.js'
import { tieneCJK } from '/home/user/pingu/js/texto.js'
import { filaDeSetConScrydex } from '/home/user/pingu/netlify/lib/scrydex.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 300) : ''}`)
}

const JAPONES = {
  id: 'mf', market: 'JP',
  name: '30th セレブレーション プレミアムデッキセット エーフィ・ブラッキー',
  name_en: '30th Celebration Premium Deck Set: Espeon & Umbreon',
  serie_name: null, serie_name_en: 'Mega Evolution',
}
const ESPANOL = {
  id: 'sv10', market: 'WEST', name: 'Rivales Predestinados', name_en: 'Destined Rivals',
  serie_name: 'Escarlata y Púrpura', serie_name_en: 'Scarlet & Violet',
}

console.log('── 1. Se traduce lo que NO SE PUEDE LEER, y nada más ──')
{
  check('un set japonés se enseña en occidental', nombreDeSet(JAPONES) === JAPONES.name_en, nombreDeSet(JAPONES))
  check('  …y su era también', eraDeSet(JAPONES) === 'Mega Evolution', eraDeSet(JAPONES))
  // ESTA ES LA MITAD QUE IMPORTA: un set español NO se enseña en inglés
  // por el hecho de que exista `name_en`. Eso cambiaría el catálogo entero
  // por un dato que se trajo para otra cosa.
  check('un set español se queda en español', nombreDeSet(ESPANOL) === 'Rivales Predestinados', nombreDeSet(ESPANOL))
  check('  …y su era también', eraDeSet(ESPANOL) === 'Escarlata y Púrpura', eraDeSet(ESPANOL))
}

console.log('── 2. Y los huecos, que son tres estados y no dos ──')
{
  check('sin `name_en`, el japonés tal cual', nombreDeSet({ name: 'セット' }) === 'セット')
  check('sin nada, cadena vacía y no «undefined»', nombreDeSet({}) === '' && nombreDeSet(null) === '')
  // Una era vacía con occidental SÍ se rellena: los sets japoneses de
  // TCGdex vienen sin serie, así que ahí no hay nada que respetar.
  check('una era vacía se rellena con la suya', eraDeSet({ serie_name: null, serie_name_en: 'Sword & Shield' }) === 'Sword & Shield')
  check('y sin ninguna de las dos, vacía', eraDeSet({}) === '')
  // El japonés NO se tira: sigue en `name`, que es el nombre de verdad del
  // set y con lo que se cruza (tandas 334 y 335).
  check('el japonés sigue guardado', JAPONES.name.includes('セレブレーション'))
}

console.log('── 3. La prueba del alfabeto es UNA, no dos ──')
{
  check('kanji', tieneCJK('セット') && tieneCJK('強化拡張パック'))
  check('hangul', tieneCJK('포켓몬'))
  check('y el español no', !tieneCJK('Rivales Predestinados') && !tieneCJK('Pokémon GO'))
  // Vive en `js/texto.js` y la usan las dos mitades: el navegador y la
  // librería de Scrydex. Una copia se separa sin que nadie se entere
  // (tanda 471), así que esto comprueba que de verdad es LA MISMA.
  const lib = readFileSync('/home/user/pingu/netlify/lib/scrydex.mjs', 'utf8')
  check('y `scrydex.mjs` la importa en vez de copiarla',
    /import \{ tieneCJK \} from '\.\.\/\.\.\/js\/texto\.js'/.test(lib))
  check('  …sin dejarse la copia vieja detrás', !/const TIENE_CJK = \/\[/.test(lib))
}

console.log('── 4. Se escribe, y se PIDE ──')
{
  const f = filaDeSetConScrydex(
    { id: 'mf', market: 'JP', name: 'セット' },
    { id: 'mf_ja', name: 'セット', series: 'Mega Evolution', translation: { en: { name: 'Mega Fighters' } }, logo: 'https://x/l' },
    'el nombre del set',
  )
  check('el nombre occidental se guarda', f.name_en === 'Mega Fighters', f.name_en)
  check('  …y la era', f.serie_name_en === 'Mega Evolution', f.serie_name_en)
  check('  …sin pisar el japonés', f.name === 'セット', f.name)
  // Y si ya lo teníamos, no se pisa.
  const g = filaDeSetConScrydex(
    { id: 'mf', market: 'JP', name: 'セット', name_en: 'El que ya había' },
    { id: 'mf_ja', translation: { en: { name: 'Otro' } } },
  )
  check('lo nuestro no se pisa', g.name_en === 'El que ya había', g.name_en)

  // ── EL BARRIDO DE LA 523, otra vez ──
  //
  // Una columna que la base rellena y ninguna consulta pide llega
  // `undefined`: aquí, además de no enseñarse, haría que cada pasada la
  // reescribiera creyendo que está vacía.
  const raiz = '/home/user/pingu/js'
  const ficheros = []
  const andar = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.isDirectory()) andar(`${dir}/${e.name}`)
      else if (e.name.endsWith('.js')) ficheros.push(`${dir}/${e.name}`)
    }
  }
  andar(raiz)
  // LA REGLA ES «QUIEN LO PINTA, LO PIDE», y no «todo el que nombre un
  // set». El constructor pide `name` para DEDUCIR el código de TCG Live
  // del set, no para enseñarlo: exigirle columnas que no usa sería una
  // guarda que marca por marcar, y una guarda ruidosa se acaba acallando.
  const faltan = []
  let vistas = 0
  for (const fichero of ficheros) {
    const txt = readFileSync(fichero, 'utf8')
    if (!/\b(nombreDeSet|eraDeSet)\b/.test(txt)) continue
    for (const m of txt.matchAll(/'([a-z_][a-z_0-9(),. *]*)'/gi)) {
      const cols = m[1].split(/[,()]/).map((s) => s.trim())
      // Y una consulta de SETS se reconoce por la serie: las de cartas
      // también llevan `name` y `id`, y colarlas aquí pedía columnas que
      // `tcg_cards` no tiene.
      if (!cols.includes('serie_name') && !cols.includes('serie_id')) continue
      vistas++
      if (!cols.includes('name_en') || !cols.includes('serie_name_en')) faltan.push(`${fichero.replace(raiz, 'js')}: ${m[1].slice(0, 70)}`)
    }
  }
  check('se han encontrado consultas de quien los pinta', vistas >= 3, vistas)
  check('TODAS piden también los nombres occidentales', faltan.length === 0, faltan.join(' | '))
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
