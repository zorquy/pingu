"""Rigor de la tanda 306 — los perfiles y la lista de inscritos.

Cada mutación deshace UNA de las decisiones de la tanda. Si la prueba
sigue en verde con el fichero roto, la prueba no vale.

Van varias contra la FORMA de fallos que ya han pasado:
  · mudar una hoja y que una regla pierda por orden de cascada,
  · `display: contents` convirtiendo a un vecino en celda de la fila,
  · una rejilla con menos columnas que celdas.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

MUTACIONES = [
    # ── La cascada al mudar la hoja ──
    ('css/perfil.css', 'el banner vacío vuelve a los 160 (la regla pierde por orden)',
     '.profile-hero-banner-vacio {\n  height: 96px;\n}', '.profile-hero-banner-vacio {\n  height: 160px;\n}'),

    # ── display: contents ──
    ('css/perfil.css', 'el lote del JS vuelve a hacer caja propia',
     '.perfil-cifras-lote {\n  display: contents;\n}', '.perfil-cifras-lote {\n  display: flex;\n}'),
    ('js/perfil.js', 'el panel de invitar se cuelga otra vez del lote de cifras',
     '  tarjeta.after(panel)', "  document.getElementById('profileStats').after(panel)"),

    # ── La tira de cifras ──
    ('css/perfil.css', 'las cifras vuelven a 96 px de base y «Trofeos» se cae de fila',
     '  flex: 1 1 84px;', '  flex: 1 1 96px;'),
    ('usuario.html', 'vuelve la rejilla de tarjetas de estadística',
     '      <div class="perfil-cifras">',
     '      <div class="stats-row" id="profileStatsViejo"></div>\n      <div class="perfil-cifras">'),
    ('js/usuario.js', 'el rango no sube a la fila de chapas',
     "    hueco.outerHTML = `<button type=\"button\" class=\"perfil-rango\" id=\"btnTierInfo\">${tier.icon}${escapeHtml(tier.title)}</button>`",
     "    hueco.outerHTML = ''"),

    # ── La lista de inscritos ──
    ('css/torneos.css', 'la rejilla de inscritos vuelve a cuatro columnas',
     '  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr) 108px 108px 104px;',
     '  grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr) 108px 104px;'),
    ('js/torneos/torneo.js', 'el avatar se pide en una consulta aparte',
     "select('id, username, avatar_url')", "select('id, username')"),
    ('js/torneos/torneo.js', 'la lista de espera se queda sin caras',
     '<span class="torneo-inscrito-nombre"><span class="torneo-cola-puesto">${n + 1}.</span>${caraDe(i.perfil, i.perfil?.username || \'Alguien\')}',
     '<span class="torneo-inscrito-nombre"><span class="torneo-cola-puesto">${n + 1}.</span>'),
    ('js/torneos/torneo.js', 'sin foto, la cara sale vacía en vez de con la inicial',
     "perfil?.avatar_url ? '' : escapeHtml(getInitial(nombre))", "''"),

    # ── La hoja ──
    ('css/components.css', 'la cabecera de perfil vuelve a components.css',
     '/* ── Modal "ver todos los niveles/rangos" ── */',
     '.profile-hero {\n  border-radius: var(--radius-xl);\n}\n\n/* ── Modal "ver todos los niveles/rangos" ── */'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-306.mjs')
