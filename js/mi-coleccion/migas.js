// Las migas de pan de Mi colección (tanda 474).
//
// Tres pantallas de la sección tienen un «dentro»: una expansión abierta,
// un Pokémon de la Pokédex y una carpeta. Las tres tenían su propia chapa
// de volver —«← Todas las colecciones», «← Todos los Pokémon», «←
// Carpetas»— escrita tres veces y con tres pintas distintas según la tanda
// que la hubiera tocado por última vez.
//
// PINGU: «estás ocupando mucho espacio arriba… el botón de volver atrás,
// yo quitaría ese botón». Una chapa de 44 px en una fila para ella sola es
// mucho sitio para decir dónde estás, y además lo dice al revés: una chapa
// cuenta A DÓNDE VAS, y lo que hace falta saber es DE DÓNDE VIENES.
//
// Así que una miga: texto pequeño, el sitio de arriba y un «›». Es lo que
// hace Dex y es lo que hace todo el mundo.
//
// Y una advertencia, porque PINGU lleva cuatro tandas diciéndolo: **esto
// NO es un «enlace pocho»**. Lo que él llama así es un `link-btn` azul y
// subrayado metido en una fila de botones. Una miga no va subrayada, no va
// del azul de los enlaces y no compite con nada: es un rótulo gris encima
// del título, que es exactamente donde se busca.
//
// Módulo suelto y sin dependencias para que lo usen los tres sitios: esta
// misma página, `pokedex.js` y lo que pinta las carpetas. Tres copias de
// una miga se separan — es lo que acaba de pasar con las tres chapas.

// `pasos`: una lista de `{ texto, id }`. El que lleva `id` es un botón
// —ese identificador es por el que lo busca quien engancha el clic— y el
// que no lo lleva es el sitio donde estás, que no se pulsa.
//
// Detrás de CADA paso que se pulsa va un «›», también si es el último: así
// `[{Expansiones, id}]` sale como «Expansiones ›», que es la forma corta
// para cuando el título grande de debajo ya dice dónde estás.
export function migasHtml(pasos) {
  const escapar = (t) =>
    String(t ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  const trozos = []
  for (const paso of pasos || []) {
    if (!paso?.texto) continue
    if (paso.id) {
      trozos.push(
        `<button type="button" class="mc-miga" id="${escapar(paso.id)}">${escapar(paso.texto)}</button>`,
        // `aria-hidden` en el separador: un lector de pantalla no tiene
        // que leer «mayor que» entre dos sitios.
        '<span class="mc-miga-sep" aria-hidden="true">›</span>'
      )
    } else {
      // `aria-current="page"` es lo que distingue «dónde estoy» de «a
      // dónde puedo ir» para quien no ve la pinta.
      trozos.push(`<span class="mc-miga-aqui" aria-current="page">${escapar(paso.texto)}</span>`)
    }
  }
  if (!trozos.length) return ''
  return `<nav class="mc-migas" aria-label="Dónde estás">${trozos.join('')}</nav>`
}
