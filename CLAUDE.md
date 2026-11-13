# PokeDoc — normas de la casa para Claude

Este repo lo trabajan DOS sesiones de Claude a la vez: la de **PINGU**
(zorquy) y la de **IBAI** (ibaimanso). Para no pisarse, lo primero que
haces en cada sesión y lo último antes de cada push está en un solo
sitio:

## La bitácora (OBLIGATORIO)

1. **Antes de tocar nada**: `git pull` y lee `BITACORA.md` — la entrada
   de arriba es lo último que hizo el otro. Ahí está qué ficheros tocó
   y qué dejó a medias.
2. **En cada commit de una tanda**: añade TU entrada ARRIBA de la
   bitácora con el formato que ya verás dentro (fecha, quién, qué,
   ficheros, qué queda pendiente). Los pushes van JUNTOS (ver «Los pushes
   se juntan», abajo), así que un push lleva las entradas de todas sus
   tandas. Un push sin entrada en la bitácora es un push a ciegas para el
   otro.
3. **Si vas a tocar un fichero que la última entrada del otro marca
   como «en curso»**, no lo toques: pregunta a tu humano primero.

## Cómo se le proponen cosas a PINGU

**Una propuesta va SIEMPRE con imágenes** (PINGU, 2026-10-18: «siempre que
te pida propuestas hazmelo con imágenes»): un artifact con las pantallas
dibujadas (maquetas de móvil y de PC con los colores de `css/style.css`),
las decisiones que se le piden y lo que entra en la tanda. Nunca solo
texto, por rápida que sea la propuesta.

## Qué es esta web

PokeDoc (pokedoc.es): comunidad española de Pokémon TCG. Guías, cursos
jugables, reto diario con liga y rachas, foro completo, perfiles y
ahora **torneos** (portados de TrainerArena, de Ibai — ver la sección
«Jugar»). Todo el detalle técnico por tanda vive en `SCHEMA.md`.

## Los capítulos (tanda 1333, I4: LÉELOS al tocar su área)

Este fichero lleva lo que vale SIEMPRE. Lo de cada área vive en `normas/`,
y **antes de tocar un área se lee su capítulo ENTERO** (cada punto cuenta
un fallo que ya pasó). Si una tarea toca dos áreas, los dos. Una norma nueva
va en el capítulo de su área, o aquí si vale para toda la web; nunca en los
dos sitios. Ni `normas/` ni este fichero se sirven en la web (`/*.md` va en
las rutas internas de `netlify/edge-functions/internos.js`).

| Capítulo | Qué hay dentro |
|---|---|
| [`normas/tiendas.md`](normas/tiendas.md) | Las cuentas de tienda: panel, stock, ventas, escaparate, ofertas, mostrador, SKU, cambios y lotes. |
| [`normas/catalogo.md`](normas/catalogo.md) | Cartas, sets, eras, versiones, idiomas, TCGGO, TCGdex, Scrydex, Cardmarket, el japonés y las pasadas que lo llenan. |
| [`normas/coleccion.md`](normas/coleccion.md) | Mi colección y /cartas, la ficha de una carta, el buscador, deseos, álbumes, el Panel, modo evento y los tratos entre personas. |
| [`normas/comunidad.md`](normas/comunidad.md) | Portada, foro, mensajes, perfil, avisos, retos, redes, eventos, guías y noticias, logros, analítica, /admin y las fiestas. |
| [`normas/jugar.md`](normas/jugar.md) | Torneos (el porte de TrainerArena), Mis partidas, mazos, el motor y el laboratorio. |
| [`normas/interfaz.md`](normas/interfaz.md) | CSS y sus escalas, el móvil, botones, pop-ups, barras generadas, service worker, accesibilidad y SEO. |
| [`normas/servidor.md`](normas/servidor.md) | Funciones de Netlify, funciones programadas y sus frenos, Supabase y la RLS. |
| [`normas/pruebas.md`](normas/pruebas.md) | La rama `pruebas`, la suite, el doble de Supabase, el rigor y sus trampas. |

Y el esquema de la base de HOY, para leer cómo es una tabla sin recorrer las
migraciones: `supabase-esquema-actual.sql` (generado; lo que manda siguen
siendo las migraciones).

## Stack y reglas técnicas (NO negociables)

- **Vanilla**: HTML + CSS + JavaScript (módulos ES) SIN build step, SIN
  frameworks, SIN dependencias nuevas de npm para el cliente. Nada de
  TypeScript en este repo: si portas código TS, tradúcelo a JS plano.
