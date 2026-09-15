"""Rigor de la tanda 302 (el torneo al canal, a mano). En segundo plano SIEMPRE."""
import sys

sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
from rigor_comun import correr

FN = 'netlify/functions/telegram-mandar.mjs'
FICHA = 'js/torneos/torneo.js'
SQL = 'supabase-migration-telegram-torneos.sql'

MUTACIONES = [
    # ── Lo que no puede salir por el canal ──
    (FN, 'un torneo privado sale por el canal',
     '  if (torneo.is_private) {', '  if (false) {'),

    (FN, 'un borrador sale por el canal',
     "  if (torneo.status !== 'registration_open') {", '  if (false) {'),

    (FN, 'uno que ya empezó se anuncia igual',
     '  if (new Date(torneo.start_at) < ahora && !forzar) {', '  if (false) {'),

    (FN, 'uno ya mandado se repite sin avisar',
     '  if (torneo.telegram_sent_at && !forzar) {', '  if (false) {'),

    (FN, 'forzar deja de servir: la salida de emergencia se cierra',
     '  if (torneo.telegram_sent_at && !forzar) {', '  if (torneo.telegram_sent_at) {'),

    (FN, 'un torneo que ya no existe da un 200',
     "  if (!torneo) return { estado: 404, cuerpo: { error: 'Ese torneo ya no existe.' } }",
     '  if (!torneo) torneo = {}'),

    # ── Lo que se manda, y adónde ──
    (FN, 'el torneo se manda al tema de NOTICIAS',
     '    tema: env.TELEGRAM_TEMA_TORNEOS || null,', '    tema: env.TELEGRAM_TEMA_NOTICIAS || null,'),

    (FN, 'no se apunta como mandado: se repetiría cada cinco minutos',
     "    await restImpl(`tournaments?id=eq.${encodeURIComponent(torneo.id)}`, env.SUPABASE_SERVICE_ROLE_KEY, {\n      method: 'PATCH',",
     "    await restImpl(`tournaments?id=eq.${encodeURIComponent(torneo.id)}`, env.SUPABASE_SERVICE_ROLE_KEY, {\n      method: 'GET',"),

    # ── Contar lo que pasa, que es el motivo de que esto exista ──
    (FN, 'el error de Telegram se traduce a un «no se ha podido» inútil',
     '  if (!r.ok) return { estado: 502, cuerpo: { error: `Telegram no lo ha aceptado: ${r.error}` } }\n\n  const cuando = new Date().toISOString()\n  try {\n    await restImpl(`tournaments',
     "  if (!r.ok) return { estado: 502, cuerpo: { error: 'No se ha podido mandar.' } }\n\n  const cuando = new Date().toISOString()\n  try {\n    await restImpl(`tournaments"),

    (FN, 'no se dice QUÉ variable de entorno falta',
     "  const faltan = llavesQueFaltan(env, { canal: 'TELEGRAM_CANAL_TORNEOS' })", '  const faltan = []'),

    # ── Las noticias, que comparten la función ──
    (FN, 'el porte de torneos se lleva por delante las noticias',
     "  if (tipo === 'torneo') return mandarUnTorneo({ id, forzar, env, restImpl, fetchImpl, ahora })",
     '  return mandarUnTorneo({ id, forzar, env, restImpl, fetchImpl, ahora })'),

    (FN, 'sin decir el tipo ya no se entiende «noticia»',
     "export async function mandarUna({ id, tipo = 'noticia', forzar = false,",
     "export async function mandarUna({ id, tipo = 'torneo', forzar = false,"),

    # ── El botón de la ficha ──
    (FICHA, 'el botón de mandar al canal desaparece',
     '  pintarTelegram(acciones)\n', '\n'),

    (FICHA, 'el botón lo ve cualquiera que lleve el torneo, no solo el admin del sitio',
     '  const procede = Boolean(perfil?.is_admin) && !torneo.is_private',
     '  const procede = mando() && !torneo.is_private'),

    (FICHA, 'el botón sale en un torneo privado',
     '&& !torneo.is_private && ', '&& true && '),

    (FICHA, 'el botón sale en un borrador',
     "!torneo.is_private && torneo.status === 'registration_open'",
     "!torneo.is_private"),

    (FICHA, 'el botón deja de contar que ya consta mandado',
     '  btn.title = yaConsta\n    ? `Ya consta como mandado el', '  btn.title = false\n    ? `Ya consta como mandado el'),

    (FICHA, 'el aviso del fallo de la 287 se pierde',
     'ya existían al poner el canal', 'ya existian'),

    # ── La migración ──
    (SQL, 'la red del estreno vuelve a silenciar TODO lo pendiente',
     """ where telegram_sent_at is null
   and (status is distinct from 'registration_open' or start_at < now());""",
     ' where telegram_sent_at is null;'),

    (SQL, 'la red deja de respetar los torneos que aún no han empezado',
     "   and (status is distinct from 'registration_open' or start_at < now());",
     "   and status is distinct from 'registration_open';"),

    (SQL, 'se pierde la explicación de por qué no vale copiarlo de noticias',
     'Un torneo apunta al FUTURO.', 'Un torneo es distinto.'),
]

correr(MUTACIONES, 'test-tanda-302.mjs')
