# Copia de seguridad de PokeDoc

Antes de abrir al público conviene tener una copia reciente de la base **y
haber probado una vez que se puede restaurar**. Una copia que nunca se ha
restaurado no es una copia: es un fichero.

Aquí están las dos herramientas y el procedimiento. Todo se ejecuta **en tu
máquina**, con tus credenciales, y nada de esto toca la web ni pasa por
GitHub.

---

## 1. Hacer la copia

```bash
# La cadena de conexión: panel de Supabase → Project Settings → Database →
# Connection string → pestaña "URI". Lleva la contraseña de la base, así que
# no la dejes escrita en ningún fichero del proyecto.
read -rs PGURL && export PGURL

./herramientas/copia-seguridad.sh
```

Deja un `~/copias-pokedoc/pokedoc-<fecha>.sql.gz` y **comprueba lo que hay
dentro**: que estén las tablas que importan y cuántas filas trae cada una. Si
falta alguna, se planta y avisa, en vez de dejarte un fichero con pinta de
copia.

Hace falta `pg_dump` (`brew install libpq` en macOS, `sudo apt install
postgresql-client` en Ubuntu) y tiene que ser de una versión **igual o más
nueva** que la del servidor.

### Qué lleva dentro

- **Todo el esquema `public`**: guías, cursos, foro, perfiles, mensajes,
  logros, cartas, avisos… tablas, datos, funciones y políticas de seguridad.
- **Los datos de `auth.users`**: las cuentas. Sin eso tendrías las guías y
  los mensajes, pero de nadie.

### Qué NO lleva

- **Las imágenes subidas.** En la base solo están las direcciones. Para eso
  está el segundo guion:

  ```bash
  ./herramientas/copia-imagenes.sh ~/copias-pokedoc/pokedoc-<fecha>.sql.gz
  ```

  Saca del volcado todas las direcciones del almacenamiento y se las baja a
  una carpeta al lado, conservando la ruta de cada fichero dentro del bucket.
  No necesita ninguna clave (el bucket es público) y, si lo vuelves a
  ejecutar, solo se baja lo nuevo.

- **Las variables de entorno de Netlify** (la clave secreta de Supabase, el
  correo). Esas no están en ningún sitio del repositorio a propósito.
  Apúntalas donde guardes las contraseñas.

### Dónde guardarla

**Fuera de ese ordenador.** Un disco externo, Drive, lo que sea. Una copia
que vive en el mismo sitio que el original no protege de casi nada.

### Cada cuánto

- **Antes de cada migración** que toque datos. Es el momento de más riesgo.
- **Antes de abrir al público**, y otra el día siguiente.
- Luego, una a la semana mientras la comunidad sea pequeña.

Y mira en el panel de Supabase qué copias automáticas te da tu plan: en los
planes de pago hay copia diaria y recuperación a un punto en el tiempo; en el
gratuito, no. Esto de aquí no sustituye a eso — es lo que te salva si el
problema es que se borró algo por error y no te diste cuenta hasta la semana
siguiente.

---

## 2. Restaurar

**Nunca restaures encima de la base viva sin hacer antes una copia de cómo
está ahora**, aunque esté rota. Restaurar es la operación en la que se pierde
todo lo que ha pasado desde la copia.

Lo normal es restaurar en un sitio nuevo para mirar, y luego decidir.

### En un proyecto nuevo de Supabase

1. Crea un proyecto nuevo y coge SU cadena de conexión.
2. Restaura:

   ```bash
   gunzip -c pokedoc-<fecha>.sql.gz | psql "$PGURL_NUEVO"
   ```

3. Vuelve a subir las imágenes de la carpeta `-imagenes` al bucket
   `guide-images` (y `avatars`) del proyecto nuevo, respetando las rutas.
4. Cambia la URL y la clave publicable en `js/supabase.js` y en las variables
   de Netlify.

### En un Postgres local, solo para comprobar que la copia es buena

```bash
createdb prueba_restauracion
psql -d prueba_restauracion -c "create schema auth; create table auth.users(id uuid primary key, email text);"
gunzip -c pokedoc-<fecha>.sql.gz | psql -d prueba_restauracion
psql -d prueba_restauracion -c "select count(*) from public.guides;"
```

La tabla `auth.users` se crea a mano porque en un Supabase de verdad ya
existe: el volcado solo trae sus filas.

**Errores que son normales y no significan nada:**

- `ERROR: schema "public" already exists` — el volcado intenta crear un
  esquema que ya está.
- Avisos sobre roles (`supabase_admin`, `authenticated`…) que no existen en
  tu Postgres local. Las políticas de seguridad se apoyan en ellos; en un
  Supabase de verdad sí están.

Si después de restaurar las cuentas de `select count(*)` cuadran con lo que
te dijo el guion al hacer la copia, la copia es buena.

---

## 3. Comprobado

El procedimiento de arriba está ejecutado de verdad contra un PostgreSQL 16,
no escrito de memoria: se hizo una copia de una base con las mismas tablas,
se restauró en una base nueva y se comprobó que los datos llegaban enteros.
El único error que aparece es el de `schema "public" already exists`.
