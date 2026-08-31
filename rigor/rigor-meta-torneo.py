# Rigor de la vista previa de torneos: se rompe cada pieza a propósito
# y se exige que la prueba lo pille. Una rotura que NADIE detecta es una
# prueba que no está probando lo que dice.
import subprocess, sys
F = '/home/user/pingu/netlify/edge-functions/meta-social.js'
T = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad/test-meta-torneo.mjs'
NODE = '/opt/node22/bin/node'

ROTURAS = [
    ("no filtra borradores", "&status=neq.draft", "&status=neq.cancelled"),
    ("el estado desaparece del título", "${estado ? ` — ${estado}` : ''}", ""),
    ("la canónica pierde el slug", "/torneo?slug=${encodeURIComponent(torneo.slug)}", "/torneo"),
    ("no cuenta las plazas ocupadas", "`${ocupadas}/${torneo.max_players} plazas`", "`${torneo.max_players} plazas`"),
    ("la liga se anuncia como suizas", "? `liga de ${t.swiss_rounds} jornadas BO${t.swiss_bo ?? 1}`", "? `${t.swiss_rounds} rondas suizas BO${t.swiss_bo ?? 1}`"),
    ("el corte se anuncia siempre", "t.top_cut_size ? ` + top", "true ? ` + top"),
    ("la descripción se pinta con etiquetas", "recortar(textoDeHtml(torneo.description))", "recortar(torneo.description)"),
    ("no van datos estructurados", "'@type': 'Event',", "'@type': 'NoEvent',"),
    ("las plazas no van en los datos", "maximumAttendeeCapacity: torneo.max_players || undefined,", ""),
    ("la fecha de comienzo se pierde", "startDate: torneo.start_at || undefined,", ""),
    ("/torneos entra como si fuera una ficha", r"/^\/torneo(\.html)?$/.test(ruta)", "ruta.startsWith('/torneo')"),
    ("se pide el usuario de TCG Live de los inscritos", "&status=eq.active&select=id", "&status=eq.active&select=id,tcg_live_username"),
    ("el espacio antes del punto vuelve", r".replace(/ +([,.;:!?%)\]}»…])/g, '$1')", ""),
]

original = open(F, encoding='utf-8').read()
fallos = []
try:
    for nombre, viejo, nuevo in ROTURAS:
        if viejo not in original:
            fallos.append(f'{nombre}: NO SE ENCUENTRA el trozo a romper')
            print(f'!! {nombre}: no se encuentra el trozo')
            continue
        open(F, 'w', encoding='utf-8').write(original.replace(viejo, nuevo, 1))
        r = subprocess.run([NODE, T], capture_output=True, text=True)
        if r.returncode == 0:
            fallos.append(nombre)
            print(f'NO DETECTADA  {nombre}')
        else:
            print(f'detectada     {nombre}')
finally:
    open(F, 'w', encoding='utf-8').write(original)

print()
print(f'{len(ROTURAS) - len(fallos)}/{len(ROTURAS)} detectadas')
sys.exit(1 if fallos else 0)
