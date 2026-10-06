// Tanda 391 — la Pokédex llevaba desde la 381 sin rellenar NI UNA carta.
//
// PINGU: «la Pokédex dice que está vacío el catálogo; entro en Bulbasaur
// y no hay nada». Y no era la pantalla: `cartas-pokedex.mjs` guardaba con
// un UPSERT parcial de PostgREST, que se traduce a `INSERT … ON CONFLICT
// DO UPDATE` — y el INSERT se evalúa PRIMERO, así que reventaba contra
// los NOT NULL de `set_id`, `local_id` y `name`:
//
//     null value in column "set_id" violates not-null constraint
//
// Cada diez minutos, en silencio, durante toda la vida de la función.
//
// **Un UPSERT no es un UPDATE con otro nombre.** Para tocar una columna
// de una fila que ya existe hace falta un UPDATE.
import { readFileSync, readdirSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? ' — ' + String(extra).slice(0, 200) : ''}`)
}
const RAIZ = '/home/user/pingu'
const leer = (f) => readFileSync(`${RAIZ}/${f}`, 'utf8')

console.log('\n── 1. Nadie hace un UPSERT parcial sobre una tabla con NOT NULL ──')
{
  // La FORMA del fallo: un `on_conflict` manda un INSERT, así que el
  // cuerpo tiene que traer TODAS las columnas obligatorias de esa tabla.
  // Las obligatorias se leen de las migraciones, no de una lista aquí.
  const obligatorias = (tabla) => {
    for (const f of readdirSync(RAIZ).filter((x) => /^supabase-migration-.*\.sql$/.test(x))) {
      const t = leer(f)
      const m = new RegExp(`create table (?:if not exists )?(?:public\\.)?${tabla} \\(([\\s\\S]*?)\\n\\);`).exec(t)
      if (!m) continue
      return m[1]
        .split('\n')
        .map((l) => l.trim())
        .filter((l) => /\bnot null\b/i.test(l) && !/^(primary|unique|constraint|foreign|check)/i.test(l))
        .map((l) => l.split(/\s+/)[0])
        .filter((c) => !/default/i.test(l0(m[1], c)))
    }
    return null
  }
  // ¿esa columna trae `default`? Entonces el INSERT no la necesita.
  function l0(bloque, col) {
    return bloque.split('\n').find((l) => l.trim().startsWith(col + ' ')) || ''
  }

  // ── EL BARRIDO TIENE QUE SEGUIR AL MAPEADOR (tanda 472) ──
  //
  // Mirar solo el texto de alrededor da por hecho que las columnas se
  // escriben a mano justo ahí. `catalogo-asia.mjs` las monta con
  // `cardToRow(...)`, que vive en `js/catalogo-tcgdex.js`, así que la
  // guarda lo cantó como «upsert sin set_id, local_id, name» cuando las
  // tres estaban. Es la lección de la 307 otra vez: un barrido que no
  // sigue de dónde sale el dato afirma cosas sobre un sitio donde el dato
  // no está.
  //
  // Se recogen los cuerpos de las funciones PURAS que montan filas y, si
  // el trozo llama a una, se le pega su cuerpo antes de buscar. Si alguien
  // le quita `name` a `cardToRow`, esto se pone rojo — que es lo que la
  // guarda tiene que hacer.
  const MODULOS_PUROS = ['js/catalogo-tcgdex.js', 'netlify/lib/carta-detalle.mjs', 'js/carta-detalle.js', 'netlify/lib/scrydex.mjs']
  const mapeadores = new Map()
  for (const f of MODULOS_PUROS) {
    for (const m of leer(f).matchAll(/export function (\w+)\(([\s\S]*?)\n\}/g)) {
      mapeadores.set(m[1], m[2])
    }
  }
  check('se han encontrado los mapeadores puros', mapeadores.has('cardToRow') && mapeadores.has('setToRow'),
    `${mapeadores.size} funciones`)

  // La función (o la constante con flecha) que contiene esa posición: desde
  // la última declaración a nivel de fichero que hay por encima, hasta el
  // `}` de la columna cero que la cierra. Es la unidad natural — quien hace
  // el upsert es quien monta las filas.
  function funcionQueContiene(texto, pos) {
    const antes = texto.slice(0, pos)
    const decl = [...antes.matchAll(/\n(?:export )?(?:async )?(?:function|const) /g)]
    const desde = decl.length ? decl[decl.length - 1].index : 0
    const cierre = texto.indexOf('\n}', pos)
    return texto.slice(desde, cierre === -1 ? texto.length : cierre + 2)
  }

  const malos = []
  for (const f of readdirSync(`${RAIZ}/netlify/functions`).filter((x) => x.endsWith('.mjs'))) {
    const t = leer(`netlify/functions/${f}`)
    for (const m of t.matchAll(/['"`]([\w]+)\?on_conflict=([\w,]+)['"`]/g)) {
      const tabla = m[1]
      const req = obligatorias(tabla)
      if (!req || !req.length) continue
      // Las claves que manda: LA FUNCIÓN QUE HACE EL UPSERT, entera.
      //
      // Era una ventana de ±1.200 caracteres y eso es demasiado flojo: en
      // `catalogo-asia.mjs` arrastraba la función de al lado, que llama a
      // `setToRow` — y `setToRow` tiene `name`, así que la guarda daba por
      // buena una `cardToRow` a la que le quitaras el `name`. Comprobado
      // quitándoselo: salía verde. **Una mutación que no cambia el
      // resultado no es una prueba aprobada** (la norma de la 314).
      let trozo = funcionQueContiene(t, m.index)
      // Más el cuerpo de los mapeadores puros a los que ESA función llame.
      for (const [nombre, cuerpo] of mapeadores) {
        if (new RegExp(`\\b${nombre}\\(`).test(trozo)) trozo += '\n' + cuerpo
      }
      const faltan = req.filter((c) => !new RegExp(`\\b${c}\\b`).test(trozo))
      if (faltan.length) malos.push(`${f}: upsert a ${tabla} sin ${faltan.join(', ')}`)
    }
  }
  check('ningún upsert se deja una columna obligatoria', malos.length === 0, malos.join(' | '))

  // Y el caso concreto, nombrado: la Pokédex escribe por su función.
  const pk = leer('netlify/functions/cartas-pokedex.mjs')
  check('la Pokédex guarda por rpc/pokedex_marcar', /rpc\/pokedex_marcar/.test(pk))
  // Sin comentarios: arriba se EXPLICA el fallo y la palabra aparece en
  // la explicación. Al barrer código buscando una cadena, todo lo que la
  // CONTIENE cuenta (la trampa de la 312, que ya picó en la 388).
  const pkCodigo = pk.replace(/\/\/[^\n]*/g, '')
  check('  …y ya no hace ningún upsert', !/on_conflict/.test(pkCodigo))
}

console.log('\n── 2. El centinela se respeta ──')
{
  // `{}` es «mirada y no lleva ningún Pokémon», y es lo que hace que la
  // cola se vacíe: si volviera null, esas cartas volverían en cada
  // pasada para siempre (tandas 333, 380 y 381).
  const sql = leer('supabase-migration-pokedex-marcar.sql')
  check('la función no puede devolver null', /coalesce\(\s*\n?\s*\(select array_agg/.test(sql) && /'\{\}'::int\[\]/.test(sql))
  check('y es un UPDATE, no un INSERT', /update public\.tcg_cards/.test(sql) && !/insert into public\.tcg_cards/.test(sql))
  // El permiso, que es lo que costó la 388.
  check('se le da a service_role', /grant execute on function public\.pokedex_marcar\(jsonb\) to service_role/.test(sql))
  check('y se le quita a quien tiene sesión', /revoke all on function public\.pokedex_marcar\(jsonb\) from public, anon, authenticated/.test(sql))
}

console.log(fails === 0 ? '\n✅ TODO BIEN' : `\n❌ ${fails} fallan`)
process.exit(fails === 0 ? 0 : 1)
