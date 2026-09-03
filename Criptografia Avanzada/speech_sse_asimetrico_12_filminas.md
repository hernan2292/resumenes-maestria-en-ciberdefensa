# 🎤 Speech Completo — 12 Filminas de SSE (Cifrado Asimétrico)
## Basado en: sse_cifrado_asimetrico.pptx — continuación de sse_cifrado_simetrico.pptx

> [!TIP]
> Este documento contiene **exactamente lo que debés saber y decir** para cada una de las 12 filminas, en un nivel pensado para poder explicarlo con confianza sin ser un experto en la matemática de fondo. Incluye: qué dice la filmina, la idea central en una frase, y el discurso sugerido textual. Sigue el mismo formato que `speech_sse_11_filminas.md` del trabajo anterior — pensalo como su continuación directa.
>
> **Regla general para todas las preguntas difíciles:** si te preguntan un detalle matemático que no manejás (por ejemplo, cómo funciona exactamente un emparejamiento bilineal), está bien responder con la idea general y decir "no entré en el detalle matemático de esa construcción, me enfoqué en qué garantiza y qué cuesta". Es una respuesta honesta y válida en una materia de nivel maestría.

---

## 📊 Mapa de la Exposición

| # | Título de la Filmina | Idea en una frase |
|:-:|:---|:---|
| 1 | Portada | Encuadre: la búsqueda sigue simétrica, hoy vemos cómo delegar acceso con clave pública |
| 2 | De lo simétrico a lo asimétrico | Puente con el trabajo anterior + agenda |
| 3 | El límite del modelo simétrico | Una sola clave no alcanza si hay varios escritores |
| 4 | PEKS | Buscar sobre datos cifrados, pero con clave pública |
| 5 | Semánticamente seguro… y aun así vulnerable | PEKS se puede "adivinar" con un diccionario de palabras |
| 6 | SSE vs. PEKS, en números | Tabla comparativa simple |
| 7 | Cifrado híbrido | La solución real: combinar las dos cosas |
| 8 | OSA | El caso de estudio: una historia clínica que construimos |
| 9 | Así lo hace OSA | Los mismos 4 pasos, pero en la app real |
| 10 | El ticket de delegación temporal | Cómo el paciente le da permiso a un médico, con firma |
| 11 | Tres cosas que solo aparecieron al construirlo | Bugs reales que encontramos y corregimos |
| 12 | Síntesis y conclusiones | Cierre y referencias |

---

## Filmina 1 — Portada

### 📋 Qué dice la filmina
- **Título:** *"SSE Simétrico, Delegación Asimétrica"*.
- **Subtítulo:** PEKS es el SSE asimétrico real de los papers — y por qué solo no alcanza. Cómo OSA delega acceso con cifrado híbrido, sin volver asimétrica la búsqueda.
- Etiqueta: *"Continuación de: SSE — Cifrado Simétrico"*.

> [!NOTE]
> Cambio de título respecto a una versión anterior: no decimos que OSA "es SSE asimétrico" — eso técnicamente describe a PEKS, no a OSA. Lo que hace OSA es buscar de forma simétrica (igual que el trabajo anterior) y usar clave pública solo para delegar y firmar. Es una distinción que un jurado de nivel maestría puede preguntar, así que la charla la deja explícita desde el título.

### 🧠 La idea en una frase
Esta charla completa el trabajo anterior: ahí vimos cómo buscar rápido sobre datos cifrados con una sola clave secreta; hoy vemos qué hacer cuando hay más de una persona involucrada y esa clave secreta compartida no alcanza — sin que la búsqueda en sí deje de ser simétrica.

### 🗣️ Discurso sugerido
> "Buenas. En el trabajo anterior de Criptografía vimos SSE, cifrado simétrico buscable. Hoy, para Criptografía Avanzada, retomamos el mismo problema pero miramos el otro lado: qué pasa cuando no hay una sola persona con una sola clave, sino varias personas —por ejemplo un paciente y varios médicos— que necesitan compartir capacidades sin haber acordado nunca un secreto entre ellos.
>
> Vamos a ver una construcción de clave pública pensada para esto —PEKS, el SSE asimétrico real de la literatura—, por qué sola no alcanza, cómo se resuelve combinándola con lo que ya vimos, y todo esto bajado a una aplicación real que construimos: OSA, una historia clínica donde el servidor nunca ve nada en claro y donde, aclaro desde ya, la búsqueda sigue siendo simétrica — lo asimétrico entra solo para delegar el acceso."

