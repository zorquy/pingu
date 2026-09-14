"""Rigor de la tanda 299 (foro, /aprender y portada). En segundo plano SIEMPRE."""
import subprocess, sys, os

SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
REPO = '/home/user/pingu'
FORO = 'js/foro.js'
APR = 'js/aprender.js'
HOME = 'js/home.js'
PORT = 'css/portada.css'
CSSF = 'css/foro.css'
COMP = 'css/components.css'
INDEX = 'index.html'
FOROHTML = 'foro.html'

MUTACIONES = [
    # ── D · el foro ──
    (FORO, 'la franja de lo caliente desaparece',
     "  if (destacado) destacado.innerHTML = calientes",
     "  if (destacado) destacado.innerHTML = ''"),

    (FORO, 'la franja repite el mismo tema una vez por mensaje',
     "  const elegidos = mensajes.filter((m) => !vistos.has(m.thread_id) && vistos.add(m.thread_id)).slice(0, CALIENTES)",
     "  const elegidos = mensajes.slice(0, CALIENTES)"),

    (FORO, 'la franja se llena de temas y deja de ser una franja',
     "const CALIENTES = 3", "const CALIENTES = 9"),

    (FORO, 'la tarjeta vuelve a ser un <a> dentro de otro <a>',
     '      <div class="foro-caliente">', '      <a class="foro-caliente" href="/foro">'),

    (FORO, 'el título de la franja deja de llevar a su tema',
     '          <a class="foro-caliente-titulo" href="${urlTema(m.thread_id)}">${escapeHtml(t.title)}</a>',
     '          <span class="foro-caliente-titulo">${escapeHtml(t.title)}</span>'),

    (FOROHTML, 'el hueco de la franja se va de foro.html',
     '<div id="foroDestacado"></div>', '<div id="foroDestacadoQueNoEs"></div>'),

    # ── D · el CSS del foro, fuera de la hoja de todos ──
    (COMP, 'las reglas del foro vuelven a components.css',
     '/* ── El CSS del foro se mudó a css/foro.css (tanda 299) ──',
     '.foro-fila { display: grid; }\n/* ── El CSS del foro se mudó a css/foro.css (tanda 299) ──'),

    (COMP, 'el @media de móvil del foro se queda en components.css, delante de su base',
     '/* El bloque de móvil del foro (@media max-width 900px) se fue a',
     '@media (max-width: 900px) {\n  .foro-columnas { grid-template-columns: minmax(0, 1fr); }\n}\n/* El bloque de móvil del foro (@media max-width 900px) se fue a'),

    (PORT, 'la portada se queda sin las reglas de «Ahora en el foro»',
     '/* ── Lo último del foro, en la portada ── */\n.foro-vivo {',
     '/* ── Lo último del foro, en la portada ── */\n.foro-vivo-que-no-es {'),

    # ── E · /aprender ──
    (APR, 'las guías vuelven a esconderse detrás de un segundo clic',
     '          ? `<div class="guia-rejilla">${visibles.map((g) => tarjetaDeGuia(g, progreso)).join(\'\')}</div>`',
     "          ? '<div class=\"guia-rejilla\"></div>'"),

    (APR, 'la tarjeta de guía deja de llevar a la guía',
     '    <a class="guia-tarjeta-enlace" href="/guia.html?slug=${encodeURIComponent(g.slug)}">',
     '    <a class="guia-tarjeta-enlace" href="#">'),

    (APR, 'el filtro de categoría no filtra',
     "      if (filtroCategoria !== 'todas' && g.category_id !== filtroCategoria) return false",
     '      if (false) return false'),

    (APR, 'el filtro de nivel deja de ser un interruptor: no se puede quitar',
     '        filtroNivel = filtroNivel === b.dataset.nivel ? null : b.dataset.nivel',
     '        filtroNivel = b.dataset.nivel'),

    (APR, '«sin leer» enseña también las leídas',
     "      if (soloSinLeer && (progreso[g.id]?.read_at || progreso[g.id]?.status === 'completed')) return false",
     '      if (false) return false'),

    (APR, 'el filtro vuelve a la base en cada clic',
     '    list.querySelectorAll(\'[data-cat]\').forEach((b) =>\n      b.addEventListener(\'click\', () => {\n        filtroCategoria = b.dataset.cat\n        pintar()',
     '    list.querySelectorAll(\'[data-cat]\').forEach((b) =>\n      b.addEventListener(\'click\', () => {\n        filtroCategoria = b.dataset.cat\n        supabase.from(\'guides\').select(\'id\').limit(1)\n        pintar()'),

    (APR, '«sigue donde lo dejaste» desaparece',
     '      ${seguirHtml(guias, progreso)}', '      ${\'\'}'),

    (APR, '«sigue donde lo dejaste» te manda al curso que YA terminaste',
     "    .filter(({ g, p }) => p && p.status !== 'completed' && (p.current_block || 0) > 0 && guideHasCourse(g))",
     '    .filter(({ g, p }) => p && (p.current_block || 0) > 0 && guideHasCourse(g))'),

    (APR, 'el aro de progreso miente: siempre lleno',
     '  const pct = bloques ? Math.round((Math.min(p.current_block, bloques) / bloques) * 100) : 0',
     '  const pct = 100'),

    # ── F · la portada ──
    (INDEX, 'la fila de «hoy» se va de la portada',
     '<div class="container portada-hoy" id="portadaHoy">',
     '<div class="container portada-hoy" id="portadaHoyQueNoEs">'),

    (HOME, 'el reto vuelve a ser una fila fina más',
     '''  <div class="reto-hoy${hecho ? ' reto-hoy-hecha' : ''}">''',
     '''  <div class="reto-tarjeta${hecho ? ' reto-tarjeta-hecha' : ''}">'''),

    (HOME, 'los cinco puntos del reto desaparecen',
     '  for (let i = 0; i < total; i++) html += `<span class="reto-punto${i < aciertos ? \' acertado\' : \'\'}"></span>`',
     '  for (let i = 0; i < 0; i++) html += `<span class="reto-punto"></span>`'),

    (HOME, 'los puntos no cuentan lo que acertaste: todos encendidos',
     "html += `<span class=\"reto-punto${i < aciertos ? ' acertado' : ''}\"></span>`",
     'html += `<span class="reto-punto acertado"></span>`'),

    (HOME, 'el reto jugado vuelve a invitarte a jugar el de hoy',
     "        boton: '<a class=\"reto-hoy-boton reto-hoy-boton-flojo\" href=\"/usuarios.html\">Ver la liga de la semana →</a>',",
     "        boton: '<a class=\"reto-hoy-boton\" href=\"/curso.html?reto=hoy\">Jugar el reto →</a>',"),

    (HOME, 'el reto jugado no se apaga: parece que te queda por jugar',
     '        hecho: true,', '        hecho: false,'),

    (HOME, 'al visitante se le esconde el reto otra vez',
     "      boton: '<a class=\"btn-primary reto-hoy-boton\" href=\"auth.html\">Crear cuenta y jugar →</a>',",
     "      boton: '',"),

    (HOME, 'la tarjeta de categoría recupera el marco de color del hash',
     '    <a href="categoria.html?slug=${encodeURIComponent(cat.slug)}" class="category-card">',
     '    <a href="categoria.html?slug=${encodeURIComponent(cat.slug)}" class="category-card border-tint-2">'),

    (HOME, 'la guía reciente recupera el marco de rareza',
     '    <div class="recent-card galon-${escapeHtml(g.guide_rarity || \'bronze\')}"',
     '    <div class="recent-card border-rarity-${escapeHtml(g.guide_rarity || \'bronze\')}"'),

    (PORT, 'el galón de rareza se queda sin color: la rareza deja de verse',
     '.galon-bronze { --galon: var(--rarity-bronze); }',
     '.galon-bronze { }'),

    (PORT, 'el héroe se queda a media columna y deja un claro al lado',
     '.portada-hoy #retoSeccion > *,\n.portada-hoy #retoTarjetas > * {\n  flex: 1;',
     '.portada-hoy #retoSeccion > *,\n.portada-hoy #retoTarjetas > * {\n  flex: 0 1 auto;'),

    (INDEX, 'la hoja propia de la portada deja de enlazarse',
     '  <link rel="stylesheet" href="css/portada.css" />',
     '  <!-- sin la hoja de la portada -->'),
]

