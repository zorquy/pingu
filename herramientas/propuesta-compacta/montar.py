# Monta la propuesta: {{img:ID}} → img/ID.jpg (de prop/ID.png) en el scratchpad.
import re, os, sys
from PIL import Image
AQUI = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[1]
os.makedirs(f'{OUT}/img', exist_ok=True)
src = open(f'{AQUI}/compacta.src.html', encoding='utf8').read()
n = 0
def jpg(idn):
    global n
    out = f'{OUT}/img/{idn}.jpg'
    im = Image.open(f'{AQUI}/prop/{idn}.png').convert('RGB')
    w, h = im.size
    ancho = 560 if 'movil' in idn else 1280
    im.resize((ancho, int(h * ancho / w)), Image.LANCZOS).save(out, 'JPEG', quality=76, optimize=True, progressive=True)
    n += 1
    return f'img/{idn}.jpg'
html = re.sub(r'\{\{img:([\w-]+)\}\}', lambda m: jpg(m.group(1)), src)
open(f'{OUT}/compacta.html', 'w', encoding='utf8').write(html)
print(n, 'imágenes,', sum(os.path.getsize(f'{OUT}/img/{f}') for f in os.listdir(f'{OUT}/img')) // 1024, 'KB')