---

## Filmina 2 — De lo simétrico a lo asimétrico

### 📋 Qué dice la filmina
- Columna clara: "Ya vimos (cripto simétrica)" — HMAC y AES como bloques base, un índice cifrado para buscar sin descifrar todo, de un modelo simple a uno más seguro, qué puede ver el servidor y qué no.
- Columna oscura: "Hoy: la parte asimétrica" — PEKS, por qué solo no alcanza, la solución real (combinar clave pública + simétrica), una firma digital, y el caso OSA.

### 🧠 La idea en una frase
Es el mapa de ruta: no es un tema nuevo, es la otra mitad del mismo problema.

### 🗣️ Discurso sugerido
> "Como mapa de ruta: del lado simétrico ya vimos cómo cifrar un índice de búsqueda usando HMAC y AES, de forma que el servidor pueda encontrar coincidencias sin ver el contenido.
>
> Hoy vamos a ver PEKS, una construcción de clave pública pensada para el mismo problema; por qué usarla sola tiene un problema real, no solo de velocidad; cómo se resuelve en la práctica combinando las dos ideas; una firma digital para que quede constancia de quién autorizó qué; y todo esto en un caso concreto que armamos: OSA."

---

## Filmina 3 — El límite del modelo simétrico

### 📋 Qué dice la filmina
- SSE clásico asume una única parte con la clave secreta.
- Tres tarjetas: Escritura de terceros (un médico cifra para un paciente sin tener sus claves) · Delegación temporal (revocable, sin haberse visto antes) · Distribución de claves (repartir un secreto por un canal no confiable).
- Cierre: la salida clásica a esto es la criptografía de clave pública.

### 🧠 La idea en una frase
El modelo simétrico asume que todos los que necesitan cifrar o buscar ya comparten una clave secreta. En la vida real (un historial clínico) eso casi nunca es cierto.

### 🗣️ Discurso sugerido
> "En SSE clásico, la misma persona cifra, indexa y después busca. Eso funciona perfecto para un backup personal. Pero se rompe apenas aparece alguien más: un médico necesita subir un análisis PARA un paciente, sin haber tenido jamás sus claves. El paciente necesita darle a ese médico permiso para buscar durante 45 minutos, de forma revocable, sin haberlo visto antes por ningún canal seguro.
>
> Repartir un secreto por un canal que no es confiable, en el momento, es exactamente el problema que la criptografía de clave pública nació para resolver."

---

## Filmina 4 — PEKS

### 📋 Qué dice la filmina
- Motivación: correo cifrado buscable — cualquiera cifra con la clave pública de Bob; un gateway filtra sin tener la clave privada de Bob.
- Referencia: Boneh, Di Crescenzo, Ostrovsky, Persiano — EUROCRYPT 2004.
- Cuatro pasos en lenguaje simple: (1) Crear las claves — un par público/privado. (2) Cifrar una palabra — cualquiera, con la pública. (3) Pedir permiso de búsqueda — solo el dueño, con la privada. (4) Comparar, sin leer — lo hace el servidor, y responde sí/no.
- Cada paso tiene, como referencia chica, su nombre técnico (KeyGen, PEKS, Trapdoor, Test) — no hace falta memorizarlos, están para que si preguntan "¿cómo se llama ese paso?" tengas la respuesta a mano.

### 🧠 La idea en una frase
PEKS da vuelta el modelo: en vez de una clave secreta que cifra Y busca, hay una clave pública que cualquiera usa para cifrar, y una clave privada que solo el dueño usa para autorizar búsquedas.

### 🗣️ Discurso sugerido
> "PEKS —cifrado de clave pública con búsqueda por palabra clave— nace en 2004, pensado originalmente para correo: cualquiera cifra un mensaje para Bob usando su clave pública, sin coordinar nada en secreto con él. Un gateway de correo, sin la clave privada de Bob, puede filtrar por palabra clave sin leer el contenido.
>
> Funciona en cuatro pasos simples. Primero se genera un par de claves: una pública, que se puede compartir con cualquiera, y una privada, que se guarda en secreto. Segundo, cualquiera con la clave pública puede cifrar una palabra. Tercero, solo el dueño de la clave privada puede generar un 'permiso de búsqueda' para una palabra puntual. Y cuarto, el servidor compara ese permiso con lo cifrado y responde sí o no — sin nunca ver cuál era la palabra."

