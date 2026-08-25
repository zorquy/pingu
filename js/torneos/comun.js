// Piezas que comparten las páginas de torneos (/torneos y /torneo):
// el vocabulario de estados y el formato de fechas. Nada de lógica de
// juego — eso vive en motor.js.

export const ESTADOS = {
  draft: { texto: 'Borrador', clase: 'torneo-estado-borrador' },
  registration_open: { texto: 'Inscripciones abiertas', clase: 'torneo-estado-abierto' },
  registration_closed: { texto: 'Inscripciones cerradas', clase: 'torneo-estado-cerrado' },
  in_progress: { texto: 'En juego', clase: 'torneo-estado-jugando' },
  finished: { texto: 'Terminado', clase: 'torneo-estado-fin' },
  cancelled: { texto: 'Cancelado', clase: 'torneo-estado-fin' },
}

export function fechaBonita(iso) {
  const f = new Date(iso)
  return f.toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// «4 suizas BO1 + top 8 BO3 · 30 min/ronda», con el corte fuera si no hay.
export function textoFormato(t) {
  const corte = t.top_cut_size ? ` + top ${t.top_cut_size} BO${t.top_cut_bo}` : ''
  return `${t.swiss_rounds} suizas BO${t.swiss_bo}${corte} · ${t.round_time_minutes} min/ronda`
}
