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
// Y lo que hay que HACER cuando falta: decirlo, no seguir por el camino
// viejo (tanda 293).
//
// El puente se montó en la tanda 252 para que inscribirse, reportar y
// hacer check-in siguieran funcionando entre el despliegue y el momento
// en que un humano ejecutaba el SQL. Pero ESA MISMA migración cerró la
// escritura de `tournament_registrations`, `match_reports` y
// `tournament_matches` a los jugadores: ahora solo se escribe por RPC.
//
// O sea que el camino viejo ya no escribe nada. Y lo peor es CÓMO no
// escribe: un INSERT que la política rechaza NO da error —vuelve como si
// todo hubiera ido bien—, así que la pantalla decía «Reportado» en verde
// y no había pasado nada. En mitad de un torneo eso es el peor fallo
// posible: el que no se ve.
//
// Se cambió el 2026-09-13, al encontrar que la migración del BO3 quita
// la RPC vieja de reportar: entre el despliegue y el SQL, NADIE podía
// reportar y la web les daba la enhorabuena.
export function avisoDeMigracion(fichero) {
  return `Falta ejecutar ${fichero} en el SQL Editor de Supabase. Hasta entonces esto no se puede hacer.`
}

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
  // La era ME (2025-26): TCGdex dejó de traer `tcgOnline` para estos
  // sets, así que el paso 2 (tcg_online_code, tanda 233) no puede
  // funcionar y la tabla vuelve a ser el camino. ASC, POR, CRI y MEE
  // salieron en una lista real el 2026-09-01 (quedaron anotados sin
  // resolver); BLK y WHT son los códigos conocidos de Black Bolt y
  // White Flare; PFL y PIT están deducidos del nombre — si el código
  // real fuera otro, este no le quita el sitio a nadie: simplemente no
  // aparecerá y esa lista caerá al respaldo por nombre.
  BLK: 'Black Bolt',
  WHT: 'White Flare',
  MEE: 'Mega Evolution Energy',
  PFL: 'Phantasmal Flames',
  ASC: 'Ascended Heroes',
  POR: 'Perfect Order',
  CRI: 'Chaos Rising',
  // Los tres que faltaban (tanda 345). El nombre tiene que ser el que
  // tiene el set EN NUESTRA BASE, no el que use Limitless: esto se
  // resuelve con un `.eq('name', …)` exacto. Por eso MEP va como «MEP
  // Black Star Promos» y no como «Mega Promos».
  PBL: 'Pitch Black',
  '30C': '30th Celebration',
  MEP: 'MEP Black Star Promos',
  PIT: 'Pitch Black',
  SVE: 'Scarlet & Violet Energy',
}

export function nombreDeSetLive(codigo) {
  return SETS_LIVE[String(codigo || '').toUpperCase()] || null
}

// ── El color de una cara (tandas 297 y 298) ──
//
// Las iniciales de la lista y las del tablero de «Tu partida» tienen que
// salir del MISMO sitio: si cada pantalla se inventara su color, la
// misma persona cambiaría de color al entrar al torneo.
//
// Sale del nombre, no al azar: así es estable en cada recarga y en el
// móvil de cada uno.
const COLORES_CARA = ['#2a6b96', '#be185d', '#0d9e6e', '#4f46e5', '#c8720a', '#0891b2', '#7c3aed']
export function colorDeNombre(nombre) {
  let suma = 0
  for (let i = 0; i < String(nombre).length; i++) suma = (suma * 17 + String(nombre).charCodeAt(i)) % 100000
  return COLORES_CARA[suma % COLORES_CARA.length]
}

// ── Quién manda en los torneos (tanda 295) ──
//
// PINGU le dio las llaves de la sección «Jugar» a la gente que se ha
// organizado para llevarla: mandan en los torneos y en nada más. Ni
// panel de administración, ni foro, ni guías.
//
// Ojo con lo que esta función es y lo que no, igual que con
// `puedeBorrarTorneo`: decide qué se PINTA. Lo que de verdad decide es
// `torneos_soy_admin()` en la base, que mira las dos columnas. Las dos
// dicen lo mismo a propósito — esconder un botón no protege nada.
//
// Y lo que NO entra aquí: marcar un torneo como OFICIAL de PokeDoc.
// Esa chapa dice «esto lo organiza el equipo de la casa», así que sigue
// siendo de `is_admin` a secas, en la pantalla y en el disparador.
export function puedeOrganizar(perfil) {
  return Boolean(perfil?.is_admin || perfil?.is_tournament_admin)
}

