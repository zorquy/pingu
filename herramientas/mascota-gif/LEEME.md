# GIF de la mascota (tanda 1488)

Saca un GIF animado de un gesto de la mascota 3D de la web (el mismo modelo de
`js/mascota.js`), para los correos.

1. Copia `mascota-gif.html` a la raíz de la web de pruebas (la que sirve
   `herramientas/servir.py` en el 8892).
2. En una carpeta con `gifenc@1.0.3` y `pngjs@7.0.0` instalados:
   `node hacer.mjs <gesto> <salida.gif> <fondo> <segundos>`
   - gesto: saludar, entregar, bailar, pensar, contento… (los de `ANIM` en
     `js/mascota-modelo.js`);
   - fondo: un color (`#1e5175`, el de la cabecera del correo) o `none` para
     transparente (con halo sobre fondos oscuros: mejor el color del sitio).
3. 30 fotogramas a 12,5 por segundo, 240×280, unos 160 KB. En el correo va a
   150 de ancho. Menos de 250 KB (lo mira `test-tanda-1488.mjs`).