> Si te preguntan por la matemática de base: usa una construcción de curvas elípticas más compleja que un simple HMAC (emparejamientos bilineales). No hace falta que entres en el detalle — alcanza con "es una operación de clave pública, bastante más cara que un HMAC".

---

## Filmina 5 — Seguridad de PEKS y por qué igual falla

### 📋 Qué dice la filmina
- Panel claro: "Sin permiso, no se puede adivinar" — sin el permiso de búsqueda de una palabra, el cifrado no dice nada sobre cuál es. Esto está formalmente probado (nombre técnico: IND-CKA).
- Panel de alerta (ámbar): "Pero se puede adivinar la palabra" — cifrar la misma palabra siempre da el mismo resultado. Si alguien consigue UN permiso filtrado, puede probar tranquilo una lista de palabras candidatas hasta encontrar cuál coincide. No hace falta robar nada, porque la clave que usa para probar es pública.
- Cita: el problema no es de velocidad, es que las palabras de búsqueda nunca tuvieron tantas combinaciones posibles como una clave secreta.

### 🧠 La idea en una frase
PEKS cumple su promesa formal, pero esa promesa no cubre lo que pasa una vez que alguien ya tiene un permiso de búsqueda: ahí se puede "probar" un diccionario de palabras, algo que en SSE simétrico no es posible.

### 🗣️ Discurso sugerido
> "PEKS cumple lo que promete: sin el permiso de búsqueda correcto, el cifrado de una palabra es indistinguible del cifrado de cualquier otra. Eso está probado formalmente.
>
> Pero hay una vuelta de tuerca real, publicada en 2006: como cifrar la misma palabra siempre da el mismo resultado, alguien que consiga UN permiso de búsqueda filtrado puede, tranquilamente y sin apuro, probar una lista de palabras candidatas —un diccionario— hasta encontrar cuál coincide. Y lo puede hacer sin robar ninguna clave secreta, porque la clave que necesita para probar candidatos es, por diseño, pública.
>
> ¿Por qué esto no pasa en SSE simétrico? Porque ahí no existe una clave pública contra la cual cualquiera pueda probar candidatos sin conocer el secreto. La conclusión de los autores que encontraron esto es contundente: el problema no es de velocidad, es que las palabras que usamos para buscar —a diferencia de una clave de 256 bits— nunca tuvieron tantas combinaciones posibles."

---

## Filmina 6 — Tabla comparativa SSE vs PEKS

### 📋 Qué dice la filmina
- Tabla con 6 filas simples: primitiva base, costo de generar un permiso de búsqueda, velocidad de búsqueda, si soporta varios escritores sin compartir clave, punto débil conocido, escala práctica.
- Cierre: ninguno de los dos alcanza solo.

### 🧠 La idea en una frase
SSE gana en velocidad; PEKS gana en que no hace falta compartir una clave de antemano. Ninguno de los dos resuelve todo por sí solo.

### 🗣️ Discurso sugerido
> "Esta tabla resume la comparación. En rendimiento, SSE gana claramente: generar un permiso de búsqueda en SSE tarda nanosegundos, en PEKS tarda milisegundos, y buscar en SSE es mucho más rápido porque no hace falta recorrer todo el índice.
>
> Pero hay una fila donde PEKS gana: permite que varias personas cifren sin haber compartido nunca una clave secreta entre ellas, exactamente el problema que planteamos antes. Y hay una fila donde pierde: el ataque de diccionario que acabamos de ver. La conclusión no es 'uno es mejor', es que cada uno resuelve una parte distinta del problema."

---

## Filmina 7 — Cifrado híbrido

### 📋 Qué dice la filmina
- Idea: usar clave pública SOLO para envolver una clave simétrica de un solo uso; usar esa clave simétrica para todo el trabajo pesado.
- Diagrama de 5 pasos: clave pública del destino → se combina y deriva → clave simétrica efímera → se cifra el contenido real → resultado.
- "En criollo", en tres pasos simples.
- Nombre técnico: esto es exactamente ECIES (un estándar, no algo que inventamos).

### 🧠 La idea en una frase
No se usa clave pública para todo el contenido — se usa solo para "entregar" una clave simétrica de un solo uso, y esa clave simétrica hace el trabajo pesado.

