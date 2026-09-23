# Plataforma de oportunidades de compras públicas — MVP Specification

**Versión:** 0.3 — borrador de producto  
**Fecha:** 23 de septiembre de 2026  
**Ámbito inicial:** procesos publicados en HonduCompras 1.0, Honduras  
**Estado:** propuesta para discusión; los parámetros comerciales y la frecuencia de monitoreo requieren validación

## 1. Problema y propuesta de valor

Una búsqueda por fechas en HonduCompras puede devolver cientos de procesos distribuidos en varias páginas. Una empresa debe abrir los resultados, leer cada detalle y, cuando existen, descargar pliegos y anexos para descubrir si alguno corresponde a lo que vende. Incluso si solo una oportunidad es pertinente, el trabajo de revisar las demás recae hoy en la empresa.

**Objetivo del MVP:** reunir los procesos recientes, leer sus detalles y documentos disponibles, compararlos con las capacidades y preferencias de cada empresa, y entregarle una lista corta de oportunidades justificadas y ordenadas por relevancia.

El producto ayuda a **descubrir y priorizar**. No certifica que una empresa reúne todos los requisitos para ofertar ni sustituye la lectura de las bases oficiales.

### Resultado esperado para el usuario

> «Vendemos soporte y licencias de software. De los procesos publicados recientemente encontramos estos tres que podrían interesarte. El primero menciona soporte funcional SAP en el objeto y en el pliego. Podés revisar el plazo, los requisitos detectados y la fuente original.»

## 2. Evidencia del flujo estudiado

