import glob, re, sys, os

def bloque(texto, i):
    """Lee un (...) equilibrado a partir del '(' en i. Devuelve (contenido, fin)."""
    if texto[i] != '(':
        return None, i
    hondo, j = 0, i
    while j < len(texto):
        if texto[j] == '(':
            hondo += 1
        elif texto[j] == ')':
            hondo -= 1
            if hondo == 0:
                return texto[i + 1:j], j + 1
        j += 1
    return None, i

def politicas(texto):
    """(nombre, tabla, using, check) de cada `create policy ... for all`."""
    for m in re.finditer(r'create policy (\w+) on ([\w.]+)\s+for all\s+', texto):
        i = m.end()
        using = check = None
        mu = re.match(r'using\s*', texto[i:])
        if mu:
            using, fin = bloque(texto, i + mu.end())
            i = fin
        mc = re.match(r'\s*with check\s*', texto[i:])
        if mc:
            check, _ = bloque(texto, i + mc.end())
        yield m.group(1), m.group(2), ' '.join((using or '').split()), ' '.join((check or '').split())

# Lo que vale es la ÚLTIMA definición de cada política: una migración
# posterior rehace la de antes. Se recorren en orden de tanda, que es el
# orden en que un humano las ejecuta.
ORDEN = ['torneos.sql', 'torneos-publico.sql', 'torneos-abiertos.sql', 'torneos-listas.sql',
         'torneos-banner.sql', 'torneos-imagen.sql', 'torneos-medallas.sql',
         'torneos-bo3.sql', 'torneos-privados.sql', 'torneos-cola.sql', 'torneos-chats.sql']
def clave(f):
    n = f.split('supabase-migration-')[-1]
    return (ORDEN.index(n) if n in ORDEN else 99, n)

final = {}
# Por defecto mira las migraciones del repo. Con un directorio por
# argumento mira ese — es como la prueba comprueba que el barrido SABE
# detectar, dándole una política mala a posta.
DONDE = sys.argv[1] if len(sys.argv) > 1 else '/home/user/pingu'
for f in sorted(glob.glob(os.path.join(DONDE, 'supabase-migration-*.sql')), key=clave):
    # Los comentarios pueden llevar EJEMPLOS de políticas viejas: leerlos
    # daría por mala una política que está bien.
    texto = '\n'.join(l for l in open(f).read().split('\n') if not l.strip().startswith('--'))
    for nombre, tabla, using, check in politicas(texto):
        final[(tabla, nombre)] = (f.split('/')[-1], using, check)

flojas = []
for (tabla, nombre), (fichero, using, check) in sorted(final.items()):
    # Sin `with check`, Postgres usa el `using` también para escribir: bien.
    if not check:
        continue
    # Con `with check`, el INSERT SOLO mira ese. Si el `using` exige
    # pertenecer a algo (un `exists`) y el `with check` no, se puede
    # escribir donde no se puede leer.
    if 'exists' in using.lower() and 'exists' not in check.lower():
        flojas.append((fichero, nombre, tabla, using, check))

for fichero, nombre, tabla, using, check in flojas:
    print(f'⚠️  {fichero}  ·  {nombre} sobre {tabla}')
    print(f'      using      : {using[:120]}')
    print(f'      with check : {check[:120]}\n')
print('SIN POLÍTICAS FLOJAS' if not flojas else f'{len(flojas)} FLOJAS')
sys.exit(1 if flojas else 0)
