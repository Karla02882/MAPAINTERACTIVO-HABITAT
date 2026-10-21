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

Los administradores pueden subir un PDF o DXF de hasta 25 MB desde el plano del proyecto. Para cada plano PDF se elige la página que se quiere mostrar. Los PDF se renderizan en el navegador mediante PDF.js a una resolución de hasta 2000 píxeles por lado; los archivos no se envían a un servicio de conversión. Al abrir el plano, las etiquetas de unidades detectadas se sincronizan automáticamente con sus registros: la aplicación asocia un contorno vectorial solo si lo encuentra dentro de esa unidad; de lo contrario, conserva un marcador en la ubicación de la etiqueta. No se inventan límites geométricos ni se calculan áreas oficiales a partir del dibujo. Un DXF muestra líneas y círculos y permite importar los contornos cerrados `LWPOLYLINE` y `POLYLINE` como unidades editables. Para usar archivos DWG, expórtalos primero a DXF desde un programa CAD; el sitio no convierte DWG automáticamente. No existe una herramienta para dibujar contornos manualmente.

Las geometrías importadas se guardan en las coordenadas del plano. No se muestran áreas geométricas calculadas ni se sustituyen las áreas oficiales. Las propiedades sin estado aparecen como **Disponibles**. Los estados **Disponible**, **Reservado**, **Vendido** y **Bloqueado** se muestran en verde, amarillo, rojo y gris; no se ofrece “Por confirmar”. Las propiedades se ordenan numéricamente por código (1, 2, 3… 10, 11). La búsqueda encuentra códigos, manzanas, casas, edificios, torres y pisos. Los filtros por precio y área afectan tanto el listado como las unidades visibles en el plano. El formulario permite editar los datos oficiales y guardarlos en Supabase; las otras sesiones consultan actualizaciones cada 30 segundos mientras el módulo está abierto. JOYA VERDE no utiliza manzanas.

Cada ficha incluye un cotizador referencial con vistas **Contado** y **Financiado**. El porcentaje de inicial y el número de cuotas (máximo 36) no tienen valores de muestra y deben ingresarse para generar el cronograma. La fecha y la separación también se pueden ajustar; la separación se considera parte de la inicial. El cotizador no cambia el precio del registro ni guarda las condiciones en Supabase; confirma los términos con un asesor.

Al abrir **Planos**, cada proyecto abre automáticamente el plano que se seleccionó por última vez para ese proyecto o, si aún no hay una selección, el primer plano disponible. Si tiene varios pisos o planos, se puede cambiar desde el selector **Plano**. También se puede entrar directamente desde la ficha de un proyecto con **Ver plano interactivo**.

Para asociar el PDF adjunto a **JOYA VERDE**, aplica primero la migración, inicia sesión como administrador, abre la ficha de JOYA VERDE y pulsa **Ver plano interactivo**. En **Agregar plano PDF/DXF**, el proyecto queda asociado automáticamente; selecciona `PLANO 17 OCTUBRE AUVERNIA.pdf`, indica un nombre para el plano y la página PDF, y guárdalo. Al abrirlo, las unidades numeradas detectables se sincronizan automáticamente y se muestran sobre el plano; si se detectan contornos vectoriales asociables, se hacen clicables por su forma; si no, se conserva el marcador del número. Se mantienen los datos oficiales que ya existan en Supabase. El PDF queda en el almacenamiento central y se abre al seleccionar JOYA VERDE desde cualquier dispositivo.

Para **LAS HUERTAS DE SICAYA**, selecciona el proyecto y carga el plano de lotización PDF o el archivo `Lotizacion Sicaya Las Huertas.dxf`. Al abrir un plano reconocido como administrador, se sincronizan los 14 lotes oficiales con manzana, número, área, precio y estado, y se muestran sobre sus contornos. El PDF asocia los contornos por su distribución espacial en el plano; revisa visualmente su correspondencia antes de usarla comercialmente. Las medidas calculadas del contorno no sustituyen las áreas oficiales.

## CRM privado

El botón **CRM** solo aparece para usuarios autenticados y autorizados en `project_admins`. Para activar el módulo, ejecuta [`supabase-crm-migration.sql`](./supabase-crm-migration.sql) en el mismo proyecto Supabase después de `supabase-setup.sql`. La migración crea tablas protegidas con RLS para leads, historial manual de mensajes y tareas; no incorpora contactos de demostración. Todos los administradores autorizados pueden consultar y gestionar los registros; la pantalla se actualiza automáticamente cada 30 segundos y oculta los datos al cerrar sesión. El CRM permite registrar leads, etapa, canal, campaña, proyecto, presupuesto, mensajes del historial y tareas. Guardar un mensaje lo registra en la base de datos, pero no lo envía a WhatsApp, Instagram, correo ni otros canales.

La carga inicial de la base de datos está vacía. Agrega únicamente datos de contactos con autorización para almacenarlos. La sincronización y las políticas del CRM dependen de Supabase y de haber ejecutado la migración; los usuarios no administradores no pueden acceder a los registros.

Para probarlo:

1. Para el módulo de planos, aplica `supabase-plans-migration.sql`; para el CRM, aplica también `supabase-crm-migration.sql`. Recarga el sitio después de ejecutar las migraciones necesarias.
2. Inicia sesión como administrador, pulsa **Planos**, elige un proyecto y agrega un plano PDF o DXF.
3. Selecciona una unidad detectada en el plano, edita su estado, precio o área oficial y pulsa **Guardar cambios**.
4. Prueba la búsqueda, el filtro por estado y los rangos de precio y área: deben actualizar a la vez el listado y las figuras visibles del plano.
5. Abre **Financiado**, cambia la inicial, la separación o las cuotas y confirma que el resumen y cronograma se recalculan. Cambia a **Contado** para ver el pago único.
6. Recarga el sitio o abre otra sesión: el plano y los cambios guardados en la ficha deben seguir disponibles. Los valores del cotizador son una simulación local y no se conservan al cerrar la página.

Los datos de propiedades que no se hayan proporcionado permanecen vacíos; la aplicación no inventa áreas, medidas, precios ni códigos oficiales.