// ── Y quién manda en ESTE torneo (tanda 296) ──
//
// Los de arriba, y además quien lo creó: si montas un torneo, lo llevas.
// Crear está abierto a todo el mundo desde la tanda 266, pero hasta hoy
// el que lo montaba se quedaba mirando — la pantalla solo daba las
// herramientas a los admin, aunque la base ya le dejara.
//
// Esto es el espejo de `torneos_mando(uuid)` en la base
// (supabase-migration-torneos-dueno.sql). Que digan lo mismo NO es
// opcional aquí: si la pantalla enseña de más, el botón no da error —
// la política rechaza en silencio y la persona se queda pulsando.
export function puedeLlevar(perfil, torneo, userId) {
  if (puedeOrganizar(perfil)) return true
  return Boolean(userId && torneo?.admin_id && torneo.admin_id === userId)
}

// ── Quién puede borrar un torneo (tanda 222, pedido por PINGU) ──
// Quien manda en los torneos, o quien lo creó. Vive AQUÍ, en el módulo
// sin DOM, por dos motivos: la usan la ficha y la lista, y así se puede
// probar sola en Node en vez de a través de una pantalla.
//
// Ojo con lo que esta función es y lo que no: decide si se PINTA el
// botón. Lo que de verdad impide borrar el torneo de otro es la
// política `torneos_borrar` de la base — esconder un botón no protege
// nada. Las dos dicen lo mismo a propósito.
export function puedeBorrarTorneo(perfil, torneo, userId) {
  return puedeLlevar(perfil, torneo, userId)
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

// ── Los premios de un torneo (tanda 352) ──
//
// Vivían dentro de la descripción, que es un bloque de texto: no se
// podía enseñar en /torneos —donde la gente decide si se apunta— ni
// resumir en ningún sitio. Ahora son una lista, y cada sitio decide qué
// enseña de ella.
//
// Aquí, en el módulo sin DOM, porque lo usan las dos pantallas y porque
// así se prueba en Node: lo que hay que acertar no es el HTML, es QUÉ se
// considera un premio y qué se tira.
export const PREMIOS_MAXIMO = 12
export const PUESTO_MAXIMO = 40
export const PREMIO_MAXIMO = 200

// Lo que llega de la base puede ser cualquier cosa: la columna es jsonb
// y la escribe cualquiera que pueda editar su torneo. Se queda solo lo
// que tiene las dos mitades — un puesto sin premio, o un premio sin
// puesto, es media frase y en pantalla se leería como un fallo.
export function premiosDeTorneo(torneo) {
  const lista = Array.isArray(torneo?.prizes) ? torneo.prizes : []
  return lista
    .map((p) => ({
      puesto: String(p?.puesto ?? '').trim().slice(0, PUESTO_MAXIMO),
      premio: String(p?.premio ?? '').trim().slice(0, PREMIO_MAXIMO),
    }))
    .filter((p) => p.puesto && p.premio)
    .slice(0, PREMIOS_MAXIMO)
}

export function hayPremios(torneo) {
  return premiosDeTorneo(torneo).length > 0
}

// Lo que cabe en una chapa del listado: el premio del PRIMERO, que es el
// que hace que alguien abra el torneo. Los demás están a un clic.
//
// Y si no cabe, se recorta con puntos suspensivos en vez de dejar media
// palabra: una chapa que dice «50 € en cart» parece rota.
export function resumenDePremios(torneo, tope = 42) {
  const premios = premiosDeTorneo(torneo)
  if (!premios.length) return ''
  const texto = premios[0].premio
  return texto.length <= tope ? texto : `${texto.slice(0, tope - 1).trimEnd()}…`
}

// Y al revés: lo que se guarda. Se limpia igual que se lee, porque la
// base tiene un CHECK con estos mismos límites — pasarse de largo no
// daría un aviso, daría un error de PostgREST que nadie sabría leer.
export function premiosParaGuardar(filas) {
  const limpias = (Array.isArray(filas) ? filas : [])
    .map((p) => ({
      puesto: String(p?.puesto ?? '').trim().slice(0, PUESTO_MAXIMO),
      premio: String(p?.premio ?? '').trim().slice(0, PREMIO_MAXIMO),
    }))
    .filter((p) => p.puesto && p.premio)
    .slice(0, PREMIOS_MAXIMO)
  // Sin premios se guarda NULL y no un array vacío: son la misma idea
  // dicha de dos maneras, y dos maneras es una de más para preguntar.
  return limpias.length ? limpias : null
}
