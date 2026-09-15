// Que ninguna migración nombre una tabla que no existe (tanda 274).
//
// POR QUÉ EXISTE ESTA PRUEBA. El 2026-09-11 una migración escribió
// `public.profiles` donde la tabla se llama `public.user_profiles`.
// Estaba dentro de una FUNCIÓN de disparador, y el cuerpo de una función
// plpgsql no se comprueba al crearla: Postgres la aceptó sin rechistar y
// la migración pasó limpia. El fallo salió en producción, al guardar la
// primera noticia:
//
//     No se pudo guardar la guía: relation "public.profiles" does not exist
//
// Ninguna prueba de navegador podía verlo —el doble de Supabase no sabe
// SQL— y montar una base de verdad para esto es desproporcionado. Pero
// para pillarlo no hace falta base ninguna: basta con leer los ficheros
// y comprobar que cada tabla que se nombra existe en alguna parte.
import { readdirSync, readFileSync } from 'node:fs'

let fails = 0
const check = (l, ok, extra = '') => {
  if (!ok) fails++
  console.log(`${ok ? '  ok ' : '  FALLA '} ${l}${extra ? '\n        ' + String(extra).split(' | ').join('\n        ') : ''}`)
}

const RAIZ = '/home/user/pingu'

// El esquema ORIGINAL: se montó a mano en el panel de Supabase, antes de
// que este repo llevara migraciones, así que ningún fichero lo crea.
// Está aquí escrito a mano a propósito — si algún día se añade una tabla
// nueva por el panel en vez de por una migración, que cueste un poco y se
// vea, porque esa tabla no la tiene nadie más en su copia.
const DEL_PRINCIPIO = [
  'public.user_profiles',
  'public.guides',
  'public.categories',
  'public.achievement_definitions',
  'public.user_notifications',
  'public.content_reports',
  'public.page_views',
  'public.tcg_cards',
  'public.tcg_sets',
  // De Supabase, no nuestra.
  'auth.users',
]

// Media migración de esta casa es comentario, y en los comentarios se
// nombran tablas al hablar de ellas: fuera antes de mirar nada.
const sinComentarios = (sql) => sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ')

const ficheros = readdirSync(RAIZ).filter((f) => f.startsWith('supabase-migration-') && f.endsWith('.sql'))
const conocidas = new Set(DEL_PRINCIPIO)
const codigo = {}
for (const f of ficheros) {
  const sql = sinComentarios(readFileSync(`${RAIZ}/${f}`, 'utf8'))
  codigo[f] = sql
  for (const m of sql.matchAll(
    /create\s+(?:or\s+replace\s+)?(?:materialized\s+)?(?:table|view)\s+(?:if\s+not\s+exists\s+)?(public\.\w+)/gi
  )) {
    conocidas.add(m[1].toLowerCase())
  }
}
console.log(`\n── ${ficheros.length} migraciones, ${conocidas.size} tablas y vistas conocidas ──`)

// Solo donde de verdad va una tabla. Sin lookahead a propósito: con él,
// `references public.guides (id)` hacía retroceder al motor hasta
// `public.guide` —sin la s— y salían tablas fantasma por todas partes.
// Se captura el nombre entero y se decide DESPUÉS si era una función.
const REFERENCIAS = /\b(?:from|join|into|update|references|alter\s+table(?:\s+if\s+exists)?)\s+(?:only\s+)?(public\.\w+)/gi

const huerfanas = []
for (const [fichero, sql] of Object.entries(codigo)) {
  for (const m of sql.matchAll(REFERENCIAS)) {
    const resto = sql.slice(m.index + m[0].length)
    // Una función se llama con paréntesis y argumentos: `public.f(x)`.
    // Una tabla también puede llevarlos —`references public.t (id)`—, así
    // que lo que la distingue es que dentro haya UNA columna y nada más.
    if (/^\s*\(/.test(resto) && !/^\s*\(\s*\w+\s*\)/.test(resto)) continue
    const tabla = m[1].toLowerCase()
    if (conocidas.has(tabla)) continue
    huerfanas.push(`${fichero}:${sql.slice(0, m.index).split('\n').length} → ${m[1]}`)
  }
}

check('ninguna migración nombra una tabla que no existe', huerfanas.length === 0, huerfanas.join(' | '))

// El caso concreto, con nombre y apellidos, para que en el listado se lea
// qué fue lo que pasó y no solo que algo falla.
const conProfiles = Object.entries(codigo).filter(([, sql]) => /\bpublic\.profiles\b/i.test(sql))
check('nadie vuelve a escribir `public.profiles` (aquí es `user_profiles`)',
  conProfiles.length === 0, conProfiles.map(([f]) => f).join(' | '))

// Y que el arreglo esté puesto de verdad.
const arreglo = readFileSync(`${RAIZ}/supabase-migration-noticias-arreglo.sql`, 'utf8')
check('el arreglo redefine la función contra user_profiles',
  /create or replace function public\.guides_solo_admin_publica_noticias/.test(arreglo) &&
    /from public\.user_profiles/.test(sinComentarios(arreglo)))

console.log(`\n${fails === 0 ? '✅ TODO BIEN' : `❌ ${fails} FALLOS`}`)
process.exit(fails ? 1 : 0)
