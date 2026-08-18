# Lista de comprobación del lanzamiento

Lo que queda por hacer **a mano** antes de anunciar, en orden. Lo del código
ya está: la suite entera corre verde y el barrido de lanzamiento pasa por
las 20 páginas públicas sin un error de JavaScript, sin desbordes en el
móvil y sin un solo enlace interno roto.

## Bloqueante — sin esto no se anuncia

- [ ] **La pantalla de consentimiento de Google** (Google Cloud Console →
  OAuth consent screen): logo, página de inicio, y los enlaces a
  `https://pokedoc.es/privacidad.html` y `https://pokedoc.es/terminos.html`.
  Sin esto, quien entre con Google ve una pantalla en crudo con el
  identificador del proyecto, que parece phishing. **Después, probar el
  login con Google desde un móvil de verdad**, no desde tu sesión de
  siempre.

- [ ] **Copia de seguridad la víspera** (y comprobar que el guion dice que
  está completa):
  ```bash
  read -rs PGURL && export PGURL
  ./herramientas/copia-seguridad.sh
  ./herramientas/copia-imagenes.sh ~/copias-pokedoc/pokedoc-<fecha>.sql.gz
  ```
  Y sácala de tu ordenador.

## Contenido — es lo que ve quien llega

- [ ] **Reimportar los catálogos de cartas** desde /admin, ahora que la
  migración de mercados está ejecutada. La tarjeta de cobertura del panel
  tiene que subir del 56 %, y con ella el buscador de cartas del editor.
- [ ] **Elegir la guía destacada** de la portada (si no hay, la portada
  abre sin su pieza central).
- [ ] **Fusionar o quitar desde /admin los subforos sin tráfico.** Veinte
  subforos a cero comunican «aquí no hay nadie»; cinco con movimiento
  comunican lo contrario. Se pueden volver a separar cuando haga falta.
- [ ] **Un tema de bienvenida fijado** en Presentaciones, escrito por ti,
  con dos líneas de qué hacer primero. Es a donde manda el panel de
  primeros pasos.
- [ ] **El hilo de "actualizaciones y fixes" al día**, que quien llegue
  cotilleando vea que esto se mueve.

## Google y las redes — 20 minutos que valen meses

- [ ] **Search Console**: verificar `pokedoc.es` y enviar
  `https://pokedoc.es/sitemap.xml`. Es lo que hace que lo indexado empiece
  a contar desde ya.
- [ ] **Probar los datos estructurados**: pegar la URL de una guía en
  https://search.google.com/test/rich-results — debe reconocer el artículo
  y las migas de pan.
- [ ] **Probar cómo se comparte**: pegar el enlace de una guía en un chat
  de WhatsApp contigo mismo. Debe salir su título y su portada, no el
  genérico. (Si sale viejo, el caché de WhatsApp tarda; el de Facebook se
  fuerza en https://developers.facebook.com/tools/debug/.)

## Correo

- [ ] **Mandar un correo de verificación de prueba** (regístrate con otro
  correo tuyo) y mirar que llega y que **no cae en spam**. Si cae: revisar
  SPF/DKIM del dominio en Hostinger.

## El día del anuncio

- [ ] Copia de seguridad de la mañana (dos minutos, y duermes tranquilo).
- [ ] **El registro de errores de /admin abierto** de fondo: si a alguien
  le rompe algo, lo ves ahí antes de que lo cuente en el foro.
- [ ] La tira de «Sin respuesta todavía» del foro es tu lista de tareas:
  que nadie pase su primer día sin respuesta.
- [ ] Y el enlace de la biografía apuntando a `https://pokedoc.es/sobre.html`,
  que para eso está.

## Lo que NO hace falta tocar

Netlify despliega solo al hacer merge; el sitemap y las vistas previas se
generan solos; la 404, los datos estructurados y el panel de primeros pasos
ya están probados. Si algo se rompe el día del anuncio, el primer sitio
donde mirar es el registro de errores del panel.
