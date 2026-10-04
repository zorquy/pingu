"""Rigor de la tanda 524 — los caminos escritos en prosa.

Las mutaciones vuelven a poner el fallo: una frase que nombra una pestaña
que no está, un botón sin quien lo atienda, y un barrido que deja de mirar
—que es la trampa de siempre, porque un barrido que no llega sale verde.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

MC = 'js/mi-coleccion.js'
HTML = 'mi-coleccion.html'
ADM = 'admin/js/admin.js'

MUTACIONES = [
    # El fallo original, tal cual.
    (MC, 'el paso 1 vuelve a mandar a la pestaña «Cartas»',
     'Abre una repetida y pon cuántas copias das: <button type="button" class="link-btn" data-ir-cartas>ver tus cartas</button>.',
     'En «Cartas», abre una repetida y pon cuántas copias das.'),
    (MC, 'y el estado vacío de «Lo que das» también',
     'Abre una carta repetida, dale a «Editar» y pon cuántas copias das: <button type="button" class="link-btn" data-ir-cartas>ver tus cartas</button>.',
     'Abre una carta repetida en la pestaña «Cartas», dale a «Editar» y pon cuántas copias das.'),
    # Un botón sin quien lo atienda: pulsa y no pasa nada, que es peor que
    # la frase porque encima parece que va a funcionar.
    (MC, 'el botón se queda sin manejador',
     "    const aCartas = e.target.closest('[data-ir-cartas]')\n    if (aCartas) return cambiarPestania('cartas')",
     ''),
    (MC, 'o lleva a otra pantalla',
     "    if (aCartas) return cambiarPestania('cartas')",
     "    if (aCartas) return cambiarPestania('resumen')"),
    # Los dos nombres de control que no existían.
    (MC, 'el campo de lo que pagaste vuelve a llamarse de otra manera',
     'al editarla, «Lo que pagaste»', 'en su ficha, «Precio de compra»'),
    (MC, 'y el de las copias que das',
     'cuántas copias das —«De esas, doy», al editarla—', 'como «la doy»'),
    (ADM, 'el informe nombra un botón de /admin que no existe',
     'Lo primero se ve en «Qué hay de cada mercado».', 'Lo primero se ve en «Contar mercados».'),
    # Y LA FORMA DEL FALLO, que es lo que de verdad tiene que cazar el
    # barrido: que desaparezca el DESTINO. Nadie toca la frase —sigue
    # diciendo «De esas, doy»—, se le cambia el nombre al campo. Así es
    # como pasó de verdad las tres veces: el texto se queda quieto y lo
    # que se mueve es la pantalla.
    (HTML, 'al campo le cambian el nombre y la frase se queda apuntando al viejo',
     '<label>De esas, doy <input type="number" id="mcEdCambio"',
     '<label>Copias que das <input type="number" id="mcEdCambio"'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-524.mjs')