originales = {}
sin_detectar = []
try:
    for fichero, nombre, viejo, nuevo in MUTACIONES:
        ruta = os.path.join(REPO, fichero)
        if ruta not in originales:
            originales[ruta] = open(ruta).read()
        base = originales[ruta]
        if base.count(viejo) != 1:
            print(f'⚠️  ANCLA MALA ({base.count(viejo)} veces) en {fichero}: {nombre}', flush=True)
            sin_detectar.append(f'{nombre} (ancla mala)')
            continue
        open(ruta, 'w').write(base.replace(viejo, nuevo))
        subprocess.run([os.path.join(SC, 'sync-forum.sh')], capture_output=True)
        r = subprocess.run(['/opt/node22/bin/node', os.path.join(SC, 'test-tanda-299.mjs')], capture_output=True, text=True, cwd=SC)
        open(ruta, 'w').write(base)
        if r.returncode == 0:
            print(f'❌ SIN DETECTAR: {nombre}', flush=True)
            sin_detectar.append(nombre)
        else:
            print(f'✅ detectada: {nombre}', flush=True)
finally:
    for ruta, contenido in originales.items():
        open(ruta, 'w').write(contenido)
    subprocess.run([os.path.join(SC, 'sync-forum.sh')], capture_output=True)

if sin_detectar:
    print(f'\n❌ {len(sin_detectar)} sin detectar:')
    for n in sin_detectar:
        print('  -', n)
    sys.exit(1)
print(f'\n✅ Las {len(MUTACIONES)} mutaciones detectadas')
