"""Rigor de la tanda 314 — las piezas de alrededor del foro.

Cada mutación deshace UNA de las decisiones que la tanda pone por
escrito. Son decisiones que un refactor se lleva por delante sin que
nada dé error: es justo el tipo de cosa que solo caza una prueba.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

MUTACIONES = [
    # ── Encuestas ──
    # LA DECISIÓN: ver por dónde va la votación cambia lo que vota la
    # gente, y en una comunidad pequeña eso se nota mucho.
    ('js/encuesta.js', 'los resultados se enseñan antes de votar',
     '  const verResultados = heVotado || cerrada', '  const verResultados = true'),
    ('js/encuesta.js', 'cambiar el voto no borra el anterior',
     "    await supabase.from('forum_poll_votes').delete().eq('thread_id', threadId).eq('user_id', userId)",
     '    void 0'),
    ('js/encuesta.js', 'una encuesta de varias respuestas vuelve a ser de una',
     "encuesta.multiple ? 'checkbox' : 'radio'", "'radio'"),
    ('js/encuesta.js', 'se puede marcar una opción sin tener cuenta',
     '  const puedeVotar = !!userId && !cerrada', '  const puedeVotar = !cerrada'),

    # ── Menciones ──
    ('js/menciones.js', 'una dirección de correo vuelve a mencionar a alguien',
     'const PATRON = /(^|[^a-z0-9@._-])@([a-z0-9][a-z0-9_-]{1,29})/gi',
     'const PATRON = /(^|[^\\s])?@([a-z0-9][a-z0-9_-]{1,29})/gi'),
    ('js/menciones.js', 'los párrafos dejan de separar y @alguien al abrir uno no cuenta',
     "  doc.body.querySelectorAll(BLOQUES).forEach((el) => el.before(' '))", '  void 0'),
    ('js/menciones.js', 'se avisa a todos los mencionados, sin tope',
     '    if (vistos.size >= MAXIMO) break', '    void 0'),
    ('js/menciones.js', 'se mete un enlace dentro de otro',
     "    if (nodo.parentElement?.closest('a, code, pre')) continue", '    void 0'),

    # ── Lo no leído ──
    # Sin esta excepción, responder te marcaba el tema en negrita: tu
    # propio mensaje contando como nuevo para ti.
    ('js/foro-lecturas.js', 'tu propio mensaje vuelve a contar como no leído',
     '  if (tema.last_post_author_id && marcas.mio && tema.last_post_author_id === marcas.mio) return false',
     '  void 0'),
    # Y sin la migración, media pantalla en negrita para siempre.
    #
    # La mutación va sobre el ORIGEN —`hayDatos`, que dice si la tabla
    # contestó— y no sobre ninguna de las dos guardas que lo consultan:
    # cada una de ellas sola es una red de repuesto de la otra, y
    # quitarle solo una no cambia nada. Una mutación que no cambia el
    # comportamiento se cuenta como «sin detectar» y tapa las de verdad.
    ('js/foro-lecturas.js', 'el foro deja de notar que la tabla no contestó',
     "  const vacio = { porTema: {}, todoHasta: null, hayDatos: false, mio: userId || null }",
     "  const vacio = { porTema: {}, todoHasta: null, hayDatos: true, mio: userId || null }"),

    # ── Seguir un tema ──
    ('js/tema.js', 'el botón de seguir no vuelve atrás cuando la base lo rechaza',
     '      siguiendo = antes', '      void 0'),

    # ── El buscador ──
    ('js/foro.js', 'sin la migración el buscador dice que no hay nada',
     '    principal.innerHTML = `<p class="empty-state">El buscador del foro todavía no está activado.</p>`',
     '    principal.innerHTML = `<p class="empty-state">No hay nada con eso.</p>`'),

    # ── Moderación ──
    ('js/foro-comun.js', 'un moderador deja de ser del equipo',
     'data?.is_admin || data?.is_moderator', 'data?.is_admin'),
    ('js/foro-comun.js', 'la moderación se le enseña a todo el mundo',
     "  if (!sesion) return { staff: false, admin: false }", '  return { staff: true, admin: true }'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-314.mjs')
