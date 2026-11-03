# Genera netlify/lib/tarjeta-letras.mjs: las cuatro letras de las tarjetas
# del enlace (1201) en base64 y su tabla de anchos por carácter, para partir
# títulos en el servidor. Las TTF salen de las variables de google/fonts con
# fontTools (instancia fija + subconjunto latino); corre con python3.13.
import base64, json, sys
from fontTools.ttLib import TTFont
aqui = sys.path[0]
salida = sys.argv[1]
letras = {}
anchos = {}
for clave, fichero in [('Outfit-800', 'Outfit-800.ttf'), ('Outfit-700', 'Outfit-700.ttf'), ('Inter-500', 'Inter-500.ttf'), ('Inter-700', 'Inter-700.ttf')]:
    ruta = f'{aqui}/{fichero}'
    letras[clave] = base64.b64encode(open(ruta, 'rb').read()).decode()
    f = TTFont(ruta)
    upm = f['head'].unitsPerEm
    cmap = f.getBestCmap()
    hmtx = f['hmtx']
    anchos[clave] = {chr(cp): round(hmtx[g][0] / upm, 4) for cp, g in cmap.items()}
with open(salida, 'w') as s:
    s.write('// GENERADO por herramientas/tarjetas-1201/generar-letras.py (rama pruebas).\n')
    s.write('// Las letras de las tarjetas del enlace (1201): Outfit 800/700 e Inter\n')
    s.write('// 500/700, instancias fijas y solo latín, y el ancho de cada carácter en\n')
    s.write('// fracción del cuerpo (para partir líneas sin navegador). No se edita a mano.\n')
    s.write(f'export const ANCHOS = {json.dumps(anchos, ensure_ascii=False, separators=(",", ":"))}\n')
    for clave, b in letras.items():
        s.write(f"export const {clave.replace('-', '_')} = '{b}'\n")
print('ok', salida)
