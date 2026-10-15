// Compartir un logro o una subida de nivel (873). Entra por `import()`
// desde la celebración (gamification.js), que la baja todo el mundo y no
// tiene por qué cargar la hoja ni el lienzo hasta que alguien pulsa.
//
// Los textos son puros, para probarlos en Node; los emojis van a
// propósito (568): es lo que se pega fuera, no la interfaz.
export const ENLACE = 'pokedoc.es'

export function textoDeLogro({ titulo, descripcion = '' }) {
  return [`🏅 Logro desbloqueado en PokeDoc: ${titulo}`, ...(descripcion ? [descripcion] : []), ENLACE].join('\n')
}

export function textoDeNivel({ nivel }) {
  return [`⬆️ He subido de nivel en PokeDoc: ahora soy ${nivel}`, ENLACE].join('\n')
}

async function abrir({ titulo, texto, nombre, imagen }) {
  const { abrirHojaCompartir } = await import('./compartir-hoja.js')
  return abrirHojaCompartir({
    titulo,
    texto,
    nombre,
    imagen: async (formato) => {
      const { pintarResultadoReto } = await import('./reto-imagen.js')
      return pintarResultadoReto(document.createElement('canvas'), { ...imagen, enlace: ENLACE, formato })
    },
  })
}

export function compartirLogro(logro) {
  return abrir({
    titulo: 'Logro desbloqueado',
    texto: textoDeLogro({ titulo: logro.title, descripcion: logro.description || '' }),
    nombre: `logro-${String(logro.id || 'pokedoc').toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    imagen: { arriba: 'PokeDoc · logros', titulo: 'Logro desbloqueado', cuenta: logro.title, detalle: logro.description || '' },
  })
}

export function compartirNivel(nivel) {
  return abrir({
    titulo: 'Nuevo nivel',
    texto: textoDeNivel({ nivel }),
    nombre: `nivel-${String(nivel).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    imagen: { arriba: 'PokeDoc · niveles', titulo: 'He subido de nivel', cuenta: nivel, detalle: '' },
  })
}
