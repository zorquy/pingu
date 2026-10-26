# Monta el artifact: sustituye {{img:ID}} por img/ID.jpg (convertido de prop/ o antes/)
# y escribe files.json con el mapa de ficheros para publicar.
import re, json, os, sys
from PIL import Image
AQUI = os.path.dirname(os.path.abspath(__file__))
src = open(f'{AQUI}/propuesta-app.src.html', encoding='utf8').read()
os.makedirs(f'{AQUI}/img', exist_ok=True)
files = {}
def jpg(idn):
    out = f'{AQUI}/img/{idn}.jpg'
    if not os.path.exists(out):
        for cand in (f'{AQUI}/prop/{idn}.png', f'{AQUI}/antes/movil/{idn.removeprefix("antes-m-")}.png', f'{AQUI}/antes/pc/{idn.removeprefix("antes-pc-")}.png'):
            if os.path.exists(cand): break
        else:
            print('FALTA', idn); return None
        im = Image.open(cand).convert('RGB')
        w, h = im.size
        if 'movil' in idn or idn.startswith('antes-m-'):
            if h > 2000: im = im.crop((0, 0, w, 2000)); h = 2000  # las de página entera, solo lo de arriba
            im = im.resize((640, int(h * 640 / w)), Image.LANCZOS)
        else:
            if h > 1800: im = im.crop((0, 0, w, 1800)); h = 1800
            im = im.resize((1280, int(h * 1280 / w)), Image.LANCZOS)
        im.save(out, 'JPEG', quality=74, optimize=True, progressive=True)
    files[f'img/{idn}.jpg'] = out
    return f'img/{idn}.jpg'
html = re.sub(r'\{\{img:([\w-]+)\}\}', lambda m: jpg(m.group(1)) or '', src)
open(f'{AQUI}/propuesta-app.html', 'w', encoding='utf8').write(html)
json.dump(files, open(f'{AQUI}/files.json', 'w'), indent=0)
print(len(files), 'imágenes;', sum(os.path.getsize(v) for v in files.values()) // 1024, 'KB;', len(html.encode()) // 1024, 'KB de html')
