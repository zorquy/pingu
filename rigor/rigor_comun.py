"""El andamio de los rigores, con red bajo la mutación.

Un rigor ROMPE un fichero del repo a propósito, pasa las pruebas y lo
restaura. El `finally` cubre las excepciones, pero NO cubre que el
contenedor se muera: el 2026-09-15 se reinició a mitad de una pasada y
dejó `usuarios.html` con la mutación puesta y el árbol listo para que
alguien lo commiteara. Netlify despliega esta rama en directo, así que
eso sale a producción.

De ahí el SALVAVIDAS: antes de tocar nada se guarda el contenido
original en un fichero aparte, y lo primero que hace cualquier rigor al
arrancar es mirar si quedó uno de la vez anterior y deshacerlo. Así un
reinicio se arregla solo con volver a lanzar el script — y si no se
vuelve a lanzar, `comprobar_arbol()` lo canta.
"""
import json, os, subprocess, sys

SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
REPO = '/home/user/pingu'
SALVAVIDAS = os.path.join(SC, 'rigor-sin-restaurar.json')


def rescatar():
    """Deshace lo que dejó a medias una pasada anterior."""
    if not os.path.exists(SALVAVIDAS):
        return []
    try:
        with open(SALVAVIDAS) as f:
            guardado = json.load(f)
    except Exception:
        os.remove(SALVAVIDAS)
        return []
    rescatados = []
    for ruta, contenido in guardado.items():
        try:
            if open(ruta).read() != contenido:
                open(ruta, 'w').write(contenido)
                rescatados.append(ruta)
        except Exception:
            pass
    os.remove(SALVAVIDAS)
    return rescatados


def correr(mutaciones, prueba):
    """Pasa cada mutación por `prueba` y cuenta cuáles no se ven."""
    rescatados = rescatar()
    if rescatados:
        print(f'⚠️  Rescatados de una pasada anterior: {", ".join(rescatados)}\n', flush=True)

    originales = {}
    sin_detectar = []
    guardar = lambda: open(SALVAVIDAS, 'w').write(json.dumps(originales))
    try:
        for fichero, nombre, viejo, nuevo in mutaciones:
            ruta = os.path.join(REPO, fichero)
            if ruta not in originales:
                originales[ruta] = open(ruta).read()
                guardar()
            base = originales[ruta]
            if base.count(viejo) != 1:
                print(f'⚠️  ANCLA MALA ({base.count(viejo)} veces) en {fichero}: {nombre}', flush=True)
                sin_detectar.append(f'{nombre} (ancla mala)')
                continue
            open(ruta, 'w').write(base.replace(viejo, nuevo))
            subprocess.run([os.path.join(SC, 'sync-forum.sh')], capture_output=True)
            r = subprocess.run(['/opt/node22/bin/node', os.path.join(SC, prueba)], capture_output=True, text=True, cwd=SC)
            open(ruta, 'w').write(base)
            if r.returncode == 0:
                print(f'❌ SIN DETECTAR: {nombre}', flush=True)
                sin_detectar.append(nombre)
            else:
                print(f'✅ detectada: {nombre}', flush=True)
    finally:
        for ruta, contenido in originales.items():
            open(ruta, 'w').write(contenido)
        if os.path.exists(SALVAVIDAS):
            os.remove(SALVAVIDAS)
        subprocess.run([os.path.join(SC, 'sync-forum.sh')], capture_output=True)

    if sin_detectar:
        print(f'\n❌ {len(sin_detectar)} sin detectar:')
        for n in sin_detectar:
            print('  -', n)
        sys.exit(1)
    print(f'\n✅ Las {len(mutaciones)} mutaciones detectadas')
