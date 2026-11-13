# Tiendas — normas de PokeDoc

> Capítulo de CLAUDE.md (tanda 1333, I4): Las cuentas de tienda: panel, stock, ventas, escaparate, ofertas, mostrador, SKU, cambios y lotes. Se lee ENTERO antes
> de tocar esta área. Una norma nueva de esta área va aquí; si vale para
> toda la web, en CLAUDE.md.

- **Una tienda es una CUENTA de tipo «tienda», y solo entra por invitación**
  (tanda 1067, PINGU: «no quiero que cambie el login de ahora»): pide en
  `/para-tiendas` (1244), el equipo acepta en /admin → Tiendas (`tienda-decidir` manda el
  correo) y el alta es `/alta-tienda?i=` con el email de la invitación. El
  tipo lo pone la base (`tienda_alta`) y no se lo cambia nadie a sí mismo
  (`trg_tienda_guarda_tipo`). Lo que sea de tiendas va en su página y su
  hoja (`/tienda`, `css/tienda.css`) y lo puro en `js/tiendas-puro.js`; el
  stock NO va en `user_collection`: es `tienda_stock` (1068), y lo que lo
  liste, filtre o sume pasa por `tienda_stock_lista` (en la base, con
  `valor_de_copia` para Cardmarket). Un filtro nuevo del stock va en
  `tienda_cumple` y en el panel lateral a la vez. Lo que ve la gente (1069)
  sale de `tienda_escaparate` (nunca el coste ni dónde está; el precio solo
  con `precio_visible`): el perfil de una tienda es su escaparate
  (`js/perfil-tienda.js`, sin las pestañas de una persona), y una tienda en
  otra pantalla pasa por `js/en-tiendas.js` o por `mercado_con_tiendas`. La
  `user_collection` de una tienda no entra en el Mercado. Una cuenta de
  tienda SOLO tiene su panel (1071, PINGU: «que no pueda acceder a todo lo
  demás»): `js/tienda-puertas.js` dice qué abre y lo demás vuelve a
  `/tienda`; sus barras son las de siempre con sus secciones
  (`js/tienda-marco.js`). Una página nueva que deba abrir una tienda va en
  `SUYAS`, y una sección nueva de su panel, en `SECCIONES_DE_TIENDA`. Las
  ventas (1072) pasan por `tienda_vender` (todo o nada, con el coste de ese
  momento) y el Panel (1073, «Hoy» hasta la 1074) sale de `tienda_hoy`, con
  los avisos contados con los umbrales de `tienda_cumple`. Su Colección
  (1075) es /cartas en modo tienda: las líneas salen de `tienda_stock` por la
  capa de `js/mi-coleccion/datos.js` (`usarStockDeTienda`, con la forma de
  una copia), así que lo que añada cartas desde esa pantalla va al stock sin
  saberlo; lo de una persona se esconde bajo `body[data-tienda]`. Una tienda
  no necesita local (1074, PINGU: «un particular que se dedica a la
  compraventa»): solo el nombre es obligatorio, y el Instagram va en su
  columna como USUARIO (`instagramDe` / `tienda_instagram`), aparte de la
  web. Cardmarket y los pagos, aparcados. El precio que CUENTA es el de la
  oferta mientras dure (1082): `tienda_precio_de` en la base y
  `precioQueCuenta` en la web, la misma regla; lo que enseñe o cobre un precio
  de tienda pasa por ahí. Las destacadas son ocho como mucho (lo pone la base,
  1079). «Me interesa» (1080) es un adjunto `tipo: 'carta'` de un mensaje: lo
  escribe quien lo manda, así que la foto sale del catálogo y Vender busca la
  línea en el stock de la tienda, nunca se fía del adjunto. Las tiendas son
  una página de Comunidad (1242, PINGU): Foro · Eventos · Tiendas · Gente en
  las barras de cada HTML, y una página recién llegada a una sección lleva
  «Nuevo» unas semanas por `js/paginas-nuevas.js` (`NUEVA_HASTA`), no con
  texto en el enlace: la burbuja y la lateral leen su `textContent`. Y una tienda se
  reconoce por su nombre (1243): es el rango `tienda` de `js/rangos.js` (verde
  azulado, `--rango-tienda`) con su icono por `data-nombre-tienda` (style.css),
  y su escaparate vive en `/tiendas/<usuario>` (`profileUrl`; meta-social manda
  ahí con un 301 desde `/usuario/`). Un enlace nuevo a una tienda pasa por
  `profileUrl` o `enlaceDeTienda`, nunca un `/usuario/` escrito a mano; y una
  pantalla que solo pinta tiendas pone `ATRIBUTOS_DE_TIENDA` en el nombre. /tiendas es
  el escaparate de escaparates (1244): tarjetas de `tiendas_agenda` con sus
  destacadas y su horario («Abierta ahora» por `estadoDeHorario`, que calla lo
  que no entiende), «Recién llegado» de `tiendas_recien`; pedir acceso es
  `/para-tiendas` (el pie lleva ahí), nunca otra vez debajo de la agenda. Y el recibo (1084)
  no lleva NUNCA el coste ni el beneficio: es para quien compra. «Avisar a los
  que la buscan» (1089) pasa por `tienda_avisar`: uno por persona, carta y
  tienda (`tienda_avisos`, sin políticas: la tienda solo ve CUÁNTOS, por
  `tienda_avisos_de`), y cada uno lo apaga con el tipo `tienda_la_tiene`. Las
  compras a un cliente (1091) pasan por `tienda_comprar`: cada línea entra al
  stock como línea NUEVA con lo que se pagó de coste (y queda en
  `tienda_compras`); Cardmarket ahí es solo orientativo (PINGU), nunca el precio. Apartar
  (1092) SACA las unidades del stock mientras dure (`tienda_apartar`), así que
  escaparate, Mercado y Vender no las ofrecen sin tocarlos; recoger es una venta
  (`tienda_reserva_recoger`) y lo caducado vuelve con `tienda_reservas_al_dia`,
  que llaman el panel y el escaparate al abrirse. En la web se llama
  «Reservar» (1249); por dentro sigue siendo `apartar`.
  Una carta de una tienda se abre en SU pop-up (1249, PINGU: «debería abrirte
  la tienda en general… con el pop-up de esa carta»): `js/tienda-carta.js`
  sobre el escaparate entero, con `?carta=<id>&linea=<stock>`
  (`enlaceDeTienda`); nunca otra vez «solo esa carta» ni la ficha de la
  colección con «Añadir». Un enlace nuevo a una carta de una tienda pasa por
  `enlaceDeTienda` con la carta (y la línea si la sabe). Su SKU es
  `skuDe` (`tiendas-puro.js`, general: el mismo en todas las tiendas). Y el
  estado de una copia se PINTA con `chapaDeEstadoHtml` (`js/estado-chapa.js`,
  los colores de Cardmarket, en toda la web), nunca la sigla suelta; y su
  idioma, con la bandera y la sigla (`banderaHtml`, 1263), cargando
  `css/cardmarket.css` en la página, que es donde están las banderas.
  Comprarle a una tienda es una OFERTA (1250): `tienda_oferta_enviar` /
  `_responder` / `_paso` (aceptar RESERVA 7 días; «hecha» es la venta con
  `donde = 'pokedoc'`), y se sigue en Mensajes con la tarjeta de
  `js/mensajes-oferta.js` y en la pestaña Ofertas del panel
  (`js/tienda-ofertas.js`), con los mismos botones. Cómo cobra una tienda
  (Bizum, PayPal) va en `tienda_cobros`, que es privada; nunca en `tiendas`,
  que la lee cualquiera. Un paso nuevo de una oferta deja su mensaje por
  `tienda_oferta_avisar` y su frase en `puntoDeOferta` / `textoDePaso`.
  El Panel de una tienda (1252) es una CARTERA como la de Mi colección (lo
  vendido en grande en `.tdh-vendido`, periodos, gráfica y cuatro cifras) y
  debajo lo que espera en PASTILLAS (`.tdh-pendientes`): lo que le toca a la
  tienda (ofertas, fotos pedidas) va delante con `.tdh-pill-toca`; un pendiente
  nuevo es una pastilla más en `pintarPendientes`, no otra tarjeta.
  El SKU (1253) es GENERAL y la regla está dos veces, la misma: `skuDe` en la
  web y `tienda_sku` en la base (`test-tanda-1253` las compara): si cambia una,
  cambia la otra. Se busca con `tienda_sku_buscar`; un SKU y un Intro (un
  lector USB) en la lupa del Stock o en Vender va por ahí (`pareceSku`). El QR
  de una etiqueta es `enlaceDeSku` → `/s/<tienda>/<SKU>`: escaparate con el
  pop-up, o su línea si escanea la tienda. Las barras son `js/codigo-barras.js`
  (Code 128, módulo de píxeles enteros): no metas otra librería de barras.
  El MOSTRADOR (1254–1256, PINGU: «que sea algo que se despliegue y que mole»)
  es el botón del centro del móvil (`MOSTRADOR` en `js/tienda-marco.js`) y
  abre el abanico de `js/tienda-mostrador.js` (Comprar, Vender, Escanear, Caja
  de hoy); en el PC, Comprar | Vender arriba. Comprar, Vender y la caja son
  hojas que se abren en cualquier página de la tienda sin navegar
  (`data-ver` de mostrador, comprar, vender o caja); al vender o comprar la
  hoja se queda abierta para el siguiente. Vender: «Vendido por» VACÍO es su
  precio (`precioCobrado`), nunca cero, y cómo te pagan va en `p_pago`
  (`PAGOS_VENTA`); la base apunta el `precio_lista`. Comprar busca en
  occidental, japonés y sellado a la vez, y lo comprado entra POR PONER A LA
  VENTA (`por_poner`, oculto y sin precio; «Vale» es `valorado`, el precio de
  partida): se publica por `tienda_poner_a_la_venta` (`js/tienda-por-poner.js`),
  y lo que liste stock PARA VENDER quita lo que está por poner. La caja del día
  es `cuentaDeCaja` (`js/tienda-caja.js`). Una forma de pago nueva va en
  `PAGOS_VENTA`/`PAGOS_COMPRA` y en el `check` de la base a la vez.
  El CAMBIO (1266: cartas por cartas y la diferencia en dinero) es la hoja de
  Comprar en `modo = 'cambio'` («Te da», con «Cuenta» a su tanto por ciento)
  más «Le das» (`js/tienda-cambio.js`, el buscador de Vender);
  la cuenta es `cuentaDeCambio` y se cierra por `tienda_cambio`, que es una
  venta y una compra marcadas con el pago «cambio» (en los `check`, no en las
  listas de la web: no se elige a mano) y la diferencia en `tienda_cambios`.
  Medio cambio no se deshace solo (`tienda_deshacer_cambio`), y lo que sume
  dinero de la caja pasa los cambios a `cuentaDeCaja`.
  El tanto por ciento de Comprar y Cambio es LIBRE (1277, PINGU: «hay algunos
  que venden al 85, otros al 90»): «− N % +» de 5 en 5 y escrito (`pctHtml`,
  `pctConPaso`, `pctDeCampo`, entero de 0 a 200); no vuelvas a poner chips
  fijos. Un LOTE (1277, la opción A) es una línea de la compra sin carta
  (`tienda_compras.lote_id` + `tienda_lotes`): lo que vale, el %, cuántas y
  una foto en `tienda-fotos/<tienda>/lotes/`; no entra al stock hasta que se
  desglosa (`tienda_lote_desglosar`: sus cartas en la MISMA compra, con el
  coste repartido por `tienda_repartir`, que es `repartirTotal`: si cambia uno,
  cambia el otro, y `test-tanda-1277` los compara). Desglosar es la hoja de
  Comprar en `modo = 'lote'`, y la pastilla «N lotes por desglosar» del Panel
  abre `js/tienda-lotes.js` (`data-ver="lotes"`).
  «Pedir fotos» (1251) es `tienda_pedir_fotos`, y quien las pidió (o tiene
  una oferta por esa copia) las ve aunque esté reservada u oculta
  (`tienda_foto_se_ve`, 1264); al subirlas avisa el
  DISPARADOR de `tienda_stock_fotos` (`trg_tienda_fotos_subidas`), así que un
  camino nuevo para subir fotos de una copia no tiene que avisar a mano.
  Una tienda DE PRUEBAS (`tiendas.de_pruebas`, 1245, PINGU: «un perfil como
  fantasma de pruebas») solo se ve a sí misma: una función nueva que enseñe
  tiendas o su stock a la gente pone `public.tienda_publica(tienda)` al lado de
  `s.visible` (con `coalesce` dentro: sin cuenta, un NULL en un `if` dejaba
  pasar), y una lista que lea `user_profiles` a pelo la quita con
  `quitarFantasmas` / `sinFantasmas` (`js/tiendas-fantasma.js`). Se marca en
  /admin → Tiendas. Y las tarjetas de /tiendas miden todas lo mismo (1245): lo
  que se añada a una va en una fila de alto fijo, con su hueco si falta. Y
  dicen poco (1248, PINGU: «no es necesario enseñar tanta información antes de
  entrar a la ficha»): nombre, cifras y, en burbujas sobre la portada
  (`.tag-chapas`), «Tienda física»/«Online» y si está abierta; la ciudad, la
  web y el Instagram van en su escaparate, no en la tarjeta.
  La actividad de la comunidad (`js/comunidad-sucesos.js`) sabe qué cuenta es
  cada uno por `conCuentas` (1246: `portada_comunidad` no da `tipo`); un suceso
  nuevo que nombre a otra persona pone su username en `datos` y pasa por ahí, o
  una tienda saldrá como una persona. Y la pestaña Actividad usa el molde de la
  portada (`cajasHtml`, con su dibujo a la derecha), no una lista de texto.
  Una gradeada (1234) lleva su casa y nota en `gradeo` («PSA 10») y se elige
  con `gradeoHtml` / `engancharGradeo` (`js/gradeo-elegir.js`: PSA, Beckett y
  CGC); se PINTA con `chapaDeGradeoHtml` (PSA roja, Beckett negra, CGC blanca,
  colores `--casa-*` en `components.css`). Un camino nuevo para meter cartas
  al stock lleva ese selector; con cápsula el estado no aplica (NM). Una
  gradeada no se repite a ciegas (1240): el «+» de su ficha abre «añadir» con su
  casa y nota puestas (`abrirAnadir(id, versión, base)`) y el Stock tiene
  «Añádela aparte» (`montarForm` con `base`): editar cambia todas las unidades.
  Las fotos de VERDAD de una copia (1235, PINGU: «frontal y trasera, solo a
  cartas») van en `tienda_stock_fotos` (rutas `frente`/`dorso`, aparte de
  `tienda_stock` para no redefinir sus funciones) y en el cubo público
  `tienda-fotos/<tienda>/…`; se ponen y se ven por `js/tienda-fotos.js`
  (`fotosDeStock`, `abrirFotosDeStock`, `verFotosDeStock`), comprimidas antes.
  Una pantalla nueva que enseñe una copia de tienda pregunta ahí.
  En el Mercado (1236, PINGU eligió lo recomendado): la línea de una carta
  con tiendas sale de `textoDeTiendas` («Desde X € · N tiendas» o «X € ·
  Nombre»; el precio de arriba, con su bandera, no se toca), y las tiendas de
  una carta se pintan en tarjetas con `enTiendasHtml` (`js/en-tiendas.js`:
  «Me interesa» por `enlaceMeInteresa`, «Su tienda», «Ver fotos», tres a la
  vista); salen de `tiendas_con_la_carta` (con la línea, `stock_id`) y caen a
  `tiendas_que_tienen` sin la migración. La agenda de tiendas es /tiendas
  (`js/tiendas-agenda.js`, `tiendas_agenda`), con «Pide acceso» debajo; la
  pestaña «Tiendas» del Mercado enseña su franja con «Ver todas».
