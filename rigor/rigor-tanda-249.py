#!/usr/bin/env python3
# Rigor de la tanda 249 (los correos). SIEMPRE en segundo plano.
import subprocess, sys, os

REPO = '/home/user/pingu'
SC = '/tmp/claude-0/-home-user/b9afdd5d-e7a3-5d00-bfc6-d85d45049058/scratchpad'
LIB = 'netlify/lib/email.mjs'
FECHAS = 'netlify/lib/fechas.mjs'

MUTACIONES = [
    # El fallo original de la tanda, tal cual estaba.
    ('vuelve el fallo: las URLs enteras se tiran y se cae a la portada', LIB,
     "  const ruta = safePath(s)\n  if (ruta) return base ? `${base}${ruta}` : null",
     "  const ruta = safePath(s)\n  if (true) return ruta ? `${base}${ruta}` : (base || null)"),

    ('se acepta CUALQUIER dominio, no solo el nuestro', LIB,
     "    if (suya.origin !== new URL(base).origin) return null",
     "    if (false) return null"),

    ('un enlace que no vale vuelve a mandar a la portada', LIB,
     "  } catch {\n    return null\n  }\n}",
     "  } catch {\n    return base\n  }\n}"),

    ('todos los tipos vuelven al verbo genérico', LIB,
     "  const t = TEXTOS_POR_TIPO[tipo] || {}",
     "  const t = {}"),

    ('el pie vuelve a ser el mismo para todos', LIB,
     "  return { cta: t.cta || CTA_GENERICO, pie: t.pie || PIE_GENERICO }",
     "  return { cta: t.cta || CTA_GENERICO, pie: PIE_GENERICO }"),

    ('se va el preheader', LIB,
     "  if (!texto) return ''\n  return `<div style=\"display:none;",
     "  if (true) return ''\n  return `<div style=\"display:none;"),

    ('el asunto deja de escaparse', LIB,
     '<h1 style="margin:0 0 14px;font-family:${FUENTE};font-size:20px;line-height:1.35;font-weight:700;color:#111827;">${escapeHtml(asunto)}</h1>',
     '<h1 style="margin:0 0 14px;font-family:${FUENTE};font-size:20px;line-height:1.35;font-weight:700;color:#111827;">${asunto}</h1>'),

    ('la tarjeta pierde el width y Outlook la estira', LIB,
     '<table role="presentation" width="520" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:520px;',
     '<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:520px;'),

    ('el texto plano se queda sin enlace', LIB,
     "    (url ? `${boton}: ${url}\\n\\n` : '') +",
     "    '' +"),

    ('el resumen semanal cae a la plantilla de un aviso', LIB,
     "      if (carga && Array.isArray(carga.temas)) {",
     "      if (false) {"),

    # Las fechas.
    ('vuelve el 1 de enero de 1970 cuando no hay fecha', FECHAS,
     "  if (iso === null || iso === undefined || iso === '') return null",
     "  if (iso === undefined || iso === '') return null"),

    ('la medianoche del ciclo h24 deja de normalizarse', FECHAS,
     "  return n % 24",
     "  return n"),

    # NO se muta el `hourCycle: 'h23'`. Se probó y NINGUNA prueba lo
    # detecta, y está bien que sea así: en este Node `hour12: false` da
    # exactamente h23, así que las dos formas producen lo mismo. Ese
    # `h23` es un cinturón contra OTRO runtime (el de Netlify, que no
    # controlamos), y una diferencia de entorno no se puede pillar desde
    # aquí. Lo que sí protege de verdad es normalizarHora, que va arriba
    # y sí se comprueba. Escribir una prueba a medida para que esta
    # mutación «fallara» sería mentirnos.

    ('las fechas se calculan en UTC y no en hora de España', FECHAS,
     "export function fechaLargaEs(iso, { zona = 'Europe/Madrid', ahora = new Date() } = {}) {",
     "export function fechaLargaEs(iso, { zona = 'UTC', ahora = new Date() } = {}) {"),

    ('el año deja de decirse cuando no es este', FECHAS,
     "  const anio = f.anio !== anioActual ? ` de ${f.anio}` : ''",
     "  const anio = ''"),
]

def correr():
    r = subprocess.run(['/opt/node22/bin/node', f'{SC}/test-correos.mjs'],
                       capture_output=True, text=True, timeout=300)
    return r.returncode, r.stdout

no_detectadas = []
for i, (nombre, fichero, viejo, nuevo) in enumerate(MUTACIONES, 1):
    ruta = os.path.join(REPO, fichero)
    original = open(ruta).read()
    if original.count(viejo) != 1:
        print(f'{i:2}. ⚠️  ANCLA MALA ({original.count(viejo)}): {nombre}', flush=True)
        no_detectadas.append(nombre + ' (ancla mala)')
        continue
    try:
        open(ruta, 'w').write(original.replace(viejo, nuevo))
        codigo, salida = correr()
        if codigo == 0:
            print(f'{i:2}. ❌ NO DETECTADA: {nombre}', flush=True)
            no_detectadas.append(nombre)
        else:
            print(f'{i:2}. ✅ pillada ({salida.count("FALLA")} fallos): {nombre}', flush=True)
    finally:
        open(ruta, 'w').write(original)

print()
if no_detectadas:
    print(f'❌ {len(no_detectadas)} sin detectar:')
    for n in no_detectadas: print('   ·', n)
    sys.exit(1)
print(f'✅ Las {len(MUTACIONES)} mutaciones detectadas.')
