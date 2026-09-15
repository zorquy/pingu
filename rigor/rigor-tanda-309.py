"""Rigor de la tanda 309 — el destello de la guía, el menú, el
desplegable y la escala de bordes.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

MUTACIONES = [
    # ── El destello: el servidor vuelve a pintar el texto suelto ──
    ('netlify/edge-functions/meta-social.js', 'el servidor deja de envolver el cuerpo del artículo',
     "    '<div class=\"article-header\">' +", "    '' +"),
    ('netlify/edge-functions/meta-social.js', 'el servidor pinta el texto fuera de .article-body',
     "    `<div class=\"article-body\">${recortado}</div>`", '    recortado'),
    ('netlify/edge-functions/meta-social.js', 'el servidor deja de mandar el texto (adiós buscadores)',
     '  const dentro = cuerpoDeBloques(bloques)', '  const dentro = ""'),

    # ── El menú ──
    ('js/app.js', 'la marca de sección vuelve a comparar el href a pelo',
     "    if (claveDeRuta(a.getAttribute('href')) === actual) a.classList.add('active')",
     "    if (a.getAttribute('href') === window.location.pathname.split('/').pop()) a.classList.add('active')"),
    ('js/app.js', 'leer una guía deja de marcar «Aprender»',
     '  const actual = APARTADO_DE[primero] || primero', '  const actual = primero'),
    ('css/style.css', 'la marca del apartado activo deja de verse',
     '.nav-links a.active {\n  color: var(--navy);\n  font-weight: 700;\n  background: color-mix(in srgb, var(--navy) 12%, transparent);',
     '.nav-links a.active {\n  color: var(--navy);\n  font-weight: 700;'),

    # ── El desplegable ──
    ('js/app.js', 'vuelve «Mis torneos» al desplegable',
     '        <a href="/perfil.html">${icons.user(16)} Mi perfil</a>',
     '        <a href="/perfil.html">${icons.user(16)} Mi perfil</a>\n        <a href="/perfil.html#torneos">${icons.trophy(16)} Mis torneos</a>'),
    ('js/app.js', '«Cerrar sesión» se queda pegado a lo de arriba',
     '<button type="button" class="nav-user-grupo" id="navUserSignOut">',
     '<button type="button" id="navUserSignOut">'),
    ('js/app.js', 'el feedback se pierde: no se monta en el pie',
     '    montarFeedbackEnElPie()', '    void 0'),

    # ── La escala de bordes ──
    ('css/components.css', 'una tarjeta vuelve al borde gordo',
     '.guide-card {\n  background: var(--white);\n  border: 1px', '.guide-card {\n  background: var(--white);\n  border: 2px'),
    ('css/style.css', 'vuelve un grosor fuera de la escala',
     '  color: var(--navy);\n  border: 1px solid var(--border-strong);\n  box-shadow: 0 4px 0 0 var(--border-strong);',
     '  color: var(--navy);\n  border: 1.5px solid var(--border-strong);\n  box-shadow: 0 4px 0 0 var(--border-strong);'),
    ('css/components.css', 'un radio vuelve a escribirse a pelo',
     '.nivel-chapa {\n  display: inline-flex;', '.nivel-chapa {\n  border-radius: 999px;\n  display: inline-flex;'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-309.mjs')
