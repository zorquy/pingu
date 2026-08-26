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

// El código de set del export (OBF, SVI…) es el de TCG Live; el espejo
// no lo guarda, pero el NOMBRE oficial del set sí. Esta tabla traduce
// código → nombre y con eso la carta se busca DENTRO de su set y por su
// número: exacta, edición incluida. Un código que falte aquí no rompe
// nada — se cae a la búsqueda global por nombre de siempre.
const SETS_LIVE = {
  SVI: 'Scarlet & Violet',
  PAL: 'Paldea Evolved',
  OBF: 'Obsidian Flames',
  MEW: '151',
  PAR: 'Paradox Rift',
  PAF: 'Paldean Fates',
  TEF: 'Temporal Forces',
  TWM: 'Twilight Masquerade',
  SFA: 'Shrouded Fable',
  SCR: 'Stellar Crown',
  SSP: 'Surging Sparks',
  PRE: 'Prismatic Evolutions',
  JTG: 'Journey Together',
  DRI: 'Destined Rivals',
  MEG: 'Mega Evolution',
  SSH: 'Sword & Shield',
  RCL: 'Rebel Clash',
  DAA: 'Darkness Ablaze',
  CPA: "Champion's Path",
  VIV: 'Vivid Voltage',
  SHF: 'Shining Fates',
  BST: 'Battle Styles',
  CRE: 'Chilling Reign',
  EVS: 'Evolving Skies',
  CEL: 'Celebrations',
  FST: 'Fusion Strike',
  BRS: 'Brilliant Stars',
  ASR: 'Astral Radiance',
  PGO: 'Pokémon GO',
  LOR: 'Lost Origin',
  SIT: 'Silver Tempest',
  CRZ: 'Crown Zenith',
}

export function nombreDeSetLive(codigo) {
  return SETS_LIVE[String(codigo || '').toUpperCase()] || null
}
