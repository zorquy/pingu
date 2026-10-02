"""Rigor de la tanda 436 — el Panel primero, y los vistazos.

Casi nada de esto da error al romperse: se abre otra pestaña, o un vistazo
sale vacío con la colección entera cargada. Se ve igual de bien.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

J = 'js/mi-coleccion.js'
C = 'css/mi-coleccion.css'
H = 'mi-coleccion.html'

MUTACIONES = [
    (J, 'vuelve a abrirse en las cartas',
     "let pestania = PESTANAS.includes(pedida) ? pedida : MUDANZAS[pedida] || 'resumen'",
     "let pestania = PESTANAS.includes(pedida) ? pedida : MUDANZAS[pedida] || 'cartas'"),
    (J, 'la direccion por defecto deja de ser la del panel',
     "  if (nueva === 'resumen') url.searchParams.delete('ver')", "  if (nueva === 'cartas') url.searchParams.delete('ver')"),
    # El fallo de la 377, con una pieza nueva.
    (J, 'los vistazos no se repintan cuando llegan las lineas',
     "  if (pestania === 'resumen') void pintarVistazos()\n", "  \n"),
    (J, 'los vistazos no se pintan al cambiar de pestaña',
     "    pintarResumenPanel()\n    void pintarVistazos()", "    pintarResumenPanel()"),
    (J, 'el vistazo de cartas enseña las primeras y no las ultimas',
     "    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))",
     "    .sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')))"),
    (J, 'el vistazo de cartas las enseña todas',
     "    .slice(0, DE_VISTAZO)", ""),
    (J, 'las expansiones salen de la que menos llevas',
     "    .sort((a, b) => b.tengo - a.tengo)", "    .sort((a, b) => a.tengo - b.tengo)"),
    (J, 'salen tambien las expansiones en las que no tienes nada',
     "    .filter((x) => x.tengo > 0)\n", "    \n"),
    (J, 'el «ver todas» no lleva a ninguna parte',
     "    if (ir) return cambiarPestania(ir.dataset.irA)\n", "    if (ir) return\n"),
    (J, 'pulsar una expansion del vistazo no la abre',
     "    cambiarPestania('album')\n    void abrirAlbum(set.dataset.set)", "    cambiarPestania('album')"),
    (C, 'una carta sin escaneo se queda en un hueco invisible',
     "  border: 1px solid var(--border);\n  border-radius: 8px;\n  background: var(--bg);\n  overflow: hidden;",
     "  border-radius: 8px;\n  overflow: hidden;"),
    (H, 'el panel se queda sin la caja de los vistazos',
     '<div class="mc-vistazos" id="mcVistazos"></div>', ''),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-436.mjs')
