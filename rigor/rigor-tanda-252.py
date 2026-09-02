#!/usr/bin/env python3
# Rigor de la tanda 252 (la apertura). SIEMPRE en segundo plano.
import subprocess, sys, os
REPO = '/home/user/pingu'
SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
TS = 'js/torneos/torneos.js'
TO = 'js/torneos/torneo.js'
CO = 'js/torneos/comun.js'
AP = 'js/app.js'

MUTACIONES = [
    ('vuelve el candado: /torneos echa a quien no sea admin', TS,
     "  document.getElementById('btnNuevoTorneo')?.classList.toggle('hidden', !perfil?.is_admin)",
     "  if (!perfil?.is_admin) { window.location.href = '/index.html'; return }\n  document.getElementById('btnNuevoTorneo')?.classList.toggle('hidden', !perfil?.is_admin)"),

    ('cualquiera puede crear un torneo', TS,
     "?.classList.toggle('hidden', !perfil?.is_admin)",
     "?.classList.toggle('hidden', false)"),

    ('/torneos vuelve a reventar sin sesión', TS,
     "    if (session?.user && i.user_id === session.user.id) miEstado[i.tournament_id] = i.status",
     "    if (i.user_id === session.user.id) miEstado[i.tournament_id] = i.status"),

    ('el enlace «Jugar» vuelve a ser solo de admins', AP,
     "  document.querySelectorAll('.nav-jugar').forEach((e) => e.classList.remove('hidden'))",
     "  if (profile?.is_admin) document.querySelectorAll('.nav-jugar').forEach((e) => e.classList.remove('hidden'))"),

    ('apuntarse deja de usar la RPC', TO,
     "      const res = await supabase.rpc('torneos_inscribirse', { p_torneo: torneo.id, p_tcg_live: tcgLive })",
     "      const res = { error: { code: 'PGRST202', message: 'Could not find the function' } }"),

    ('la RPC se llama sin el usuario de TCG Live', TO,
     "{ p_torneo: torneo.id, p_tcg_live: tcgLive }",
     "{ p_torneo: torneo.id, p_tcg_live: '' }"),

    ('se inserta a mano ADEMÁS de llamar a la RPC', TO,
     "    if (!porLaRpc) {",
     "    if (true) {"),

    ('un error de la RPC se cae al insert directo (lo que NO puede pasar)', CO,
     "  return (\n    error.code === 'PGRST202' ||\n    error.code === '42883' ||",
     "  return (\n    true ||\n    error.code === '42883' ||"),

    ('el puente deja de reconocer «no existe esa función»', CO,
     "    error.code === 'PGRST202' ||",
     "    false ||"),
]

def correr():
    subprocess.run(['bash', f'{SC}/sync-forum.sh'], check=True, capture_output=True)
    r = subprocess.run(['/opt/node22/bin/node', f'{SC}/test-tanda-252.mjs'],
                       capture_output=True, text=True, timeout=600)
    return r.returncode, r.stdout

sin = []
for i, (nombre, f, viejo, nuevo) in enumerate(MUTACIONES, 1):
    ruta = os.path.join(REPO, f)
    original = open(ruta).read()
    if original.count(viejo) != 1:
        print(f'{i:2}. ⚠️  ANCLA MALA ({original.count(viejo)}): {nombre}', flush=True)
        sin.append(nombre + ' (ancla mala)')
        continue
    try:
        open(ruta, 'w').write(original.replace(viejo, nuevo))
        codigo, salida = correr()
        if codigo == 0:
            print(f'{i:2}. ❌ NO DETECTADA: {nombre}', flush=True); sin.append(nombre)
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
