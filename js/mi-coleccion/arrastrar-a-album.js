// Arrastrar una carta de la rejilla a un ÁLBUM de la barra lateral (741,
// X13 de la lista de propuestas).
//
// Meter una carta en un álbum era abrir su ficha, bajar hasta «Álbumes» y
// tocar el chip, carta a carta. En el ordenador, con la barra lateral
// (739) y el menú de Mi colección dentro (740), tus álbumes cuelgan de
// «Álbumes» y cada uno recibe cartas: coges una de la rejilla y la sueltas
// encima. Pulsar un álbum lo abre.
//
// Arrastrar es SOLO un atajo de ratón: con el teclado o el dedo, el camino
// es el de siempre (la ficha → Álbumes). Por eso las cartas solo se vuelven
// `draggable` cuando el menú está en la lateral, que es pantalla ancha y
// con ratón: en un iPhone, `draggable` convierte la pulsación larga en un
// arrastre y se comería la selección múltiple de la 713.
import { escapeHtml } from '../html.js'

export const TIPO = 'application/x-pokedoc-linea'

// Los álbumes que se ofrecen: los de primer nivel y sus hijas, en orden, con
// la sangría de su hondura. Puro.
export function albumesDeLaLateral(arbol, resumen = new Map(), { tope = 12 } = {}) {
  const fuera = []
  const bajar = (lista, nivel) => {
    for (const c of lista) {
      if (fuera.length >= tope) return
      fuera.push({ id: c.id, nombre: c.nombre || 'Sin nombre', nivel, cartas: resumen.get(c.id)?.cartas ?? null })
      if (nivel < 1) bajar(c.hijas || [], nivel + 1)
    }
  }
  bajar(arbol || [], 0)
  return fuera
}

export function albumesHtml(albumes) {
  if (!albumes.length) return ''
  return `<ul class="lat-albumes" aria-label="Tus álbumes: suelta una carta encima para meterla">${albumes
    .map((a) => `<li><button type="button" class="lat-album${a.nivel ? ' lat-album-hija' : ''}" data-carpeta-destino="${escapeHtml(a.id)}"><span>${escapeHtml(a.nombre)}</span>${a.cartas == null ? '' : `<b>${a.cartas.toLocaleString('es-ES')}</b>`}</button></li>`)
    .join('')}</ul>`
}

// Engancha la rejilla y los álbumes. `meter(carpeta, linea)` guarda y
// devuelve el nombre del álbum (o lanza); `abrir(carpeta)` lo abre.
export function engancharArrastre({ rejilla, caja, meter, abrir, avisar, doc = document }) {
  if (!rejilla || !caja) return
  rejilla.addEventListener('dragstart', (e) => {
    const carta = e.target.closest?.('.mc-carta[data-linea]')
    if (!carta || !e.dataTransfer) return
    e.dataTransfer.setData(TIPO, carta.dataset.linea)
    e.dataTransfer.effectAllowed = 'copy'
    doc.documentElement.classList.add('arrastrando-carta')
  })
  rejilla.addEventListener('dragend', () => doc.documentElement.classList.remove('arrastrando-carta'))
  const destino = (e) => e.target.closest?.('[data-carpeta-destino]')
  caja.addEventListener('dragover', (e) => {
    const d = destino(e)
    if (!d || !e.dataTransfer?.types?.includes(TIPO)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    d.classList.add('sobre')
  })
  caja.addEventListener('dragleave', (e) => destino(e)?.classList.remove('sobre'))
  caja.addEventListener('drop', async (e) => {
    const d = destino(e)
    const linea = e.dataTransfer?.getData(TIPO)
    doc.documentElement.classList.remove('arrastrando-carta')
    if (!d || !linea) return
    e.preventDefault()
    d.classList.remove('sobre')
    try {
      const nombre = await meter(d.dataset.carpetaDestino, linea)
      avisar?.(`Dentro de «${nombre}».`, 'success')
    } catch (err) {
      avisar?.(err?.message || 'No se ha podido meter en el álbum.', 'error')
    }
  })
  caja.addEventListener('click', (e) => {
    const d = destino(e)
    if (d) abrir(d.dataset.carpetaDestino)
  })
}
