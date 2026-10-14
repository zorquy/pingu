# Uso: python3 preparar-plantilla-decklist.py ORIGINAL.pdf assets/decklist/play-pokemon-decklist-a4.pdf
# (pypdf y qpdf). Después, volver a medir las casillas y tablas con pdfplumber
# si TPCi ha cambiado el diseño, y pasar test-tanda-834.mjs.
#
# Prepara la plantilla oficial de decklist para que la web la rellene sin
# librerías (tanda 834): quita el equipaje de InDesign (metadatos XMP,
# PieceInfo, árbol de estructura: 3,2 MB → ~150 KB, idéntica al pintarla),
# añade la fuente estándar que usa el texto (Helvetica, que todo lector de PDF
# trae y no se incrusta) y deja la página con
#   /Contents [ «q»  original  «Q»  HUECO ]
# donde HUECO es un flujo vacío que la web SUSTITUYE con una actualización
# incremental (añadir al final del fichero una versión nueva de ese objeto).
import sys, subprocess, re
import pypdf
from pypdf.generic import (DictionaryObject, ArrayObject, IndirectObject, NameObject,
                           StreamObject, DecodedStreamObject)
origen, destino = sys.argv[1], sys.argv[2]
r = pypdf.PdfReader(origen)
w = pypdf.PdfWriter()
p = w.add_page(r.pages[0])
visto = set()
def limpiar(o):
    if isinstance(o, IndirectObject):
        if o.idnum in visto: return
        visto.add(o.idnum)
        o = o.get_object()
    if isinstance(o, DictionaryObject):
        for k in ['/Metadata', '/PieceInfo', '/StructParents', '/StructParent', '/ArtBox', '/BleedBox', '/TrimBox', '/LastModified']:
            if k in o: del o[k]
        for k, v in list(o.items()):
            if k == '/Parent': continue
            limpiar(v)
    elif isinstance(o, ArrayObject):
        for v in o: limpiar(v)
limpiar(p)
p.compress_content_streams(level=9)
def flujo(texto):
    s = DecodedStreamObject()
    s.set_data(texto.encode('latin-1'))
    return w._add_object(s)
q, Q, hueco = flujo('q\n'), flujo('\nQ\n'), flujo('% PokeDoc: aqui va el texto\n')
original = p.get('/Contents')
if not isinstance(original, IndirectObject):
    original = w._add_object(p['/Contents'].get_object())
p[NameObject('/Contents')] = ArrayObject([q, original, Q, hueco])
res = p['/Resources']
fuentes = res['/Font']
if isinstance(fuentes, IndirectObject): fuentes = fuentes.get_object()
def fuente(base, enc=True):
    d = DictionaryObject({NameObject('/Type'): NameObject('/Font'), NameObject('/Subtype'): NameObject('/Type1'),
                          NameObject('/BaseFont'): NameObject(base)})
    if enc: d[NameObject('/Encoding')] = NameObject('/WinAnsiEncoding')
    return w._add_object(d)
fuentes[NameObject('/PDH')] = fuente('/Helvetica')
w.compress_identical_objects(remove_identicals=False, remove_orphans=True)
with open(destino + '.tmp', 'wb') as f: w.write(f)
subprocess.run(['qpdf', '--object-streams=disable', '--compress-streams=y', '--recompress-flate',
                '--compression-level=9', '--deterministic-id', destino + '.tmp', destino], check=True)
d = open(destino, 'rb').read()
# El objeto HUECO: el cuarto de /Contents de la página.
pag = re.search(rb'/Contents \[ (\d+) 0 R (\d+) 0 R (\d+) 0 R (\d+) 0 R \]', d)
print('contenidos', pag.groups() if pag else None, 'tamano', len(d))
