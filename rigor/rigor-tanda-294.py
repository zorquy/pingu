"""Rigor de la tanda 294 (la puerta de atrás de los chats). En segundo plano SIEMPRE."""
import subprocess, sys, os

SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
REPO = '/home/user/pingu'

CHECK_MESA = """  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from tournament_matches m
      where m.id = match_id
        and (m.player_a_id = auth.uid() or m.player_b_id = auth.uid()
             or torneos_soy_admin()
             or torneos_soy_juez((select r.tournament_id from rounds r where r.id = m.round_id)))
    )
  );"""

CHECK_JUEZ = """  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from judge_calls c
      where c.id = judge_call_id
        and (c.created_by = auth.uid() or torneos_soy_admin() or torneos_soy_juez(c.tournament_id))
    )
  );"""

MUTACIONES = [
    ('supabase-migration-torneos-chats.sql', 'vuelve el agujero del chat de la mesa',
     CHECK_MESA, "  with check (sender_id = auth.uid());"),

    ('supabase-migration-torneos-chats.sql', 'vuelve el agujero del chat del juez',
     CHECK_JUEZ, "  with check (sender_id = auth.uid());"),

    ('supabase-migration-torneos-chats.sql', 'se puede escribir en nombre de otro (mesa)',
     "  with check (\n    sender_id = auth.uid()\n    and exists (\n      select 1 from tournament_matches m",
     "  with check (\n    true\n    and exists (\n      select 1 from tournament_matches m"),

    ('js/torneos/jueces.js', 'el chat deja de firmar y la RLS lo cierra a todos',
     ".insert({ [columna]: id, sender_id: yo(), message: texto })",
     ".insert({ [columna]: id, message: texto })"),
]

# Y el propio barrido: si deja de mirar, no guarda nada.
MUTACIONES_HERRAMIENTA = [
    ('barrido-politicas.py', 'el barrido deja de comparar using con with check',
     "    if 'exists' in using.lower() and 'exists' not in check.lower():",
     "    if False:"),
    ('barrido-politicas.py', 'el barrido se queda con la primera definición y no con la última',
     "        final[(tabla, nombre)] = (f.split('/')[-1], using, check)",
     "        final.setdefault((tabla, nombre), (f.split('/')[-1], using, check))"),
]

originales = {}
sin_detectar = []

def probar(ruta, base, nuevo, nombre):
    open(ruta, 'w').write(nuevo)
    r = subprocess.run(['/opt/node22/bin/node', os.path.join(SC, 'test-tanda-294.mjs')],
                       capture_output=True, text=True, cwd=SC)
    open(ruta, 'w').write(base)
    if r.returncode == 0:
        print(f'❌ SIN DETECTAR: {nombre}', flush=True)
        sin_detectar.append(nombre)
    else:
        print(f'✅ detectada: {nombre}', flush=True)

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
        probar(ruta, base, base.replace(viejo, nuevo), nombre)

    for fichero, nombre, viejo, nuevo in MUTACIONES_HERRAMIENTA:
        ruta = os.path.join(SC, fichero)
        if ruta not in originales:
            originales[ruta] = open(ruta).read()
        base = originales[ruta]
        if base.count(viejo) != 1:
            print(f'⚠️  ANCLA MALA ({base.count(viejo)} veces) en {fichero}: {nombre}', flush=True)
            sin_detectar.append(f'{nombre} (ancla mala)')
            continue
        probar(ruta, base, base.replace(viejo, nuevo), nombre)
finally:
    for ruta, contenido in originales.items():
        open(ruta, 'w').write(contenido)

if sin_detectar:
    print(f'\n❌ {len(sin_detectar)} sin detectar:')
    for n in sin_detectar:
        print('  -', n)
    sys.exit(1)
print(f'\n✅ Las {len(MUTACIONES) + len(MUTACIONES_HERRAMIENTA)} mutaciones detectadas')
