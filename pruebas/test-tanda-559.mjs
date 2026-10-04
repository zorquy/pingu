// Tanda 559 — el OCR lee el logo de «ex» como «CKT» y lo pega al nombre.
//
// PINGU volvió a escanear una リザードンex —esta vez la 134/108 SAR, con el
// número bien visible— y en el buscador quedó «リザードンCKT». Cero
// resultados.
//
// El «ex» de una carta japonesa va estilizado: en relieve, a dos colores y
// pegado al nombre sin espacio. El OCR lo lee como le parece —«CKT» esta
// vez, «ex» la anterior— y como va pegado, el resultado es UNA palabra. El
// `like` buscaba «%リザードンCKT%» y no casaba con nada.
//
// ── LA REGLA ──
//
// El nombre japonés de una carta es kana y kanji. Lo latino que se le pega
// es o el sufijo (ex, V, GX) o basura del OCR, y las dos cosas sobran: con
// «リザードン» la base ya encuentra «リザードンex», porque el `like` va por
// dentro. Se busca la RACHA japonesa más larga del trozo, así que da igual
// si la basura se pega delante o detrás.
//
// Y esto es la tercera capa del mismo escáner, que conviene verlo junto:
//   · 557 — la consulta descomponía el kana y no casaba NUNCA.
//   · 558 — la franja lleva fase, evolución y habilidad además del nombre.
//   · 558b — el número venía a ancho completo.
//   · 559 — y el sufijo estilizado se pega al nombre.
// Cada una tapaba a la siguiente: hasta que no casó una, no se vio la otra.
import { nombreDeLaFranja, numeroDeLaFranja } from '/home/user/pingu/js/mi-coleccion/escaner.js'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}

console.log('── 1. La carta de PINGU, entera ──')
{
  // La franja de arriba de la 134/108 SAR, con el «ex» leído como «CKT».
  const ARRIBA = '2進化 リザードンCKT HP330 リザードから進化 テラスタル このポケモンは、ベンチにいるかぎり、ワザのダメージを受けない。'
  check('el nombre sale limpio', nombreDeLaFranja(ARRIBA) === 'リザードン', nombreDeLaFranja(ARRIBA))
  // Y la de abajo: «sv3 134/108 SAR» con el ilustrador al lado.
  const ABAJO = 'Illus. AKIRA EGAWA sv3 134/108 SAR'
  check('y el número también', numeroDeLaFranja(ABAJO) === '134', String(numeroDeLaFranja(ABAJO)))
  check('  …aunque venga a ancho completo', numeroDeLaFranja('sv3 １３４／１０８ SAR') === '134', String(numeroDeLaFranja('sv3 １３４／１０８ SAR')))
}

console.log('── 2. La basura se pegue donde se pegue ──')
{
  for (const [franja, esperado] of [
    ['2進化 リザードンCKT HP330', 'リザードン'],
    ['2進化 リザードンex HP330', 'リザードン'],
    ['2進化 CKTリザードン HP330', 'リザードン'],
    ['2進化 リザードンeX HP330', 'リザードン'],
    ['たね ピカチュウV HP210', 'ピカチュウ'],
    ['1進化 フシギソウ HP100 フシギダネから進化', 'フシギソウ'],
  ]) {
    check(`«${franja.slice(0, 22)}…» → ${esperado}`, nombreDeLaFranja(franja) === esperado, nombreDeLaFranja(franja))
  }
  // Con «リザードン» la base encuentra «リザードンex»: el `like` va por
  // dentro. Buscar MENOS es lo correcto aquí — lo que afina es el número.
  check('un nombre más corto sigue casando por dentro', 'リザードンex'.includes('リザードン'))
}

console.log('── 3. Lo que NO se puede romper ──')
{
  // El occidental, que lleva el sufijo con espacio y en letras normales.
  check('Reshiram EX', nombreDeLaFranja('BÁSICO Reshiram EX PV180') === 'Reshiram EX', nombreDeLaFranja('BÁSICO Reshiram EX PV180'))
  check('Charizard ex', nombreDeLaFranja('Fase 2 Charizard ex HP 330') === 'Charizard ex', nombreDeLaFranja('Fase 2 Charizard ex HP 330'))
  // Un nombre japonés con el alargador (ー) y el repetidor (々) no se parte:
  // son parte de la palabra, no basura latina.
  check('el alargador no parte el nombre', nombreDeLaFranja('たね イーブイ HP70') === 'イーブイ', nombreDeLaFranja('たね イーブイ HP70'))
  check('y un kanji con 々 tampoco', nombreDeLaFranja('たね 々テスト HP70') === '々テスト', nombreDeLaFranja('たね 々テスト HP70'))
  // Y si del trozo no sale ninguna racha japonesa decente, se devuelve el
  // trozo tal cual: quedarse sin nada es peor que quedarse con algo.
  check('si no hay racha, vuelve el trozo', nombreDeLaFranja('たね ア HP70').length > 0)
}

console.log(fails ? `\n❌ ${fails} FALLOS` : '\n✅ TODO BIEN')
process.exit(fails ? 1 : 0)
