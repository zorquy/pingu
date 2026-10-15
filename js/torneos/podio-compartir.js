// Compartir un puesto del podio (873): «Campeón de la Copa X en PokeDoc».
// Lo abre el botón que ronda.js pinta en TU puesto del podio; entra por
// `import()`, que la ficha del torneo ya pesa lo suyo.
//
// Para IBAI: no toca el motor ni la base; solo lee el nombre, el slug y el
// puesto que ya están pintados.
export const PUESTOS = ['Campeón', 'Finalista', 'Semifinalista', 'Semifinalista']
const EMOJI = ['🏆', '🥈', '🥉', '🥉']
const ORDINAL = ['1.º', '2.º', '3.º–4.º', '3.º–4.º']

export const enlaceDeTorneo = (slug) => `pokedoc.es/torneo?slug=${encodeURIComponent(slug || '')}`

export function textoDePodio({ nombre, slug, puesto }) {
  const i = Math.max(0, Math.min(3, Number(puesto) || 0))
  return [`${EMOJI[i]} ${PUESTOS[i]} de ${nombre} en PokeDoc`, enlaceDeTorneo(slug)].join('\n')
}

export async function compartirPodio({ nombre, slug, puesto }) {
  const { abrirHojaCompartir } = await import('../compartir-hoja.js')
  const i = Math.max(0, Math.min(3, Number(puesto) || 0))
  return abrirHojaCompartir({
    titulo: PUESTOS[i],
    texto: textoDePodio({ nombre, slug, puesto: i }),
    nombre: `torneo-${String(slug || 'pokedoc').replace(/[^a-z0-9-]+/gi, '-')}`,
    imagen: async (formato) => {
      const { pintarResultadoReto } = await import('../reto-imagen.js')
      return pintarResultadoReto(document.createElement('canvas'), {
        arriba: 'PokeDoc · torneos',
        titulo: nombre,
        cuenta: ORDINAL[i],
        detalle: PUESTOS[i],
        enlace: enlaceDeTorneo(slug),
        formato,
      })
    },
  })
}
