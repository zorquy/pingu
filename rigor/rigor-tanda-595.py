"""Rigor de la tanda 595 — «¿cómo la encuentro?», con todo combinado.

Lo que se rompe aquí da caminos creíbles pero peores: falta el que primero
baraja y luego mira, o el que trae a Drakloak para usarlo. Cada mutación
rompe el ORIGEN de uno de esos caminos.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

CAM = 'js/constructor/caminos.js'
HTML = 'js/constructor/caminos-html.js'

MUTACIONES = [
    (CAM, 'los pasos que preparan se tiran', "    const preparan = hijos.filter((h) => !ganan.includes(h) && h.mueve > 0.5).slice(0, preparar)", "    const preparan = []"),
    (CAM, 'prepara cualquiera, mueva o no el mazo', "    const preparan = hijos.filter((h) => !ganan.includes(h) && h.mueve > 0.5).slice(0, preparar)", "    const preparan = hijos.filter((h) => !ganan.includes(h)).slice(0, preparar)"),
    (CAM, 'todo paso dado cuenta como mover el mazo', "        if (dado && p.s.mazo.join() !== mazoAntes) mueve++", "        if (dado) mueve++"),
    (CAM, 'una evolución no es un puente', "        const evoluciona = !!def && esEvolucion(c) && !def.cuando && !def.pasiva", "        const evoluciona = false"),
    (CAM, 'el puente evoluciona pero no usa la habilidad', "          const dado = (await hacer(p, accion, ui)) && (!evoluciona || (await hacer(p, { tipo: 'habilidad', clave }, ui)))", "          const dado = await hacer(p, accion, ui)"),
    (HTML, 'ninguno es «lo mejor»', "caminoHtml(c, puedeFallar, { mejor: i === 0 })", "caminoHtml(c, puedeFallar, { mejor: false })"),
    (HTML, '«en este orden» con un solo paso', "${c.pasos.length < 2 ? 'Lo mejor' : c.ordenDaIgual", "${c.pasos.length < 1 ? 'Lo mejor' : c.ordenDaIgual"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-595.mjs')
