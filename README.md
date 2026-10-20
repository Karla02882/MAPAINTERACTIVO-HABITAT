# Proyectos inmobiliarios en Huancayo

Aplicación web estática para explorar 17 proyectos inmobiliarios de Huancayo y alrededores. Incluye una interfaz inspirada en iOS, filtros por tipo y estado, el mapa compartido de Google My Maps y fichas con galerías y documentos.

## Desarrollo local

Para probar cambios antes de publicarlos, sirve la carpeta desde un servidor local:

```powershell
python -m http.server 8765
```

Después abre `http://localhost:8765`. El mapa ya está incrustado y no requiere una clave de Google Maps Platform. Los filtros afectan la lista de proyectos; las capas y marcadores se administran en el mapa de Google My Maps.

## Publicación

El sitio público está en [https://karla02882.github.io/MAPAINTERACTIVO-HABITAT/](https://karla02882.github.io/MAPAINTERACTIVO-HABITAT/). Se publica con GitHub Pages y HTTPS desde la rama `main`; los cambios futuros en esa rama se despliegan automáticamente. El código fuente del repositorio también es público. La base Supabase es compartida entre los usuarios.

## Activar almacenamiento compartido

La aplicación utiliza Supabase Storage para los archivos y una tabla Postgres para sus metadatos. Las imágenes y los PDF son legibles públicamente para que puedan visualizarse en cualquier dispositivo. **No subas información confidencial o documentos privados.** Solo las cuentas administradoras autorizadas pueden cargar, reemplazar, cambiar portadas o eliminar archivos.

1. Crea un proyecto en Supabase.
2. En el SQL Editor de ese proyecto, ejecuta el contenido completo de [`supabase-setup.sql`](./supabase-setup.sql). El script crea las tablas, políticas, el bucket público `project-files` y los 17 proyectos.
3. Los registros públicos están desactivados en este proyecto. Las cuentas administradoras autorizadas son `habitatbr2@gmail.com` y `72128731@continental.edu.pe`; invita a sus usuarios desde Authentication → Users y autorízalos en la tabla `project_admins`. La app no permite crear cuentas.
4. Autoriza las cuentas ejecutando en el SQL Editor:

   ```sql
   insert into public.project_admins (user_id)
   select id from auth.users
   where lower(email) in ('habitatbr2@gmail.com', '72128731@continental.edu.pe')
   on conflict (user_id) do nothing;
   ```

5. La Project URL y la clave pública `anon`/publishable ya están guardadas en [`supabase-config.js`](./supabase-config.js). Si cambias de proyecto, reemplázalas allí:

   ```js
   window.HABITAT_SUPABASE_URL = "https://tu-proyecto.supabase.co";
   window.HABITAT_SUPABASE_ANON_KEY = "tu-clave-anon-publica";
   window.HABITAT_SUPABASE_BUCKET = "project-files";
   ```

   **Nunca pongas una clave `service_role` en el navegador.** La clave `anon` es pública y las políticas RLS restringen las operaciones de escritura a las cuentas autorizadas.
6. Inicia sesión con una cuenta autorizada y administra los archivos desde la ficha de cada proyecto.

Si Supabase no está configurado o no se puede conectar, el catálogo y el mapa siguen visibles y la app muestra el estado del almacenamiento. Las imágenes admitidas son JPEG, PNG, WebP, GIF y AVIF, con un límite de 25 MB por archivo. Los PDF también tienen un límite de 25 MB.

## Galería y portadas

Las galerías se organizan en **Fachada** para departamentos, casas y oficinas; **Pórtico** para lotes y casas de campo; **Áreas comunes** para todos; y grupos separados por tipología en proyectos de departamentos. Se pueden seleccionar varias imágenes y PDF en una misma carga. Los administradores pueden cambiar el nombre visible de cada imagen desde **Renombrar**; el archivo almacenado no cambia de ruta. La primera imagen agregada a la categoría de portada se selecciona como imagen principal automáticamente. Esta misma imagen aparece en la ficha y como miniatura en la lista. Un administrador puede cambiarla desde la galería.

La opción de reemplazar la galería elimina las imágenes anteriores del proyecto y las sustituye por la carga nueva. Los documentos PDF se administran por separado y no se eliminan al reemplazar imágenes. Las fichas solo muestran los PDF que hayan subido los administradores; no incluyen documentos de demostración.

## Planos interactivos

La opción **Planos** se integra con los proyectos y el inicio de sesión actuales. Para activarla, ejecuta [`supabase-plans-migration.sql`](./supabase-plans-migration.sql) en el SQL Editor del mismo proyecto Supabase, después de `supabase-setup.sql`. La migración añade planos, unidades inmobiliarias, geometrías y políticas RLS; cada plano guarda el identificador del proyecto existente al que pertenece. Los datos de propietario se guardan en una tabla privada para administradores. No crea proyectos ni propiedades de ejemplo.

Los administradores pueden subir un PDF o DXF de hasta 25 MB desde el plano del proyecto. Para cada plano PDF se elige la página que se quiere mostrar. Los PDF se renderizan en el navegador mediante PDF.js a una resolución de hasta 2000 píxeles por lado; los archivos no se envían a un servicio de conversión. El lector PDF se carga desde jsDelivr cuando se abre un PDF. Si el PDF contiene etiquetas de texto `LOTE n` y áreas, se pueden importar automáticamente los números, las áreas sin discrepancias y sus ubicaciones para habilitar la selección y la ficha de datos. Los números se muestran como marcadores clicables sobre el plano. Las zonas de esos lotes siguen siendo el dibujo original del PDF; sus límites no se inventan ni se convierten en polígonos. Un DXF muestra líneas y círculos y permite importar como propiedades sus contornos cerrados `LWPOLYLINE` y `POLYLINE`; luego se pueden editar sus códigos y completar los datos oficiales. Para usar archivos DWG, expórtalos primero a DXF desde un programa CAD o un conversor instalado en tu equipo; el sitio público no envía el archivo a servicios externos ni hace la conversión automáticamente. Los elementos que no se detecten o no tengan un contorno cerrado se pueden delimitar o volver a dibujar manualmente. En JOYA VERDE, el botón **Restaurar marcador PDF** devuelve un lote redibujado a la posición de su número original.

Al dibujar, las geometrías se guardan en las coordenadas del plano. No se muestran áreas geométricas calculadas ni se sustituyen las áreas oficiales. Las propiedades nuevas y las que no tienen un estado asignado aparecen como **Disponibles**. Los estados **Disponible**, **Reservado**, **Vendido** y **Bloqueado** se muestran en verde, amarillo, rojo y morado; no se ofrece “Por confirmar”. Las propiedades se ordenan numéricamente por código (1, 2, 3… 10, 11). La búsqueda encuentra códigos, manzanas, casas, edificios, torres y pisos; los cambios guardados se sincronizan con Supabase y las otras sesiones consultan actualizaciones cada 30 segundos mientras el módulo está abierto. JOYA VERDE no utiliza manzanas.

Al abrir **Planos**, cada proyecto abre automáticamente el plano que se seleccionó por última vez para ese proyecto o, si aún no hay una selección, el primer plano disponible. Si tiene varios pisos o planos, se puede cambiar desde el selector **Plano**. También se puede entrar directamente desde la ficha de un proyecto con **Ver plano interactivo**.

Para asociar el PDF adjunto a **JOYA VERDE**, aplica primero la migración, inicia sesión como administrador, abre la ficha de JOYA VERDE y pulsa **Ver plano interactivo**. En **Agregar plano PDF/DXF**, el proyecto queda asociado automáticamente; selecciona `LA AUVERNIA LOTIZACION (1)-Model.octubre.pdf`, indica un nombre para el plano y la página PDF, y guárdalo. Ese archivo concreto detecta e importa automáticamente sus lotes numerados y áreas legibles al guardarse; también se pueden importar manualmente los lotes detectados desde cualquier otro PDF. Quedará en el almacenamiento central de Supabase y se abrirá al seleccionar JOYA VERDE desde cualquier dispositivo.

Para **LAS HUERTAS DE SICAYA**, selecciona el proyecto y sube el archivo `Lotizacion Sicaya Las Huertas.dxf`. El lector conserva las capas y etiquetas de texto, encuadra el grupo de manzanas A y B y, para ese archivo, relaciona los contornos con los 14 lotes oficiales por manzana, número y área. Al abrirlo como administrador, importa las áreas, precios y estados proporcionados; las medidas de contorno calculadas no sustituyen las áreas oficiales. Los lotes quedan asociados al plano en Supabase y se muestran sobre el dibujo con su número y estado.

Para probarlo:

1. Aplica la migración SQL y recarga el sitio.
2. Inicia sesión como administrador, pulsa **Planos**, elige un proyecto y agrega un plano PDF o DXF.
3. Pulsa **Nueva propiedad**, completa el código y dibuja el contorno haciendo clic en el plano; termina con **Cerrar contorno** y guarda.
4. Cambia el estado y guarda: el color del polígono y de la lista debe actualizarse. Prueba el buscador y el filtro por estado.
5. Recarga el sitio o abre otra sesión: el plano, la geometría y los datos guardados deben seguir disponibles.

Los datos de propiedades que no se hayan proporcionado permanecen vacíos; la aplicación no inventa áreas, medidas, precios ni códigos oficiales.
