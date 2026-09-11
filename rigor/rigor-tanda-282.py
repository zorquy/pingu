"""Rigor de la tanda 282 (mandar una noticia a Telegram a mano). En segundo plano SIEMPRE."""
import subprocess, sys, os

SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
REPO = '/home/user/pingu'

MUTACIONES = [
    ('netlify/lib/telegram.mjs', 'vuelve el silencio: nunca falta ninguna llave',
     "  const faltan = []\n  if (!env.TELEGRAM_BOT_TOKEN)", "  const faltan = []\n  if (false)"),

    ('netlify/lib/telegram.mjs', 'el canal deja de contar como obligatorio',
     "  if (!env.TELEGRAM_CANAL_NOTICIAS) faltan.push('TELEGRAM_CANAL_NOTICIAS')", "  if (false) faltan.push('TELEGRAM_CANAL_NOTICIAS')"),

    ('netlify/lib/telegram.mjs', 'el mensaje ya no va al tema del grupo',
     "  const dentroDelTema = tema ? { message_thread_id: Number(tema) } : {}",
     "  const dentroDelTema = {}"),

    ('netlify/lib/telegram.mjs', 'el pie de foto deja de recortarse a 1024',
     "export function mensajeDeNoticia({ title, description, slug }, { limite = 1024 } = {}) {",
     "export function mensajeDeNoticia({ title, description, slug }, { limite = 100000 } = {}) {"),

    ('netlify/functions/telegram-mandar.mjs', 'el botón manda aunque falte la configuración',
     "  if (faltan.length) {\n    return {", "  if (false) {\n    return {"),

    ('netlify/functions/telegram-mandar.mjs', 'una noticia ya mandada se repite sin avisar',
     "  if (noticia.telegram_sent_at && !forzar) {", "  if (false) {"),

    ('netlify/functions/telegram-mandar.mjs', 'insistir deja de servir: nunca se puede repetir',
     "  if (noticia.telegram_sent_at && !forzar) {", "  if (noticia.telegram_sent_at) {"),

    ('netlify/functions/telegram-mandar.mjs', 'un borrador sale por el canal',
     "  if (!noticia.published_at) return { estado: 400,", "  if (false) return { estado: 400,"),

    ('netlify/functions/telegram-mandar.mjs', 'una guía se cuela por el canal de noticias',
     "  if (noticia.kind !== 'news') return", "  if (false) return"),

    ('netlify/functions/telegram-mandar.mjs', 'el error de Telegram se traga y se da por buena',
     "  if (!r.ok) return { estado: 502, cuerpo: { error: `Telegram no lo ha aceptado: ${r.error}` } }",
     "  if (false) return { estado: 502, cuerpo: { error: `Telegram no lo ha aceptado: ${r.error}` } }"),

    ('netlify/functions/telegram-mandar.mjs', 'el error de Telegram se traduce y se pierde la pista',
     "cuerpo: { error: `Telegram no lo ha aceptado: ${r.error}` } }",
     "cuerpo: { error: 'No se ha podido mandar.' } }"),

    ('netlify/functions/telegram-mandar.mjs', 'la noticia mandada no se apunta',
     "      body: JSON.stringify({ telegram_sent_at: cuando }),", "      body: JSON.stringify({}),"),

    ('netlify/functions/telegram-mandar.mjs', 'mandada-pero-no-apuntada deja de avisar',
     "aviso: `Mandada, pero no se ha podido apuntar (${e?.message || e}). Podría repetirse.` } }",
     "aviso: '' } }"),

    ('netlify/functions/telegram-noticias.mjs', 'la automática vuelve a callarse el nombre de la llave',
     "  if (faltan.length) return { ok: true, saltado: `faltan variables de entorno en Netlify: ${faltan.join(', ')}`, faltan }",
     "  if (faltan.length) return { ok: true, saltado: 'no se manda nada' }"),

    ('netlify/functions/telegram-noticias.mjs', 'la automática pierde la red de las 48 horas',
     "        `&published_at=gte.${encodeURIComponent(desde)}` +", "        '' +"),

    ('admin/js/admin.js', 'el botón de Telegram sale también en los borradores',
     '${n.published_at ? `<button class="btn-secondary" data-telegram-noticia',
     '${true ? `<button class="btn-secondary" data-telegram-noticia'),

    ('admin/js/admin.js', 'la tabla dice «Mandada» siempre, salió o no',
     "                : n.telegram_sent_at\n                  ? `<span class=\"badge badge-completed\">Mandada</span>`\n                  : `<span class=\"badge badge-progress\">Sin mandar</span>`",
     "                : `<span class=\"badge badge-completed\">Mandada</span>`"),

    ('admin/js/admin.js', 'el botón deja de mandar el token del admin',
     "headers: { 'content-type': 'application/json', authorization: `Bearer ${session.access_token}` },\n      body: JSON.stringify({ id, forzar }),",
     "headers: { 'content-type': 'application/json' },\n      body: JSON.stringify({ id, forzar }),"),

    ('admin/js/admin.js', 'el icono se cambia por un emoji suelto',
     "${icons.send(15)} Telegram</button>", "✈️ Telegram</button>"),
]


