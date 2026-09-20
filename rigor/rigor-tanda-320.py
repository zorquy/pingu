"""Rigor de la tanda 320 — la barra de arriba con un torneo en juego.

Ninguna de estas mutaciones da error ni desborda la página: el logo CEDE
en silencio, que es justo por lo que el fallo llevaba meses ahí. La
prueba tiene que MEDIR anchos, no leer selectores.

Los puntos de corte se mutan a lo que eran ANTES de esta tanda (860 y
479), porque eran valores plausibles que alguien eligió mirando la
pantalla: si la prueba no los caza, no está midiendo.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

MUTACIONES = [
    # ── 1. El logo vuelve a encogerse ──
    # LA causa. Sin esto el logo pasa de 126 px a 44 y «PokeDoc» se
    # amontona encima de su icono, sin que nada se salga de la página.
    ('css/style.css', 'el logo vuelve a ceder su sitio',
     '  flex-shrink: 0;\n}\n\n.nav-logo::before {', '}\n\n.nav-logo::before {'),

    # ── 2. …y el remedio que NO lo es ──
    # Un `min-width` parece que arregla lo mismo y no arregla nada: es el
    # mínimo de la CAJA, no del reparto. Si la prueba pasa con esto, es
    # que está leyendo el CSS en vez de medir el logo.
    ('css/style.css', 'el flex-shrink se cambia por un min-width, que no vale',
     '  flex-shrink: 0;\n}\n\n.nav-logo::before {',
     '  min-width: 126px;\n}\n\n.nav-logo::before {'),

    # ── 3. El corte de los enlaces, de vuelta a 860 ──
    ('css/style.css', 'los enlaces vuelven a salir desde 860 px',
     '@media (min-width: 1080px) {\n  .nav-links {', '@media (min-width: 860px) {\n  .nav-links {'),

    # ── 4. El tramo del chip, borrado ──
    # Entre 1.080 y 1.179 los enlaces tienen que irse al desplegable.
    ('css/style.css', 'con torneo en juego, los enlaces ya no se apartan',
     '  body:has(.nav-torneo-vivo) .nav-links {\n    display: none;\n  }',
     '  body:has(.nav-torneo-vivo) .nav-links {\n    display: flex;\n  }'),

    # ── 5. El menú de ese tramo, que no se abriría ──
    # Sin el !important el botón está, se pulsa y no pasa nada: los
    # enlaces se han ido y no hay forma de llegar a ellos.
    ('css/style.css', 'en ese tramo el menú se ve pero no se abre',
     '  body:has(.nav-torneo-vivo) .nav-menu-mobile.open {\n    display: flex !important;\n  }',
     '  body:has(.nav-torneo-vivo) .nav-menu-mobile.open {\n    display: flex;\n  }'),

    # ── 6. El corte de la lupa y el tema, de vuelta a 479 ──
    ('css/style.css', 'lupa y tema vuelven a retirarse solo por debajo de 479',
     '@media (max-width: 599px) {\n  .nav-right:has(.nav-torneo-vivo) #navSearchBtn,',
     '@media (max-width: 479px) {\n  .nav-right:has(.nav-torneo-vivo) #navSearchBtn,'),

    # ── 7. El chip largo, de vuelta a mandar por defecto ──
    # Pide 1.282 px: enseñarlo desde 860 es lo que se salía.
    ('js/torneos/aviso-torneo.js', 'el chip con el nombre vuelve a salir desde 860',
     '@media (min-width: 1340px) {', '@media (min-width: 860px) {'),

    # ── 8. Los dos chips a la vez ──
    # Si la regla que esconde el largo desaparece, salen los DOS. No es
    # un desbordamiento: son dos enlaces al mismo sitio, uno al lado del
    # otro, y solo lo caza contar cuántos se ven.
    ('js/torneos/aviso-torneo.js', 'salen los dos chips a la vez',
     '.nav-right .nav-torneo-vivo:not(.nav-torneo-mini) { display: none; }', ''),

    # ── 9. El nombre pierde su caja ──
    # Vuelve al hachazo: `text-overflow` sobre el contenedor flex no hace
    # nada, así que «Pachanga de inauguración» sale como «Pachanga de
    # inauguraci». Sin error, sin desbordar.
    ('js/torneos/aviso-torneo.js', 'el nombre vuelve a ir suelto dentro del chip',
     '${icons.zap(14)}<span class="nav-torneo-nombre">${escapeHtml(torneo.name)}</span>',
     '${icons.zap(14)} ${escapeHtml(torneo.name)}'),

    # ── 10. La caja está, pero sin el min-width ──
    # La otra mitad: un `overflow: hidden` sin `min-width: 0` tampoco
    # encoge por debajo de su contenido.
    ('js/torneos/aviso-torneo.js', 'el nombre tiene caja pero no puede encoger',
     '.nav-torneo-nombre {\n  min-width: 0;', '.nav-torneo-nombre {'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-320.mjs')
