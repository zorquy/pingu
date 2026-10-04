"""Rigor de la tanda 514 — las notas y los momentos en el vídeo.

Lo que se rompe aquí no da error: una nota que pasa demasiado deprisa para
leerla, un vídeo que dura otra cosa de lo que dijo la ventana, un cartel
sin su número o una barra que marca los KO donde no son.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

VID = 'js/repeticiones/video.js'
REP = 'js/repeticiones.js'

MUTACIONES = [
    (VID, 'la nota va con el ritmo (a 4× no da tiempo a leerla)',
     '+ (extraDe ? extraDe(i) / 1000 : 0)', '+ (extraDe ? extraDe(i) / 1000 / ritmo : 0)'),
    (VID, 'la nota no se pinta',
     '  if (!nota) return\n  ctx.save()\n  ctx.globalAlpha = Math.min(1, t / 0.25)', '  if (true) return\n  ctx.save()\n  ctx.globalAlpha = Math.min(1, t / 0.25)'),
    (VID, 'el cartel del turno pierde su número',
     '      ? `Turno ${s.turno} de ${s.deQuien}`', '      ? `Turno de ${s.deQuien}`'),
    (VID, 'el KO no tiene cartel',
     "        : f?.tipo === 'ko' && f.carta\n", "        : false\n"),
    (VID, 'los KO de la barra no salen',
     "  return { total: tiempo, turnos: cuando('turno'), kos: cuando('ko') }", "  return { total: tiempo, turnos: cuando('turno'), kos: [] }"),
    (VID, 'la barra no avanza',
     '  redondo(ctx, x, y, Math.max(6, pos(tiempo) - x), 6, 3)', '  redondo(ctx, x, y, 6, 6, 3)'),
    (VID, 'las notas se cuentan desde el principio de la partida y no del trozo',
     '.map(([i, texto]) => [i - a, texto]))', '.map(([i, texto]) => [i, texto]))'),
    (VID, 'el bucle no dice en qué foto va',
     '      dibujarFoto(ctx, C, fotos[fr.foto], fr.t, dibujo, { i: fr.foto, tiempo: us / 1e6 })',
     '      dibujarFoto(ctx, C, fotos[fr.foto], fr.t, dibujo)'),
    (REP, 'la ventana no cuenta las notas en lo que dura',
     '    const conNotas = casilla ? casilla.checked : R.notas.length > 0', '    const conNotas = casilla ? casilla.checked : false'),
    (REP, 'el vídeo no recibe las notas',
     "      notas: conNotas ? new Map([...R.notas].reverse().map((n) => [n.foto, n.texto])) : null,", '      notas: null,'),
    (REP, 'la casilla de la barra nace sin marcar',
     '<input type="checkbox" id="repVideoBarra" checked />', '<input type="checkbox" id="repVideoBarra" />'),
    (REP, 'cambiar la casilla de notas no recuenta lo que dura',
     "e.target.closest('#repDesde, #repHasta, #repVideoNotas')", "e.target.closest('#repDesde, #repHasta')"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-514.mjs')
