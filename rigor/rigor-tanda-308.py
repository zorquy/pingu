"""Rigor de la tanda 308 — las pestañas del perfil y los esqueletos de lista.

Las mutaciones van contra cada decisión: que la chapa cuente lo que
cuenta, que se abra la pestaña con contenido, que quien mira mande sobre
la página, y que el esqueleto se PAREZCA a lo que llega.
"""
import sys
sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
import rigor_comun

MUTACIONES = [
    # ── La chapa ──
    ('js/perfil-pestanias.js', 'la chapa se pinta también con cero',
     '  if (!n) return', '  if (n === null) return'),
    ('js/perfil-pestanias.js', 'un número largo se sale de la chapa',
     "  chapa.textContent = n > 99 ? '99+' : String(n)", '  chapa.textContent = String(n)'),
    ('js/foro-actividad.js', 'la cuenta del foro se olvida de los mensajes',
     '  return (nTemas || 0) + (nMensajes || 0)', '  return nTemas || 0'),
    # (La salida `if (!formEl)` de renderWall no la recorre nadie hoy:
    #  las dos páginas que lo llaman pasan siempre formEl. Una mutación
    #  que ningún camino ejecuta se cuenta como «sin detectar» y tapa las
    #  de verdad — misma limpieza que la de la tanda 303.)

    # ── Qué pestaña se abre ──
    ('js/perfil-pestanias.js', 'se abre siempre la primera aunque esté vacía',
     "  const conAlgo = ORDEN.find((n) => cuentas[n] > 0 && botonDe(n))",
     "  const conAlgo = null"),
    ('js/perfil-pestanias.js', 'el muro lleno deja de mandar sobre el foro',
     "const ORDEN = ['wall', 'foro', 'guides', 'torneos']",
     "const ORDEN = ['foro', 'wall', 'guides', 'torneos']"),

    # ── Quien manda es quien mira ──
    ('js/perfil-pestanias.js', 'el #hash deja de mandar sobre la pestaña con contenido',
     '  if (laHaTocado || window.location.hash) return', '  if (laHaTocado) return'),
    ('js/perfil-pestanias.js', 'la página te cambia de pestaña después de que la toques',
     '      if (e.isTrusted) laHaTocado = true', '      if (false) laHaTocado = true'),

    # ── Los esqueletos ──
    # La silueta va repetida seis veces, así que el ancla tiene que ser
    # única: se le quita la portada a la PRIMERA, con el `<div>` que la
    # abre delante.
    ('noticias.html', 'la silueta de la noticia se queda sin portada',
     '<div class="noticias-rejilla" id="noticiasRejilla" aria-hidden="true">\n        <div class="esq-tarjeta">\n          <div class="esq-bloque"></div>',
     '<div class="noticias-rejilla" id="noticiasRejilla" aria-hidden="true">\n        <div class="esq-tarjeta">'),
    ('css/components.css', 'la portada de la silueta deja de ser apaisada',
     '  aspect-ratio: 16 / 9;\n  height: auto;', '  aspect-ratio: 1 / 3;\n  height: auto;'),
    ('aprender.html', 'la silueta de la guía se queda sin icono',
     '<div class="guia-rejilla" aria-hidden="true">\n        <div class="esq-guia">\n          <i></i>',
     '<div class="guia-rejilla" aria-hidden="true">\n        <div class="esq-guia">'),
    ('css/components.css', 'la silueta de la guía deja de ser horizontal',
     '.esq-guia {\n  display: flex;', '.esq-guia {\n  display: block;'),
]

rigor_comun.correr(MUTACIONES, 'test-tanda-308.mjs')
