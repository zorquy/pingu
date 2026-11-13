// «COMPARTIR» CON IMAGEN EN LAS PÁGINAS PÚBLICAS (tanda 1336). PINGU: «esto a
// la gente le interesaría… al darle al compartir según en qué sitio estés de
// la web». La misma pieza que /admin → Redes (`redes-textos.js`), en la hoja
// de compartir de siempre (`compartir-hoja.js`): la imagen en sus tres
// tamaños (la primera diapositiva: un carrusel es cosa del equipo), el texto
// para X con el enlace y «Publicar en X». Entra por `import()` al pulsar: la
// página no paga nada hasta entonces.
export async function compartirPieza(pieza, { titulo = 'Compartir' } = {}) {
  if (!pieza) return null
  const [{ abrirHojaCompartir }, { pintarDiapositiva }] = await Promise.all([import('./compartir-hoja.js'), import('./redes-piezas.js')])
  const primera = pieza.diapositivas[0]
  const imagen = (formato) => pintarDiapositiva(document.createElement('canvas'), primera, { formato, n: 1, total: 1 })
  const nombre = `pokedoc-${pieza.clave.replace(/[^a-z0-9-]+/gi, '-').replace(/^-|-$/g, '').toLowerCase()}`
  return abrirHojaCompartir({
    // Es de PokeDoc, no de quien lo comparte: sin «únete con mi enlace» (1327).
    invitar: false,
    titulo,
    texto: `${pieza.x.texto}\n\n${pieza.url}`,
    imagen,
    nombre,
    historiaPropia: true,
    x: pieza.x,
  })
}

