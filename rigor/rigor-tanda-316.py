"""Rigor de la tanda 316 — las seis cosas que se vieron mirando.

Cada mutación deshace UNA de las seis y las devuelve al estado en el que
estaban esta mañana. Ninguna da error en ninguna parte: todas se veían
mirando la pantalla, que es justo por lo que hacen falta pruebas que
MIDAN y no que lean el código.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

MUTACIONES = [
    # ── 1. Una sola tarjeta de guía ──
    # LA DECISIÓN: el molde es uno. Volver a tener dos es exactamente lo
    # que pasó, y no lo nota nadie hasta que alguien compara las dos
    # pantallas a la vez.
    ('js/home.js', 'la portada vuelve a pintar su propia tarjeta',
     "    .map((g) => tarjetaDeGuia(g, { categoria: g.categories?.name || '', pie: true }))",
     "    .map((g) => `<div class=\"recent-card\"><h3>${g.title}</h3></div>`)"),
    ('js/guia-tarjeta.js', 'la tarjeta deja de decir de qué es la guía',
     "          ${categoria ? `<span class=\"guia-chapa-cat\">${escapeHtml(categoria)}</span>` : '<span></span>'}",
     "          <span></span>"),
    ('js/home.js', 'la portada pierde el autor y el guardar',
     "    .map((g) => tarjetaDeGuia(g, { categoria: g.categories?.name || '', pie: true }))",
     "    .map((g) => tarjetaDeGuia(g, { categoria: g.categories?.name || '' }))"),
    # Y la trampa de la 306, que picó al mudar el bloque de hoja: el gris
    # de la etiqueta se come el color de la rareza si va detrás.
    ('css/components.css', 'la rareza se pinta del gris de las etiquetas',
     '.rareza-bronze { color: var(--rarity-bronze); }', '.rareza-bronze { color: inherit; }'),

    # ── 2. El título de un tema, en el móvil ──
    ('css/portada.css', 'el título de un tema vuelve a una línea con «…»',
     """.foro-vivo-titulo {
  font-weight: 700;
  color: var(--text);
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}""",
     """.foro-vivo-titulo {
  font-weight: 700;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}"""),
    ('css/portada.css', 'la cuenta de mensajes se queda con su columna en el móvil',
     """  .foro-vivo-cuenta {
    grid-column: 2;""",
     """  .foro-vivo-cuenta {
    grid-column: 3;"""),

    # ── 3. La portada no se repite ──
    ('js/home.js', 'los temas del foro vuelven a salir dos veces',
     '  return temas.map((t) => `tema:${t.id}`)', '  return []'),
    ('js/home.js', 'la noticia del banner vuelve a salir dos veces',
     '    return [`noticia:${noticia.id}`, `guia:${noticia.id}`]', '    return []'),
    # Y el descarte del otro lado: si la actividad deja de mirar la lista,
    # da igual lo bien que la rellenen los de arriba.
    ('js/home.js', 'la actividad deja de mirar lo que ya está pintado',
     '    const eventos = actividad.eventos.filter((e) => !yaEstan.has(claveDeEvento(e))).slice(0, 4)',
     '    const eventos = actividad.eventos.slice(0, 4)'),

    # ── 4. Los primeros pasos, arriba en el móvil ──
    ('css/portada.css', 'los primeros pasos vuelven al final en el móvil',
     """  #primerosPasos {
    order: -1;
  }""",
     """  #primerosPasos {
    order: 0;
  }"""),
    # Sin disolver las columnas, el `order` no puede mover nada de una a
    # la otra: es una mutación INERTE si no se mira el resultado, así que
    # la prueba tiene que medir DÓNDE acaba el panel y no si hay `order`.
    ('css/portada.css', 'las dos columnas dejan de disolverse en el móvil',
     """  .portada-principal,
  .portada-lateral {
    display: contents;
  }""",
     """  .portada-principal,
  .portada-lateral {
    display: flex;
  }"""),

    # ── 5. La rejilla de torneos ──
    ('css/torneos.css', 'una tarjeta sola vuelve a dejar la fila a medias',
     '.torneos-rejilla:has(> :only-child) {\n  grid-template-columns: minmax(0, 620px);\n}',
     '.torneos-rejilla:has(> :only-child) {\n  grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));\n}'),
    ('css/torneos.css', 'con dos, la rejilla vuelve a guardar sitio para una tercera',
     '.torneos-rejilla:has(> :nth-child(2):last-child) {\n  grid-template-columns: repeat(auto-fit, minmax(330px, 1fr));\n}',
     '.torneos-rejilla:has(> :nth-child(2):last-child) {\n  grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));\n}'),
    # Y la trampa de verdad: devolver las pestañas a la rejilla. Con
    # ellas cruzándola, `auto-fit` no pliega nada y todo lo de arriba deja
    # de funcionar sin que cambie una sola regla de CSS.
    ('js/torneos/torneos.js', 'las pestañas vuelven dentro de la rejilla y la cruzan',
     '    <div class="torneos-rejilla">${activa.filas.join(\'\')}</div>',
     '    ${activa.filas.join(\'\')}'),

    # ── 6. La cabecera del foro ──
    ('foro.html', 'el buscador vuelve a salir encima del título',
     '    <div class="page-header foro-cabecera" style="padding-top: 8px;">',
     '    <form class="foro-buscador" role="search">'
     '<input type="search" aria-label="Buscar en el foro" /></form>\n'
     '    <div class="page-header foro-cabecera" style="padding-top: 8px;">'),

    # ── 7. La tarjeta se mide a sí misma ──
    ('css/components.css', 'la tarjeta deja de ser su propio marco de referencia',
     '  container-type: inline-size;\n  container-name: guia;', '  container-name: guia;'),
    ('css/components.css', 'la franja no se encoge en una tarjeta estrecha',
     '@container guia (max-width: 299px) {\n  .guia-arte { height: 68px; }',
     '@container guia (max-width: 299px) {\n  .guia-arte { height: 100px; }'),

    # ── 8. Los títulos se reparten las líneas ──
    ('css/style.css', 'los títulos dejan de repartirse las líneas',
     '.foro-vivo-titulo {\n  text-wrap: balance;\n}', '.foro-vivo-titulo {\n  text-wrap: wrap;\n}'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-316.mjs')
