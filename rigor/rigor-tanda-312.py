"""Rigor de la tanda 312 — las seis mejoras visuales.

Cada mutación deshace UNA de las seis, o vuelve a meter el fallo que
había debajo. Si alguna sale «sin detectar», la prueba está mirando el
caso y no la forma.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

MUTACIONES = [
    # ── 1. La franja de la tarjeta de guía ──
    ('js/aprender.js', 'la franja vuelve a quedarse vacía',
     '<span class="guia-arte-info">', '<span class="guia-arte-info" style="display:none">'),
    ('js/aprender.js', 'la tarjeta deja de saber de qué categoría es',
     '  const nombreDeCategoria = Object.fromEntries',
     '  const nombreDeCategoria = {} || Object.fromEntries'),
    ('css/aprender.css', 'las dos chapas se amontonan a un lado',
     '  justify-content: space-between;\n  gap: 8px;\n  padding: 12px;\n  pointer-events: none;',
     '  justify-content: flex-start;\n  gap: 8px;\n  padding: 12px;\n  pointer-events: none;'),
    ('css/aprender.css', 'el pie de la tarjeta vuelve a apilarse',
     '.guia-progreso {\n  margin-top: auto;\n  display: flex;\n  align-items: center;',
     '.guia-progreso {\n  margin-top: auto;\n  display: flex;\n  flex-direction: column;\n  align-items: flex-start;'),
    ('js/aprender.js', 'la barra vuelve a aparecer solo si has empezado',
     '<span class="guia-barra"><i style="width:${relleno}%"></i></span>',
     '${relleno ? `<span class="guia-barra"><i style="width:${relleno}%"></i></span>` : \'\'}'),

    # ── 2. El pie y el hueco de las páginas cortas ──
    # EL FALLO DE DEBAJO, que no era el pie: el contenido estaba obligado
    # a medir una pantalla entera, así que el pie caía detrás de un vacío
    # y había que bajar a buscarlo.
    ('css/style.css', 'el contenido vuelve a medir una pantalla entera',
     'body:has(> .footer) .page-content {', 'body:has(> .no-existe) .page-content {'),
    # El `width: 100%` fue el arreglo del arreglo: sin él, el margen
    # automático del centrado anula el estirado y la columna se encoge a
    # su contenido. Se quita, no se cambia: cambiarlo por otro valor no
    # reproduce el fallo.
    ('css/style.css', 'la columna se estrecha al volverse flexible',
     '     sin que nada diera error. */\n  width: 100%;\n}',
     '     sin que nada diera error. */\n}'),
    ('guia.html', 'una página se queda con el pie de antes',
     '    <div class="pie-rejilla">', '    <div class="pie-rejilla-no">'),
    ('torneos.html', 'el pie pierde el ancla donde se engancha el feedback',
     '<p class="footer-links">', '<p class="footer-enlaces">'),

    # ── 3. Los números de la comunidad ──
    ('css/comunidad.css', 'los números vuelven a ser cuatro tarjetas sueltas',
     '  border-right: 1px solid var(--border);\n  border-bottom: 1px solid var(--border);\n}',
     '  border: 1px solid var(--border);\n  border-radius: var(--radius-lg);\n  box-shadow: var(--shadow-xs);\n}'),

    # ── 4. La actividad ──
    ('js/activity.js', 'vuelve el icono repetido a los dos lados de la fila',
     "  const iconoDerecha = t.deLaCasa ? '' :",
     "  const iconoDerecha = false ? '' :"),
    ('js/activity.js', 'vuelve el «Nueva noticia:» delante de cada titular',
     "    ? `<span class=\"activity-tipo\">${escapeHtml(t.etiqueta || t.verbo)}</span>`",
     "    ? `<strong>${escapeHtml(t.verbo)}</strong>`"),

    # ── 5. La noticia sin portada ──
    ('css/noticias.css', 'el hueco sin foto vuelve a parecer una imagen rota',
     '  background-image: linear-gradient(135deg, #16405e 0%, #2a7fb5 55%, #3fa3c9 100%);\n  color: rgba(255, 255, 255, 0.7);',
     '  color: var(--navy);\n  opacity: 0.45;'),
    ('css/noticias.css', 'el sello del hueco sin foto desaparece',
     "  content: 'PokeDoc';", "  content: '';"),

    # ── 6. Los objetivos táctiles ──
    ('css/style.css', 'la barra de arriba vuelve a ser de 35 px',
     '.nav-inner .nav-right a:not(.nav-user-dropdown a),\n.nav-inner .nav-right button:not(.nav-user-dropdown button),\n.nav-logo {\n  min-height: 44px;\n}',
     '.nav-inner .nav-right a:not(.nav-user-dropdown a),\n.nav-inner .nav-right button:not(.nav-user-dropdown button),\n.nav-logo {\n  min-height: 0;\n}'),
    ('css/components.css', 'los chips y las pestañas vuelven a quedarse cortos',
     '@media (pointer: coarse) {\n  .com-chip,', '@media (pointer: no-existe) {\n  .com-chip,'),
    # Y las dos caras del botón de tema: sin el gemelo, una pantalla
    # estrecha se queda SIN forma de cambiar de tema; sin esconder el de
    # la barra, salen los dos a la vez.
    ('js/theme.js', 'el botón de tema desaparece de las pantallas estrechas',
     "  document.getElementById('navMobileMenu')?.appendChild(enMenu)", '  void 0'),
    ('css/style.css', 'el botón de tema sale por duplicado',
     '@media (min-width: 360px) {\n  .nav-tema-menu {\n    display: none;\n  }\n}',
     '@media (min-width: 360px) {\n  .nav-tema-menu {\n    display: flex;\n  }\n}'),
    # El que se me pasó y cazó test-torneos-15: la barra con un torneo
    # en juego lleva un pasajero más y dejaba de caber.
    ('css/style.css', 'con un torneo en juego la barra se sale de la pantalla',
     '  .nav-right:has(.nav-torneo-vivo) #navSearchBtn,\n  .nav-right:has(.nav-torneo-vivo) #navThemeToggle {\n    display: none;\n  }',
     '  .nav-right:has(.nav-torneo-vivo) #navSearchBtn,\n  .nav-right:has(.nav-torneo-vivo) #navThemeToggle {\n    display: inline-flex;\n  }'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-312.mjs')