### 🗣️ Discurso sugerido
> "La salida real no es elegir entre SSE puro o PEKS puro, es no usar ninguno de los dos puro. La idea, en criollo: se genera una clave de un solo uso. Esa clave se cifra con la clave pública del destinatario, así que solo él la puede abrir. Y todo el contenido real —el documento, el índice de búsqueda— se cifra con esa clave de un solo uso, que es simétrica y mucho más rápida.
>
> Esto tiene nombre: se llama ECIES, es un estándar que ya se usa hace años en cosas como el correo cifrado o las apps de mensajería. No lo inventamos nosotros — lo que hicimos fue aplicarlo con curvas modernas en el contexto de una historia clínica."

---

## Filmina 8 — Caso de estudio OSA

### 📋 Qué dice la filmina
- OSA: MVP de historia clínica donde el servidor (escrito en Go) es un "custodio ciego" — nunca ve nada en claro.
- Cuatro piezas: Argon2id (deriva las claves desde la contraseña), AES-256-GCM (cifra el contenido), HMAC-SHA256 (arma el índice de búsqueda), X25519/Ed25519 (identidad y firma).
- Diagrama en árbol: de la contraseña sale una "semilla", y de ahí se ramifican las cuatro claves del paciente.

### 🧠 La idea en una frase
Todo lo visto hasta ahora, bajado a una aplicación real que funciona.

### 🗣️ Discurso sugerido
> "Para no quedarnos solo en la teoría, construimos OSA: una historia clínica donde el servidor —sin frameworks de terceros, a propósito, para reducir riesgos— nunca ve contenido clínico, ni claves, ni las palabras que alguien busca.
>
> La contraseña del paciente nunca sale de su navegador. De ahí se deriva una semilla, y de esa semilla salen cuatro cosas: un par de claves pública/privada para identidad y firma, una clave para cifrar documentos, una clave para armar el índice de búsqueda, y una clave auxiliar. La clave pública del paciente es, justamente, pública: cualquier médico la usa para cifrar hacia él. Su clave privada vive solo en la memoria de su propio navegador.
>
> Y una aclaración importante, porque es fácil confundirla: de estas cuatro cosas, la única que es asimétrica es el par de identidad. La clave del índice de búsqueda sigue siendo simétrica, el mismo esquema HMAC del trabajo anterior. Lo asimétrico no busca nada — solo permite delegar y firmar quién puede usar esa clave simétrica."

---

## Filmina 9 — Así lo hace OSA

### 📋 Qué dice la filmina
- Los mismos 4 pasos de la filmina 7, pero con las palabras concretas de la app: se crea una clave de un solo uso → se combina con la clave del destino → se deriva una clave AES → se cifra el contenido.
- Panel "Paso a paso, en la aplicación": los mismos 4 pasos explicados en una oración cada uno.
- Panel "¿Por qué no usar directamente lo que trae el navegador?": porque el soporte de esta curva específica no es parejo entre navegadores, así que se usa una librería aparte, ya revisada, para que el navegador y el servidor "hablen el mismo idioma".

### 🧠 La idea en una frase
Es la filmina 7, pero mostrando que no quedó solo en un diagrama: es exactamente lo que corre en la aplicación real.

### 🗣️ Discurso sugerido
> "Esto es la idea anterior, tal cual corre en el navegador de cada paciente y médico. Se crea una clave de un solo uso, se la combina con la clave pública del destinatario para obtener un secreto que solo esas dos partes pueden calcular, ese secreto se convierte en una clave AES lista para usar, y con esa clave se cifra el contenido real.
>
> Una aclaración de implementación, por si preguntan: no usamos el sistema de criptografía que trae el navegador porque su soporte de esta curva específica no es parejo entre todos los navegadores. Usamos una librería aparte, ya revisada por otros, para que el navegador y el servidor —escrito en otro lenguaje— usen exactamente la misma matemática."

---

## Filmina 10 — El ticket de delegación temporal

### 📋 Qué dice la filmina
- Tres columnas: Paciente / Servidor (custodio ciego) / Médico.
- Paso 1 (paciente): junta sus claves de búsqueda y lectura, las cifra para que solo el médico las pueda abrir, y firma todo el paquete.
- Paso 2 (servidor): guarda el paquete firmado, revisa la firma y que no haya vencido (máximo 120 minutos), pero nunca puede abrirlo.
- Paso 3 (médico): descarga el paquete, lo abre con su propia clave privada, y busca en su propia computadora.
- Corrección real: sin un paquete extra, un médico autorizado podía encontrar un documento pero nunca abrirlo.

