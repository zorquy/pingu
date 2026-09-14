"""Rigor de la tanda 297-A (la lista en tarjetas). En segundo plano SIEMPRE."""
import subprocess, sys, os

SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
REPO = '/home/user/pingu'
JS = 'js/torneos/torneos.js'
CSS = 'css/torneos.css'

MUTACIONES = [
    # ── La acción, que es lo único que promete la tarjeta ──
    (JS, 'a quien ya está dentro se le ofrece apuntarse otra vez',
     "    return miEstado === 'active'\n      ? { texto: 'Ver el torneo', clase: 'btn-secondary' }\n      : { texto: 'Apuntarme', clase: 'torneo-btn-apuntarse' }",
     "    return { texto: 'Apuntarme', clase: 'torneo-btn-apuntarse' }"),

    (JS, 'un torneo en juego invita a apuntarse',
     "  if (t.status === 'in_progress') {\n    return { texto: 'Ver el directo', clase: miEstado === 'active' ? 'btn-primary' : 'btn-secondary' }\n  }",
     "  if (t.status === 'in_progress') {\n    return { texto: 'Apuntarme', clase: 'torneo-btn-apuntarse' }\n  }"),

    (JS, 'el botón de apuntarse pierde el verde',
     "      : { texto: 'Apuntarme', clase: 'torneo-btn-apuntarse' }",
     "      : { texto: 'Apuntarme', clase: 'btn-secondary' }"),

    (JS, 'el botón lleva a un torneo que no es el de la tarjeta',
     """      <a class="${accion.clase} torneo-pie-accion" href="${url}">${accion.texto}</a>""",
     """      <a class="${accion.clase} torneo-pie-accion" href="/torneos">${accion.texto}</a>"""),

    # ── Quién va apuntado ──
    ('', 'se piden los perfiles de TODOS los inscritos', None, None),

    (JS, 'las caras no se cortan y se piden todos los perfiles',
     "      if (ya.length < CARAS_POR_TARJETA) ya.push(i.user_id)",
     "      ya.push(i.user_id)"),

    (JS, 'el «+N» miente sobre cuánta gente falta',
     "  const sobran = Math.max(0, ocupadas - caras.length)",
     "  const sobran = 0"),

    (JS, 'la barra nunca avisa de que el torneo se llena',
     "  const apurado = !sinLimite && porcentaje >= 80",
     "  const apurado = false"),

    # ── El arte, que tiene que ser ESTABLE ──
    (JS, 'la portada cambia de color en cada recarga',
     "  const clave = String(t.slug || t.id || '')\n  let suma = 0\n  for (let i = 0; i < clave.length; i++) suma = (suma * 31 + clave.charCodeAt(i)) % 100000\n  return (suma % ARTES) + 1",
     "  return Math.floor(Math.random() * ARTES) + 1"),

    # ── La barra del torneo en juego ──
    (JS, 'la barra sale aunque no estés jugando nada',
     "      .filter((t) => t.status === 'in_progress' && miEstado[t.id] === 'active')",
     "      .filter((t) => t.status === 'in_progress')"),

    (JS, 'la barra no dice por qué ronda va',
     "${ronda ? `Ronda ${ronda.round_number}${total ? ` de ${total}` : ''}` : 'Entre rondas'}",
     "Torneo en marcha"),

    (JS, 'el reloj de la barra se queda parado',
     "  tic()\n  relojVivo = setInterval(tic, 1000)",
     "  relojVivo = null"),

    (JS, 'la barra te manda a la lista en vez de a tu torneo',
     """<a class="btn-primary" href="/torneo?slug=${encodeURIComponent(torneo.slug)}">Ir a tu mesa</a>""",
     """<a class="btn-primary" href="/torneos">Ir a tu mesa</a>"""),

    # ── El campeón ──
    (JS, 'un torneo terminado no dice quién ganó',
     "      campeon: t.status === 'finished' ? gente[t.champion_id]?.username || null : null,",
     "      campeon: null,"),

    # ── El HTML que la tanda arregla ──
    (JS, 'los botones vuelven a meterse dentro del enlace de la tarjeta',
     """    </a>
    <div class="torneo-pie">""",
     """    <div class="torneo-pie">"""),

    # ── La rejilla ──
    (CSS, 'la lista deja de ser una rejilla',
     ".torneos-lista {\n  display: grid;\n  grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));",
     ".torneos-lista {\n  display: block;\n  grid-template-columns: repeat(auto-fill, minmax(330px, 1fr));"),

    (CSS, 'las pestañas se colocan como una tarjeta más',
     ".torneos-lista > .torneo-pestanas,\n.torneos-lista > .torneo-ver-mas { grid-column: 1 / -1; }",
     ".torneos-lista > .torneo-ver-mas { grid-column: 1 / -1; }"),

    (CSS, 'en un móvil estrecho siguen cabiendo dos columnas',
     "  .torneos-lista { grid-template-columns: 1fr; gap: 14px; }",
     "  .torneos-lista { gap: 14px; }"),

    (CSS, 'las chips de la lista se comen las pestañas de la ficha',
     ".torneo-pestanas-chips {\n  border-bottom: none;",
     ".torneo-pestanas {\n  border-bottom: none;"),
]

originales = {}
sin_detectar = []
try:
    for fichero, nombre, viejo, nuevo in MUTACIONES:
        if not fichero:
            continue
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
        r = subprocess.run(['/opt/node22/bin/node', os.path.join(SC, 'test-tanda-297.mjs')], capture_output=True, text=True, cwd=SC)
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
print(f'\n✅ Las {len([m for m in MUTACIONES if m[0]])} mutaciones detectadas')
