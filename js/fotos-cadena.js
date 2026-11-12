// Copiar fotos de cartas de un sitio a otro SIN perder su cadena de respaldo
// (1296). La vitrina pinta cada carta con la primera dirección de su cadena
// (`cadenaDeEscaneo`) y, si no carga, salta a la siguiente (`data-cadena`).
// El Resumen del perfil y la losa de «Cartas» copiaban `img.src` tal cual en
// el momento de copiar: si esa foto aún no había fallado, se llevaban la rota
// y se quedaban con ella (PINGU: «salen como rotas… pero en la colección no»).
// Ahora la copia se lleva lo que le queda de cadena y salta igual.

// Lo que hay que copiar de cada <img> de `origen`: su dirección de ahora, lo
// que le queda de cadena y su alt. Las que ya se rindieron (escondidas o sin
// dirección) no se copian.
export function fotosDe(origen, maximo = 8) {
  return [...(origen?.querySelectorAll('img') || [])]
    .filter((i) => i.style.visibility !== 'hidden' && (i.currentSrc || i.getAttribute('src')))
    .slice(0, maximo)
    .map((i) => {
      let cadena = []
      try { cadena = JSON.parse(i.dataset.cadena || '[]') } catch {}
      return { src: i.currentSrc || i.getAttribute('src'), cadena: Array.isArray(cadena) ? cadena : [], alt: i.alt || '' }
    })
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// El <img> de una copia, con su cadena para el salto.
export const imgDeFoto = (f, ancho, alto) => `<img src="${esc(f.src)}" data-cadena="${esc(JSON.stringify(f.cadena || []))}" alt="${esc(f.alt)}" width="${ancho}" height="${alto}" loading="lazy" decoding="async">`

// El salto: una foto que no carga pasa a la siguiente de su cadena; sin más,
// se esconde (un hueco es mejor que el icono de foto rota). Una vez por caja.
export function engancharCadena(caja) {
  if (!caja || caja.dataset.cadenaLista) return
  caja.dataset.cadenaLista = '1'
  caja.addEventListener('error', (e) => {
    const img = e.target
    if (!(img instanceof HTMLImageElement)) return
    let resto = []
    try { resto = JSON.parse(img.dataset.cadena || '[]') } catch {}
    if (resto.length) {
      img.dataset.cadena = JSON.stringify(resto.slice(1))
      img.src = resto[0]
    } else img.style.visibility = 'hidden'
  }, true)
}