- **Supabase** (proyecto zqamujmfavwrsqlgbead): la clave pública anon
  vive en `js/supabase.js` y es la única que puede aparecer en el repo.
  **NUNCA toques la base real directamente**: todo cambio de esquema o
  datos se entrega como fichero `supabase-migration-*.sql` en la raíz,
  y un humano lo ejecuta en el SQL Editor. **Y en el SQL Editor cada sentencia puede
  ir por su lado** (tanda 631): una tabla TEMPORAL creada en una sentencia
  no existe en la siguiente («relation "tipos_629" does not exist»), y con
  `\i` en psql —la prueba— sí. Nada de tablas temporales entre sentencias:
  la lista va en un `(values …)` dentro de cada una, o todo en un `do`.
  Lo vigila `test-tanda-631.mjs`, que ejecuta la migración sentencia a
  sentencia, cada una en su conexión.
- **Netlify** despliega la rama `claude/react-native-web-migration-wl51z5`
  DIRECTAMENTE a producción. Cada push sale en vivo en minutos: no
  subas nada roto. Las funciones de servidor van en `netlify/functions/`
  (patrón inyectable, mira las que hay).
- **Los pushes se JUNTAN** (PINGU, 2026-11-09, con la factura delante):
  cada despliegue a producción cuesta 15 créditos de Netlify, y en un
  periodo se fueron 3.240 de 4.910 en 216 despliegues (el plan trae 3.000 y
  lo que pasa se paga aparte). Además, tras cada despliegue la web guardada
  en el móvil de cada visitante vuelve a preguntar por sus ficheros, y eso
  suma peticiones. Así que:
  - Cada tanda va en su COMMIT (con su entrada de bitácora, SCHEMA y
    novedades), pero no se sube sola: se sube junto con las demás.
  - Se sube SOLO cuando PINGU lo pide («sube», «quiero probarlo») — y
    aun así, como mucho unas DOS veces al día, juntando lo pendiente. «Dos
    al día» es un TOPE, no un permiso: «¿puedes corregir esto?» no es
    «sube» (2026-11-11, la 1284 se subió sin pedirla y PINGU lo paró: «aquí
    no hacemos pushes si no se dice»). Al acabar, se dice que está lista y
    se espera. La excepción es antes de que se acabe una sesión, que el
    contenedor se recicla tras un rato sin uso y se lleva los commits sin
    subir: entonces se AVISA a PINGU de que hay commits esperando.
  - Un ARREGLO URGENTE (algo roto en producción, datos que se pierden, un
    agujero de seguridad) se sube al momento, solo o con lo pendiente si
    eso ya está probado.
  - Una tanda con migración se sube cuando PINGU la vaya a ejecutar: la
    web no puede pedir una columna antes que su migración (la 624).
  - La rama `pruebas` no la despliega Netlify: subirla no cuesta nada y
    se sube cuando se quiera.
  - Antes del push, lo de siempre: `git fetch` y PARAR si el otro subió
    algo. Con varios commits esperando es más probable: se hace
    `git pull --rebase`, se deja la bitácora con lo más nuevo arriba, se
    vuelve a pasar `test-imports.mjs` y `comprobar-arbol.sh`, y entonces
    se sube.
  - Al acabar una tanda que no se sube aún, se le dice a PINGU que está
    lista y que sale en el próximo push, y qué queda pendiente de subir.
- **Presupuesto de peso**: la portada (index.html + su grafo de JS +
  CSS) debe caber en 170 KB gzip. **A 2026-10-14 (835) van 149,2 y quedan
  20,8** (la 835 metió 1,3 con los logros de los retos en `gamification.js`; a la 796 eran 147,9; de la 786 a la 796, 1,9 más; a la 785 eran 146,0: la 784 metió la píldora y los efectos, la 785 el escaparate; la 782 puso la cabecera común; la 781 metió el «Ver todo» y el vacío con abanico); la 780 mudó a SCHEMA los comentarios largos de `style.css`,
  `components.css`, `portada.css` e `index.html` (eran 65 de los 169 KB). Antes, a 2026-10-07 (753), 169,2 y quedaba
  0,8 (la 753 escribió la barra de abajo del móvil en el HTML y su sitio en
  `style.css`; antes, 168,4): la hoja «Tú» se fue a `js/menu-tu.js` + `css/menu-tu.css`, que
  entran al tocar el avatar, y luego volvieron dos décimas para que la
  lateral y «Hoy» tengan su sitio desde el primer pintado. Antes de la 748 iban 169,7
  (medido con `pesar-portada.mjs`; la 718 sacó de `components.css` el
  desplegable viejo de la lupa y bajó a 169,5, la 723 y la 734 se
  comieron tres décimas y la 736 las devolvió sacando el pintado de la
  campana a un `import()`: `notifications.js` lo baja la portada por
  `guide-rating.js`, así que lo que se pinta AL ABRIRLA no va ahí; la 737
  puso el anillo de foco a los campos, y la 744 la línea que llama a la
  portada «Hoy», que entra por `import()`). O sea: TRESCIENTOS BYTES. Una tanda que meta algo de verdad en la portada no cabe —tiene
  que empezar por hacer sitio—. Historia: el pie de
  la tanda 312 está en las 22 páginas y suma, la 313 sacó el editor de
  texto rico a `css/editor-texto.css` para hacer sitio, y la 319 le metió
  a la portada la consulta del progreso. El candidato para hacer sitio es
  `components.css` (26 KB gzip, el mayor de los que baja todo el mundo). Antes de meter nada más en la portada, haz sitio —
  `pesar-portada.mjs` dice quién ocupa qué— y el camino es siempre el
  mismo: lo que solo usa una pantalla, a su hoja. `components.css` y `js/app.js` los
  baja TODO el mundo — el CSS o JS de una sola página va en su propio
  fichero (mira css/lanzamientos.css o css/curso.css como ejemplo).
