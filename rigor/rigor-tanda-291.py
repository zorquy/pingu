"""Rigor de la tanda 291 (BO3 partida a partida). En segundo plano SIEMPRE."""
import subprocess, sys, os

SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
REPO = '/home/user/pingu'

# UNA MUTACIÓN QUITADA: «se puede volver a marcar una partida ya jugada».
# Era una guarda redundante — `serieBo3().siguiente` ya devuelve la
# primera partida SIN jugar, así que comprobarlo aparte no podía fallar
# nunca. Se quitó del motor en vez de fingir que se prueba.

MUTACIONES = [
    ('js/torneos/motor.js', 'la serie no se cierra con dos ganadas',
     "  if (ganadasA >= 2) {", "  if (ganadasA >= 3) {"),

    ('js/torneos/motor.js', 'la tercera sigue abierta con la serie decidida',
     "  let siguiente = null\n  if (!result) {", "  let siguiente = null\n  if (true) {"),

    ('js/torneos/motor.js', 'se puede saltar una partida',
     "  return serieBo3(juegos).siguiente === n", "  return true"),

    ('js/torneos/motor.js', 'tres jugadas sin dos ganadas dejan de ser empate',
     "  } else if (jugados === 3) {", "  } else if (false) {"),

    ('js/torneos/motor.js', 'las tablas cuentan como victoria de A',
     "    if (r === 'a_wins') ganadasA++", "    if (r === 'a_wins' || r === 'draw') ganadasA++"),

    ('js/torneos/ronda.js', 'el parte va sin número de partida',
     "reportar(mia, b.dataset.reporte, Number(b.dataset.juego || 0))", "reportar(mia, b.dataset.reporte)"),

    ('js/torneos/ronda.js', 'la RPC no recibe el número de partida',
     "{ p_partida: partida.id, p_resultado: resultado, p_juego: juego }", "{ p_partida: partida.id, p_resultado: resultado }"),

    ('js/torneos/ronda.js', 'un BO3 vuelve a pedir un solo resultado',
     "    bo === 3\n      ? panelBo3(mia, soyA)", "    false\n      ? panelBo3(mia, soyA)"),

    ('js/torneos/ronda.js', 'un BO1 se llena de partidas que no existen',
     "    bo === 3\n      ? panelBo3(mia, soyA)", "    true\n      ? panelBo3(mia, soyA)"),

    ('js/torneos/ronda.js', 'se puede cambiar un parte ya acordado',
     "  if (confirmados[n]) {\n    cuerpo = `<span class=\"torneo-bo3-cerrada\">${comoMeFue(confirmados[n], soyA)}</span>`\n  } else if (mios[n]) {",
     "  if (false) {\n    cuerpo = `<span class=\"torneo-bo3-cerrada\">${comoMeFue(confirmados[n], soyA)}</span>`\n  } else if (mios[n]) {"),

    ('js/torneos/ronda.js', 'los partes de todas las partidas se mezclan',
     "    const a = suyos.find((r) => nDe(r) === n && r.reporter_id === partida.player_a_id)",
     "    const a = suyos.find((r) => r.reporter_id === partida.player_a_id)"),

    ('js/torneos/ronda.js', 'ganar y perder se cuentan al revés',
     "  const gane = (resultado === 'a_wins') === soyA", "  const gane = (resultado === 'a_wins') !== soyA"),

    ('js/torneos/ronda.js', 'el botón de retirar el parte manda otra partida',
     "desreportar(mia, Number(b.dataset.quitar))", "desreportar(mia, 0)"),

    ('supabase-migration-torneos-bo3.sql', 'el candado vuelve a ser uno por mesa y persona',
     "  on public.match_reports (match_id, reporter_id, game_number);", "  on public.match_reports (match_id, reporter_id);"),

    ('supabase-migration-torneos-bo3.sql', 'la RPC vieja se queda al lado y la llamada queda ambigua',
     "drop function if exists public.torneos_reportar(uuid, text);", "-- sin drop"),
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
        r = subprocess.run(['/opt/node22/bin/node', os.path.join(SC, 'test-tanda-291.mjs')], capture_output=True, text=True, cwd=SC)
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
