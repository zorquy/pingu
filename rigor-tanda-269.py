"""Rigor de la tanda 269 (Noticias). En segundo plano SIEMPRE."""
import subprocess, sys, os

SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
REPO = '/home/user/pingu'

# (fichero, nombre, original, mutado)
MUTACIONES = [
    ('js/noticias.js', 'la portada de noticias no filtra por tipo',
     "    .eq('kind', 'news')", "    .neq('kind', 'nada')"),

    ('js/noticias.js', 'la más reciente deja de ir la primera',
     "    .order('published_at', { ascending: false })",
     "    .order('published_at', { ascending: true })"),

    ('js/noticias.js', 'la noticia enlaza a la dirección de guía',
     "const enlaceDeNoticia = (slug) => rutaDeArticulo('news', slug)",
     "const enlaceDeNoticia = (slug) => rutaDeArticulo('guide', slug)"),

    ('js/noticias.js', 'el <time> se queda sin fecha de máquina',
     'datetime="${fechaMaquina(n.published_at)}">${escapeHtml(cuandoFue(n.published_at))}</time>\n      <h3>',
     'datetime="">${escapeHtml(cuandoFue(n.published_at))}</time>\n      <h3>'),

    ('js/home.js', 'las noticias vuelven a tapar las guías en la portada',
     "    return filtrar ? q.eq('kind', 'guide') : q\n  }\n  const { data, error } = await conVueltaAtrasDeTipo",
     "    return q\n  }\n  const { data, error } = await conVueltaAtrasDeTipo"),

    ('js/articulos.js', 'el puente de la migración desaparece',
     "  if (!faltaElTipo(resultado.error)) return resultado",
     "  if (true) return resultado"),

    ('js/articulos.js', 'el error de columna que falta deja de reconocerse',
     "  return error.code === '42703' || /\\bkind\\b/.test(`${error.message || ''} ${error.details || ''}`)",
     "  return false"),

    ('js/articulos.js', 'una noticia deja de tener dirección propia',
     "  return kind === 'news' ? `/noticias/${limpio}` : `/guia.html?slug=${limpio}`",
     "  return `/guia.html?slug=${limpio}`"),

    ('js/guia.js', 'la noticia no corrige su dirección ni su canónica',
     "  if (esNoticia) {\n    const buena = rutaDeArticulo('news', guide.slug)",
     "  if (false) {\n    const buena = rutaDeArticulo('news', guide.slug)"),

    ('js/guia.js', 'las migas de la noticia vuelven a la categoría',
     "          ? `<a href=\"/noticias\">Noticias</a>`",
     "          ? `<a href=\"/categoria.html\">Categoría</a>`"),

    ('js/guia.js', 'la noticia se pinta con chapa de rareza',
     "          esNoticia ? '' : `<span class=\"time-tag\">${LEVEL_LABELS[guide.level] || 'Básico'}</span>",
     "          false ? '' : `<span class=\"time-tag\">${LEVEL_LABELS[guide.level] || 'Básico'}</span>"),

    ('js/guia.js', 'la noticia pierde su fecha de publicación',
     "          esNoticia\n            ? `<time class=\"time-tag\"",
     "          false\n            ? `<time class=\"time-tag\""),

    ('js/guia.js', 'una guía se disfraza de noticia',
     "  const esNoticia = guide.kind === 'news'",
     "  const esNoticia = true"),

    ('js/aprender.js', '«Aprender» se llena de noticias',
     "    return filtrar ? q.eq('kind', 'guide') : q",
     "    return q"),

    ('css/noticias.css', 'la rejilla deja de ser de tres columnas',
     "  grid-template-columns: repeat(3, minmax(0, 1fr));",
     "  grid-template-columns: repeat(2, minmax(0, 1fr));"),

    ('css/noticias.css', 'el móvil se queda con la rejilla de escritorio',
     "@media (max-width: 560px) {\n  .noticias-rejilla {\n    grid-template-columns: 1fr;",
     "@media (max-width: 560px) {\n  .noticias-rejilla {\n    grid-template-columns: repeat(3, 1fr);"),

    ('index.html', 'el enlace de Noticias desaparece de la barra',
     '        <a href="/noticias">Noticias</a>\n        <a href="aprender.html">Aprender</a>',
     '        <a href="aprender.html">Aprender</a>'),
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
        r = subprocess.run(['/opt/node22/bin/node', os.path.join(SC, 'test-tanda-269.mjs')],
                           capture_output=True, text=True, cwd=SC)
        open(ruta, 'w').write(base)
        if r.returncode == 0:
            print(f'❌ SIN DETECTAR: {nombre}', flush=True)
            sin_detectar.append(nombre)
        else:
            print(f'✅ detectada ({r.stdout.count("FALLA")} fallos): {nombre}', flush=True)
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
