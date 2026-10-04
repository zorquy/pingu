"""Rigor de la tanda 594 — elegir en la mesa, sin ventanas.

Lo que se rompe aquí sigue «funcionando»: vuelve la ventana, la elección no
se puede confirmar, o se cuela otra jugada a mitad. Cada mutación rompe el
ORIGEN de una de esas decisiones.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

LAB = 'js/constructor/laboratorio.js'
CSS = 'css/laboratorio.css'

MUTACIONES = [
    (LAB, 'las cartas vuelven a la ventana', "    if (!valen.length || !valen.every(seVeEnLaMesa)) return ventana.cartas(o)", "    return ventana.cartas(o)"),
    (LAB, 'las energías unidas no se ven en la mesa', "  return lados.some((j) => j.enJuego.some((sl) => sl.energias.includes(uid) || sl.herramienta === uid))", "  return lados.some((j) => j.enJuego.some((sl) => sl.herramienta === uid))"),
    (LAB, 'los Pokémon vuelven a la ventana', "    if (!enLaMesa) return ventana.pokemon(o)", "    return ventana.pokemon(o)"),
    (LAB, 'los premios vuelven a la ventana', "    if (!seVen) return ventana.premios(o)", "    return ventana.premios(o)"),
    (LAB, 'el sí o no vuelve a la ventana', "    return elegirEnLaMesa({ tipo: 'confirmar'", "    return ventana.confirmar(o) || elegirEnLaMesa({ tipo: 'confirmar'"),
    (LAB, 'elegir un Pokémon pide confirmar', "const elegirAlTocar = (e) => (e.tipo === 'pokemon' && e.min === 1 && e.max === 1) || e.tipo === 'premios'", "const elegirAlTocar = (e) => e.tipo === 'premios'"),
    (LAB, 'se confirma con menos de las que hacen falta', "  return n >= e.min && n <= e.max && !errorDeElegir(e)", "  return n <= e.max && !errorDeElegir(e)"),
    (LAB, 'lo obligatorio se cancela con Escape', "  if (e.sinCancelar) return true\n", ''),
    (LAB, 'Escape no cancela la elección (cierra el laboratorio)', "    else if (cancelarElegir()) {", "    else if (false) {"),
    (LAB, 'la raíz lleva data-elegir', "  if (e) L.raiz.dataset.eligiendo = e.tipo\n  else delete L.raiz.dataset.eligiendo", "  if (e) L.raiz.dataset.elegir = e.tipo\n  else delete L.raiz.dataset.elegir"),
    (LAB, 'la mano no sabe cuáles valen', "            const elegible = L.elegir?.tipo === 'cartas' && L.elegir.valen.has(u)", "            const elegible = !!L.elegir"),
    (LAB, 'Intro no pulsa el muñeco', "    tocarElegir(foco.dataset.elegir)\n    return true", "    return true"),
    (LAB, 'cerrar deja la jugada esperando', "  if (L.elegir && !L.elegir.sinCancelar) cancelarElegir()\n", ''),
    (LAB, 'los botones de arriba se cuelan', "      if (!e.target.closest('[data-accion=\"panel\"], [data-accion=\"cerrar\"], [data-panel-pestania]')) return\n", ''),
    (CSS, 'la mano no se apaga al elegir otra cosa', ".lab-modo-elegir:not([data-eligiendo='cartas']) .lab-mano-carta,\n", ''),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-594.mjs')