MUTACIONES += [
    ('netlify/lib/telegram.mjs', 'la portada vuelve a mandarse tal cual, sin completar',
     "  return `${SITIO}${v.startsWith('/') ? '' : '/'}${v}`\n}\n\n// Con portada va como FOTO",
     "  return v\n}\n\n// Con portada va como FOTO"),

    ('netlify/lib/telegram.mjs', 'una imagen incrustada se cuela y revienta el envío',
     "  if (/^[a-z][a-z0-9+.-]*:/i.test(v)) return ''", "  if (false) return ''"),

    ('netlify/lib/telegram.mjs', 'el envío usa la portada sin completar',
     "    ? { chat_id: canal, ...dentroDelTema, photo: portada, caption: texto, parse_mode: 'HTML' }",
     "    ? { chat_id: canal, ...dentroDelTema, photo: noticia.cover_image, caption: texto, parse_mode: 'HTML' }"),

    ('netlify/lib/telegram.mjs', 'el reintento vuelve a perder la portada del todo',
     "      body: JSON.stringify({ chat_id: canal, ...dentroDelTema, text: texto, parse_mode: 'HTML', link_preview_options: VISTA_PREVIA }),",
     "      body: JSON.stringify({ chat_id: canal, ...dentroDelTema, text: texto, parse_mode: 'HTML' }),"),

    ('netlify/lib/telegram.mjs', 'la vista previa deja de ser grande',
     "const VISTA_PREVIA = { prefer_large_media: true, show_above_text: true }",
     "const VISTA_PREVIA = { show_above_text: true }"),

    ('netlify/lib/telegram.mjs', 'la portada deja de ir encima del texto',
     "const VISTA_PREVIA = { prefer_large_media: true, show_above_text: true }",
     "const VISTA_PREVIA = { prefer_large_media: true }"),

    ('netlify/lib/telegram.mjs', 'no se cuenta por qué la foto no entró',
     "    if (datos2?.ok) return { ok: true, sinFoto: true, motivo: datos?.description || 'Telegram no ha aceptado la portada' }",
     "    if (datos2?.ok) return { ok: true, sinFoto: true }"),

    ('admin/js/admin.js', 'el panel se calla que la portada no entró',
     "    const sinPortada = r.sinFoto ? `Mandada al canal, pero la portada no ha entrado como foto: ${r.motivo || 'Telegram no la ha aceptado'}. Sale en la vista previa del enlace.` : 'Mandada al canal.'",
     "    const sinPortada = 'Mandada al canal.'"),
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
        r = subprocess.run(['/opt/node22/bin/node', os.path.join(SC, 'test-tanda-282.mjs')],
                           capture_output=True, text=True, cwd=SC)
        r2 = subprocess.run(['/opt/node22/bin/node', os.path.join(SC, 'test-tanda-280.mjs')],
                            capture_output=True, text=True, cwd=SC)
        open(ruta, 'w').write(base)
        if r.returncode == 0 and r2.returncode == 0:
            print(f'❌ SIN DETECTAR: {nombre}', flush=True)
            sin_detectar.append(nombre)
        else:
            print(f'✅ detectada: {nombre}', flush=True)
finally:
    for ruta, contenido in originales.items():
        open(ruta, 'w').write(contenido)

if sin_detectar:
    print(f'\n❌ {len(sin_detectar)} sin detectar:')
    for n in sin_detectar:
        print('  -', n)
    sys.exit(1)
print(f'\n✅ Las {len(MUTACIONES)} mutaciones detectadas')
