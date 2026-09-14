"""Rigor de la tanda 296 (quien crea un torneo, lo lleva). En segundo plano SIEMPRE."""
import subprocess, sys, os

SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
REPO = '/home/user/pingu'
MIG = 'supabase-migration-torneos-dueno.sql'

MUTACIONES = [
    # ── El criterio, en el cliente ──
    ('js/torneos/comun.js', 'el creador se queda fuera otra vez',
     "  if (puedeOrganizar(perfil)) return true\n  return Boolean(userId && torneo?.admin_id && torneo.admin_id === userId)",
     "  return puedeOrganizar(perfil)"),

    ('js/torneos/comun.js', 'cualquiera lleva cualquier torneo',
     "  if (puedeOrganizar(perfil)) return true\n  return Boolean(userId && torneo?.admin_id && torneo.admin_id === userId)",
     "  return true"),

    ('js/torneos/comun.js', 'sin sesión, un torneo sin dueño es de todos',
     "  return Boolean(userId && torneo?.admin_id && torneo.admin_id === userId)",
     "  return torneo?.admin_id === userId"),

    # ── El criterio, en la base ──
    (MIG, 'torneos_mando se olvida del admin y del organizador',
     "  select public.torneos_soy_admin()\n      or exists (",
     "  select exists ("),

    (MIG, 'torneos_mando mira con los ojos de quien pregunta',
     "returns boolean\nlanguage sql\nstable\nsecurity definer\nset search_path = public, pg_catalog\nas $$\n  select public.torneos_soy_admin()",
     "returns boolean\nlanguage sql\nstable\nset search_path = public, pg_catalog\nas $$\n  select public.torneos_soy_admin()"),

    (MIG, 'la baja de un inscrito vuelve a ser solo del admin',
     "create policy inscripciones_baja on public.tournament_registrations for update\n  using (user_id = auth.uid() or torneos_mando(tournament_id))",
     "create policy inscripciones_baja on public.tournament_registrations for update\n  using (user_id = auth.uid() or torneos_soy_admin())"),

    (MIG, 'nombrar jueces vuelve a ser solo del admin',
     "create policy jueces_decidir on public.judge_applications for update\n  using (torneos_mando(tournament_id))",
     "create policy jueces_decidir on public.judge_applications for update\n  using (torneos_soy_admin())"),

    (MIG, 'los pareos vuelven a ser solo del admin',
     "create policy torneos_escribir on public.rounds for all\n  using (torneos_mando(tournament_id))",
     "create policy torneos_escribir on public.rounds for all\n  using (torneos_soy_admin())"),

    (MIG, 'la disputa se queda sin los reportes',
     "             or torneos_mando((select r.tournament_id from rounds r where r.id = m.round_id))\n             or torneos_soy_juez((select r.tournament_id from rounds r where r.id = m.round_id)))\n    )\n  );\n\n-- ------------------------------------------------------------\n-- 8.",
     "             or torneos_soy_juez((select r.tournament_id from rounds r where r.id = m.round_id)))\n    )\n  );\n\n-- ------------------------------------------------------------\n-- 8."),

    # ── Lo que NO se abre ──
    (MIG, 'se ve una decklist que el torneo no deja ver',
     "        and coalesce(t.decklist_visibility, 'al_terminar') <> 'nunca'",
     "        and coalesce(t.decklist_visibility, 'al_terminar') is not null"),

    (MIG, 'se reabre la puerta de atrás del chat de mesa',
     "  with check (\n    sender_id = auth.uid()\n    and exists (\n      select 1 from tournament_matches m",
     "  with check (\n    sender_id = auth.uid()\n    or exists (\n      select 1 from tournament_matches m"),

    ('js/torneos/torneos.js', 'quien monta su torneo se lo sella como oficial',
     "  document.getElementById('torneoOficialCampo')?.classList.toggle('hidden', !perfil?.is_admin)",
     "  document.getElementById('torneoOficialCampo')?.classList.toggle('hidden', !puedeLlevar(perfil, torneo, session?.user?.id))"),

    # ── Los rechazos en silencio ──
    ('js/torneos/torneo.js', 'expulsar canta victoria sin mirar si pasó algo',
     "        .eq('id', b.dataset.expulsar)\n        .select('id')\n      if (error || !data?.length) {",
     "        .eq('id', b.dataset.expulsar)\n      if (error) {"),

    ('js/torneos/ronda.js', 'se da por retirado a quien sigue en el torneo',
     "    if (error || !data?.length) continue",
     "    if (error) continue"),

    # ── Y la pantalla, que tiene que decir lo mismo que la base ──
    ('js/torneos/torneo.js', 'la ficha vuelve a preguntar solo por el rol',
     "const mando = () => puedeLlevar(perfil, torneo, session?.user?.id)",
     "const mando = () => Boolean(perfil?.is_admin || perfil?.is_tournament_admin)"),
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
        r = subprocess.run(['/opt/node22/bin/node', os.path.join(SC, 'test-tanda-296.mjs')], capture_output=True, text=True, cwd=SC)
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
