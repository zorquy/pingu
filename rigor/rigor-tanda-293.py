"""Rigor de la tanda 293 (el puente que mentía). En segundo plano SIEMPRE."""
import subprocess, sys, os

SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
REPO = '/home/user/pingu'

VUELVE_EL_CAMINO_VIEJO = """  if (faltaLaRpc(res.error)) {
    await supabase.from('match_reports').insert({ match_id: partida.id, reporter_id: miId(), result: resultado })
    showToast('Reportado. Falta que tu rival lo confirme.', 'success')
    return
  }"""

MUTACIONES = [
    ('js/torneos/ronda.js', 'vuelve el camino viejo de reportar (el fallo original)',
     """  if (faltaLaRpc(res.error)) {
    // `match_reports` solo se escribe por RPC desde la apertura (tanda
    // 252): el camino viejo de aquí abajo no apuntaba nada y lo hacía EN
    // SILENCIO, con un «Reportado» en verde. Se dice lo que falta.
    showToast(avisoDeMigracion('supabase-migration-torneos-bo3.sql'), 'error')
    return
  }""", VUELVE_EL_CAMINO_VIEJO),

    ('js/torneos/ronda.js', 'se avisa pero se sigue adelante igual',
     "    showToast(avisoDeMigracion('supabase-migration-torneos-bo3.sql'), 'error')\n    return",
     "    showToast(avisoDeMigracion('supabase-migration-torneos-bo3.sql'), 'error')"),

    ('js/torneos/ronda.js', 'vuelve el camino viejo del check-in',
     "    showToast(avisoDeMigracion('supabase-migration-torneos-publico.sql'), 'error')\n    return",
     "    await supabase.from('tournament_matches').update({ [columna]: ahora() }).eq('id', partida.id)\n    return"),

    ('js/torneos/torneo.js', 'vuelve el camino viejo de la inscripción',
     "      showToast(avisoDeMigracion('supabase-migration-torneos-cola.sql'), 'error')\n      return",
     "      await supabase.from('tournament_registrations').insert({ tournament_id: torneo.id, user_id: session.user.id, status: 'waitlisted', tcg_live_username: tcgLive })\n      return"),

    ('js/torneos/torneo.js', 'la cola deja de decir que es cola',
     "      p_cola: Boolean(aLaCola),", "      p_cola: false,"),

    ('js/torneos/comun.js', 'el aviso no dice qué fichero falta',
     "  return `Falta ejecutar ${fichero} en el SQL Editor de Supabase. Hasta entonces esto no se puede hacer.`",
     "  return 'No se ha podido hacer.'"),

    ('supabase-migration-torneos-cola.sql', 'la RPC vieja se queda y las inscripciones quedan ambiguas',
     "drop function if exists public.torneos_inscribirse(uuid, text);", "-- sin drop"),

    ('supabase-migration-torneos-cola.sql', 'pedir cola no sirve de nada',
     "  if p_cola or v_lleno then", "  if v_lleno then"),

    ('supabase-migration-torneos-cola.sql', 'quien llega justo al llenarse se queda fuera',
     "  v_lleno := v_torneo.max_players is not null and v_ocupadas >= v_torneo.max_players;",
     "  v_lleno := false;"),

    ('supabase-migration-torneos-cola.sql', 'se deja de contar bajo candado',
     "  select * into v_torneo from tournaments where id = p_torneo for update;",
     "  select * into v_torneo from tournaments where id = p_torneo;"),
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
        r = subprocess.run(['/opt/node22/bin/node', os.path.join(SC, 'test-tanda-293.mjs')], capture_output=True, text=True, cwd=SC)
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
