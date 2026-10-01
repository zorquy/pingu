"""Rigor de la tanda 422 — moverse por la ficha, y poder cerrarla.

Casi nada de esto da error al romperse. Unas flechas que se quedan en el
sitio, un «3 de 198» que miente, una nota que se pierde al pasar de carta
o un cerrar que no cierra: todo se ve igual de bien en una captura. Por
eso cada mutación rompe el ORIGEN —el vecindario, el guardado pendiente,
el `disabled`— y no una de sus guardas.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

J = 'js/mi-coleccion.js'
C = 'css/mi-coleccion.css'
H = 'mi-coleccion.html'

MUTACIONES = [
    # ── El vecindario ──
    (J, 'el vecindario sale de los datos y no del DOM',
     "  const ids = [...($(zona)?.querySelectorAll(selector) || [])].map((x) => x.dataset[atributo]).filter(Boolean)",
     "  const ids = lineas.map((l) => l.id)"),
    (J, 'el sitio cuenta desde cero',
     "  $('mcEdSitio').textContent = `${vecindario.i + 1} de ${vecindario.ids.length}`",
     "  $('mcEdSitio').textContent = `${vecindario.i} de ${vecindario.ids.length}`"),
    (J, 'la flecha de atras no se apaga en la primera',
     "  $('mcEdAnterior').disabled = vecindario.i === 0",
     "  $('mcEdAnterior').disabled = false"),
    (J, 'la flecha de alante no se apaga en la ultima',
     "  $('mcEdSiguiente').disabled = vecindario.i >= vecindario.ids.length - 1",
     "  $('mcEdSiguiente').disabled = false"),
    (J, 'se puede salir de la lista por arriba',
     "  if (i < 0 || i >= vecindario.ids.length) return",
     "  if (i < 0) return"),
    (J, 'el indice no avanza: la flecha repinta la misma carta',
     "  vecindario.i = i\n", "  \n"),
    (J, 'los pasos se pintan con una sola carta detras',
     "  pasos.hidden = !vecindario || vecindario.ids.length < 2", "  pasos.hidden = false"),

    # ── Lo que estabas escribiendo ──
    (J, 'cambiar de carta se lleva por delante lo escrito',
     "  await cerrarGuardadoPendiente()\n", "  \n"),
    (J, 'el temporizador no se limpia: lo escrito se guarda en la carta de al lado',
     "  clearTimeout(guardadoPendiente)\n  guardadoPendiente = null\n  await guardarEditor()",
     "  guardadoPendiente = null"),
    (J, 'el temporizador deja su id gastado puesto',
     "    guardadoPendiente = setTimeout(() => {\n      guardadoPendiente = null\n      void guardarEditor()\n    }, retardo)",
     "    guardadoPendiente = setTimeout(() => guardarEditor(), retardo)"),

    # ── El teclado ──
    (J, 'las flechas del teclado se le roban a un campo',
     "    if (e.target.closest('input, select, textarea')) return\n", "    \n"),
    (J, 'el teclado no mueve nada',
     "    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return",
     "    if (e.key !== 'Home') return"),

    # ── Abrir sobre abierto ──
    (J, 'vuelve a abrir un dialogo ya abierto (InvalidStateError)',
     "  if (!d.open) d.showModal()", "  d.showModal()"),

    # ── Las tres rejillas ──
    (J, 'la rejilla de tu coleccion no fija vecindario',
     "    fijarVecindario('mcCartas', '[data-linea]', 'linea', l.id)\n", "    \n"),
    (J, 'las rejillas de carta no fijan vecindario',
     "      fijarVecindario(zona, selector, 'carta', enlace.dataset.carta)\n", "      \n"),

    # ── El cerrar ──
    (H, 'la ficha se queda sin boton de cerrar',
     '<button type="button" class="mc-panel-cerrar" id="mcEdCerrar" aria-label="Cerrar la ficha">✕</button>',
     ''),
    (J, 'el boton de cerrar no cierra',
     "  $('mcEdCerrar')?.addEventListener('click', () => $('mcEditor').close())\n", "  \n"),

    # ── El CSS ──
    (C, 'los pasos escondidos siguen ocupando',
     ".mc-ficha-pasos[hidden] {\n  display: none;\n}", ".mc-ficha-pasos[hidden] {\n  opacity: 0;\n}"),
    (C, 'el mando se va con el desplazamiento',
     "  display: flex;\n  position: sticky;\n  z-index: 3;\n  top: calc(var(--e-xl) * -1);",
     "  display: flex;\n  position: static;\n  z-index: 3;"),
    (C, 'las flechas dejan de poder tocarse en el movil',
     "  min-width: 44px;\n  min-height: 44px;\n  padding: 0;\n  border: 1px solid var(--border);\n  border-radius: 50%;",
     "  min-width: 32px;\n  min-height: 32px;\n  padding: 0;\n  border: 1px solid var(--border);\n  border-radius: 50%;"),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-422.mjs')
