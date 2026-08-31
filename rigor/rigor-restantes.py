# Solo las dos roturas que la pasada anterior no pilló, ahora que las
# pruebas miden lo que decían medir.
import subprocess, sys
SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
REPO = '/home/user/pingu'
NODE = '/opt/node22/bin/node'

ROTURAS = [
    ('js/torneos/torneo.js', 'el visitante pide todas las columnas',
     "soloMirando ? COLUMNAS_PUBLICAS_INSCRIPCION.join(', ') : '*'", "'*'"),
    ('js/torneos/jueces.js', 'el bye se cuela como partida del visitante (jueces)',
     "  miPartida = mi && rondaViva", "  miPartida = rondaViva"),
    # Y de paso, que el registro de columnas del doble no sea un adorno.
    ('js/torneos/comun.js', 'la lista pública pierde una columna',
     "  'status',\n", "  "),
]

fallos = []
for rel, nombre, viejo, nuevo in ROTURAS:
    ruta = f'{REPO}/{rel}'
    original = open(ruta, encoding='utf-8').read()
    if viejo not in original:
        fallos.append(nombre); print(f'!! {nombre}: no se encuentra el trozo'); continue
    open(ruta, 'w', encoding='utf-8').write(original.replace(viejo, nuevo, 1))
    try:
        subprocess.run(['bash', f'{SC}/sync-forum.sh'], capture_output=True)
        r20 = subprocess.run([NODE, f'{SC}/test-torneos-20.mjs'], capture_output=True, text=True)
        r21 = subprocess.run([NODE, f'{SC}/test-torneos-21.mjs'], capture_output=True, text=True)
        detectada = r20.returncode != 0 or r21.returncode != 0
    finally:
        open(ruta, 'w', encoding='utf-8').write(original)
    print(('detectada     ' if detectada else 'NO DETECTADA  ') + nombre)
    if not detectada: fallos.append(nombre)

subprocess.run(['bash', f'{SC}/sync-forum.sh'], capture_output=True)
print(f'\n{len(ROTURAS) - len(fallos)}/{len(ROTURAS)} detectadas')
sys.exit(1 if fallos else 0)
