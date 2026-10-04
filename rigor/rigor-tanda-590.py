"""Rigor de la tanda 590 — la impresión que se juega en el meta.

Lo que se rompe aquí no da error: la repetición enseña OTRA carta con el
mismo nombre, y se ve perfectamente bien.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

IMP = 'js/repeticiones/impresion.js'
REP = 'js/repeticiones.js'
DAT = 'js/repeticiones/datos.js'

MUTACIONES = [
    (IMP, 'no suma la misma impresión escrita distinta', "const numeroPlano = (n) => String(n ?? '').trim().toLowerCase().replace(/^0+(?=\\w)/, '')", "const numeroPlano = (n) => String(n ?? '').trim().toLowerCase()"),
    (IMP, 'se queda con la primera, no con la de más mazos', '    if (!ya || x.mazos > ya.mazos) mejor.set(x.nombre, x)', '    if (!ya) mejor.set(x.nombre, x)'),
    (IMP, 'una fila sin colección cuenta', '    if (!f?.nombre || !set || !numero) continue', '    if (!f?.nombre) continue'),
    (REP, 'el meta no se mira', '  if (await preferirLasDelMeta(resueltos, vez)) rehacerFotos()', '  if (false) rehacerFotos()'),
    (REP, 'se cambia por la del meta de OTRO nombre', '    const buena = mejor.get(plano(c.name))', '    const buena = [...mejor.values()][0]'),
    (DAT, 'el meta se pide sin filtrar la sección', "    .eq('seccion', 'pokemon')\n", ''),
    (DAT, 'el meta se pide de siempre', "    .gte('dia', desde)\n", ''),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-590.mjs')
