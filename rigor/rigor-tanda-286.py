"""Rigor de la tanda 286 (convertir AVIF/WebP al subir). En segundo plano SIEMPRE."""
import subprocess, sys, os

SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
REPO = '/home/user/pingu'

MUTACIONES = [
    ('js/app.js', 'el AVIF deja de convertirse (el fallo original)',
     "const FORMATOS_A_CONVERTIR = ['image/avif', 'image/webp', 'image/heic', 'image/heif']",
     "const FORMATOS_A_CONVERTIR = ['image/webp', 'image/heic', 'image/heif']"),

    ('js/app.js', 'un JPEG se recodifica sin necesidad',
     "const FORMATOS_A_CONVERTIR = ['image/avif', 'image/webp', 'image/heic', 'image/heif']",
     "const FORMATOS_A_CONVERTIR = ['image/avif', 'image/webp', 'image/heic', 'image/heif', 'image/jpeg']"),

    ('js/app.js', 'el tipo en mayúsculas ya no se reconoce',
     "  return FORMATOS_A_CONVERTIR.includes(String(tipo || '').toLowerCase())",
     "  return FORMATOS_A_CONVERTIR.includes(String(tipo || ''))"),

    ('js/app.js', 'la transparencia se ignora y un logo sale con fondo',
     "    const salida = tieneTransparencia(bitmap) ? 'image/png' : 'image/jpeg'",
     "    const salida = 'image/jpeg'"),

    ('js/app.js', 'todo sale PNG y una foto pesa cinco veces más',
     "    const salida = tieneTransparencia(bitmap) ? 'image/png' : 'image/jpeg'",
     "    const salida = 'image/png'"),

    ('js/app.js', 'la transparencia deja de detectarse',
     "  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true",
     "  for (let i = 3; i < data.length; i += 4) if (data[i] < 0) return true"),

    ('js/app.js', 'el alfa se mira en el canal equivocado',
     "  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) return true",
     "  for (let i = 0; i < data.length; i += 4) if (data[i] < 255) return true"),

    ('js/app.js', 'una imagen que el navegador no sabe leer se pierde',
     "  } catch {\n    // El navegador no sabe descodificarlo. Se sube tal cual: mejor una\n    // imagen que Telegram no quiera que ninguna imagen.\n    return file\n  }",
     "  } catch (e) {\n    throw e\n  }"),

    ('js/app.js', 'el nombre se queda con la extensión vieja',
     "    const nombre = `${String(file.name || 'imagen').replace(/\\.[^.]+$/, '')}.${salida === 'image/png' ? 'png' : 'jpg'}`",
     "    const nombre = String(file.name || 'imagen')"),

    ('js/app.js', 'la subida no convierte nada',
     "  file = await convertirImagenRara(file)\n  const ext = extensionDeImagen(file)",
     "  const ext = extensionDeImagen(file)"),

    ('js/app.js', 'se saca la extensión ANTES de convertir',
     "  file = await convertirImagenRara(file)\n  const ext = extensionDeImagen(file)",
     "  const ext = extensionDeImagen(file)\n  file = await convertirImagenRara(file)"),

    ('js/app.js', 'la conversión devuelve un fichero vacío sin darse cuenta',
     "    if (!blob) return file", "    if (false) return file"),
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
        r = subprocess.run(['/opt/node22/bin/node', os.path.join(SC, 'test-tanda-286.mjs')],
                           capture_output=True, text=True, cwd=SC)
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
