#!/usr/bin/env python3
# Rigor de la tanda 251. SIEMPRE en segundo plano.
import subprocess, sys, os
REPO = '/home/user/pingu'
SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
MP = 'js/mis-partidas.js'
MZ = 'js/matriz-partidas.js'
SEL = 'js/torneos/selector-mazo.js'

MUTACIONES = [
    ('un torneo cerrado sigue pidiendo rondas', MP,
     "  const editable = t.aMano && !t.cerrado",
     "  const editable = t.aMano"),

    ('cerrar no guarda la fecha', MP,
     "    .update({ cerrado_el: cerrar ? new Date().toISOString() : null })",
     "    .update({ cerrado_el: null })"),

    ('reabrir no borra el cierre', MP,
     "    .update({ cerrado_el: cerrar ? new Date().toISOString() : null })",
     "    .update({ cerrado_el: new Date().toISOString() })"),

    ('la tarjeta no se marca como cerrada', MP,
     "cerrado: Boolean(t.cerrado_el),",
     "cerrado: false,"),

    ('editar vuelve a insertar una fila nueva', MP,
     "  const { error } = editando\n    ? await supabase.from('match_log').update(cambios).eq('id', editando.id)\n    : await supabase.from('match_log').insert(fila)",
     "  const { error } = await supabase.from('match_log').insert(fila)"),

    ('el mazo del rival NO vuelve al campo al editar', MP,
     "  if (partida) rellenarFormConPartida(partida, esRonda)",
     "  if (false) rellenarFormConPartida(partida, esRonda)"),

    ('el selector no sabe ponerse un valor', SEL,
     "      campo.value = elegido ? elegido.nombre : ''\n      sprite.classList.toggle('hidden', !elegido?.sprite)",
     "      campo.value = ''\n      sprite.classList.toggle('hidden', !elegido?.sprite)"),

    ('borrar una ronda ya no pregunta', MP,
     "      if (!b.dataset.armado) {\n        b.dataset.armado = '1'\n        b.textContent = '¿Seguro?'\n        return\n      }\n      if (editando?.id === b.dataset.borrarRonda) cerrarFormPartida()",
     "      if (editando?.id === b.dataset.borrarRonda) cerrarFormPartida()"),

    ('se va el corte y salen todos de golpe', MP,
     "  const visibles = verTodosLosTorneos ? casan : casan.slice(0, TORNEOS_DE_GOLPE)",
     "  const visibles = casan"),

    ('el buscador deja de mirar el nombre', MZ,
     "    const donde = [t.nombre, t.donde]",
     "    const donde = [t.donde]"),

    ('el buscador vuelve a distinguir tildes', MZ,
     "  const q = String(texto || '')\n    .normalize('NFD')\n    .replace(/[\\u0300-\\u036f]/g, '')",
     "  const q = String(texto || '')\n    .normalize('NFD')"),

    ('el filtro de estado no filtra nada', MZ,
     "    if (estado === 'abiertos' && (!t.aMano || t.cerrado)) return false\n    if (estado === 'cerrados' && (!t.aMano || !t.cerrado)) return false",
     ""),

    # ── Lo nuevo: editar el torneo y la lista de enfrentamientos ──
    ('editar el torneo crea otro en vez de actualizarlo', MP,
     "    const { error } = await supabase.from('match_log_torneos').update(campos).eq('id', editandoTorneo.id)",
     "    const { error } = await supabase.from('match_log_torneos').insert({ user_id: session.user.id, ...campos })"),

    ('el formulario del torneo no se rellena al editar', MP,
     "  $('torneoLogNombre').value = torneo?.nombre || ''",
     "  $('torneoLogNombre').value = ''"),

    ('el mazo del torneo no vuelve al campo', MP,
     "  ponerMazoEnSelector('tmio1', 'tmio2', torneo?.mi_mazo, torneo?.mi_mazo_nombre)",
     "  ponerMazoEnSelector('tmio1', 'tmio2', null, null)"),

    ('el cliente arrastra las rondas a mano (lo que hace el disparador)', MP,
     "    showToast('Torneo actualizado. Sus rondas se han puesto al día solas.', 'success')",
     "    await supabase.from('match_log').update({ mi_mazo: campos.mi_mazo }).eq('torneo_id', editandoTorneo.id)\n    showToast('Torneo actualizado. Sus rondas se han puesto al día solas.', 'success')"),

    ('vuelve la tabla ancha en vez de la lista', MP,
     "  caja.innerHTML = m.filas\n    .map((f) => {",
     "  caja.innerHTML = '<div class=\"partidas-matriz-scroll\"><table class=\"partidas-matriz\"></table></div>' + m.filas\n    .map((f) => {"),

    ('los enfrentamientos dejan de ordenarse por lo más jugado', MZ,
     "        b.casilla.total - a.casilla.total ||\n        (b.ratio ?? 0) - (a.ratio ?? 0) ||",
     "        (b.ratio ?? 0) - (a.ratio ?? 0) ||"),

    ('la barra no mide el porcentaje', MP,
     '<span style="width:${pctNum ?? 0}%"></span>',
     '<span style="width:0%"></span>'),

    ('las sueltas vuelven a cortarse en silencio', MP,
     "  const ultimas = verTodasLasSueltas ? ordenadas : ordenadas.slice(0, SUELTAS_DE_GOLPE)\n  const ocultas = ordenadas.length - ultimas.length",
     "  const ultimas = ordenadas.slice(0, SUELTAS_DE_GOLPE)\n  const ocultas = 0"),
]

def correr():
    subprocess.run(['bash', f'{SC}/sync-forum.sh'], check=True, capture_output=True)
    r = subprocess.run(['/opt/node22/bin/node', f'{SC}/test-tanda-251.mjs'],
                       capture_output=True, text=True, timeout=600)
    return r.returncode, r.stdout

sin = []
for i, (nombre, fichero, viejo, nuevo) in enumerate(MUTACIONES, 1):
    ruta = os.path.join(REPO, fichero)
    original = open(ruta).read()
    if original.count(viejo) != 1:
        print(f'{i:2}. ⚠️  ANCLA MALA ({original.count(viejo)}): {nombre}', flush=True)
        sin.append(nombre + ' (ancla mala)')
        continue
    try:
        open(ruta, 'w').write(original.replace(viejo, nuevo))
        codigo, salida = correr()
        if codigo == 0:
            print(f'{i:2}. ❌ NO DETECTADA: {nombre}', flush=True)
            sin.append(nombre)
        else:
            print(f'{i:2}. ✅ pillada ({salida.count("FALLA")} fallos): {nombre}', flush=True)
    finally:
        open(ruta, 'w').write(original)

subprocess.run(['bash', f'{SC}/sync-forum.sh'], check=True, capture_output=True)
print()
if sin:
    print(f'❌ {len(sin)} sin detectar:')
    for n in sin: print('   ·', n)
    sys.exit(1)
print(f'✅ Las {len(MUTACIONES)} mutaciones detectadas.')
