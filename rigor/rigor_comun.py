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

# La prueba y el script de copia salen del ARBOL de la rama `pruebas`
# (tanda 422), no de copias sueltas en el scratchpad. Lo de antes tenia un
# fallo que se comia el rigor ENTERO y en silencio: si la prueba no estaba
# en el scratchpad —y el 2026-10-01 no habia NINGUNA—, `node` salia con
# codigo 1 por el fichero que falta, y el rigor leia ese 1 como «mutacion
# detectada». Todas. Siempre. Un rigor que no puede fallar no prueba nada,
# que es justo lo que un rigor existe para no ser.
WT = os.environ.get('WT', '/tmp/wt-pruebas')
SYNC = os.path.join(WT, 'herramientas', 'sync-forum.sh')
PRUEBAS = os.path.join(WT, 'pruebas')


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


def _pasar(prueba):
    """Corre la prueba sobre lo que haya ahora en disco."""
    subprocess.run([SYNC], capture_output=True)
    return subprocess.run(['/opt/node22/bin/node', os.path.join(PRUEBAS, prueba)],
                          capture_output=True, text=True, cwd=PRUEBAS)


def correr(mutaciones, prueba):
    """Pasa cada mutación por `prueba` y cuenta cuáles no se ven."""
    rescatados = rescatar()
    if rescatados:
        print(f'⚠️  Rescatados de una pasada anterior: {", ".join(rescatados)}\n', flush=True)

    # Antes de mutar nada, la prueba tiene que pasar SOBRE EL ARBOL LIMPIO.
    # Sin esto, «la prueba falla» no significa «la mutación se ve»: puede
    # significar que la prueba no existe, que el servidor está caído o que
    # ya estaba roja — y las tres se leen como un rigor impecable.
    if not os.path.exists(os.path.join(PRUEBAS, prueba)):
        print(f'❌ No existe la prueba {prueba} en {PRUEBAS}. Un rigor sin prueba no prueba nada.')
        sys.exit(2)
    limpio = _pasar(prueba)
    if limpio.returncode != 0:
        print(f'❌ {prueba} ya falla SIN mutar: el rigor no diría nada. Últimas líneas:')
        print('\n'.join((limpio.stdout + limpio.stderr).strip().splitlines()[-12:]))
        sys.exit(2)
    print(f'✅ {prueba} en verde sobre el árbol limpio: se puede empezar\n', flush=True)

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
            r = _pasar(prueba)
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
        subprocess.run([SYNC], capture_output=True)

    if sin_detectar:
        print(f'\n❌ {len(sin_detectar)} sin detectar:')
        for n in sin_detectar:
            print('  -', n)
        sys.exit(1)
    print(f'\n✅ Las {len(mutaciones)} mutaciones detectadas')
