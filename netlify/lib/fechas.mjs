// Fechas en español para los avisos (tanda 249).
//
// Un correo de «inscripciones abiertas» que no dice CUÁNDO se juega no
// sirve de nada: lo abres y sigues sin saber si es mañana o dentro de un
// mes. Esto pone la fecha en cristiano y en hora de España.
//
// ── Por qué no se usa toLocaleString('es-ES') a secas ──
//
// Porque depende de que el Node que ejecute la función traiga los datos
// del idioma español (ICU completo). En un runtime con ICU pequeño —y no
// controlamos el de Netlify— saldría en inglés sin avisar de nada, y un
// «Friday, September 4» en un correo en español canta.
//
// Así que la ZONA HORARIA se la pedimos a Intl, que eso sí lo trae
// cualquier compilación, y los NOMBRES los ponemos nosotros.

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']
const MESES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

// La medianoche se escribe «00», pero no siempre.
//
// Intl tiene dos ciclos de 24 horas: h23 (00–23) y h24 (01–24). Con h24,
// la medianoche sale como «24» y un torneo de las 00:00 se anunciaría
// «a las 24:00». Hoy `hour12: false` da h23 en el Node de aquí — pero
// esto lo ejecuta el runtime de Netlify, que no controlamos, y el mapeo
// de `hour12: false` a un ciclo u otro ha cambiado entre versiones de V8.
//
// Así que se piden las dos cosas: el ciclo h23 EXPLÍCITO abajo, y esta
// normalización por si acaso. Va aparte y exportada para poder probarla
// de verdad: metida dentro de `piezas` era una rama que ninguna fecha
// llegaba a ejercitar, y una rama que no se prueba es una rama que no
// sabes si funciona.
export function normalizarHora(valor) {
  const n = Number(valor)
  if (!Number.isFinite(n)) return 0
  return n % 24
}

// Las piezas de una fecha ya en hora de Madrid.
function piezas(iso, zona) {
  // `new Date(null)` NO es una fecha inválida: es el 1 de enero de 1970,
  // y sin esta línea un torneo sin fecha se anunciaba para 1970.
  if (iso === null || iso === undefined || iso === '') return null
  const fecha = new Date(iso)
  if (Number.isNaN(fecha.getTime())) return null
  const fmt = new Intl.DateTimeFormat('en-GB', {
    timeZone: zona,
    weekday: 'short', day: 'numeric', month: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  })
  const p = Object.fromEntries(fmt.formatToParts(fecha).map((x) => [x.type, x.value]))
  const diaSemana = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(p.weekday)
  return {
    diaSemana,
    dia: Number(p.day),
    mes: Number(p.month) - 1,
    anio: Number(p.year),
    hora: normalizarHora(p.hour),
    minuto: Number(p.minute),
  }
}

// «viernes 4 de septiembre a las 19:00». Sin el año, que en un aviso de
// algo que pasa esta semana solo estorba — salvo que no sea este año.
export function fechaLargaEs(iso, { zona = 'Europe/Madrid', ahora = new Date() } = {}) {
  const f = piezas(iso, zona)
  if (!f) return null
  const anioActual = piezas(ahora.toISOString(), zona)?.anio
  const anio = f.anio !== anioActual ? ` de ${f.anio}` : ''
  const hora = `${String(f.hora).padStart(2, '0')}:${String(f.minuto).padStart(2, '0')}`
  return `${DIAS[f.diaSemana]} ${f.dia} de ${MESES[f.mes]}${anio} a las ${hora}`
}

// Solo la hora: «19:00». Para el recordatorio, que ya dice el día.
export function horaEs(iso, { zona = 'Europe/Madrid' } = {}) {
  const f = piezas(iso, zona)
  if (!f) return null
  return `${String(f.hora).padStart(2, '0')}:${String(f.minuto).padStart(2, '0')}`
}
