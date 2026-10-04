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

// `tieneCJK` vive en `js/texto.js`, que no importa nada: la misma pregunta
// la hacen el navegador y las funciones de servidor (tanda 532).
import { tieneCJK } from '../texto.js'

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

// ── LA FRANJA DE UNA CARTA JAPONESA LLEVA CUATRO COSAS MÁS (tanda 558) ──
//
// PINGU escaneó una リザードンex y en el buscador quedó esto:
//
//   «己進化 リザードン ex シダードか テ テキス…»
//
// Que es, en orden: la FASE mal leída (el «2» de 2進化 sale como 己 —es la
// confusión más común del OCR con ese glifo—), el NOMBRE, un trozo de
// «リザードから進化» (de quién evoluciona, que va en una línea debajo del
// nombre) y el principio del texto de la habilidad.
//
// Y aquí está lo que lo convierte en CERO resultados: la búsqueda exige
// TODAS las palabras (un `like` por cada una). Basta con que el OCR meta
// una basura para que no case nada, aunque el nombre esté perfecto. En
// occidental la franja solo lleva fase + nombre + PS y por eso colaba.
//
// Tres reglas, de la más segura a la menos:
//
//   1. «◯◯から進化» se va ENTERO. Es literal y no puede ser parte de un
//      nombre: «から進化» solo aparece en esa línea.
//   2. La fase: cualquier cosa de hasta dos caracteres pegada a 進化 al
//      principio. Así da igual si el OCR lee 2, 己, 乙 o Z.
//   3. Las etiquetas de mecánica que van en la misma franja y no son el
//      nombre de nadie.
const EVOLUCIONA_DE = /\S*から進化/g
const FASE_CJK_SUELTA = /(^|\s)\S{0,2}進化/g
const MECANICA_CJK = /(テラスタル|ポケモンex|かがやく)/g

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
  // ── Y si la franja está en japonés, lo suyo (tanda 558) ──
  //
  // Se mira el TEXTO y no el idioma elegido en el escáner: si lo que ha
  // vuelto lleva kanji, las reglas del kanji aplican, haya puesto lo que
  // haya puesto nadie en un desplegable.
  if (tieneCJK(t)) {
    t = t.replace(EVOLUCIONA_DE, ' ')
    t = t.replace(FASE_CJK_SUELTA, ' ')
    t = t.replace(MECANICA_CJK, ' ')
    // Y DE LO QUE QUEDE, EL PRIMER TROZO CON KANJI.
    //
    // EL PRIMERO Y NO EL MÁS LARGO, que fue mi primer intento y está mal:
    // si la franja pilla el principio del texto de la habilidad —y la
    // pilla, porque el recorte es generoso a propósito—, esa frase es MÁS
    // LARGA que el nombre y gana. «このポケモンは、ベンチにいるかぎり» mide
    // 17 y «リザードン» mide 5.
    //
    // El nombre es lo PRIMERO que se lee: va en la línea de arriba y a la
    // izquierda, y lo único que puede ir antes es la fase, que ya se ha
    // quitado. Y antes de elegir se corta por el primer signo japonés
    // (、。「」), que un nombre no lleva nunca y una frase sí — así una
    // frase larga no puede colarse entera ni aunque el corte falle.
    //
    // Un trozo de más no es un trozo de menos: cada palabra es un `like`
    // que hay que cumplir, así que vale más quedarse con uno solo y que el
    // número afine.
    const piezas = t.split(/[、。「」（）]/)[0].split(/\s+/).filter(Boolean).filter(tieneCJK)
    const primera = piezas.find((p) => p.length >= 2)
    // ── Y DEL TROZO ELEGIDO, SOLO LO QUE ES JAPONÉS (tanda 559) ──
    //
    // PINGU volvió a escanear la misma Charizard y en el buscador quedó
    // «リザードンCKT»: el OCR leyó el logo de «ex» —que va estilizado, en
    // relieve y a dos colores— como «CKT» y se lo pegó al nombre sin
    // espacio. Y una palabra pegada es UNA palabra: el `like` buscaba
    // «%リザードンCKT%» y no casaba con nada.
    //
    // El nombre japonés de una carta es kana y kanji; lo latino que se le
    // pega es o el sufijo (ex, V, GX) o basura del OCR. Las dos cosas
    // sobran: con «リザードン» la base ya encuentra «リザードンex», porque
    // el `like` va por dentro. Se busca la RACHA japonesa más larga del
    // trozo, y así da igual si la basura se pega delante o detrás.
    if (primera) {
      const rachas = primera.split(/[^\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー々]+/u).filter(Boolean)
      const mejor = rachas.length ? rachas.reduce((a, b) => (b.length > a.length ? b : a)) : ''
      if (mejor.length >= 2) return mejor
      return primera
    }
  }
  // Lo que queda, con los espacios recogidos. Y si no queda NADA, se
  // devuelve lo de antes sin tocar: un limpiador que se lleva por delante
  // el nombre entero es peor que no limpiar — mejor buscar de más que no
  // buscar nada.
  const limpio = t.replace(/\s{2,}/g, ' ').trim()
  return limpio || String(texto || '').trim()
}

