# Proyectos inmobiliarios en Huancayo

Aplicación web estática para explorar proyectos inmobiliarios de Huancayo y alrededores, con interfaz inspirada en iOS.

## Uso

Abre la carpeta desde un servidor web local. Por ejemplo, ejecuta `python -m http.server 8765` desde la carpeta y visita `http://localhost:8765`. El mapa de Google My Maps compartido está incrustado directamente en la página y no necesita una clave propia de Google Maps Platform.

La lista contiene los 17 proyectos proporcionados. Selecciona un proyecto de la lista para abrir su ficha. Filtra por tipo o estado; estos filtros afectan la lista, no las capas del mapa incrustado. Administra los marcadores en el mapa compartido de Google My Maps.

Desde cada ficha puedes **reemplazar toda la galería** por imágenes seleccionadas de tu dispositivo, o agregar archivos PDF por separado. Las imágenes nuevas reemplazan las ilustraciones de ejemplo y los PDF se añaden a los documentos existentes. Se guardan en IndexedDB y siguen disponibles en el mismo navegador y perfil después de recargar. No se envían a un servidor. Si el navegador no permite guardar, la aplicación muestra un aviso y deshabilita la carga.

Mientras no reemplaces la galería, aparecen ilustraciones de demostración. Las ubicaciones, proyectos y documentos también deben revisarse antes de publicar.
