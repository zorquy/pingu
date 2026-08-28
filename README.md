# El entorno de pruebas de PokeDoc

Esta rama NO es la web. Netlify solo despliega
`claude/react-native-web-migration-wl51z5`, así que nada de aquí sale a
producción.

## Por qué existe

Hasta la tanda 224 esto vivía únicamente en el contenedor de la sesión
de Claude de PINGU, porque la norma de CLAUDE.md dice que el doble de
Supabase no va en el repo. El 2026-08-28 el contenedor se reinició y se
llevó por delante el doble y unas 87 pruebas de Playwright de tandas
anteriores. No había copia en ninguna parte.

La norma sigue teniendo razón en el fondo —esto no puede acabar en la
web— pero «fuera del repo» y «en ningún sitio» no son lo mismo. Una
rama que Netlify no despliega cumple las dos cosas.

## Qué hay

- `herramientas/stub-supabase.js` — el doble de Supabase. Emula lo que
  usan las páginas de torneos del cliente de verdad: el encadenado
  `select/eq/in/is/order/limit` con `maybeSingle`/`single`, y las
  escrituras, que se apuntan en `sessionStorage` para poder comprobar
  QUÉ se guardó aunque la página navegue después.
- `herramientas/sync-forum.sh` — copia el sitio al entorno de pruebas y
  vuelve a poner el doble en su sitio. **Hay que correrlo antes de cada
  prueba de navegador**: las pruebas leen de la copia, no del repo.
- `herramientas/correr-suite.sh` — la suite entera.
- `herramientas/auditoria-general.mjs` — barrido de todas las páginas a
  320/360/390/430 px buscando desbordes.
- `pruebas/` — las pruebas de Playwright.
- `rigor/` — por cada prueba, un script que ROMPE el código a propósito
  de N maneras y comprueba que la prueba se entera de todas. Una prueba
  que no falla cuando el código está roto no está probando nada.
- `sql/` — el andamio para levantar la base en un Postgres local y los
  casos de las políticas de RLS.

## Cómo se usa

Las rutas están a pelo dentro de los scripts (`/home/user/pingu`, el
directorio del scratchpad). Si el entorno cambia, hay que ajustarlas.

```bash
# 1. Dejar los ficheros donde los scripts los buscan
cp -r herramientas/* pruebas/* rigor/* "$SC/"

# 2. Copiar el sitio al entorno de pruebas
bash "$SC/sync-forum.sh"

# 3. Levantar el servidor (las pruebas de navegador van contra el 8892)
(cd "$SC" && npx serve -l 8892 test-forum &)

# 4. La suite
bash "$SC/correr-suite.sh" && cat "$SC/suite.log"

# 5. El rigor de una prueba
python3 "$SC/rigor-torneos-17.py"
```

Las pruebas del barredor (`test-torneos-17`) no necesitan ni navegador
ni doble: la función recibe su `rest` por parámetro y el mundo se monta
dentro del propio test.

## Lo que FALTA

Solo están las de torneos. Las de foro, guías, cursos, perfiles y
portada se perdieron y hay que rehacerlas. Mientras tanto, un cambio en
esas zonas sale a producción sin nada que lo frene.
