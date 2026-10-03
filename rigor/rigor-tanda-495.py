"""Rigor de la tanda 495 — las notas del dueño en jugadas concretas.

Una nota en la jugada equivocada se lee igual de bien: el fallo es que
habla de otra cosa. Cada mutación rompe el ORIGEN de su sitio, de quién la
ve o de cuánto se queda (tanda 314).
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

REG = 'js/repeticiones/registro.js'
REP = 'js/repeticiones.js'

MUTACIONES = [
    (REG, 'las jugadas no saben de qué línea salen',
     '    ev.fila = fila\n', ''),
    (REP, 'una nota se ancla a la jugada siguiente',
     "  const nuevas = (texto ? [...otras, { fila: ev.fila, texto }] : otras).sort((x, y) => x.fila - y.fila)",
     "  const nuevas = (texto ? [...otras, { fila: R.lectura.eventos[i]?.fila ?? ev.fila, texto }] : otras).sort((x, y) => x.fila - y.fila)"),
    (REP, 'una nota en una línea que no es jugada se pierde',
     "      return { fila: n.fila, texto: n.texto, foto: Math.max(1, k + 1) }",
     "      return { fila: n.fila, texto: n.texto, foto: ev[k]?.fila === n.fila ? k + 1 : -1 }"),
    (REP, 'la reproducción no espera a que se lea la nota',
     'const esperaDeNota = (n) => (n ? Math.min(8000, 1500 + n.texto.length * 40) : 0)', 'const esperaDeNota = () => 0'),
    (REP, 'cualquiera puede escribir notas en la repetición de otro',
     'const puedeAnotar = () => !R.origen || Boolean(R.origen.mia)', 'const puedeAnotar = () => true'),
    (REP, 'cambiar una nota la duplica',
     '  const otras = R.notas.filter((n) => n.foto !== i).map(', '  const otras = R.notas.map('),
    (REP, 'las notas no son momentos de la tira',
     "  const ms = [...R.momentos, ...R.notas.map((n) => ({ foto: n.foto, turno: turnoDe(n.foto), tipo: 'nota', texto: n.texto }))].sort((a, b) => a.foto - b.foto)",
     '  const ms = [...R.momentos]'),
    (REP, 'una guardada abre sin sus notas',
     ', notas: fila.notas || [], mazos:', ', notas: [], mazos:'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-495.mjs')
