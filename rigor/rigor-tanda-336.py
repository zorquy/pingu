"""Rigor de la tanda 336 — las marcas de regulacion desde /admin.

Ninguna da error. La pantalla se pinta, el boton guarda y sale el
mensajito verde. Lo que cambia es si el aviso de la rotacion CANTA
cuando toca, si la red contra la errata sirve de algo, y si lo que se
guarda es lo que el resto de la web lee.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

A = 'admin/js/admin.js'
H = 'admin/index.html'
CSS = 'admin/css/admin.css'

MUTACIONES = [
    # ── 1. El aviso de la rotacion, que es POR LO QUE existe la pantalla ──
    # Callado: unas marcas de hace tres temporadas se ven exactamente
    # igual que unas buenas, y eso es el estado del que veniamos.
    (A, 'el aviso de la rotacion no salta nunca',
     '  const vieja = cuando && cuando < ultimaRotacion()',
     '  const vieja = false'),
    # O al reves, saltando siempre: un aviso que sale todos los dias deja
    # de leerse, y el dia que importe tampoco se lee.
    (A, 'el aviso de la rotacion salta siempre',
     '  const vieja = cuando && cuando < ultimaRotacion()',
     '  const vieja = true'),
    # El abril de referencia, un ano corrido: en septiembre diria que
    # unas marcas de mayo estan viejas, y no lo estan.
    (A, 'la rotacion se compara contra el abril que viene',
     '  if (abril > hoy) abril.setUTCFullYear(abril.getUTCFullYear() - 1)',
     '  if (abril < hoy) abril.setUTCFullYear(abril.getUTCFullYear() + 1)'),

    # ── 2. La fecha ──
    # `updated_at` tiene `default now()`, que solo corre al INSERTAR, y
    # no hay disparador: si no se escribe a mano, la fecha se queda en la
    # de la siembra y el aviso miente CALLANDOSE, que es peor.
    (A, 'guardar no actualiza la fecha',
     "    { key: 'torneos_reglas', value: { marcas_legales: marcas }, updated_at: new Date().toISOString() },",
     "    { key: 'torneos_reglas', value: { marcas_legales: marcas } },"),
    # Y que el aviso no se refresque al guardar: la pantalla se queda en
    # rojo y nadie sabe si ha servido de algo.
    (A, 'el aviso no se refresca al guardar',
     '  marcasLegalesActuales = marcas\n  marcasActualizado = new Date().toISOString()\n  pintarAvisoMarcas()',
     '  marcasLegalesActuales = marcas'),

    # ── 3. La red contra la errata ──
    # Sin contar, una letra mal escrita se guarda tan campante y el fallo
    # aparece en el mazo de alguien, no aqui.
    (A, 'guardar ya no comprueba nada',
     '  const marcas = await comprobarMarcas()', '  const marcas = marcasDelCampo()'),
    # Y el cero sin cantar: «0 cartas legales» contado como una nota mas.
    # Y el singular: «1 cartas legales» canta a maquina.
    (A, 'la cuenta dice «1 cartas» en singular',
     "    ? `<p class=\"admin-note\">Con ${marcas.join(', ')} queda${count === 1 ? '' : 'n'} <strong>${count}</strong>` +\n"
     "      ` carta${count === 1 ? '' : 's'} legal${count === 1 ? '' : 'es'} en el catálogo.</p>`",
     "    ? `<p class=\"admin-note\">Con ${marcas.join(', ')} quedan <strong>${count}</strong> cartas legales en el catálogo.</p>`"),
    (A, 'que no quede ninguna carta legal deja de ser una alerta',
     "    : `<p class=\"admin-note admin-note-warn admin-note-alerta\"><strong>Ninguna carta del catálogo lleva esas marcas.</strong>`",
     "    : `<p class=\"admin-note\"><strong>Ninguna carta del catálogo lleva esas marcas.</strong>`"),
    # Contar sin el mercado: los catalogos asiaticos son otra cosa y
    # inflarian el numero, que es justo lo que se mira para decidir.
    (A, 'la cuenta se lleva tambien los catalogos asiaticos',
     "    .eq('market', 'WEST')\n    .in('regulation_mark', marcas)",
     "    .in('regulation_mark', marcas)"),

    # ── 4. Lo que se guarda ──
    # Sin normalizar: una «h» minuscula no casa con la «H» de la carta y
    # deja TODO el catalogo fuera de reglamento sin dar error.
    (A, 'lo que se escribe no se pasa a mayusculas',
     "    .toUpperCase()\n    .split(/[^A-Z]+/)", '    .split(/[^A-Za-z]+/)'),
    # Guardar una lista vacia: la web se queda sin poder juzgar nada y
    # cae al respaldo del codigo sin que nadie lo haya pedido.
    (A, 'se puede guardar una lista vacia',
     '  if (!marcas.length) {\n    showToast', '  if (false) {\n    showToast'),
    # La clave equivocada: se guarda en un sitio que no lee nadie. El
    # boton dice «guardado» y no cambia nada en la web.
    (A, 'se guarda en una clave que no lee nadie',
     "    { key: 'torneos_reglas', value: { marcas_legales: marcas }, updated_at: new Date().toISOString() },",
     "    { key: 'torneos_marcas', value: { marcas_legales: marcas }, updated_at: new Date().toISOString() },"),
    # Y el campo de dentro del JSON, igual de silencioso.
    (A, 'se guarda en un campo que no lee nadie',
     '  const marcas = data?.value?.marcas_legales\n  marcasLegalesActuales = Array.isArray(marcas) ? marcas : []',
     '  const marcas = data?.value?.marcas\n  marcasLegalesActuales = Array.isArray(marcas) ? marcas : []'),

    # ── 5. La pantalla ──
    # Sin decir que manda el respaldo del codigo: alguien ve el campo
    # vacio y se cree que no hay ninguna marca en vigor.
    (A, 'no se avisa de que sin fila manda el codigo',
     "  if (!marcasLegalesActuales.length) {", '  if (false) {'),
    # El campo sin rellenar: se abre vacio y quien guarde sin mirar se
    # carga las que habia.
    (A, 'el campo no trae las marcas que ya hay',
     '  if (campo) campo.value = marcasLegalesActuales.join(\', \')', '  if (campo) campo.value = \'\''),
    # Y que la tarjeta no se cargue: la pantalla existe pero llega vacia.
    (A, 'la pantalla no llega a cargarse',
     '  await loadMarcasLegales()\n', '\n'),
    (A, 'los botones no se enganchan',
     '  initMarcasSection()\n', '\n'),
    # El canto de la alerta, en el CSS: si no cambia de color, un aviso
    # rojo y una nota gris se ven igual.
    (CSS, 'la alerta se pinta igual que un aviso normal',
     '.admin-note-alerta {\n  border-left-color: var(--danger);\n}',
     '.admin-note-alerta {\n  border-left-color: var(--warning);\n}'),
    # Y el campo, fuera del HTML.
    (H, 'el campo de las marcas desaparece del HTML',
     '<input type="text" id="marcasLegales"', '<input type="text" id="marcasLegalesNo"'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-336.mjs')
