# DESIGN.md — cómo se ve PokeDoc

La paleta y la letra de siempre, y las reglas que evitan que la web parezca
hecha con plantilla. Lo que está aquí manda sobre el gusto de quien escribe
una hoja nueva; lo que no está aquí, se pregunta. (Propuesta de noviembre de
2026, a partir de la skill de gusto, la guía de interfaz de Vercel y los
DESIGN.md de awesome-design-md.)

## Identidad (no se toca)

- **Fondo oscuro azul marino** (`--bg: #0b1219`, superficie `--white: #1a2733`)
  y el claro equivalente (`#f6f8fa` / `#ffffff`). Los tokens viven en
  `css/style.css`, en los dos temas; un color nuevo va en los dos con sus
  dos medidas de contraste (SCHEMA 1018).
- **El azul**: `--navy` (`#1e5175` claro, `#7cbae4` oscuro) para enlaces y lo
  activo; `--navy-solid` para fondos de color que llevan blanco encima
  (`--blanco-fijo`), que no se redefine en oscuro.
- **Cada sección tiene su color** (`--acento`, por `data-seccion` en `<html>`):
  Inicio marino, Aprender verde, Colección ámbar, Comunidad rosa, Jugar
  violeta. La barra de abajo, la burbuja, la lateral y `.btn-primary` lo
  llevan solos.
- **Semánticos**: `--success`, `--warning`, `--danger` (y sus `-bg`) para lo que
  sube, lo que avisa y lo que falla. Nunca para adornar.
- **Letra**: Outfit en títulos, marca y cifras (`--font-display`); Inter en el
  cuerpo, botones y chapas. Cifras con `tabular-nums` (va en `body`).
- **Formas**: bordes de 1 px (`--border`), radios de la escala (`--radius-*`),
  botones de tres clases (principal, suave, icono; tanda 917), espaciado y
  tamaños de la escala (`--e-*`, `--t-*`).
- **El móvil**: la barra de abajo fija y la burbuja de la sección. No se mueven.

## Reglas (lo que una hoja nueva no hace)

1. **Un degradado solo si dibuja algo**: una bandera, el relleno bajo una
   gráfica, el marco de redes, el dorso de una carta. Nunca de fondo de una
   tarjeta, un botón, una cabecera o un banner. Los seis `--arte-*` son
   colores planos.
2. **Nada translúcido ni desenfocado**: barras, burbuja y menús son opacos.
   Sin `backdrop-filter`. Sin halos (`filter: blur`) detrás de un logo o una
   carta.
3. **Una tarjeta se apoya en su borde**: sin `box-shadow` y sin saltar al pasar
   el ratón (nada de `translateY` en `:hover`; cambia el borde o el fondo). La
   sombra es solo para lo que FLOTA: pop-ups, menús, avisos, la burbuja.
4. **Los rótulos van en frase**: sin `text-transform: uppercase` ni
   `letter-spacing` positivo. Las únicas mayúsculas son las que SON mayúsculas
   (SV08, ME03, una placa de álbum).
5. **El icono va suelto**: nunca dentro de un cuadrado o círculo de color. Si
   un icono no añade nada al nombre (el foro «Competitivo»), no va.
6. **Las cifras son texto, no baldosas**: una tira dividida con rayas o una
   línea («2 das · 3 quieres»). Una tarjeta no lleva otra tarjeta dentro.
7. **El color va en el dato**: verde sube, rojo baja, ámbar avisa, el color de
   la sección en lo activo. No en el cromo (bandas de color en cabeceras de
   tarjeta, iconos de colores).
8. **Una acción principal por pantalla** (`.btn-primary`); lo demás, suave.
9. **Lo que se escribe**: «…» y no «...», comillas «así», `text-wrap: balance`
   en títulos, el foco visible con `--shadow-ring` (un `outline: none` lleva
   su anillo al lado).
10. **Lo que se pulsa mide 44 px** (tanda 312) y respeta «menos movimiento»
    (313).

## Dónde va cada cosa

- `css/style.css` y `css/components.css` los baja todo el mundo; lo de una
  pantalla va en su hoja (CLAUDE.md). La portada cabe en 170 KB gzip.
- Un bloque nuevo de una lista de cartas usa el molde `.mc-vistazo-ficha`
  (la carta, el dato, el cambio, el nombre); una lista de cifras,
  `.mc-cifras-linea`.
- Lo que vigila esto: `test-tanda-1181.mjs` (rama `pruebas`) cuenta en las
  hojas los degradados de fondo, los `backdrop-filter`, los `uppercase` y las
  sombras en tarjetas, y canta si suben.
