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

// ══════════════════════════════════════════════════════════════════
// LIMPIAR LO QUE SE LEE DE LA FRANJA DE ARRIBA (tanda 451)
// ══════════════════════════════════════════════════════════════════
//
// PINGU escaneó un Reshiram EX y en el buscador le quedó
// «BÁSICO Reshiram EX pv180·». Cero resultados, claro.
//
// LA FRANJA DE ARRIBA NO ES EL NOMBRE: es la fila entera de la carta, y
// lleva TRES cosas. A la izquierda la FASE («BÁSICO», «FASE 1», «MEGA»),
// en medio el nombre, y a la derecha los PUNTOS DE VIDA con su etiqueta y
// el símbolo del tipo. El OCR las lee todas, porque todas están ahí.
//
// Recortar la franja más estrecha no vale: la fase y los PV están a la
// MISMA ALTURA que el nombre, no encima ni debajo. Y recortar por los
// lados tampoco, porque el nombre no empieza siempre en el mismo sitio.
// Lo que sí se puede es quitar lo que SE SABE que no es el nombre.

// La etiqueta de los puntos de vida en los siete idiomas del escáner:
// PV (español y francés), HP (inglés), KP (alemán), PS (italiano), y en
// japonés y chino va con el número pegado a «HP».
const PUNTOS_DE_VIDA = /\b(pv|hp|ps|kp)\s*\.?\s*\d{1,3}\b|\b\d{1,3}\s*(pv|hp|ps|kp)\b/gi

// La fase, arriba a la izquierda. Son las de `FASES_ES` escritas como las
// IMPRIME la carta, que no es lo mismo que como las llama TCGdex.
const FASE = new RegExp(
  '\\b(' + [
    'b[aá]sico', 'basic', 'basis', 'base', 'b[aá]sica',
    'fase\\s*\\d?', 'stage\\s*\\d?', 'phase\\s*\\d?', 'niveau\\s*\\d?', 'liv\\.?\\s*\\d?',
    'mega', 'break', 'v-?union', 'vstar', 'vmax', 'restaurado', 'restored',
  ].join('|') + ')\\b', 'gi')

// El japonés y el chino van en SU PROPIA expresión y SIN `\b`. No es un
// detalle de estilo: `\b` es el borde entre un carácter de palabra y uno
// que no lo es, y para JavaScript un kanji NO es carácter de palabra. Así
// que `\bたね\b` no casa con «たね リザードン» NUNCA — y la prueba lo pilló
// con el único caso japonés que tenía. Una expresión que no casa no da
// error: deja el nombre sin limpiar y la búsqueda sin resultados.
const FASE_CJK = /(たね|[12１２]進化|基[础礎]|[一二]階|[一二]阶)/g

// Lo que el símbolo de energía y el canto de la carta dejan al leerse como
// si fueran letras.
const BASURA = /[·•|¦×✕*_~^<>«»"'`´¨=+\\/•·]/g

// Y los puntos de vida SIN su etiqueta. Siempre son múltiplos de diez de
// dos o tres cifras, así que un «180» suelto en esta franja es eso; un
// número que fuera parte del nombre («Porygon2», «Zygarde 50%») no va
// suelto ni es múltiplo de diez.
const VIDA_SUELTA = /\b\d{2,3}0\b/g

export function nombreDeLaFranja(texto) {
  let t = String(texto || '')
  t = t.replace(BASURA, ' ')
  t = t.replace(PUNTOS_DE_VIDA, ' ')
  t = t.replace(FASE, ' ')
  t = t.replace(FASE_CJK, ' ')
  t = t.replace(VIDA_SUELTA, ' ')
  // Lo que queda, con los espacios recogidos. Y si no queda NADA, se
  // devuelve lo de antes sin tocar: un limpiador que se lleva por delante
  // el nombre entero es peor que no limpiar — mejor buscar de más que no
  // buscar nada.
  const limpio = t.replace(/\s{2,}/g, ' ').trim()
  return limpio || String(texto || '').trim()
}

// El número impreso de la franja de ABAJO, que viene como «22/99» o
// «22/99 · Ilus. Shizurow». Se queda con lo de delante de la barra: el 99
// es cuántas tiene el set, no la carta.
export function numeroDeLaFranja(texto) {
  const t = String(texto || '')
  const conBarra = t.match(/\b(\d{1,3})\s*\/\s*\d{1,3}\b/)
  if (conBarra) return conBarra[1]
  const suelto = t.match(/\b(\d{1,3})\b/)
  return suelto ? suelto[1] : null
}
