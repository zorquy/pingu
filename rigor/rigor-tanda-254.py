#!/usr/bin/env python3
# Rigor de la tanda 254. SIEMPRE en segundo plano.
import subprocess, sys, os
REPO = '/home/user/pingu'; SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
C = 'js/curso.js'
J = 'js/curso-juego.js'

M = [
    ('vuelve el fallo: se compara el número de pareja', C,
     "      const isCorrect = selectedLeft.dataset.clave === this.dataset.clave",
     "      const isCorrect = selectedLeft.dataset.clave === this.dataset.clave && selectedLeft.dataset.side !== 'left'"),

    ('cualquier respuesta vale', C,
     "      const isCorrect = selectedLeft.dataset.clave === this.dataset.clave",
     "      const isCorrect = true"),

    ('las respuestas repetidas vuelven a salir dos veces', C,
     "    if (!porRespuesta.has(clave)) porRespuesta.set(clave, { text: p.right, clave, usos: 0 })",
     "    porRespuesta.set(clave + Math.random(), { text: p.right, clave, usos: 0 })"),

    ('la respuesta se apaga al primer acierto', C,
     "        if (quedan <= 0) {\n          this.classList.add('matched')",
     "        if (true) {\n          this.classList.add('matched')"),

    ('la respuesta no se apaga nunca', C,
     "        const quedan = Number(this.dataset.usos || 1) - 1",
     "        const quedan = 99"),

    ('no se avisa del acierto parcial', C,
     "          chip.classList.add('acierto')", "          void chip"),

    ('el término no se cuenta como emparejado', C,
     "        matchedCount++", "        matchedCount += 0"),

    ('mayúsculas y espacios vuelven a ser respuestas distintas', J,
     "  return String(texto || '').replace(/\\s+/g, ' ').trim().toLowerCase()",
     "  return String(texto || '')"),
]

def correr():
    subprocess.run(['bash', f'{SC}/sync-forum.sh'], check=True, capture_output=True)
    r = subprocess.run(['/opt/node22/bin/node', f'{SC}/test-tanda-254.mjs'], capture_output=True, text=True, timeout=600)
    return r.returncode, r.stdout

sin = []
for i, (nombre, f, viejo, nuevo) in enumerate(M, 1):
    ruta = os.path.join(REPO, f); original = open(ruta).read()
    if original.count(viejo) != 1:
        print(f'{i}. ⚠️ ANCLA MALA ({original.count(viejo)}): {nombre}', flush=True); sin.append(nombre); continue
    try:
        open(ruta, 'w').write(original.replace(viejo, nuevo))
        codigo, salida = correr()
        if codigo == 0:
            print(f'{i}. ❌ NO DETECTADA: {nombre}', flush=True); sin.append(nombre)
        else:
            print(f'{i}. ✅ pillada ({salida.count("FALLA")} fallos): {nombre}', flush=True)
    finally:
        open(ruta, 'w').write(original)
subprocess.run(['bash', f'{SC}/sync-forum.sh'], check=True, capture_output=True)
print()
if sin:
    print(f'❌ {len(sin)} sin detectar:')
    for n in sin: print('   ·', n)
    sys.exit(1)
print(f'✅ Las {len(M)} mutaciones detectadas.')
