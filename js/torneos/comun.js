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

// ── El puente a las RPC (tanda 252) ──
//
// Con la sección abierta, un jugador normal NO escribe directamente en
// `tournament_registrations`, `match_reports` ni `tournament_matches`:
// la RLS fina se lo impide y lo hacen tres funciones del servidor
// (`torneos_inscribirse`, `torneos_reportar`, `torneos_checkin`), que
// además cierran carreras que desde el navegador no se pueden cerrar —
// el cupo, la conciliación de dos reportes.
//
// PERO este código sale a producción ANTES de que se ejecute la
// migración que las crea. En ese rato la RPC no existe y la base
// contesta que no la conoce; entonces se hace lo de siempre, que hoy
// funciona porque quien entra es admin.
//
// Solo se cae al camino viejo cuando la función NO EXISTE. Cualquier
// otro error —«torneo lleno», «ya estás inscrito»— se devuelve tal
// cual: caerse al insert directo ahí se saltaría justo la comprobación
// que la RPC existe para hacer.
//
// QUITAR este puente cuando la migración lleve un tiempo puesta.
export function faltaLaRpc(error) {
  if (!error) return false
  // PGRST202 es «no existe esa función» de PostgREST; 42883 es el
  // mismo error visto desde PostgreSQL.
  return (
    error.code === 'PGRST202' ||
    error.code === '42883' ||
    /could not find the function|does not exist/i.test(String(error.message || ''))
  )
}

export function fechaBonita(iso) {
  const f = new Date(iso)
  return f.toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

// «4 suizas BO1 + top 8 BO3 · 30 min/ronda», con el corte fuera si no
// hay. Una liga (tanda 219) habla de jornadas, que es lo que son.
export function textoFormato(t) {
  const corte = t.top_cut_size ? ` + top ${t.top_cut_size} BO${t.top_cut_bo}` : ''
  const base = t.format === 'league' ? `liga de ${t.swiss_rounds} jornadas BO${t.swiss_bo}` : `${t.swiss_rounds} suizas BO${t.swiss_bo}`
  return `${base}${corte} · ${t.round_time_minutes} min/ronda`
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

// Las marcas de regulación legales en Estándar AHORA (rotan cada
// abril). El valor vivo está en site_settings ('torneos_reglas', lo
// siembra supabase-migration-cartas-marcas.sql) para poder cambiarlo
// sin desplegar; esto es el respaldo si la clave no existe.
export const MARCAS_LEGALES_DEFECTO = ['H', 'I', 'J']

// ── Quién puede borrar un torneo (tanda 222, pedido por PINGU) ──
// El admin del sitio o quien lo creó. Vive AQUÍ, en el módulo sin DOM,
// por dos motivos: la usan la ficha y la lista, y así se puede probar
// sola en Node en vez de a través de una pantalla.
//
// Ojo con lo que esta función es y lo que no: decide si se PINTA el
// botón. Lo que de verdad impide borrar el torneo de otro es la
// política `torneos_borrar` de la base — esconder un botón no protege
// nada. Las dos dicen lo mismo a propósito.
export function puedeBorrarTorneo(perfil, torneo, userId) {
  if (perfil?.is_admin) return true
  return Boolean(userId && torneo?.admin_id && torneo.admin_id === userId)
}

// ── Lo que ve un visitante SIN cuenta de una inscripción (tanda 229) ──
//
// No es una lista de cortesía. En la base, el rol `anon` NO tiene
// permiso sobre tcg_live_username (grant por columnas en
// supabase-migration-torneos-publico.sql), y en Postgres un `select *`
// que toca una columna prohibida no devuelve esa columna vacía: FALLA
// LA CONSULTA ENTERA. Si esta lista se desincroniza del grant, la ficha
// deja de cargar para cualquiera que no haya entrado.
//
// Vive aquí, en el módulo sin DOM, para poder compararla en Node contra
// el SQL de verdad — que es lo único que impide que las dos se separen.
export const COLUMNAS_PUBLICAS_INSCRIPCION = [
  'id',
  'tournament_id',
  'user_id',
  'status',
  'registered_at',
  'dropped_at',
  'dropped_after_round_id',
]
