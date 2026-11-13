// La cara de cada persona cuando no hay foto: su inicial y un color fijo
// sacado de su id (y la foto cuando la hay). Salió de app.js en la tanda
// 1351 porque app.js toca el documento al cargarse, y los módulos puros de
// torneos (ligas-franja.js, que se prueba en Node) también pintan caras.
import { urlParaCss } from './html.js'

export function getInitial(name) {
  if (!name) return '?'
  return name.trim().charAt(0).toUpperCase()
}

// Estilo del avatar de una persona, en un solo sitio.
//
// El patrón estaba copiado en seis ficheros y en todos tenía el mismo
// fallo: cuando HAY foto solo se ponía `background-image`, pero varias
// clases traen un `background-color` de fábrica en el CSS. Resultado: el
// color asomaba por detrás de la foto (por los bordes redondeados, o si
// la imagen no cubre del todo). Se ve raro y no hay forma de quitarlo
// desde el CSS sin romper el caso sin foto.
//
// Con foto: color transparente. Sin foto: el círculo de color, del mismo
// tamaño, con la inicial.
// Colores para el avatar de quien no tiene foto.
//
// El color se DEDUCE del identificador: es estable (a cada persona le
// toca siempre el mismo), no hace falta escribir nada en la base, y
// funciona desde ya para las cuentas que ya existen.
//
// La columna `user_profiles.avatar_color` NO se mira. Tiene valor por
// defecto en la base y ni la web ni el admin la escriben nunca: nadie
// puede elegir color de avatar. O sea que lo único que puede traer es el
// mismo azul para todo el mundo. Respetarla "por si alguien lo ha
// elegido a mano" protegía un caso que no existe y rompía el que sí:
// ganaba siempre y anulaba el reparto entero.
const COLORES_AVATAR = [
  '#1e5175', // azul PokeDoc
  '#8b5cf6', // violeta
  '#0e9488', // verde azulado
  '#d97706', // ámbar
  '#db2777', // rosa
  '#0284c7', // celeste
  '#65a30d', // verde
  '#dc2626', // rojo
  '#7c3aed', // púrpura
  '#0891b2', // cian
]

export function avatarColorForKey(key) {
  // No se reutiliza tintIndexForKey: ese hash es polinómico (h*31+c) y al
  // hacerle un módulo pequeño el resultado depende sobre todo de los
  // últimos caracteres. Con identificadores largos y parecidos entre sí
  // —como los UUID de Supabase— eso agrupaba a la gente en unos pocos
  // colores. Medido: 4 de 10 colores para 20 personas.
  //
  // Esta mezcla final (un finalizador tipo xorshift) reparte los bits
  // altos hacia los bajos antes del módulo.
  const s = String(key ?? '')
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619) >>> 0
  }
  h ^= h >>> 16
  h = Math.imul(h, 2246822507) >>> 0
  h ^= h >>> 13
  h = Math.imul(h, 3266489909) >>> 0
  h ^= h >>> 16
  // El `>>> 0` de aquí NO es decorativo. En JavaScript el XOR devuelve un
  // entero con SIGNO: la línea de arriba deja `h` negativo casi la mitad
  // de las veces, `h % 10` sale negativo, y `COLORES_AVATAR[-3]` es
  // `undefined`. Eso acababa en `background-color: undefined`, que el
  // navegador descarta sin dar error, dejando el azul de la hoja de
  // estilos. Medido con UUID reales: el 45% de la gente.
  return COLORES_AVATAR[(h >>> 0) % COLORES_AVATAR.length]
}

export function avatarStyle(profile) {
  const foto = urlParaCss(profile?.avatar_url)
  if (foto) return `background-image:url('${foto}'); background-color:transparent;`
  return `background-color:${avatarColorForKey(profile?.id || profile?.username || '')};`
}
