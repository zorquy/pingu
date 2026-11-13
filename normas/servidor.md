# Servidor, base y costes — normas de PokeDoc

> Capítulo de CLAUDE.md (tanda 1333, I4): Funciones de Netlify, funciones programadas y sus frenos, Supabase y la RLS. Se lee ENTERO antes
> de tocar esta área. Una norma nueva de esta área va aquí; si vale para
> toda la web, en CLAUDE.md.

- **Una reescritura de Netlify NO le pasa la consulta a una función v2**
  (tanda 633). `/escaneo/:set/:n → /.netlify/functions/escaneo?set=:set&n=:n`
  llega a la función con la URL ORIGINAL (`/escaneo/TWM/151`, sin `?`), así
  que `searchParams.get('set')` era null y /escaneo y /sprite contestaban
  404 a TODO en producción — Hassel sin foto al exportar, sin un error en
  la web porque la cadena de respaldos se lo comía. Una función que va
  detrás de una reescritura lee la RUTA (y la consulta, para llamarla a
  pelo).
- **Un aviso que no PARA no es un aviso** (tanda 510, y es la colisión
  número DIEZ). Mi guion de empujar hacía `git fetch` + `git log
  HEAD..origin`, imprimía los commits del otro… y empujaba igual. O sea que
  la colisión me pilló con el aviso delante, escrito por mí, diciéndomelo.
  La norma de la casa dice «mira el remoto justo antes del push» y yo lo
  miraba: lo que faltaba era **salirse** si hay algo. Si una comprobación no
  puede impedir lo que comprueba, es decoración.
- **La RLS no da error: devuelve una lista VACÍA** (tanda 510). La tabla de
  estado del relleno nació con RLS y sin políticas, que para escribir está
  bien —la escribe una función con la clave de servicio, que se la salta—
  pero el navegador leía cero filas, así que el panel decía «todavía no ha
  corrido ninguna vez» de algo que llevaba toda la noche corriendo. Es la
  familia de siempre: un vacío que se lee como una respuesta cuando en
  realidad es «no tienes permiso». Al añadir una tabla que vaya a leer el
  panel, la política de SELECT va en la misma migración — y mientras no
  esté, lo que se enseña es «no se sabe», no «no hay».
- **Un freno que pregunta «¿queda trabajo?» no frena si parte del trabajo
  es IMPOSIBLE** (tanda 510, y es la tercera vez en una noche con la misma
  forma). `scrydex-logos` iba cada hora con un freno que preguntaba «¿queda
  algún set sin emparejar?» — y **siempre quedan**, porque las promos no las
  cuenta igual ningún catálogo, así que la respuesta es «sí» para siempre y
  el freno no corta nunca: 3 créditos × 24 × 30 = **2.160 al mes, de 5.000**,
  para no cambiar nada. Pasó lo mismo con el barrido de las cartas (ahí hizo
  falta un tope de barridos) y con la página que falla siempre (ahí, saltarla
  a la quinta). La regla: cuando el trabajo pendiente nunca llega a cero, el
  freno no puede ser «¿queda algo?» — tiene que ser **cuántas veces se ha
  intentado** o **cada cuánto se vuelve a mirar**.
- **Una función programada que vuelve a empezar es una FACTURA** (tanda
  509). El relleno de Scrydex barría el catálogo —101 páginas, 101
  créditos— y al acabar volvía a la página 1. Cada cinco minutos. Eso son
  **48 barridos en una noche = 4.848 créditos, con 5.000 al MES**: se
  habría comido el plan entero antes de que nadie se despertara, y encima
  reescribiendo lo mismo. Lo cacé releyendo lo que acababa de poner en
  producción, no probándolo. Y frenarlo pide DOS cosas, porque una sola no
  basta: preguntar antes si queda algo por hacer —a nuestra base, que es
  gratis— **y** un tope de barridos, porque hay cartas nuestras que su
  catálogo no tiene y «quedan pendientes» sería verdad para siempre. Antes
  de poner un `schedule`, multiplica: coste por pasada × pasadas al día ×
  30. Si el resultado no cabe en el presupuesto, el `schedule` está mal.
