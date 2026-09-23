// Tanda 343 — saber si un set se ha VISITADO, no si le falta un campo.
//
// PINGU, comparando /cartas con Limitless: «los sets están mal, pones la
// nomenclatura asiática y no la occidental». Donde Limitless dice PBL,
// SSP o TWM, PokeDoc decía ME05, SV08 o SV06 — lo primero es el código
// de TCG Live, con el que habla la gente y que sale en las decklists; lo
// segundo es el identificador interno de TCGdex.
//
// Y el código de pintar YA prefiere el de Live. Lo que faltaba era el
// DATO, y falta por una razón que es el tema de esta tanda: las dos
// versiones anteriores preguntaban «¿le falta ESTE campo?», y esa
// pregunta no distingue «no lo hemos pedido» de «TCGdex no lo tiene».
import { readFileSync } from 'node:fs'
import { faltaVisitar, leFaltaAlgo } from '/home/user/pingu/netlify/lib/carta-detalle.mjs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const leer = (f) => readFileSync(`/home/user/pingu/${f}`, 'utf8')

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 1. Con la columna puesta, manda la VISITA ──')
{
  const visitado = { id: 'sv8', serie_id: 'sv', serie_name: 'SV', tcg_online_code: 'SSP',
    curado_at: '2026-09-23T00:00:00Z' }
  check('un set ya visitado no se vuelve a pedir', !faltaVisitar(visitado))
  check('uno sin visitar, sí', faltaVisitar({ ...visitado, curado_at: null }))

  // EL CASO DEL FALLO: tiene serie —así que la regla de la 333 lo daba
  // por completo— pero le falta el código de TCG Live. Con la visita
  // como criterio, se va a pedir.
  const conSerieSinCodigo = { id: 'me05', serie_id: 'me', serie_name: 'Mega',
    tcg_online_code: null, curado_at: null }
  check('el del fallo (con serie, sin código) se pide', faltaVisitar(conSerieSinCodigo))
  check('…y la regla vieja lo daba por bueno', !leFaltaAlgo(conSerieSinCodigo))

  // Y EL CERROJO DE LA 333, que es lo que no puede volver: un set
  // anterior a TCG Online no tiene código y no lo va a tener nunca. Una
  // vez visitado se queda quieto, aunque siga sin código.
  const viejoSinCodigo = { id: 'base1', serie_id: 'base', serie_name: 'Base',
    tcg_online_code: null, curado_at: '2026-09-23T00:00:00Z' }
  check('un set que nunca tendrá código no se pide para siempre',
    !faltaVisitar(viejoSinCodigo))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 2. Sin la columna, la regla vieja ──')
{
  // Mientras la migración no esté puesta, `curado_at` no viaja en la
  // respuesta. `'curado_at' in fila` distingue «la columna no está» de
  // «está y vale null», que es justo la confusión que esto viene a
  // quitar — con un `!fila.curado_at` a secas, TODOS los sets saldrían
  // sin visitar y la fase se comería las pasadas para siempre.
  const sinColumna = { id: 'sv8', serie_id: 'sv', serie_name: 'SV', tcg_online_code: 'SSP' }
  check('un set completo con la regla vieja no se pide', !faltaVisitar(sinColumna))
  check('…y uno sin serie sí', faltaVisitar({ id: 'x', serie_id: null, serie_name: null }))
  // La diferencia que importa: null es «no visitado», ausente es «no se
  // puede saber, usa la regla vieja».
  check('null y ausente NO son lo mismo',
    faltaVisitar({ ...sinColumna, curado_at: null }) !== faltaVisitar(sinColumna))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 3. La marca se escribe aunque no hubiera nada que curar ──')
{
  const tarea = leer('netlify/functions/cartas-detalle.mjs')
  check('la tarea usa la visita y no el campo', /filter\(faltaVisitar\)/.test(tarea))
  check('…y ya no usa leFaltaAlgo', !/filter\(leFaltaAlgo\)/.test(tarea))
  // Sin esto el set volvería en cada pasada: sería el cerrojo de la 333
  // dicho de otra manera.
  check('`curado_at` se escribe siempre, no solo si hubo cambios',
    /const marca = 'curado_at' in fila \? \{ curado_at: new Date\(\)\.toISOString\(\) \} : \{\}/.test(tarea))
  check('…y el PATCH lo lleva junto a lo demás',
    /body: JSON\.stringify\(\{ \.\.\.cambios, \.\.\.marca \}\)/.test(tarea))
  // Y lo que no puede pasar: mandarla sin la migración. Este PATCH lleva
  // TAMBIÉN la serie y la fecha, así que un 400 se llevaría por delante
  // la cura entera, no solo la marca.
  check('no se manda la columna si no existe', /'curado_at' in fila \?/.test(tarea))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 4. Y las columnas se piden de más a menos, una a una ──')
{
  const tarea = leer('netlify/functions/cartas-detalle.mjs')
  const candidatas = (tarea.match(/const CANDIDATAS = \[([\s\S]*?)\]/)?.[1] || '')
    .split('\n').map((l) => l.trim()).filter(Boolean)
  check('hay varios escalones', candidatas.length >= 4, String(candidatas.length))
  // Uno a uno y no todo de golpe: con la migración de la 339 puesta y
  // esta sin poner, no se puede perder también la marca de regulación.
  check('el primero lo pide todo',
    /curado_at/.test(candidatas[0]) && /names_fixed_at/.test(candidatas[0]) &&
      /regulation_mark/.test(candidatas[0]), candidatas[0])
  check('el segundo suelta solo la última columna nueva',
    !/names_fixed_at/.test(candidatas[1]) && /curado_at/.test(candidatas[1]) &&
      /regulation_mark/.test(candidatas[1]), candidatas[1])
  check('el tercero suelta la siguiente',
    !/curado_at/.test(candidatas[2]) && /regulation_mark/.test(candidatas[2]), candidatas[2])
  check('y el último es el de siempre',
    !/regulation_mark/.test(candidatas.at(-1)), candidatas.at(-1))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 5. Y la migración ──')
{
  const sql = leer('supabase-migration-sets-curado.sql')
  check('añade la columna', /add column if not exists curado_at timestamptz/.test(sql))
  // Sin rellenar nada: los 220 sets se visitan una vez y ya. Rellenarla
  // de entrada daría por visitados los que nunca lo han sido, que es el
  // fallo que esto arregla.
  check('no da por visitado a nadie', !/update public\.tcg_sets[\s\S]*set curado_at/.test(sql))
  check('y deja dicho qué pregunta responde', /hemos ido a mirar/.test(sql))
}

// ═════════════════════════════════════════════════════════════════════
console.log('\n── 6. Y lo que se pinta sigue prefiriendo el de Live ──')
{
  // Esto ya estaba bien y por eso no se toca: el fallo era el dato, no
  // el molde. Se comprueba para que nadie lo «arregle» al revés.
  const cartas = leer('js/cartas.js')
  check('la insignia prefiere el código de TCG Live',
    /set\?\.tcg_online_code \|\| set\?\.id/.test(cartas), cartas.match(/return String\(set[^\n]*/)?.[0])
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
