// Tanda 380 — el curador se queda con todo lo que ya se descarga.
//
// PINGU: «hay un montón de colecciones que no tienen logo —Shining
// Legends, la Shiny Vault, todas las Trainer Gallery, la 30th
// Celebration— y la Classic Collection no trae ninguna carta».
//
// Tres síntomas, UNA causa: `cartas-detalle` ya se descarga el SET
// COMPLETO y la CARTA COMPLETA —las peticiones caras, las que la
// importación evita a propósito— y se quedaba con una parte de lo que
// viene dentro. El logo estaba en esa respuesta desde el primer día.
//
// Y una lección que esta tanda pone por escrito: **enseñarle al curador
// un campo nuevo no sirve de nada si no hay forma de volver a pasar por
// lo ya visitado.** La imagen de una carta se guarda DESDE LA 348, y
// ~1.200 cartas seguían sin ella porque ya tenían `detalle_at` y nunca
// se volvían a mirar. El código llevaba dos meses escrito sin aplicarse
// a una sola fila.
import { readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 220) : ''}`)
}
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')
const { loQueFaltaDeUnSet, faltaVisitar, VERSION_CURADO } = await import('/home/user/pingu/netlify/lib/carta-detalle.mjs')
const { detalleDeCarta } = await import('/home/user/pingu/js/carta-detalle.js')

// El set completo tal como lo devuelve TCGdex.
const COMPLETO = {
  id: '30th-c',
  name: '30th Classic Collection',
  logo: 'https://assets.tcgdex.net/en/me/30th-c/logo',
  symbol: 'https://assets.tcgdex.net/univ/me/30th-c/symbol.png',
  cardCount: { total: 30, official: 30 },
  releaseDate: '2026-09-16',
  serie: { id: 'me', name: 'Mega Evolution' },
}

console.log('\n── 1. El logo y las cuentas, que venían y se tiraban ──')
{
  // La 30th Classic Collection, tal como estaba en la base: con sus 30
  // cartas dentro y `card_count_official` a 0. Por eso la estantería
  // decía «0 de 0» y el álbum salía vacío — mide con
  // `card_count_official || card_count_total || 0`.
  const cambios = loQueFaltaDeUnSet(
    { id: '30th-c', logo_path: null, card_count_official: 0, card_count_total: 0,
      serie_id: 'me', serie_name: 'Mega Evolution', release_date: '2026-09-16' },
    COMPLETO
  )
  check('se cura el logo', cambios.logo_path === 'me/30th-c/logo', JSON.stringify(cambios.logo_path))
  check('  …y el símbolo', typeof cambios.symbol_url === 'string')
  check('  …y las dos cuentas', cambios.card_count_official === 30 && cambios.card_count_total === 30,
    `${cambios.card_count_official} / ${cambios.card_count_total}`)
  // El 0 es un número GUARDADO, no un hueco: la condición tiene que
  // tratarlo como «no sabemos cuántas tiene» y no como «tiene cero».
  check('  …y el 0 cuenta como que NO se sabe', cambios.card_count_official === 30)
}

console.log('\n── 2. Lo que no falta no se escribe, y lo que no viene no borra ──')
{
  // Un PATCH por set que ya está bien son 220 escrituras para nada en
  // cada pasada.
  const nada = loQueFaltaDeUnSet(
    { logo_path: 'me/30th-c/logo', symbol_url: 'x', card_count_official: 30, card_count_total: 30,
      serie_id: 'me', serie_name: 'M', release_date: '2026-09-16', tcg_online_code: 'M30' },
    COMPLETO
  )
  check('un set completo no gasta un PATCH', Object.keys(nada).length === 0, JSON.stringify(nada))

  // Y la cautela de siempre: lo que la API no manda NO puede borrar lo
  // que ya estaba bien. Un `logo_path: null` dejaría sin logo a un set
  // que lo tenía, y no daría error en ninguna parte.
  const vacio = loQueFaltaDeUnSet({ logo_path: 'bueno/logo', card_count_official: 12 }, { id: 'x' })
  check('lo que la API no manda no borra nada', Object.keys(vacio).length === 0, JSON.stringify(vacio))
  check('  …ni siquiera con la respuesta a null', Object.keys(loQueFaltaDeUnSet({ logo_path: 'b' }, null)).length === 0)
}

console.log('\n── 3. La versión: a quién se visita y a quién no ──')
{
  // La pregunta NO puede ser «¿le falta el logo?»: hay sets cuyo logo
  // TCGdex no tiene, y esa pregunta no distingue «no lo hemos pedido»
  // de «no existe». Se volverían a pedir cada cinco minutos para
  // siempre — que es EXACTAMENTE el cerrojo de la 333, el que dejó el
  // engorde de cartas sin arrancar jamás.
  check('un set curado por una versión vieja se revisita',
    faltaVisitar({ curado_at: '2026-09-01', curado_v: 0 }) === true)
  check('  …pero solo UNA vez', faltaVisitar({ curado_at: '2026-09-01', curado_v: VERSION_CURADO }) === false)
  check('uno sin curar se visita igual', faltaVisitar({ curado_at: null, curado_v: 0 }) === true)
  // Sin la columna (migración sin ejecutar) se comporta como antes: el
  // código nuevo no puede exigir una columna que todavía no está, o
  // subirlo pararía el engorde en seco.
  check('sin la migración, como antes', faltaVisitar({ curado_at: '2026-09-01' }) === false &&
    faltaVisitar({ curado_at: null }) === true)

  // Y la versión se escribe SIEMPRE, tenga o no tenga el campo: es lo
  // único que impide que lo que TCGdex no tiene se pregunte para
  // siempre.
  const fn = leer('netlify/functions/cartas-detalle.mjs')
  check('la versión se escribe al visitar un set', /curado_v.*=.*VERSION_CURADO/.test(fn))
  check('  …y al mirar una carta, con imagen o sin ella',
    /curado_v: VERSION_CURADO \}\s*:\s*\{ curado_v: VERSION_CURADO \}/.test(fn),
    (fn.match(/const cuerpo = [^\n]*/) || [])[0])
}

console.log('\n── 4. La imagen: el código estaba y no llegaba a nadie ──')
{
  // Esto lleva escrito desde la 348 y sigue bien: se comprueba para que
  // el repaso no tape que la cura de verdad es esta.
  const con = detalleDeCarta({ image: 'https://assets.tcgdex.net/en/sv/sv01/25', hp: 60 })
  check('la ficha de una carta cura su imagen', con.image_path === 'sv/sv01/25', con.image_path)
  const sin = detalleDeCarta({ hp: 60 })
  check('  …y sin imagen no se escribe la clave', !('image_path' in sin),
    JSON.stringify(Object.keys(sin).filter((k) => k.includes('image'))))

  // Lo que faltaba era volver a pasar: el engorde solo mira las que
  // tienen `detalle_at` a null, así que las ~1.200 engordadas ANTES de
  // la 348 nunca se volvieron a visitar.
  const fn = leer('netlify/functions/cartas-detalle.mjs')
  check('hay una fase que repasa las que quedaron sin imagen', /async function cartasSinImagen/.test(fn))
  check('  …y busca por imagen vacía Y versión vieja',
    /image_path=is\.null/.test(fn) && /curado_v=lt\./.test(fn))
  // En inglés y nada más: el escaneo es el mismo fichero en todos los
  // idiomas, y probar cuatro multiplicaría por cuatro la petición cara.
  check('  …pidiendo UN solo idioma', /urlDeCartaEnIdioma\(fila\.id, 'en'\)/.test(fn))
  // Acotada, no excluyente: la lección de la 333 otra vez.
  check('  …y con presupuesto propio, sin llevarse la pasada',
    /PRESUPUESTO_IMAGENES_MS = \d+/.test(fn) && /PRESUPUESTO_IMAGENES_MS\)\s*break/.test(fn))
}

console.log('\n── 5. La migración ──')
{
  const sql = leer('supabase-migration-curado-completo.sql')
  check('añade la versión a las dos tablas',
    /tcg_sets\s+add column if not exists curado_v/.test(sql) && /tcg_cards add column if not exists curado_v/.test(sql))
  // El índice es PARCIAL: lo que se busca son ~1.200 filas de 21.356, y
  // sin el `where` el índice pesaría dieciocho veces más para contestar
  // la misma pregunta. Y cuando el repaso acabe se queda vacío, así que
  // no hay que acordarse de borrarlo.
  check('  …con índices parciales', (sql.match(/where image_path is null and curado_v < 1/g) || []).length === 1 &&
    /where curado_v < 1/.test(sql))
  check('  …y es re-ejecutable', (sql.match(/if not exists/g) || []).length >= 4)
}

console.log('\n── 6. Y el síntoma que se ve en pantalla ──')
{
  // `totalDe` es lo que hacía que la 30th Classic Collection dijera
  // «0 de 0». No se cambia —el arreglo es el dato, no la cuenta— pero
  // se deja escrito de dónde sale, que es lo que costó encontrar.
  const js = leer('js/mi-coleccion.js')
  check('la estantería mide con las cuentas del set',
    /card_count_total \|\| set\?\.card_count_official \|\| 0/.test(js), // el total manda desde la 669
    (js.match(/return set\?\.card_count[^\n]*/) || [])[0])
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
