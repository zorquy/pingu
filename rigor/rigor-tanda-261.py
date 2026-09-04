#!/usr/bin/env python3
# Rigor de la tanda 261. SIEMPRE en segundo plano.
import subprocess, sys, os
REPO = '/home/user/pingu'
SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
ARQ = 'js/torneos/arquetipos.js'
EVO = 'js/torneos/evoluciones.js'

MUTACIONES = [
    ('no se agrupa por línea: cada carta va suelta', ARQ,
     "    if (suyo) suyo.cartas.push(carta)\n    else grupos.push({ cartas: [carta] })",
     "    grupos.push({ cartas: [carta] })"),

    ('el parentesco solo mira hacia un lado', ARQ,
     "          esAntepasadoDe(c.dex, carta.dex) ||\n          esAntepasadoDe(carta.dex, c.dex)",
     "          esAntepasadoDe(c.dex, carta.dex)"),

    ('la línea se llama por la carta de abajo', ARQ,
     "    const cabezas = g.cartas.filter((c) => !g.cartas.some((o) => esAntepasadoDe(c.dex, o.dex)))",
     "    const cabezas = g.cartas.filter((c) => g.cartas.some((o) => esAntepasadoDe(c.dex, o.dex)))"),

    ('la Mega no se reduce a su especie', ARQ,
     "    return dex && BASE_DE_FORMA.has(dex) ? BASE_DE_FORMA.get(dex) : dex",
     "    return dex"),

    ('manda el «ex» y no el peso de la línea', ARQ,
     "      b.copias - a.copias ||\n      b.peso - a.peso ||",
     "      b.peso - a.peso ||\n      b.copias - a.copias ||"),

    ('una carta suelta puede ser el segundo icono', ARQ,
     "  const segunda = orden.slice(1).find((g) => g.copias >= 2)",
     "  const segunda = orden.slice(1)[0]"),

    ('la Mega no pesa más que un ex al nombrar la línea', ARQ,
     "  if (/\\bmega\\b/i.test(n)) return 3",
     "  if (/\\bmega\\b/i.test(n)) return 1"),

    ('el desempate deja de ser estable', ARQ,
     "      String(a.cabeza.linea.name).localeCompare(String(b.cabeza.linea.name))",
     "      0"),

    ('las copias de la línea no se suman', ARQ,
     "    g.copias = g.cartas.reduce((n, c) => n + (Number(c.linea.quantity) || 0), 0)",
     "    g.copias = Number(g.cartas[0].linea.quantity) || 0"),

    ('el parentesco no sigue la cadena (Ralts deja de ser Gardevoir)', EVO,
     "    frente = frente.flatMap((d) => EVOLUCIONA_A.get(d) || [])",
     "    frente = []"),

    ('la tabla de evoluciones se queda a medias', EVO,
     "  CRUDO.split(' ').map((par) => {",
     "  CRUDO.split(' ').slice(0, 20).map((par) => {"),
]


def correr():
    r = subprocess.run(['/opt/node22/bin/node', f'{SC}/test-tanda-261.mjs'],
                       capture_output=True, text=True, timeout=300)
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

print()
if sin:
    print(f'❌ {len(sin)} sin detectar:')
    for n in sin: print('   ·', n)
    sys.exit(1)
print(f'✅ Las {len(MUTACIONES)} mutaciones detectadas.')