### 🧠 La idea en una frase
El cifrado (filminas 7-9) protege el contenido; la firma agrega algo distinto: que quede constancia de que fue el paciente, y solo el paciente, quien autorizó esa delegación puntual.

### 🗣️ Discurso sugerido
> "Cifrar nos protege el contenido, pero no dice nada sobre quién autorizó qué. Para eso está la firma digital: el paciente firma todo el paquete de delegación —a quién, con qué alcance, hasta cuándo— con su propia clave de firma.
>
> El flujo tiene tres pasos. El paciente arma el paquete y lo firma. El servidor lo guarda, revisa la firma y el vencimiento, pero nunca puede abrirlo porque no tiene la clave privada del médico. El médico lo descarga, lo abre con su propia clave, y busca todo en su propia computadora.
>
> El recuadro de abajo es un bug real que encontramos armando esto: si solo protegemos el paquete de una forma, un médico autorizado podía encontrar que un documento existe, pero nunca podía abrirlo — porque le faltaba la llave correcta. La corrección fue agregar un segundo paquete, pensado específicamente para que un médico con delegación activa sí pueda abrirlo."

---

## Filmina 11 — Tres cosas que solo aparecieron al construirlo

### 📋 Qué dice la filmina
- (1) Los resultados de una búsqueda nunca se abren en el servidor: viajan cifrados, se abren en la computadora de quien busca, y el control de acceso real pasa cuando se pide cada documento.
- (2) Cambiar la clave maestra sin volver a envolver cada documento existente deja todo el historial anterior imposible de leer — no es que el sistema falle, es que se pierden los datos para siempre.
- (3) El relleno que oculta el tamaño de los archivos tiene que calcularse sobre el paquete ya cifrado, no sobre el texto original, o el servidor rechaza cada archivo que se sube.
- Fuera de alcance de este MVP, a propósito: acceso de emergencia, cifrado de disco, verificar matrícula médica real, exportar en un formato médico estándar (FHIR).

### 🧠 La idea en una frase
Ningún diseño en papel anticipa todo — estas tres son fallas reales que solo aparecieron probando la aplicación de punta a punta, no leyendo el diseño.

### 🗣️ Discurso sugerido
> "Quiero cerrar con honestidad sobre el proceso. Estas tres cosas no estaban previstas en el diseño original y aparecieron recién al construir la aplicación de verdad, con pruebas de punta a punta.
>
> Primero: los resultados de una búsqueda nunca se abren en el servidor — viajan cifrados, se abren en la computadora de quien busca, y ahí es donde realmente se controla el acceso, documento por documento.
>
> Segundo, el más serio: si cambiás la clave maestra del paciente sin volver a envolver cada documento que ya tenía, ese historial queda imposible de leer para siempre. No es una falla temporaria, es pérdida de datos.
>
> Tercero: el relleno que usamos para que el tamaño de un archivo no revele qué tipo de documento es, hay que calcularlo sobre el paquete final ya cifrado, no sobre el texto original — si no, el servidor rechaza literalmente cada archivo.
>
> Y para ser honestos con el alcance: dejamos afuera a propósito el acceso de emergencia, el cifrado de disco, la verificación real de matrícula médica, y la exportación en un formato médico estándar. Son decisiones de alcance para un MVP, no descuidos."

---

## Filmina 12 — Síntesis y conclusiones

### 📋 Qué dice la filmina
- Cuatro conclusiones numeradas + referencias.

### 🧠 La idea en una frase
Cierre: no agregues conceptos nuevos, solo repasá lo ya dicho con seguridad.

### 🗣️ Discurso sugerido
> "Para cerrar, cuatro ideas.
>
> Primero: el límite real de SSE simétrico no es la velocidad, es que asume una sola clave compartida, y eso no siempre existe.
>
> Segundo: PEKS resuelve ese problema en la teoría, pero paga un costo real — se puede adivinar la palabra con un diccionario, además de ser más lento.
>
> Tercero: la solución que se usa en la práctica combina las dos cosas — clave pública solo para entregar una clave de un solo uso, y clave simétrica para todo el trabajo pesado.
>
> Y cuarto: construir esto de verdad, no solo diseñarlo en papel, expone problemas que ningún documento de diseño anticipa por sí solo — encontramos y corregimos varios en el camino.
>
> Muchas gracias por su atención. Quedo a disposición para sus preguntas."

