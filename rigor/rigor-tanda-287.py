"""Rigor de las tandas 287 (torneos a Telegram) y 288 (banner de la portada). En segundo plano SIEMPRE."""
import subprocess, sys, os

SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
REPO = '/home/user/pingu'

# (fichero, nombre, original, mutado, prueba)
MUTACIONES = [
    ('netlify/functions/telegram-torneos.mjs', 'se anuncian también los borradores',
     "      `tournaments?status=eq.registration_open&telegram_sent_at=is.null`", "      `tournaments?telegram_sent_at=is.null`", 'test-tanda-287.mjs'),

    ('netlify/functions/telegram-torneos.mjs', 'se repite un torneo ya anunciado',
     "&telegram_sent_at=is.null`", "`", 'test-tanda-287.mjs'),

    ('netlify/functions/telegram-torneos.mjs', 'se anuncia un torneo que ya ha empezado',
     "        `&start_at=gte.${encodeURIComponent(ahora.toISOString())}` +", "        '' +", 'test-tanda-287.mjs'),

    ('netlify/functions/telegram-torneos.mjs', 'el banner del torneo no se manda',
     "      { texto: mensajeDeTorneo(torneo, { ahora }), portada: torneo.banner_url },",
     "      { texto: mensajeDeTorneo(torneo, { ahora }) },", 'test-tanda-287.mjs'),

    ('netlify/functions/telegram-torneos.mjs', 'el torneo cae en el tema de noticias',
     "  const tema = env.TELEGRAM_TEMA_TORNEOS || null", "  const tema = env.TELEGRAM_TEMA_NOTICIAS || null", 'test-tanda-287.mjs'),

    ('netlify/functions/telegram-torneos.mjs', 'un envío fallido se da por bueno',
     "    if (!r.ok) {\n      // No se marca: se reintenta en la siguiente pasada.\n      fallos.push({ slug: torneo.slug, error: r.error })\n      continue\n    }",
     "    if (false) {\n      fallos.push({ slug: torneo.slug, error: r.error })\n      continue\n    }", 'test-tanda-287.mjs'),

    ('netlify/functions/telegram-torneos.mjs', 'se sueltan todos de golpe',
     "&order=start_at.asc&limit=${POR_PASADA}`", "&order=start_at.asc`", 'test-tanda-287.mjs'),

    ('netlify/lib/telegram.mjs', 'el anuncio se queda sin la fecha del torneo',
     "  const ficha = escaparTelegram([cuando, comoSeJuega(torneo), plazas].filter(Boolean).join(' · '))",
     "  const ficha = escaparTelegram([comoSeJuega(torneo), plazas].filter(Boolean).join(' · '))", 'test-tanda-287.mjs'),

    ('netlify/lib/telegram.mjs', 'ni las plazas',
     "  const plazas = torneo.max_players == null ? 'plazas sin límite' : `${torneo.max_players} plazas`",
     "  const plazas = ''", 'test-tanda-287.mjs'),

    ('netlify/lib/telegram.mjs', 'un torneo sin aforo dice «0 plazas»',
     "torneo.max_players == null ? 'plazas sin límite' :", "false ?  'plazas sin límite' :", 'test-tanda-287.mjs'),

    ('netlify/lib/telegram.mjs', 'el top cut desaparece del anuncio',
     "  return top ? `${base} + top ${top}` : base", "  return base", 'test-tanda-287.mjs'),

    ('netlify/lib/telegram.mjs', 'una liga se anuncia como si fueran suizas',
     "  const base = format === 'league' ?", "  const base = false ?", 'test-tanda-287.mjs'),

    ('netlify/lib/telegram.mjs', 'la descripción va con etiquetas HTML crudas',
     "  const resumen = recortarA(escaparTelegram(soloTexto(torneo.description)), sitio)",
     "  const resumen = recortarA(escaparTelegram(String(torneo.description || '')), sitio)", 'test-tanda-287.mjs'),

    ('netlify/lib/telegram.mjs', 'el anuncio de torneo deja de recortarse a 1024',
     "export function mensajeDeTorneo(torneo, { limite = 1024, ahora = new Date() } = {}) {",
     "export function mensajeDeTorneo(torneo, { limite = 100000, ahora = new Date() } = {}) {", 'test-tanda-287.mjs'),

    ('netlify/lib/telegram.mjs', 'el canal de torneos deja de caer en el de noticias',
     "  return env[nombre] || env.TELEGRAM_CANAL_NOTICIAS || ''", "  return env[nombre] || ''", 'test-tanda-287.mjs'),

    ('js/home.js', 'el banner se queda sin imagen',
     "    hueco.innerHTML = noticia.cover_image", "    hueco.innerHTML = false", 'test-tanda-288.mjs'),

    ('js/home.js', 'se pinta un banner con la caja de imagen vacía',
     "    hueco.innerHTML = noticia.cover_image", "    hueco.innerHTML = true", 'test-tanda-288.mjs'),

    ('js/home.js', 'la portada de la noticia deja de pedirse',
     "      .select('slug, title, published_at, cover_image')", "      .select('slug, title, published_at')", 'test-tanda-288.mjs'),

    ('js/home.js', 'la imagen se carga en la primera pantalla',
     'loading="lazy" decoding="async"', 'decoding="async"', 'test-tanda-288.mjs'),

    ('js/home.js', '«Ver todas» lleva al artículo en vez de a la sección',
     '<a class="noticia-banner-todas" href="/noticias">', '<a class="noticia-banner-todas" href="${enlace}">', 'test-tanda-288.mjs'),

    ('js/home.js', 'se pierde el enlace a todas las noticias',
     '      <a class="noticia-banner-todas" href="/noticias">Ver todas las noticias →</a>`', '`', 'test-tanda-288.mjs'),

    ('js/home.js', 'el banner deja de llevar al artículo',
     '      <a class="noticia-banner" href="${enlace}">', '      <a class="noticia-banner" href="/noticias">', 'test-tanda-288.mjs'),

    ('js/home.js', 'sin noticias se queda el esqueleto puesto para siempre',
     "    if (!noticia) return recogerSeccion('noticiaPortadaSeccion')\n\n    // Con portada", "    if (!noticia) return\n\n    // Con portada", 'test-tanda-288.mjs'),

    ('js/home.js', 'se pinta la más vieja en vez de la última',
     "      .order('published_at', { ascending: false })\n      .limit(1)\n    const noticia = !error && data?.[0]",
     "      .order('published_at', { ascending: true })\n      .limit(1)\n    const noticia = !error && data?.[0]", 'test-tanda-288.mjs'),

    ('css/components.css', 'la imagen no reserva su hueco y la portada pega un salto',
     "  aspect-ratio: 16 / 7;\n  object-fit: cover;", "  object-fit: cover;", 'test-tanda-288.mjs'),
]

originales = {}
sin_detectar = []
try:
    for fichero, nombre, viejo, nuevo, prueba in MUTACIONES:
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
        r = subprocess.run(['/opt/node22/bin/node', os.path.join(SC, prueba)], capture_output=True, text=True, cwd=SC)
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