- Fuente de consulta: [Búsqueda histórica de HonduCompras](http://sicc.honducompras.gob.hn/HC/Procesos/BusquedaHistorico.aspx).
- El filtro **Fecha de Inicio** tiene dos fechas, inicio y fin. La búsqueda del 22/09/2026 al 23/09/2026 devolvió 30 procesos por página y al menos 12 páginas visibles en la navegación.
- Se comprobó que pasar a la página 2 conserva ambas fechas.
- Cada resultado del listado muestra expediente, entidad, unidad de compra, objeto resumido, etapa, modalidad, inicio, cierre y enlace de detalle.
- El detalle puede incluir objeto completo, fechas y horas, tipo de adquisición, productos o servicios, código UNSPSC y enlaces a PDF.
- El proceso `LPN-008-2026` del IHSS tenía aviso, pliego y anexos. El proceso `CM 39-019-2026` no tenía documentos en su detalle. **La ausencia de archivos es un estado válido.**
- La consulta usa un formulario ASP.NET con estado de sesión, campos de calendario serializados y paginación mediante `POST`. Se comprobó una consulta fechada y una transición a la segunda página mediante HTTP.
- El portal de datos OCDS de ONCAE documenta una extracción cada 12 horas. Esta exportación puede servir para conciliación e históricos, pero la detección temprana del MVP se basará en el portal de HonduCompras. Véase la [política de publicación de ONCAE](https://oncae.gob.hn/wp-content/uploads/2025/01/Politica_de_publicacion_EDCA_ONCAE.pdf).

**Límite de la evidencia:** «Fecha de Inicio» no demuestra la hora exacta de publicación. Se debe medir cuándo aparece por primera vez cada proceso en nuestras consultas y cuánto tarda respecto de su disponibilidad en el portal.

## 3. Alcance funcional del MVP

| Área | Incluido en el MVP |
| --- | --- |
| Acceso | Registro por correo e inicio de sesión; cuenta individual o empresa representada como organización. |
| Organización | Un administrador y miembros con acceso a búsquedas y reportes de su organización; límites de asientos por plan. |
| Perfil de empresa | Descripción de bienes/servicios, palabras y sinónimos relevantes, exclusiones, categorías/códigos conocidos, ubicaciones y preferencias de modalidad o entidad. |
| Búsquedas guardadas | Cada organización configura una o más búsquedas con criterios propios y frecuencia de ejecución; botón «Ejecutar ahora». |
| Descubrimiento | Recolección central de procesos de HonduCompras: listado completo, paginación, detalle y enlaces a documentos. |
| Evaluación | Recuperación amplia de candidatos y ranking por coincidencia con el perfil de la empresa. Jev de TypeSafe AI evalúa la relevancia semántica de los candidatos mediante decisiones estructuradas, combinadas con filtros verificables y evidencia del detalle y documentos. |
| Resultados | Bandeja con estados «muy relevante», «posible» y «descartada», motivos de coincidencia y acceso a la fuente. El usuario puede marcar «me interesa» o «no me interesa». |
| Reportes | Una ejecución genera un registro inmutable de resultados y un PDF descargable; CSV descargable para análisis. |
| Notificaciones | Reporte en la plataforma y envío por correo configurable por búsqueda. No se envía una misma oportunidad repetidamente salvo cambios significativos. |
| Historial | Lista de ejecuciones, filtros aplicados, resultados, fecha de captura, estado de la fuente y descarga del reporte original. |
| Documentos | Metadatos y enlaces oficiales; descarga, extracción de texto y OCR cuando sea necesario y viable. |
| Chat | Preguntas sobre una oportunidad y sus documentos procesados, con referencia al archivo y página/sección cuando pueda identificarse. |
| Suscripción | Planes con límites de búsquedas, frecuencia, miembros, historial y uso de IA; control de acceso y consumo. |
| Créditos IA | Saldo mensual para chat y análisis documentales solicitados por el usuario. El matching base y los reportes básicos están incluidos en el plan. |
| Administración | Estado de recolectores y trabajos, fallos, calidad de extracción, uso, límites de planes y soporte a cuentas. |

### Fuera del MVP

- Preparar, presentar o enviar ofertas a la institución compradora.
- Afirmar automáticamente que una empresa es legal o técnicamente elegible para ofertar.
- Monitoreo de otras fuentes además de HonduCompras 1.0.
- Integración prometida «en tiempo real» o notificaciones instantáneas sin medición previa de latencia.
- WhatsApp, SMS, integraciones de CRM y webhooks para clientes.
- Predicción de adjudicación, análisis de competidores y generación automática de propuestas.
- Facturación y cobro recurrente completamente automáticos antes de elegir y validar un proveedor de pagos. Para un piloto, las suscripciones pueden activarse desde administración.

## 4. Usuarios y recorrido principal

### Roles propuestos

- **Administrador de organización:** define perfil, búsquedas, miembros, canal de entrega y plan.
- **Miembro:** revisa oportunidades, consulta documentos, guarda decisiones y usa créditos disponibles según permisos de su organización.
- **Administrador de plataforma:** supervisa ingesta, pagos/planes, fallos y soporte; no accede a documentos privados de clientes sin motivo operativo y control de acceso.

### Flujo

1. El cliente crea su cuenta y describe lo que vende, por ejemplo «soporte de software empresarial, licencias SAP y desarrollo de integraciones».
2. Configura una búsqueda con restricciones opcionales y elige la periodicidad del reporte.
3. Un recolector central consulta HonduCompras y almacena procesos, detalles, documentos y versiones observadas.
4. El evaluador recupera candidatos mediante búsqueda amplia y usa Jev para valorar el encaje semántico con el perfil. Ordena las oportunidades junto con señales verificables y evidencias de la fuente.
5. El cliente recibe un reporte que prioriza resultados relevantes, explica cada coincidencia y enlaza a la publicación oficial.
6. En el detalle puede consultar fechas, archivos, cambios y chat documental; marca oportunidades de interés y descarta falsos positivos.

## 5. Perfil, búsquedas y ranking

### Perfil de empresa

Campos mínimos: nombre, descripción de productos/servicios en lenguaje natural, ejemplos concretos de lo que sí ofrece, términos que no desea recibir y ámbito geográfico. Categorías y códigos UNSPSC se podrán agregar cuando el usuario los conozca; no serán requisito para empezar.

El usuario puede crear búsquedas distintas para líneas de negocio diferentes. Ejemplo: «soporte de software» y «equipos de cómputo». Cada búsqueda puede heredar el perfil de la organización y añadir términos, exclusiones, entidades, modalidad y tipo de adquisición.

### Evaluación por etapas

1. **Captura amplia:** recolectar todos los resultados de la ventana consultada. Ningún perfil de cliente limita la captura global.
2. **Detalle:** obtener el objeto completo y datos del proceso para cada resultado nuevo o modificado.
3. **Documentos:** descubrir y procesar los archivos disponibles. El matching debe poder detectar coincidencias que solo aparezcan dentro del pliego o anexo. El OCR fallido o un archivo ilegible se marca como análisis parcial.
4. **Recuperación de candidatos:** combinar coincidencias exactas, sinónimos, códigos UNSPSC y búsqueda semántica sobre objeto y fragmentos de documentos. El umbral de recuperación debe favorecer no perder oportunidades pertinentes, incluso si eso incorpora candidatos de más.
5. **Evaluación con Jev (incluida en el MVP):** para cada candidato recuperado, enviar a TypeSafe AI un `state` con la oferta de la empresa, el objeto de compra, metadatos pertinentes y fragmentos identificados por archivo/página. Formular preguntas atómicas en una solicitud: si el alcance solicitado corresponde a lo que la empresa vende (`Noul`), la fuerza de la coincidencia en niveles definidos (`Score`) y si la evidencia recibida es insuficiente para clasificar con seguridad (`Noul`). Guardar resultados y probabilidades junto con la versión del modelo y de las preguntas.
6. **Composición y explicación:** combinar la evaluación de Jev con señales verificables, como fecha de cierre, preferencias, exclusiones explícitas y presencia de documentos. Guardar qué campos o fragmentos fueron usados; redactar motivos breves a partir de esas evidencias y enlazar a la fuente. Jev no genera texto explicativo ni referencias por sí solo: ninguna razón o cita se presenta sin verificarla contra el contenido recuperado.

Los niveles y umbrales de Jev son parámetros del producto que se calibran con procesos etiquetados manualmente. Una respuesta incierta se presenta como «posible coincidencia» y no se descarta automáticamente. Una exclusión explícita comprobable puede prevalecer sobre la evaluación semántica; una incompatibilidad inferida por IA requiere revisión antes de ocultar una oportunidad. Si Jev no responde, el trabajo se reintenta y el candidato se conserva como **pendiente de evaluación**; el reporte muestra que el análisis es parcial.

**Responsabilidades diferenciadas:** la búsqueda textual/vectorial localiza posibles coincidencias; Jev decide cuán bien encajan los candidatos con la oferta de la empresa; el sistema conserva y verifica la evidencia; un modelo generativo separado atiende el chat RAG y, si se necesita, redacta explicaciones extensas. Jev no sustituye OCR, embeddings ni conversación.

Referencia para la integración: [documentación de Jev y tipos de preguntas de TypeSafe AI](https://docs.typesafe.ai/primitives) y [guía de inicio de la API](https://docs.typesafe.ai/introduction/quickstart).

Las etiquetas de relevancia representan **prioridad de revisión**, no probabilidad de adjudicación. Un resultado dudoso debe quedar en «posible» para revisión humana. El orden puede considerar grado de coincidencia, proximidad del cierre y estado del proceso. Si se usan límites para controlar costo de OCR o IA, estos deben declararse en la cobertura de cada ejecución y someterse a medición de falsos negativos.

### Retroalimentación

El cliente puede marcar una recomendación como interesante o irrelevante y dejar un motivo opcional. El sistema registra esa señal para mejorar reglas y evaluar calidad; cualquier aprendizaje automático posterior requiere datos suficientes.

## 6. Ingesta y seguimiento de cambios

La ingesta es **central**, independiente de las búsquedas guardadas. La frecuencia de ingesta determina qué tan frescos están los datos; la frecuencia de cada búsqueda determina cuándo se calcula y entrega su reporte.

### Reglas mínimas

- Consultar una ventana móvil de fechas de inicio con solape, recorrer todas las páginas y registrar URL/identificadores del detalle. Valor inicial del solape: **7 días, sujeto a prueba**.
- Reconsultar regularmente oportunidades aún abiertas, incluso si su fecha de inicio queda fuera de la ventana móvil, para detectar cambios de etapa, plazo y documentos.
- Tratar el expediente como dato de presentación; identificar de forma estable cada proceso mediante su enlace/identificadores del portal y fuente. Mantener el `ocid` cuando pueda mapearse con OCDS, sin suponer que siempre está disponible.
- Guardar `first_seen_at`, `last_seen_at`, `source_start_at`, `last_checked_at` y una versión/hash del detalle y de cada documento. `first_seen_at` es observación de la plataforma, no fecha oficial de publicación.
- Cuando cambien fechas críticas, estado o documentos, registrar el evento y permitir una alerta de actualización.
- Aplicar reintentos limitados, espera entre solicitudes, métricas y detección de cambios en el HTML. Evitar consultas por cada cliente y descargar archivos una vez por versión.
- Si la fuente falla, mostrar la última captura válida y su antigüedad; no informar «sin nuevas oportunidades» como si la consulta hubiese terminado correctamente.

**Frecuencia inicial propuesta:** comprobación central cada 2–4 horas durante la etapa piloto, condicionada a pruebas de estabilidad del sitio, volumen, disponibilidad y medición del tiempo de aparición. Los reportes por cliente pueden ser diarios y las ejecuciones manuales consultarán la última ingesta completa. La frecuencia comercial definitiva queda pendiente de la medición.

## 7. Reportes y entrega

Cada ejecución crea un `search_run` con fecha, configuración congelada, versión del perfil, estado de ingesta utilizado, cantidad examinada, cantidad recomendada y resultados. La ejecución mantiene su fotografía histórica aunque más adelante cambie el proceso o el perfil.

El PDF contiene un encabezado con fecha de generación y última sincronización de la fuente; resumen de oportunidades; una sección por oportunidad con expediente, institución, objeto, fechas, estado, nivel de relevancia, motivos y documentos considerados; enlace a detalle oficial; y una nota visible cuando falten archivos o el análisis sea parcial. El CSV contiene campos tabulares y URLs.

Las preferencias por búsqueda incluyen «guardar solamente», «enviar por correo», «enviar incluso sin coincidencias» y «avisar cambios de oportunidades guardadas». Para evitar ruido, una oportunidad ya notificada reaparece en el correo únicamente si tiene un cambio relevante o el usuario solicita un reporte completo.

## 8. Chat con fuentes (RAG)

El chat del MVP tiene dos contextos: **una oportunidad** (detalle y todos sus documentos procesados) y **un reporte** (comparación de las oportunidades que contiene). El acceso se limita a la organización autorizada, aunque los documentos fuente sean públicos.

Las respuestas se fundamentan en texto recuperado de documentos y datos estructurados. Deben citar documento y página/sección cuando la extracción permita establecerlos, ofrecer enlace al archivo original e indicar cuando falta información. Si el proceso no tiene documentos, el chat solo puede usar datos del detalle y debe decirlo claramente. Las preguntas sobre plazos y estados deben consultar además los datos estructurados más recientes y señalar si difieren del reporte histórico.

El texto del pliego y de otros archivos se considera contenido a analizar; nunca instrucciones para el asistente. No generar respuestas de elegibilidad definitiva, compromisos legales ni cifras no respaldadas.

## 9. Suscripción y consumo

Una suscripción pertenece a la organización. Los parámetros del plan son configurables, sin fijar precios en esta versión:

| Límite | Unidad sugerida |
| --- | --- |
| Búsquedas guardadas | Número simultáneo activo |
| Frecuencia de entrega | Diaria o varias veces al día según plan y frescura medida |
| Miembros | Asientos por organización |
| Historial | Meses accesibles según plan |
| IA | Créditos mensuales compartidos por organización |

El matching automático con Jev necesario para generar recomendaciones y el PDF básico están incluidos en el plan y no consumen créditos visibles al usuario. Los créditos cubren preguntas al chat y análisis extensos solicitados expresamente. Mostrar costo estimado antes de la operación cuando sea posible, saldo actual, historial de consumo y estado al agotarse; reservar consumo para evitar cargos dobles ante reintentos. La equivalencia entre crédito y operación se definirá después de medir costos reales de texto, OCR y modelos.

Para un piloto, el administrador puede activar manualmente un plan y registrar vigencia. La integración de checkout y renovaciones dependerá del proveedor de pagos elegido; la interfaz debe distinguir activación, vencimiento y cancelación aunque no haya cobro automático.

## 10. Modelo de datos propuesto

| Entidad | Propósito |
| --- | --- |
| `users`, `organizations`, `organization_members` | Identidad, pertenencia y roles. |
| `plans`, `subscriptions`, `ai_credit_ledger` | Límites, vigencia y movimientos auditables. |
| `company_profiles`, `company_offerings` | Descripción y capacidades de la empresa. |
| `saved_searches`, `search_schedules` | Criterios por línea de negocio y periodicidad de reporte. |
| `source_sync_runs`, `source_pages` | Ejecución del recolector, ventana, paginación, éxito y errores. |
| `procurement_processes`, `process_versions`, `process_events` | Identidad del proceso, última vista y cambios observados. |
| `source_documents`, `document_versions`, `document_chunks` | Enlaces, archivo/versiones, texto extraído y referencias para RAG. |
| `search_runs`, `search_run_matches`, `reports` | Historial congelado, coincidencias, explicación y descargas. |
| `match_evaluations` | Candidato evaluado por Jev, versión del modelo/preguntas, respuestas estructuradas, probabilidades, fragmentos de entrada, estado de procesamiento y puntuación compuesta. |
| `opportunity_feedback`, `notification_deliveries` | Decisiones del cliente y trazabilidad de envíos. |
| `chat_threads`, `chat_messages`, `ai_usage_events` | Conversaciones, fuentes usadas y consumo. |

Reglas: separar datos públicos compartidos de datos privados por organización; permisos por organización en cada lectura; identificadores de proceso y documento únicos por fuente; procesamiento y envíos idempotentes; conservar versión original y texto derivado. La política de retención y borrado se configurará antes del lanzamiento comercial.

## 11. Arquitectura de referencia

- **Web:** aplicación responsive para onboarding, bandeja, detalle, búsquedas, historial, suscripción y chat.
- **API y base de datos:** PostgreSQL para organizaciones, procesos, matching y auditoría. Índices de texto para filtros; búsqueda vectorial si la evaluación semántica lo necesita.
- **Trabajadores y cola:** recolección, paginación, lectura de detalle, descarga/OCR, clasificación, reportes y correo como trabajos separados, reintentables e idempotentes.
- **Almacenamiento de objetos:** PDFs oficiales descargados, versiones y reportes generados.
- **IA y ranking:** recuperación de candidatos por texto/códigos/embeddings; llamadas a Jev para preguntas atómicas sobre coincidencia; combinación en código con restricciones y señales verificables. Guardar modelo, versión de preguntas, probabilidades, fuentes utilizadas, costo, latencia y estado. El RAG emplea un modelo generativo aparte para responder con referencias.
- **Observabilidad:** salud del portal, última sincronización exitosa, cantidad de páginas y procesos, errores de descarga, latencia de análisis y entregas fallidas.

Una implementación compatible con la experiencia actual del equipo puede usar Next.js, Supabase/PostgreSQL y trabajadores independientes. La elección concreta de cola, OCR y proveedores de correo/pagos queda para la definición técnica; no condiciona el alcance funcional.

## 12. Pantallas mínimas y Home de trabajo

### 12.1 Home de escritorio: organización tipo correo

El Home es el espacio principal de trabajo después del inicio de sesión. Su distribución tiene dos áreas persistentes:

| Área | Contenido y acciones |
| --- | --- |
| Barra lateral izquierda | Nombre de la organización; botón «Nueva búsqueda»; lista de búsquedas guardadas ordenada por la fecha de su última ejecución, con indicador de nuevas coincidencias. Al seleccionar una búsqueda, aparecen sus ejecuciones recientes ordenadas por fecha descendente. Acceso al historial completo. |
| Área derecha | Nombre y criterios resumidos de la búsqueda seleccionada; fecha/hora de ejecución y de última sincronización de HonduCompras; estado del trabajo; botón «Ejecutar ahora»; acciones de descarga; tabla de oportunidades pertenecientes a la ejecución seleccionada. |

Al entrar, se abre la búsqueda ejecutada más recientemente y su última ejecución **completada**. Si el usuario selecciona una ejecución anterior, ve la fotografía histórica de sus resultados. Una ejecución en curso se identifica por su estado y no sustituye los resultados completados hasta finalizar. Una ejecución sin coincidencias muestra cuántos procesos se evaluaron, cuándo se consultó la fuente y una opción para ajustar los criterios.

«Ejecutar ahora» crea una ejecución de la búsqueda seleccionada usando su configuración vigente y la última ingesta completa disponible. Muestra la antigüedad de esa ingesta para evitar que el usuario interprete la acción como una consulta instantánea a HonduCompras. Si ya hay una ejecución de esa misma búsqueda en curso, se muestra su progreso y se evita crear otra por un doble clic.

### 12.2 Tabla de resultados

Cada fila representa una oportunidad dentro de la ejecución seleccionada. Columnas propuestas: relevancia, estado de la coincidencia (nueva/actualizada/conocida), expediente, objeto de compra, institución, modalidad, etapa, fecha límite, documentos disponibles y fecha en que la plataforma la detectó. El objeto y el expediente abren el detalle.

La tabla se ordena inicialmente por relevancia; el usuario puede ordenar por fecha límite, fecha de inicio, institución y fecha de detección. Se pagina sin limitar las descargas al contenido de la página visible.

**Filtros por facetas:** relevancia; institución; modalidad; etapa; tipo de adquisición; estado de la coincidencia; rango de fecha límite; y disponibilidad de documentos. También hay búsqueda por texto dentro de los resultados y una acción «Limpiar filtros». Cada faceta muestra el recuento de resultados cuando los datos estén disponibles. Los filtros de esta tabla solo cambian la vista de la ejecución: no modifican el perfil de empresa, los criterios de la búsqueda guardada ni su programación.

**Descarga:** el usuario puede descargar «Todos los resultados de esta ejecución» o «Solo resultados filtrados» en CSV, y el reporte PDF congelado de la ejecución. «Todos» significa todas las filas del resultado elegido, incluidas las que están en otras páginas de la tabla. Una fila individual permite abrir la fuente oficial y descargar sus documentos existentes; no se ofrece descarga de documentos cuando el proceso carece de ellos. Las opciones muestran el número de registros que contendrá cada descarga.

### 12.3 Detalle sin perder el contexto

Al abrir una fila, un panel lateral o una vista de detalle conserva la búsqueda, la ejecución y los filtros desde los que llegó el usuario. Presenta el motivo de coincidencia con evidencia, los datos y cambios del proceso, documentos, enlace oficial, acciones «Me interesa»/«No me interesa» y acceso al chat contextual. Al cerrar el detalle se regresa a la misma posición de la tabla.

En pantallas pequeñas, la lista de búsquedas se abre desde un menú y la tabla utiliza columnas esenciales más un resumen por fila; los filtros se muestran en un panel. La información y las descargas conservan el mismo alcance funcional.

### 12.4 Otras pantallas

1. Registro e inicio de sesión.
2. Crear organización y describir productos/servicios.
3. Crear o editar búsqueda y configurar frecuencia y entrega.
4. Historial completo de ejecuciones, accesible desde la barra lateral.
5. Chat contextual y saldo de créditos.
6. Configuración de organización, miembros, suscripción y notificaciones.
7. Panel operativo interno de sincronizaciones y errores.

## 13. Criterios de aceptación del primer piloto

- Una búsqueda con fechas reproduce correctamente el conjunto completo de páginas; procesa la página 2 y las siguientes sin perder el filtro.
- Cada proceso recuperado se guarda una sola vez; una consulta repetida no duplica procesos, documentos, coincidencias ni correos.
- El detalle del IHSS muestra al menos los tres enlaces documentales observados y puede recomendarse por «soporte funcional SAP» con evidencia visible.
- `CM 39-019-2026` permanece consultable aunque no tenga documentos; su chat explica que solo dispone del detalle del proceso.
- Una empresa con perfil de software puede localizar una oportunidad relevante sin revisar manualmente cientos de resultados; una empresa no relacionada no recibe esa oportunidad como coincidencia alta.
- Se evalúa una muestra etiquetada manualmente de oportunidades pertinentes e irrelevantes; se mide especialmente la tasa de oportunidades relevantes omitidas antes de activar alertas pagadas.
- Jev participa en la clasificación de candidatos del MVP; sus decisiones quedan registradas con modelo, preguntas, probabilidades y evidencia de entrada. El sistema conserva como «posibles» los casos inciertos y como «pendientes» aquellos en los que falló la evaluación.
- La evaluación compara el flujo con Jev frente a reglas y búsqueda semántica sin Jev, usando el mismo conjunto etiquetado; se revisan oportunidades omitidas, falsos positivos, latencia y costo antes de fijar umbrales de alertas.
- Una nueva ejecución produce PDF, CSV e historial; refleja fecha de última ingesta, cobertura y análisis incompleto donde corresponda.
- En el Home, seleccionar una búsqueda y una ejecución actualiza la tabla sin perder el historial; «Ejecutar ahora» muestra progreso y evita ejecuciones duplicadas.
- Los filtros por facetas no cambian la búsqueda guardada; «Descargar todos» incluye registros de todas las páginas y «Solo resultados filtrados» respeta las facetas aplicadas.
- Un cambio de fecha o nuevo anexo queda registrado y genera una alerta como actualización, sin duplicar la alerta original.
- Una falla del portal, de OCR o del correo queda registrada y visible; ninguna se presenta como búsqueda exitosa sin coincidencias.
- El chat muestra las fuentes de sus respuestas, respeta el contexto elegido y no afirma haber leído documentos no procesados.
- Los límites de suscripción y el saldo de créditos se aplican por organización; no hay doble consumo por reintentos.

## 14. Validaciones pendientes antes de fijar el lanzamiento

1. **Frescura:** comparar varias capturas del portal durante días consecutivos para medir aparición, retrasos y procesos agregados con fecha de inicio anterior.
2. **Cobertura de cambios:** comprobar si modificaciones a procesos antiguos se detectan con reconsultas de abiertos y cómo se identifican adendas o archivos reemplazados.
3. **Carga:** medir procesos y tamaño de documentos por día, tiempos de descarga, OCR y costo de clasificación antes de prometer una frecuencia comercial.
4. **Matching con Jev:** construir un conjunto de evaluación con empresas y oportunidades reales; medir omisiones, falsos positivos, desempeño en español, latencia y costo; calibrar umbrales sin tratar las probabilidades declaradas como precisión ya demostrada en licitaciones hondureñas.
5. **Acceso y uso de contenido:** revisar condiciones de acceso de HonduCompras y atribución de datos antes de operar el recolector comercialmente; enlazar siempre a la fuente oficial.
6. **Planes:** decidir frecuencia, asientos, retención, créditos y precio a partir de costos y entrevistas con posibles clientes.
7. **Pagos:** elegir proveedor y proceso para suscripción recurrente cuando se valide la demanda del piloto.

## 15. Orden recomendado de construcción

1. Prototipo de ingesta, paginación, detalle, documentos, versiones y observabilidad.
2. Conjunto etiquetado, recuperación amplia, integración de Jev y bandeja priorizada para una empresa de prueba.
3. Perfiles, búsquedas guardadas, ejecuciones, reportes y correo.
4. RAG con citas y tratamiento de procesos sin documentos.
5. Organizaciones, planes, créditos y panel administrativo para piloto pagado.

**Regla de producto para todas las fases:** el éxito no es capturar muchos procesos; es ayudar a una empresa a encontrar a tiempo las pocas oportunidades que sí merecen su revisión.