### Referencias para citar si preguntan
- Boneh, Di Crescenzo, Ostrovsky, Persiano — *"Public Key Encryption with Keyword Search"*, EUROCRYPT 2004.
- Byun, Rhee, Park, Lee — *"Off-Line Keyword Guessing Attacks on Recent Keyword Search Schemes over Encrypted Data"*, 2006.
- Curtmola, Garay, Kamara, Ostrovsky — 2006 (trabajo anterior, cripto simétrica).
- Bernstein — *"Curve25519: new Diffie-Hellman speed records"*, 2006.
- Bernstein, Duif, Lange, Schwabe, Yang — *"High-speed high-security signatures"* (Ed25519), 2011.

---

## 🔥 Preguntas Frecuentes del Jurado y Cómo Responder (en lenguaje simple)

### ❓ "¿Por qué no usaron PEKS directamente en la aplicación?"
> "Por dos motivos. Primero, PEKS tiene el problema del diccionario que mostramos: como las palabras médicas no tienen tanta variedad, alguien con un permiso filtrado podría adivinar buena parte de lo que se buscó. Segundo, es más lento y no escala tan bien. Por eso usamos un diseño combinado: clave pública solo para entregar claves, y todo el trabajo pesado de búsqueda con las técnicas simétricas que vimos en el trabajo anterior."

### ❓ "Si ustedes también usan clave pública, ¿no tienen el mismo problema del diccionario?"
> "No, porque no ciframos palabras con la clave pública. Los permisos de búsqueda siguen siendo los del esquema simétrico —derivados de una clave secreta que nunca sale del navegador del usuario—, no de una clave pública de acceso libre. La clave pública en nuestro diseño solo se usa para 'entregar' otras claves dentro de un paquete cifrado, nunca para cifrar palabras directamente. Por eso no hay forma de aplicar ese ataque de diccionario en nuestro esquema."

### ❓ "¿Qué pasa si el servidor es hackeado por completo?"
> "El servidor nunca tiene, en ningún momento, el contenido en claro, las claves de cifrado, ni las palabras buscadas — solo ve paquetes cifrados y permisos de búsqueda que no puede interpretar. Si lo hackean, lo que se filtra es información indirecta —qué documentos coinciden con qué búsquedas, tamaños de archivo— pero no el contenido clínico ni las claves. Además, guardamos un registro firmado e inmutable de accesos, así que un compromiso quedaría detectable."

### ❓ "¿Por qué usan dos tipos de claves distintas —una para cifrar, otra para firmar— y no una sola?"
> "Son curvas relacionadas pero pensadas para roles distintos: una para acordar secretos entre dos partes (cifrar), otra optimizada específicamente para firmar. Además, elegimos la de firma porque no depende de un número aleatorio nuevo en cada firma — eso evita una clase entera de errores graves que sí existen en otros esquemas de firma más viejos."

### ❓ "¿Por qué no confiar en las herramientas de criptografía que ya trae el navegador?"
> "Porque el soporte de la curva específica que necesitábamos no es parejo entre todos los navegadores. Usamos una librería externa, ya revisada por la comunidad, para tener consistencia entre lo que corre en el navegador y lo que corre en el servidor."

### ❓ "¿Qué tan realista es el problema que están resolviendo?"
> "Es, de hecho, el caso típico de cualquier historia clínica compartida: no hay un solo dueño de los datos que también los genera — laboratorios, médicos de distintas especialidades, muchas veces sin haber tenido contacto previo con ese paciente, necesitan poder escribir información sobre él. Es exactamente el mismo tipo de problema que motivó a los autores originales de PEKS en 2004, pensando en correo electrónico."

### ❓ "Mencionaron que encontraron bugs reales. ¿Cómo los encontraron?"
> "Escribiendo una prueba automática de punta a punta que ejecuta el flujo completo —registro, subida de un documento, búsqueda, delegación, revocación, cambio de clave— contra un servidor y una base de datos reales, usando el mismo código que corre en el navegador, no una versión simplificada. Varios de los problemas más importantes solo aparecían al ejecutar ese flujo completo una vez; no se detectaban solo leyendo el código."
