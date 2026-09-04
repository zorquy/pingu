// El palmarés de torneos de una persona (tanda 262).
//
// Hasta hoy solo había tres logros de torneo y los tres eran de «lo has
// hecho una vez»: jugar uno, entrar en un corte y ganar. Quien juega
// veinte torneos tiene exactamente las mismas medallas que quien jugó
// uno, y en el perfil salía una línea de texto —«Torneos jugados: 1
// Podio»— que no dice gran cosa.
//
// PINGU pidió medallas. La decisión (2026-09-04): **por hitos, no por
// torneo suelto**. Una medalla por cada torneo llena el perfil de
// iconos idénticos y con veinte al año no distingue a nadie; un hito
// —cinco torneos, tres campeonatos— sí se presume.
//
// Este módulo es PURO a propósito: no toca la red ni el DOM. Lo usan
// dos sitios que no se parecen en nada —la ficha del torneo, que
// concede, y la ficha de una persona, que enseña— y así los dos cuentan
// con las mismas reglas y se puede probar en Node.

// Los hitos, del más fácil al más difícil dentro de cada familia. El
// orden importa: es el que se usa para pintarlos.
export const HITOS = [
  { id: 'torneo_jugado', familia: 'jugados', pide: 1 },
  { id: 'torneo_veterano', familia: 'jugados', pide: 5 },
  { id: 'torneo_habitual', familia: 'jugados', pide: 10 },
  { id: 'torneo_podio', familia: 'podios', pide: 1 },
  { id: 'torneo_top_cut', familia: 'topCut', pide: 1 },
  { id: 'torneo_campeon', familia: 'campeonatos', pide: 1 },
  { id: 'torneo_tricampeon', familia: 'campeonatos', pide: 3 },
]

// Cuenta el palmarés a partir de los torneos TERMINADOS en los que
// alguien jugó. El podio va congelado en la fila del torneo desde la
// tanda 217, así que aquí no se recalcula ningún bracket: se mira en qué
// puesto sale la persona y ya.
//
// «Podio» es del segundo al cuarto: el primero es campeonato y se cuenta
// aparte, que si no un campeón tendría también «primer podio» y las dos
// medallas dirían lo mismo.
export function contarPalmares(torneos, userId) {
  let jugados = 0
  let podios = 0
  let campeonatos = 0
  for (const t of torneos || []) {
    jugados++
    const podio = Array.isArray(t?.podium) ? t.podium : []
    const puesto = podio.indexOf(userId)
    if (puesto === 0) campeonatos++
    else if (puesto > 0) podios++
  }
  return { jugados, podios, campeonatos }
}

// Los hitos que le corresponden a un palmarés. `topCut` llega aparte
// porque no se puede sacar de la fila del torneo: quién pisó el corte lo
// sabe el bracket, y eso lo calcula la ficha.
export function hitosMerecidos({ jugados = 0, podios = 0, campeonatos = 0, topCut = false } = {}) {
  const cuentas = { jugados, podios, campeonatos, topCut: topCut ? 1 : 0 }
  return HITOS.filter((h) => cuentas[h.familia] >= h.pide).map((h) => h.id)
}

// ¿Es un logro de torneo? Sirve para separar la vitrina de torneos del
// resto de trofeos sin tener que repetir la lista en el perfil.
export function esLogroDeTorneo(id) {
  return String(id ?? '').startsWith('torneo_')
}

// Lo que falta para la siguiente medalla de PARTICIPACIÓN: «a 3 de
// Veterano» dice algo que se puede ir a buscar, y anima más que un
// número a secas.
//
// Solo la familia `jugados` a propósito. Se probó mirándolas todas y
// salía cosas como «te falta 1 podio», que ni es comparable con «te
// faltan 2 torneos» —un podio no depende solo de ti— ni se puede
// prometer. Jugar sí.
export function siguienteHito({ jugados = 0 } = {}) {
  const pendiente = HITOS.filter((h) => h.familia === 'jugados').find((h) => jugados < h.pide)
  return pendiente ? { ...pendiente, faltan: pendiente.pide - jugados } : null
}