// ── ¿ESTO PUEDE SER EL NOMBRE DE UNA CARTA? (tanda 560) ──
//
// PINGU escaneó y el aviso dijo: «He leído: 19:054 Card Trader 111 5G».
// O sea el RELOJ, el nombre de la app y la cobertura: el marco pilló la
// pantalla del móvil que tenía delante, no la carta de dentro.
//
// Eso no es un fallo del OCR —leyó perfectamente lo que había— ni de la
// búsqueda. Es que la foto no era de una carta. Y hasta ahora la web
// contestaba a eso cerrando el escáner, saltando a Buscar y enseñando «no
// encuentro ninguna carta así», que es la MISMA pantalla que sale cuando
// la carta no está en el catálogo. Dos cosas muy distintas con la misma
// cara, y la que toca es «vuelve a encuadrar», no «esa carta no está».
//
// Dos señales, las dos seguras:
//
//   · Un RELOJ. Ningún nombre de carta lleva «19:05» dentro, y toda
//     pantalla de móvil lo lleva arriba.
//   · Si se está escaneando en japonés o en chino y NO ha salido ni un
//     carácter de esos alfabetos. El nombre de una carta japonesa es kana
//     y kanji siempre; si no hay ninguno, o no era una carta o el idioma
//     elegido no es el de la carta.
//
// Lo que NO se hace: inventarse más reglas. Una lista de palabras de
// barra de estado («Wi-Fi», «batería»…) sería una lista curada que se
// queda vieja y que además puede casar con el nombre de una carta.
// Sin `\b` al final a propósito: el OCR pega lo siguiente al reloj
// —«19:054» era «19:05» y el «4» de «4G»— y con el borde de palabra no
// casaba. Un nombre de carta no lleva dos puntos entre cifras.
const RELOJ = /\b\d{1,2}\s*:\s*\d{2}/
const IDIOMAS_CJK = ['ja', 'zh']

export function pareceNombreDeCarta(nombre, idioma = 'es') {
  const t = String(nombre || '').trim()
  if (!t) return { vale: false, porque: 'vacio' }
  if (RELOJ.test(t)) return { vale: false, porque: 'pantalla' }
  if (IDIOMAS_CJK.includes(String(idioma)) && !tieneCJK(t)) return { vale: false, porque: 'sin-cjk' }
  return { vale: true }
}

// El número impreso de la franja de ABAJO, que viene como «22/99» o
// «22/99 · Ilus. Shizurow». Se queda con lo de delante de la barra: el 99
// es cuántas tiene el set, no la carta.
export function numeroDeLaFranja(texto) {
  // ── A ANCHO COMPLETO NO ES UN NÚMERO PARA UNA EXPRESIÓN REGULAR (558b) ──
  //
  // El OCR japonés devuelve las cifras y la barra como las imprime una
  // carta japonesa: «０６６／１０８», a ancho completo. Y `\d` no casa con
  // ０, ni `\/` con ／. O sea que de una carta japonesa salía NULL, la
  // búsqueda se quedaba solo con el nombre y PINGU veía los 23 Charizards
  // en vez del suyo.
  //
  // Aquí NFKC sí es lo que toca —y es lo contrario que en `normalizeSearch`
  // (tanda 557), donde habría roto la comparación—: esto no compara contra
  // la base, EXTRAE un número de un texto leído por una máquina. Pasar
  // ０→0 y ／→/ es exactamente lo que hace falta.
  const t = String(texto || '').normalize('NFKC')
  const conBarra = t.match(/\b(\d{1,3})\s*\/\s*\d{1,3}\b/)
  if (conBarra) return conBarra[1]
  const suelto = t.match(/\b(\d{1,3})\b/)
  return suelto ? suelto[1] : null
}
