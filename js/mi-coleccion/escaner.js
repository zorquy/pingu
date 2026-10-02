// El escáner de cartas (tanda 447).
//
// PINGU quería el de Dex: abres la cámara y reconoce la carta. Dex lo hace
// en TIEMPO REAL porque es una app nativa y usa el OCR del propio iPhone
// —el framework Vision de Apple; la lista de idiomas de su pantalla es
// literalmente la de Vision—. Una página web no puede: el equivalente del
// navegador, la Shape Detection API, solo funciona en Chrome tras una
// bandera de funciones experimentales, y en Safari de iOS dejó de
// funcionar en iOS 18.
//
// Así que esto es el OTRO modo que Dex también tiene, el «Snap»: encuadras
// con las mismas dos guías, tocas, y se leen esas dos franjas. Se pierde el
// «apunta y ya»; se gana que funcione en iPhone, en Android y en el
// ordenador.
//
// POR QUÉ SE RECORTAN DOS FRANJAS Y NO SE MANDA LA FOTO: una foto de
// cámara son dos o tres megas y lo que hay que leer son cuatro palabras.
// Dos franjas estrechas en JPEG son unas decenas de kilobytes, viajan en
// nada y además le quitan al OCR todo el ruido del dibujo de la carta, que
// es donde se inventa texto.

// Dónde caen las dos franjas DENTRO del marco, en tanto por uno. Salen de
// la proporción de una carta de Pokémon (63 × 88 mm): el nombre vive en el
// 12 % de arriba y el código con el ilustrador en el 10 % de abajo. Se
// recorta con holgura porque nadie encuadra perfecto.
export const FRANJAS = {
  nombre: { y: 0.03, alto: 0.14 },
  codigo: { y: 0.86, alto: 0.12 },
}

// Los idiomas que se pueden leer. Es la lista de la carta, no la del
// sitio: tú puedes tener la web en español y estar escaneando una japonesa.
export const IDIOMAS_ESCANER = [
  { id: 'es', nombre: 'Español' },
  { id: 'en', nombre: 'Inglés' },
  { id: 'ja', nombre: 'Japonés' },
  { id: 'zh', nombre: 'Chino' },
  { id: 'de', nombre: 'Alemán' },
  { id: 'fr', nombre: 'Francés' },
  { id: 'it', nombre: 'Italiano' },
]

// El rectángulo del marco DENTRO del vídeo, en píxeles del vídeo.
//
// No se puede usar la caja del marco en pantalla y ya está: el vídeo va con
// `object-fit: cover`, así que la imagen se recorta por el lado que sobra y
// las coordenadas de la pantalla NO son las del fotograma. Sin esta cuenta
// las franjas se recortan desplazadas y el OCR lee el dibujo.
export function marcoEnElVideo(video, marco) {
  const anchoV = video.videoWidth
  const altoV = video.videoHeight
  if (!anchoV || !altoV) return null
  const caja = video.getBoundingClientRect()
  if (!caja.width || !caja.height) return null
  // `cover`: la escala es la MAYOR de las dos, y lo que sobra se sale por
  // los lados o por arriba y abajo a partes iguales.
  const escala = Math.max(caja.width / anchoV, caja.height / altoV)
  const sobraX = (anchoV * escala - caja.width) / 2
  const sobraY = (altoV * escala - caja.height) / 2
  const m = marco.getBoundingClientRect()
  return {
    x: (m.left - caja.left + sobraX) / escala,
    y: (m.top - caja.top + sobraY) / escala,
    ancho: m.width / escala,
    alto: m.height / escala,
  }
}

// Las dos franjas, recortadas del fotograma y en JPEG.
export function recortarFranjas(video, marco, lienzo, calidad = 0.85) {
  const r = marcoEnElVideo(video, marco)
  if (!r) return null
  const ctx = lienzo.getContext('2d')
  const fuera = {}
  for (const [clave, f] of Object.entries(FRANJAS)) {
    const alto = Math.round(r.alto * f.alto)
    const ancho = Math.round(r.ancho)
    if (alto < 8 || ancho < 8) return null
    lienzo.width = ancho
    lienzo.height = alto
    ctx.drawImage(video, Math.round(r.x), Math.round(r.y + r.alto * f.y), ancho, alto, 0, 0, ancho, alto)
    fuera[clave] = lienzo.toDataURL('image/jpeg', calidad)
  }
  return fuera
}
