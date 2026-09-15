"""Rigor de la tanda 300 (la portada en dos columnas). En segundo plano SIEMPRE."""
import sys

sys.path.insert(0, '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad')
from rigor_comun import correr

SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
REPO = '/home/user/pingu'
HOME = 'js/home.js'
APR = 'js/aprender.js'
APP = 'js/app.js'
PP = 'js/primeros-pasos.js'
PORT = 'css/portada.css'
COMP = 'css/components.css'
INDEX = 'index.html'

MUTACIONES = [
    # ── El reparto en dos columnas ──
    (INDEX, 'el torneo se queda en la columna ancha',
     '''      <aside class="portada-lateral">
        <!-- El próximo torneo sube a la lateral''',
     '''      <aside class="portada-lateral-que-no-es">
        <!-- El próximo torneo sube a la lateral'''),

    (INDEX, 'las guías nuevas vuelven al fondo de la página',
     '        <section id="recientesSeccion">', '        <section id="recientesSeccionQueNoEs">'),

    (INDEX, 'los temas desaparecen de la portada',
     '          <div class="portada-temas" id="temasChips"></div>',
     '          <div class="portada-temas" id="temasChipsQueNoEs"></div>'),

    (INDEX, 'vuelven los dos atajos que se quitaron',
     '        <section id="temasSeccion">',
     '        <section id="atajosSeccion"></section>\n        <section id="temasSeccion">'),

    (PORT, 'la fila de hoy deja de cuadrar con el panel de abajo',
     '''  .portada-hoy {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 320px;
    gap: 16px;
  }''',
     '''  .portada-hoy {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 280px;
    gap: 16px;
  }'''),

    # ── El torneo ──
    (HOME, 'el torneo vuelve a ser una fila fina',
     '      <a class="portada-torneo" href="/torneo?slug=${encodeURIComponent(torneo.slug)}">',
     '      <a class="reto-tarjeta" href="/torneo?slug=${encodeURIComponent(torneo.slug)}">'),

    (HOME, 'el torneo pierde el día',
     '          <b>${dia.getDate()}</b>', '          <b></b>'),

    (HOME, 'el torneo pierde el mes',
     '          <span>${MESES[dia.getMonth()]}</span>', '          <span></span>'),

    (HOME, 'el torneo pierde el botón de apuntarse',
     '        <span class="portada-torneo-boton">Apuntarme</span>', '        <span></span>'),

    (HOME, 'sin torneo abierto la sección se queda con el esqueleto girando',
     "    if (!torneo) return recogerSeccion('torneoPortadaSeccion')",
     '    if (!torneo) return'),

    # ── Los temas: el punto entero de la tanda ──
    (HOME, 'los chips vuelven a llevar a la página de categoría vacía',
     '      <a class="portada-tema" href="/aprender.html?tema=${encodeURIComponent(c.slug)}">',
     '      <a class="portada-tema" href="/categoria.html?slug=${encodeURIComponent(c.slug)}">'),

    (HOME, 'sale también el tema que no tiene ni una guía',
     '  const conGuias = data.filter((c) => (c.guide_count ?? 0) > 0).sort((a, b) => (b.guide_count ?? 0) - (a.guide_count ?? 0))',
     '  const conGuias = data.slice()'),

    (HOME, 'los temas dejan de ordenarse por número de guías',
     '.sort((a, b) => (b.guide_count ?? 0) - (a.guide_count ?? 0))', '.sort(() => 0)'),

    (HOME, 'el tema pierde el color que lo hace reconocible',
     '        <span class="portada-tema-icono ${tintClassForKey(c.id)}">${categoryIconHtml(c, 14)}</span>',
     '        <span class="portada-tema-icono">${categoryIconHtml(c, 14)}</span>'),

    # ── /aprender lee el tema ──
    (APR, '/aprender deja de leer el tema de la URL',
     "  temaDeLaUrl = new URLSearchParams(location.search).get('tema') || null",
     '  temaDeLaUrl = null'),

    (APR, 'un tema que no existe deja la pantalla vacía',
     '    if (cat && porCategoria[cat.id]) filtroCategoria = cat.id',
     "    filtroCategoria = cat ? cat.id : 'no-existe'"),

    # ── El foro ──
    (HOME, 'la cuenta de mensajes desaparece del foro',
     '''          <span class="foro-vivo-cuenta">
            <b>${mensajes}</b>''',
     '''          <span class="foro-vivo-cuenta hidden">
            <b>${mensajes}</b>'''),

    (HOME, 'la cuenta de mensajes miente: siempre uno',
     '            <b>${mensajes}</b>', '            <b>1</b>'),

    (HOME, 'la cuenta dice «1 mensajes»',
     "            <small>${mensajes === 1 ? 'mensaje' : 'mensajes'}</small>",
     "            <small>mensajes</small>"),

    # ── Las guías nuevas ──
    (HOME, 'las guías nuevas pierden su portada',
     '      <span class="recent-arte arte-${arteDe(g)}">',
     '      <span class="recent-arte-que-no-es">'),

    (HOME, 'el color de la portada cambia en cada pintada',
     '      <span class="recent-arte arte-${arteDe(g)}">',
     '      <span class="recent-arte arte-${1 + Math.floor(Math.random() * 6)}">'),

    (HOME, 'la rareza desaparece de la tarjeta',
     '''        <span class="rarity-chip rarity-${g.guide_rarity || 'bronze'}">${RAREZAS[g.guide_rarity] || RAREZAS.bronze}</span>''',
     '        <span></span>'),

    (HOME, 'la rareza vuelve a decirse en inglés',
     "${RAREZAS[g.guide_rarity] || RAREZAS.bronze}</span>", "${g.guide_rarity || 'bronze'}</span>"),

    (HOME, 'vuelven a salir tres guías y una se queda suelta en la segunda fila',
     '      .limit(4)', '      .limit(3)'),

    (APP, 'el degradado deja de salir del slug',
     '  const clave = String(algo?.slug || algo?.id || algo || \'\')',
     '  const clave = String(Math.random())'),

    (COMP, 'el degradado compartido desaparece de la hoja que bajan las dos pantallas',
     '.arte-1 { background: linear-gradient(135deg, #0d9e6e, #7cc6d8 130%); }',
     '.arte-1-que-no-es { background: linear-gradient(135deg, #0d9e6e, #7cc6d8 130%); }'),

    # ── Los primeros pasos ──
    (PP, 'los primeros pasos pierden la barra de progreso',
     '    <span class="primeros-pasos-barra" aria-hidden="true"><i style="width:${Math.round((estado.hechos / PASOS.length) * 100)}%"></i></span>\n',
     ''),

    (PP, 'la barra de progreso no dice por dónde vas',
     'style="width:${Math.round((estado.hechos / PASOS.length) * 100)}%"', 'style="background:red"'),

    # ── Lo que ya funcionaba ──
    (HOME, 'la sección recogida deja de avisar al CSS y la fila queda a medias',
     "  s.classList.add('seccion-recogida')", '  // sin marcar'),
]

correr(MUTACIONES, 'test-tanda-300.mjs')