- **Una columna que la base RELLENA y ninguna consulta PIDE no existe para
  la web** (tanda 523). La 509 puso el inglés exacto de Scrydex en
  `rarity_en` y la 510 le dio un traductor que la prefiere y cae a
  `rarity`. Las dos bien, y el resultado CERO: ningún `select` del cliente
  la pedía, así que el respaldo se usaba siempre y la Rainbow seguía
  rotulada «Rara Híper» con el dato bueno guardado. **Una columna que no se
  pide llega `undefined`, y `undefined || otra` es una expresión
  perfectamente válida**: no hay error que mirar, hay una pantalla que dice
  lo de antes. Al añadir una columna, el paso que se olvida es el `select` —
  y son todos los `select`, que de la rareza había OCHO. Lo vigila
  `test-tanda-523.mjs`: cualquier lista de columnas que nombre `rarity`
  tiene que nombrar `rarity_en`.
- **Un UPSERT tiene que poder FORMAR la fila que insertaría, aunque vaya a
  ser un update** (tanda 526, y costó una noche entera a cero). PostgREST
  manda `insert … on conflict do update`, y Postgres comprueba los
  `not null` sobre la fila que propone ANTES de ver que ya existe. El
  relleno mandaba `id`, `market`, `set_id` y las columnas de Scrydex, y
  `tcg_cards` tiene `local_id` y `name` a `not null`: **23502, y la
  sentencia rechazada ENTERA**, las 250 cartas de la página, aunque las 250
  fueran updates. Las dos columnas se REPITEN con el valor que la fila ya
  tiene; no es que se quieran cambiar, es que sin ellas no hay fila. Y la
  guarda no se escribe a mano: las obligatorias **se leen de la migración**
  y se exigen en TODAS las sentencias que se mandan —la de los nombres se
  arma a mano dentro de la función y tenía el mismo agujero, así que una
  prueba que mirara solo el ayudante puro habría salido verde—.
- **SALTAR vale para el fallo del OTRO; para el tuyo, PARAR** (tanda 526, y
  es la 522 corregida). Saltarse la página a la quinta es lo correcto cuando
  la mala es LA PÁGINA —un 500 suyo, un id raro—: el problema se queda
  atrás. Si el que falla es NUESTRO Supabase, la página no tiene nada que
  ver, y saltarla es pagar un crédito por página para no escribir nada:
  cinco intentos × 101 páginas = **505 créditos por un barrido en blanco**,
  con el panel enseñando «página 42» como si fuera progreso. Lo nuestro
  queda `parado` en el estado y la pasada siguiente **se sale antes de
  pedirle nada a la API de pago**. Y lo quita un humano: si se quitara solo,
  volvería a gastar sin que nadie haya mirado por qué fallaba.
- **Cuando una pasada GASTA antes de poder fallar, todo lo que venga
  después cuenta como intento** (tanda 522, y es la cuarta vez esta noche que
  un freno frena solo la mitad). `scrydex-relleno` pedía la página a Scrydex
  —crédito gastado— y luego preguntaba a nuestra base. El salto a la quinta
  página fallida existía, pero solo contaba los fallos SUYOS: si el que
  fallaba era nuestro Supabase, el error se escapaba de la función, la página
  no avanzaba y a los cinco minutos otra vez — **288 créditos al día sin
  escribir una carta**. El cuerpo entero va en `try/catch` y los dos lados
  pasan por el mismo `tropiezo()`. Antes de poner un freno, mira **dónde se
  paga** y cuenta desde ahí.
- **Un error que vuelve como RESPUESTA de una función programada no lo
  lee nadie** (tanda 655). `tcggo-catalogo` creaba el set japonés, la
  escritura de sus cartas fallaba, y el error volvía en el JSON de la
  función —a los registros de Netlify— sin apuntarse en el estado: en la
  web, «0 de 102» y dentro nada, durante días. Lo que falla en una
  función programada va al ESTADO (`fallidos`, `vacios`, `ultimoError`)
  y /admin lo enseña («Estado del catálogo de TCGGO»); y una expansión
  que no se deja escribir se salta a la tercera, no se pide cada cinco
  minutos para siempre.
- **Un aviso que se dispara se APAGA antes de avisar** (tanda 665).
  `avisos-precio` marca el aviso como disparado y DESPUÉS escribe la
  notificación y el correo: si lo de después falla, se pierde un aviso;
  al revés, la pasada siguiente lo repetiría cada hora. Es la forma de la
  522 (contar desde donde se paga) aplicada a un envío. Y los avisos
  viven en `user_price_alerts` (migración `avisos-precio`); la
  notificación es `user_notifications` tipo `aviso_precio`, que
  `enviar-push` ya empuja sola.
