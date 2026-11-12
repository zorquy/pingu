// EL CALENDARIO DE ADVIENTO, lo puro (tanda 1285). Las 24 casillas y la
// cuenta del día. Sin dependencias: lo prueba Node y lo usa js/adviento.js.
//
// Cada casilla es un Pokémon de hielo o de estas fechas, de menos a más: el 24
// es Delibird, el que reparte los regalos. El dato es de su Pokédex, contado
// en corto; si alguno no convence, se cambia aquí y nada más.
export const CASILLAS = [
  [361, 'Snorunt', 'Cuentan que la casa que visita un Snorunt prospera durante generaciones.'],
  [220, 'Swinub', 'Hoza el suelo con la nariz para encontrar comida, aunque esté bajo la nieve.'],
  [582, 'Vanillite', 'Dicen que nació de un carámbano bañado por la luz del sol de la mañana.'],
  [613, 'Cubchoo', 'Siempre tiene moqueo: su moco helado es la base de sus ataques.'],
  [459, 'Snover', 'En invierno baja de las montañas nevadas y se acerca a los pueblos.'],
  [363, 'Spheal', 'Le cuesta más andar que rodar, así que cruza el hielo dando vueltas.'],
  [471, 'Glaceon', 'Baja su temperatura para congelar el pelo y lanzarlo como agujas.'],
  [872, 'Snom', 'Se alimenta de la nieve del suelo y escupe hilos de seda helada.'],
  [712, 'Bergmite', 'Se cubre de hielo a cien grados bajo cero para protegerse.'],
  [478, 'Froslass', 'La leyenda dice que nació de alguien que se perdió en una montaña nevada.'],
  [131, 'Lapras', 'Le encanta llevar a gente a cuestas para cruzar el mar.'],
  [473, 'Mamoswine', 'Su especie anda por aquí desde la última glaciación, hace unos 10.000 años.'],
  [875, 'Eiscue', 'Su cabeza es un cubo de hielo que lo protege; con granizo, le vuelve a crecer.'],
  [698, 'Amaura', 'Revivió de un fósil: vivía en tierras frías donde no tenía enemigos.'],
  [615, 'Cryogonal', 'Está hecho de cristales de hielo y atrapa a sus presas con cadenas heladas.'],
  [614, 'Beartic', 'Congela su aliento para hacerse colmillos y garras de hielo.'],
  [873, 'Frosmoth', 'Sus alas sueltan escamas heladas: por donde vuela, parece que nieva.'],
  [713, 'Avalugg', 'Lleva Bergmite en el lomo, como un portaaviones de hielo.'],
  [144, 'Articuno', 'El ave legendaria del hielo: dicen que se aparece a quien se pierde en la montaña.'],
  [378, 'Regice', 'Su cuerpo es hielo de la glaciación que ni el magma consigue derretir.'],
  [646, 'Kyurem', 'El dragón de hielo de Teselia: se puede fusionar con Reshiram o con Zekrom.'],
  [433, 'Chingling', 'Cuando se mueve suena como un cascabel. Muy de estas fechas.'],
  [234, 'Stantler', 'Sus cuernos curvados crean ilusiones a quien se queda mirándolos.'],
  [225, 'Delibird', 'Lleva la comida en la cola como si fuera un saco, y su ataque es Presente.'],
]

export const XP_POR_CASILLA = 10

// La fecha de hoy en ESPAÑA, la misma que usa la base (`adviento_hoy`): el
// navegador de cada uno puede estar en otra zona.
export function hoyEnEspana(fecha = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid', year: 'numeric', month: 'numeric', day: 'numeric' })
    .formatToParts(fecha).map((x) => [x.type, Number(x.value)]))
  return { anio: p.year, mes: p.month, dia: p.day }
}

// Qué toca hoy: null fuera de diciembre; si no, el año, el día del mes y la
// última casilla que ya se puede abrir (hasta la 24; del 25 al 31 solo se
// abren las que falten).
export function adviento(fecha = new Date()) {
  const h = hoyEnEspana(fecha)
  if (h.mes !== 12) return null
  return { anio: h.anio, dia: h.dia, hasta: Math.min(h.dia, 24) }
}

// Cómo se pinta cada casilla: `abierta`, `hoy` (la de hoy, sin abrir),
// `pendiente` (de un día pasado, sin abrir) o `cerrada` (aún no se puede).
export function estadoCasilla(n, a, abiertas) {
  if (abiertas.has(n)) return 'abierta'
  if (!a || n > a.hasta) return 'cerrada'
  return n === a.dia ? 'hoy' : 'pendiente'
}

// La frase de la tarjeta de Inicio.
export function resumenAdviento(a, abiertas) {
  const n = abiertas.size
  if (n >= 24) return 'Completo: las 24 abiertas'
  if (a.dia > 24) return `Llevas ${n} de 24 · quedan hasta el 31 para abrirlas`
  const toca = estadoCasilla(a.dia, a, abiertas) === 'hoy'
  return toca ? `Día ${a.dia}: tu casilla te espera` : `Día ${a.dia} · llevas ${n} de ${a.hasta}`
}

// La casilla que abre el botón de la tarjeta: la de hoy si falta; si no, la
// primera pendiente; si no, ninguna (el botón abre el calendario).
export function siguienteCasilla(a, abiertas) {
  if (!a) return null
  if (a.dia <= 24 && !abiertas.has(a.dia)) return a.dia
  for (let n = 1; n <= a.hasta; n++) if (!abiertas.has(n)) return n
  return null
}

const ARTE = 'sprites/pokemon/other/official-artwork'
export const dibujoDe = (dex) => [
  `https://cdn.jsdelivr.net/gh/PokeAPI/sprites@master/${ARTE}/${dex}.png`,
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/${ARTE}/${dex}.png`,
]
