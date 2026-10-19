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
