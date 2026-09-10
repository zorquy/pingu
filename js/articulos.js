// Guías y noticias son lo mismo con distinto traje (tanda 269).
//
// Las dos viven en `guides` y se leen con la misma página. Las distingue
// la columna `kind`: 'guide' o 'news'. Aquí están las dos cosas que hay
// que compartir para que eso no se convierta en un lío repartido por
// media docena de ficheros.

// La dirección de un artículo. Una noticia vive en /noticias/<slug>
// porque la dirección también dice de qué va la página, y eso lo lee
// tanto quien la copia en un chat como quien la indexa.
export function rutaDeArticulo(kind, slug) {
  const limpio = encodeURIComponent(slug || '')
  return kind === 'news' ? `/noticias/${limpio}` : `/guia.html?slug=${limpio}`
}

// ── El puente mientras la migración no esté puesta ──
//
// `kind` la crea supabase-migration-noticias.sql, y las migraciones las
// ejecuta una persona a mano en el SQL Editor. Entre que esto se
// despliega —que en este sitio es al momento— y alguien ejecuta el SQL,
// la columna NO EXISTE, y una consulta que la filtre no devuelve cero
// filas: devuelve un error 42703 y la lista se queda vacía.
//
// O sea, que sin este puente el despliegue apaga la portada, /aprender y
// las páginas de categoría hasta que alguien se acuerde del SQL. Con él,
// todo sigue exactamente como antes hasta que la columna aparece.
//
// Es temporal, como el `faltaLaRpc` de los torneos: cuando la migración
// lleve un tiempo puesta, esto se quita.
export function faltaElTipo(error) {
  if (!error) return false
  return error.code === '42703' || /\bkind\b/.test(`${error.message || ''} ${error.details || ''}`)
}

export async function conVueltaAtrasDeTipo(conFiltro, sinFiltro) {
  const resultado = await conFiltro()
  if (!faltaElTipo(resultado.error)) return resultado
  console.warn(
    '[articulos] Falta la columna `kind`: se listan guías y noticias juntas. ' +
      'Ejecuta supabase-migration-noticias.sql en Supabase.'
  )
  return sinFiltro()
}

// ── Fechas ──
//
// Las comparten el listado y el artículo, así que viven aquí y no en la
// página de noticias: la fecha de una noticia se pinta en los dos sitios
// y tiene que decir lo mismo.

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
  'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// La que lee la máquina. Va en el atributo `datetime` del <time>, que es
// de donde Google saca la fecha de publicación de una noticia.
export function fechaMaquina(iso) {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toISOString()
}

// «10 de septiembre de 2026». La del artículo: ahí no interesa el «hace
// dos horas», interesa la fecha, que es lo que se cita.
export function fechaLarga(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
}

// «hace 2 horas» para lo de hoy, la fecha para lo de antes.
//
// En una web de noticias el «hace un rato» es información: dice si has
// llegado a tiempo. Pasadas las 48 h deja de decir nada —«hace 23 días»
// no se lee— y entonces vale más la fecha.
export function cuandoFue(iso, ahora = new Date()) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const minutos = Math.floor((ahora - d) / 60000)
  if (minutos < 1) return 'ahora mismo'
  if (minutos < 60) return `hace ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`
  const horas = Math.floor(minutos / 60)
  if (horas < 48) return `hace ${horas} ${horas === 1 ? 'hora' : 'horas'}`
  const mismoAno = d.getFullYear() === ahora.getFullYear()
  return `${d.getDate()} de ${MESES[d.getMonth()]}${mismoAno ? '' : ` de ${d.getFullYear()}`}`
}
