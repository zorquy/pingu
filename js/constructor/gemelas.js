// LO QUE LE FALTA A UNA IMPRESIÓN, DESDE OTRA DE LA MISMA CARTA (tanda 913).
//
// PINGU: «en jugar, muchas cartas no se reconocen en repeticiones». Las de
// los Prize Pack (tg-741, tg-742, tg-743) y las del 30 aniversario las crea
// TCGGO, que no da ni la categoría, ni los PS, ni los ataques, ni el nombre
// en español: de las 125 cartas de sus trece partidas guardadas, 18 eran de
// esas. En la repetición salían sin barra de vida (sin PS no se sabe cuándo
// cae), un Pokémon que solo pasó por la mano se contaba como Entrenador, y
// en «Jugar desde aquí» el laboratorio no sabía qué hacían.
//
// Lo que juega una carta no depende de la impresión: el Dudunsparce del
// Prize Pack ES el de Fuerzas Temporales con un sello. Así que lo que falta
// se copia de otra impresión con el mismo nombre que sí lo tenga — pero
// solo lo que no admite duda:
//
//   · Si la impresión dice de dónde viene («129/162», como numera TCGGO los
//     Prize Pack), la original: el set con 162 cartas oficiales y en él la
//     129. Esa es la carta exacta y se copia todo.
//   · Si no, cada campo SOLO si todas las demás impresiones que lo tienen
//     dicen lo mismo. Hay cartas distintas que se llaman igual (cada Pikachu
//     tiene sus PS y sus ataques): si no coinciden, ese campo se queda vacío,
//     que es lo que ya pasaba. Los ataques se comparan por su FORMA (coste y
//     daño), porque unas filas los guardan en español y otras en inglés.
//
// Sin DOM y sin Supabase: se prueba en Node. La consulta va en datos.js.
import { plano } from '../clave-de-nombre.js'

// Lo que se rellena para PINTAR (las columnas del constructor) y lo que se
// rellena para JUGAR (las del laboratorio).
export const CAMPOS_DE_FICHA = ['category', 'stage', 'evolve_from', 'trainer_type', 'energy_type', 'suffix', 'hp', 'types', 'name_es']
export const CAMPOS_DE_JUEGO = ['attacks', 'abilities', 'retreat', 'weaknesses', 'resistances', 'hp', 'types', 'stage', 'evolve_from']

const vacio = (v) => v == null || v === '' || (Array.isArray(v) && !v.length)
const SOLO_LA_MISMA = new Set(['attacks', 'abilities', 'retreat', 'weaknesses', 'resistances', 'evolve_from', 'stage'])

// ¿Le falta algo que se pueda pedir a otra impresión?
export const faltanDatos = (c, campos = CAMPOS_DE_FICHA) => Boolean(c?.name_key || c?.name) && campos.some((k) => vacio(c?.[k]))

// La clave con la que se buscan las gemelas: la de la base (`name_key`) o,
// si no viene, el nombre normalizado igual que ella.
export const claveDeGemela = (c) => c?.name_key || plano(c?.name) || null

// La forma de un valor para decidir si dos impresiones dicen lo mismo, sin
// que el idioma lo cambie: de un ataque, su coste y su daño; de una lista de
// debilidades, sus tipos; un texto, normalizado.
function forma(campo, v) {
  if (vacio(v)) return null
  if (campo === 'attacks') return JSON.stringify(v.map((a) => [(a?.cost || []).length, String(a?.damage ?? '').replace(/\D/g, '')]))
  if (campo === 'abilities') return JSON.stringify(v.map((a) => String(a?.type || 'ability').toLowerCase()))
  if (campo === 'weaknesses' || campo === 'resistances') return JSON.stringify(v.map((x) => plano(x?.type)))
  if (campo === 'types') return JSON.stringify([...v].map(plano).sort())
  if (campo === 'hp' || campo === 'retreat') return String(Number(v))
  if (Array.isArray(v)) return JSON.stringify(v)
  if (typeof v === 'object') return JSON.stringify(v)
  return plano(v)
}

// «129/162» → { numero: '129', total: 162 }.
function deDondeViene(localId) {
  const m = /^\s*([A-Za-z]*\d+[A-Za-z]?)\s*\/\s*(\d+)\s*$/.exec(String(localId ?? ''))
  return m ? { numero: m[1].replace(/^0+(?=\d)/, '').toLowerCase(), total: Number(m[2]) } : null
}
const numeroPlano = (n) => String(n ?? '').trim().toLowerCase().replace(/^0+(?=\d)/, '')

// La carta `c` con lo que le falta, sacado de `gemelas` (filas del mismo
// nombre). `totalDeSet(setId)` dice cuántas cartas oficiales tiene un set
// (para encontrar la original de un «129/162»). Devuelve una copia; si no
// hay nada que poner, la misma fila.
export function completarConGemelas(c, gemelas, { campos = CAMPOS_DE_FICHA, totalDeSet = () => null } = {}) {
  if (!c) return c
  const faltan = campos.filter((k) => vacio(c[k]))
  if (!faltan.length) return c
  const clave = claveDeGemela(c)
  const otras = (gemelas || []).filter((g) => g && g.id !== c.id && claveDeGemela(g) === clave)
  if (!otras.length) return c
  const origen = deDondeViene(c.local_id)
  const original = origen ? otras.find((g) => numeroPlano(g.local_id) === origen.numero && Number(totalDeSet(g.set_id)) === origen.total) : null
  // Lo que solo vale si es LA MISMA carta (lo que hace en la mesa): sin la
  // original, se exige además que todas las que tienen PS digan los mismos
  // PS. Dos Pokémon que se llaman igual y tienen PS distintos son dos
  // cartas, y los ataques de una no son los de la otra. Si entre TODAS no
  // coinciden, se mira entre las modernas (las que llevan letra de
  // reglamento): el Mew ex del 30 aniversario no es el de 2006 (90 PS), pero
  // sí el de 151 y su promo (180).
  const unanime = (lista, k) => {
    const con = lista.filter((g) => !vacio(g[k]))
    return con.length && new Set(con.map((g) => forma(k, g[k]))).size === 1 ? con[0][k] : null
  }
  const psUnanimes = (lista) => lista.length > 0 && (lista.every((g) => vacio(g.hp)) || unanime(lista, 'hp') != null)
  const grupo = [otras, otras.filter((g) => g.regulation_mark)].find(psUnanimes) || null
  const fuera = { ...c }
  let cambia = false
  for (const k of faltan) {
    let valor = null
    if (original && !vacio(original[k])) valor = original[k]
    else if (grupo) valor = unanime(grupo, k)
    else if (!SOLO_LA_MISMA.has(k) && k !== 'hp') valor = unanime(otras, k)
    if (valor != null) {
      fuera[k] = valor
      cambia = true
    }
  }
  return cambia ? fuera : c
}
