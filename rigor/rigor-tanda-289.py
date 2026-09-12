"""Rigor de la tanda 289 (una noticia no es una guía, y no la firma nadie). En segundo plano SIEMPRE."""
import subprocess, sys, os

SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
REPO = '/home/user/pingu'

MUTACIONES = [
    ('js/activity.js', 'una noticia vuelve a anunciarse como guía (el fallo original)',
     "eventos.push({ tipo: g.kind === 'news' ? 'noticia' : 'guia',", "eventos.push({ tipo: 'guia',"),

    ('js/activity.js', 'una guía se anuncia como noticia',
     "eventos.push({ tipo: g.kind === 'news' ? 'noticia' : 'guia',", "eventos.push({ tipo: 'noticia',"),

    ('js/activity.js', 'la noticia vuelve a llevar firma y avatar de alguien',
     "  noticia: { icono: 'newspaper', verbo: 'Nueva noticia:', deLaCasa: true },",
     "  noticia: { icono: 'newspaper', verbo: 'ha publicado la noticia' },"),

    ('js/activity.js', 'el enlace de la noticia vuelve a ser el de guía',
     "    ? ` <a href=\"${rutaDeArticulo(e.guia.kind, e.guia.slug)}\">${escapeHtml(e.guia.title)}</a>`",
     "    ? ` <a href=\"/guia.html?slug=${encodeURIComponent(e.guia.slug)}\">${escapeHtml(e.guia.title)}</a>`"),

    ('js/activity.js', 'la consulta por id deja de traer el tipo',
     "          () => supabase.from('guides').select('id, title, slug, kind').in('id', guideIds),",
     "          () => supabase.from('guides').select('id, title, slug').in('id', guideIds),"),

    ('js/activity.js', 'la noticia sale dos veces: ella y su hilo del foro',
     "    if (hilosDeNoticia.has(String(t.id))) continue", "    if (false) continue"),

    ('js/activity.js', 'se recogen los hilos de las guías y no los de las noticias',
     "    (guiasNuevas.data || []).filter((g) => g.kind === 'news' && g.forum_thread_id).map((g) => String(g.forum_thread_id))",
     "    (guiasNuevas.data || []).filter((g) => g.kind !== 'news' && g.forum_thread_id).map((g) => String(g.forum_thread_id))"),

    ('js/activity.js', 'la consulta deja de pedir el hilo de la noticia',
     "      () => publicadas('id, title, slug, author_id, published_at, kind, forum_thread_id'),",
     "      () => publicadas('id, title, slug, author_id, published_at, kind'),"),

    ('js/guia.js', 'la noticia vuelve a firmarse con el nombre de quien la publicó',
     "  if (guide.author_id && !esNoticia) {", "  if (guide.author_id) {"),

    ('js/guia.js', 'la noticia se presenta como «guía oficial»',
     "author ? (guide.review_status === 'pending' ? 'Escrita por' : 'Publicada por') : esNoticia ? 'Noticia de' : 'Guía oficial de'",
     "author ? (guide.review_status === 'pending' ? 'Escrita por' : 'Publicada por') : 'Guía oficial de'"),
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
        r = subprocess.run(['/opt/node22/bin/node', os.path.join(SC, 'test-tanda-289.mjs')], capture_output=True, text=True, cwd=SC)
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
