# Hoja de contactos: N capturas en fila, con su nombre encima.
import sys
from PIL import Image, ImageDraw, ImageFont
salida, *rutas = sys.argv[1:]
ims = [Image.open(r).convert('RGB') for r in rutas]
w = 390; h = int(ims[0].height * w / ims[0].width)
hoja = Image.new('RGB', (len(ims) * (w + 12), h + 30), (40, 40, 40))
d = ImageDraw.Draw(hoja)
for i, (im, r) in enumerate(zip(ims, rutas)):
    hoja.paste(im.resize((w, h)), (i * (w + 12), 30))
    d.text((i * (w + 12) + 6, 8), r.split('/')[-1], fill=(255, 255, 0))
hoja.save(salida)
