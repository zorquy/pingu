// Las novedades de PokeDoc (tanda 829), la parte PURA: agrupar, filtrar y
// decidir qué es nuevo para ti. Sin DOM ni red, así se prueba con node.
//
// Las entradas viven en `/novedades.json`, en el repo: las escribe quien sube
// el cambio, en el mismo momento (PINGU: «hasta ahora lo tenía en un post del
// foro y lo actualizaba a mano»). Una entrada es UNA frase para quien usa la
// web —nada técnico—, con su tipo y, si se puede, un enlace a donde probarlo.

export const TIPOS = {
  nuevo: { rotulo: 'Nuevo', filtro: 'Nuevo' },
  mejora: { rotulo: 'Mejora', filtro: 'Mejoras' },
  arreglo: { rotulo: 'Arreglo', filtro: 'Arreglos' },
}

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// Una fecha «AAAA-MM-DD» como día del calendario, sin husos: las entradas no
// tienen hora, y `new Date('2026-10-13')` es medianoche en UTC, que en España
// todavía es el día 12 a ciertas horas si se pinta con la zona local.
function partes(fecha) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(fecha || ''))
  return m ? { y: Number(m[1]), mes: Number(m[2]), d: Number(m[3]) } : null
}

// El lunes de la semana de una fecha, también como «AAAA-MM-DD».
export function lunesDe(fecha) {
  const p = partes(fecha)
  if (!p) return null
  const dia = new Date(Date.UTC(p.y, p.mes - 1, p.d))
  const desde = (dia.getUTCDay() + 6) % 7
  dia.setUTCDate(dia.getUTCDate() - desde)
  return dia.toISOString().slice(0, 10)
}

export function rotuloDeSemana(lunes) {
  const p = partes(lunes)
  return p ? `Semana del ${p.d} de ${MESES[p.mes - 1]}` : ''
}

export function nombreDeMes(mes) {
  const m = /^(\d{4})-(\d{2})/.exec(String(mes || ''))
  return m ? MESES[Number(m[2]) - 1] : ''
}

// Solo lo que se puede pintar: tipo conocido, fecha válida y texto.
export function entradasValidas(entradas) {
  return (Array.isArray(entradas) ? entradas : []).filter((e) => e && TIPOS[e.tipo] && partes(e.fecha) && typeof e.texto === 'string' && e.texto.trim())
}

// Por semanas, la más nueva arriba; dentro, por fecha y en el orden del
// fichero (lo que se apunta primero en un día es lo que más se nota).
export function porSemanas(entradas, filtro = null) {
  const lista = entradasValidas(entradas).filter((e) => !filtro || e.tipo === filtro)
  const semanas = new Map()
  lista.forEach((e, i) => {
    const lunes = lunesDe(e.fecha)
    if (!semanas.has(lunes)) semanas.set(lunes, [])
    semanas.get(lunes).push({ ...e, orden: i })
  })
  return [...semanas.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([lunes, es]) => ({ lunes, rotulo: rotuloDeSemana(lunes), entradas: es.sort((a, b) => b.fecha.localeCompare(a.fecha) || a.orden - b.orden) }))
}

// Las destacadas: las del mes más reciente que tenga, como mucho tres.
export function destacadasDelMes(destacadas) {
  const validas = (Array.isArray(destacadas) ? destacadas : []).filter((d) => d && /^\d{4}-\d{2}$/.test(String(d.mes)) && d.titulo)
  if (!validas.length) return { mes: null, lista: [] }
  const mes = validas.map((d) => d.mes).sort().at(-1)
  return { mes, lista: validas.filter((d) => d.mes === mes).slice(0, 3) }
}

// Lo NUEVO PARA TI: lo de después de la última vez que abriste la página.
// `visto` es la fecha («AAAA-MM-DD») que se guardó entonces; sin ella (la
// primera vez), no se marca nada: todo sería nuevo y la marca no diría nada.
export function semanasNuevas(semanas, visto) {
  if (!visto) return new Set()
  return new Set(semanas.filter((s) => s.entradas.some((e) => e.fecha > visto)).map((s) => s.lunes))
}

export function ultimaFecha(entradas) {
  return entradasValidas(entradas).map((e) => e.fecha).sort().at(-1) || null
}

// ¿Hay algo después de `visto`? Lo pregunta el menú «Tú» para su punto.
// Quien no la ha abierto nunca lo tiene todo por ver: punto.
export function hayNovedades(entradas, visto) {
  const ultima = ultimaFecha(entradas)
  return Boolean(ultima && (!visto || ultima > visto))
}

export const CLAVE_VISTO = 'pokedoc-novedades-visto'