- **Un export que no existe no rompe una función: rompe LA PÁGINA** (tanda
  510). Añadí `rarezaDeCarta` a la lista de importación de `js/carta.js`
  dando por hecho que venía de `carta-traducciones.js` —que es de donde la
  coge `mi-coleccion.js`—, pero carta.js la pide por `carta-nucleo.js`, que
  no la reexportaba. Eso es un `SyntaxError` AL RESOLVER EL MÓDULO, así que
  /carta se quedó **sin una sola línea de JavaScript** y estuvo así en
  producción hora y media. Lo cazó la suite completa con seis rojos, todos
  el mismo error — y es otra vez la lección de la 447: había corrido las
  pruebas de rarezas y de /mi-coleccion, que son «las que tocaban», y
  /carta no estaba entre ellas. Desde ahora lo caza `test-imports.mjs` en
  un segundo y sin navegador: recorre los 249 módulos del repo y comprueba
  que cada una de las ~1.600 importaciones con nombre apunta a algo que de
  verdad se exporta. **Correrla antes de cada push cuesta un segundo y se
  come esta familia entera de fallos.**
- **Un REEXPORT no es un IMPORT** (tanda 624). `export { normalizeSearch }
  from './texto.js'` deja que otros la importen de `js/tcgdex.js`, pero NO
  crea el nombre dentro de ese fichero — y `searchCards` la llamaba. Desde la
  447, cada búsqueda era un `ReferenceError` que el `try` de quien llama
  convertía en «no hay resultados»: el buscador de cartas del editor y el
  del selector de mazo llevaban semanas mudos. Si un fichero reexporta algo
  y además lo usa, lo IMPORTA también. `test-imports.mjs` lo vigila.
- **Un `select` del cliente que pide una columna NUEVA no se empuja antes
  que la migración que la crea** (tanda 624, por la 640). Una función de
  servidor puede «saltarse diciéndolo»; una consulta de la web que nombra
  una columna inexistente falla ENTERA (42703), y con ella el buscador del
  constructor, /mi-coleccion o las listas de torneos. O la migración va
  primero, o la columna no se pide hasta que exista.
- **Cada cambio que se NOTA lleva su línea en `novedades.json`** (tanda
  829, /novedades). PINGU llevaba el registro de cambios a mano en un hilo
  del foro; ahora lo escribe quien sube el cambio, en el mismo push que la
  bitácora. Una frase para quien usa la web —nada técnico: ni tandas ni
  nombres de función—, su tipo (`nuevo`, `mejora`, `arreglo`) y, si se
  puede, un `enlace` a donde probarlo (que exista: lo comprueba
  `test-tanda-829-pantalla.mjs`). Lo interno que nadie nota no va. Y cada
  mes, tres `destacadas` con su `pokemon` (1217: son portadas con el Pokémon; sin número, uno elegido por el título) —las
  elige quien escribe; si PINGU prefiere otras, se cambian—. La bitácora
  sigue siendo para nosotros; esto es para la gente.
- **Lo común se ve en /admin → Guía de estilo** (tanda 1326b,
  `admin/js/guia-estilo.js`): los tokens salen solos del `:root` de style.css
  y cada pieza la pinta su función. Una pieza común nueva (chapa, molde,
  botón) entra en `APARTADOS` con su «dónde»; antes de inventar una, mira ahí.
- **Iconos SVG de js/icons.js, nunca emojis sueltos en la interfaz**
  (única excepción deliberada: la banderita 🇪🇸).
- Comentarios del código en español, contando el porqué, no el qué.
- Textos de la web en español, tono cercano («tú»).
