# 🎤 Speech Completo — 11 Filminas de SSE
## Basado en: [sse_cifrado_simetrico.pptx](file:///c:/Users/herna/Downloads/resumenes-maestria-en-ciberdefensa/Trabajo%20final%20de%20criptografia%20simetrica/sse_cifrado_simetrico.pptx)

> [!TIP]
> Este documento contiene **exactamente lo que debés saber y decir** para cada una de las 11 filminas. Incluye: conceptos clave, qué dice la filmina, qué tenés que explicar y el discurso sugerido textual.

---

## 📊 Mapa de la Exposición

| # | Título de la Filmina | Tema Central |
|:-:|:---|:---|
| 1 | Portada: Cifrado Simétrico en SSE | Presentación y encuadre |
| 2 | El Problema: Buscar sin ver | La tensión cliente/servidor |
| 3 | ¿Por qué no alcanza con AES estándar? | IND-CPA destruye la búsqueda |
| 4 | Primitivas Base: PRF y PRP | Los bloques constructores |
| 5 | La Idea Central: El índice invertido cifrado | La estructura T + A |
| 6 | Construcción SSE-1 (Curtmola 2006) | Los 4 algoritmos formales |
| 7 | SSE-2: Seguridad adaptativa | CKA1 vs CKA2 |
| 8 | El perfil de fuga (leakage) | Qué se acepta revelar |
| 9 | Simétrico vs. Clave Pública (PEKS) | La brecha de eficiencia |
| 10 | El trade-off: eficiencia vs. fuga | El eje de diseño |
| 11 | Síntesis y conclusiones | Cierre y referencia al paper |

---

## Filmina 1 — Portada: Cifrado Simétrico en SSE

### 📋 Qué dice la filmina
- **Título:** *"CRIPTOGRAFÍA APLICADA — SSE: Cifrado Simétrico en SSE"*
- **Subtítulo:** *"El núcleo criptográfico que hace posible la búsqueda sobre datos cifrados"*
- Menciona las tres columnas: **PRF** (Función Pseudoaleatoria), **PRP** (Permutación Pseudoaleatoria), y la referencia al paper de **Curtmola, Garay, Kamara, Ostrovsky — SSE-1 / SSE-2 (2006)**.

### 🧠 Qué tenés que saber
- SSE = *Symmetric Searchable Encryption* (Cifrado Simétrico Buscable).
- El trabajo se centra en cómo las primitivas simétricas (no de clave pública) son las que hacen posible buscar sobre datos cifrados de forma eficiente.
- Las dos primitivas fundamentales son las **PRF** y las **PRP** (que en la práctica se instancian como HMAC y AES respectivamente).
- El paper fundacional es el de Curtmola et al. (2006), que propone dos esquemas: SSE-1 (no adaptativo) y SSE-2 (adaptativo).

### 🗣️ Discurso sugerido
> "Buenos días. El tema de esta presentación es el **Cifrado Simétrico Buscable**, conocido en la literatura como SSE por sus siglas en inglés (*Symmetric Searchable Encryption*).
>
> El objetivo es analizar cuál es el **núcleo criptográfico** que hace posible que un servidor que no es de confianza pueda ejecutar búsquedas sobre datos cifrados sin descifrarlos ni aprender su contenido.
>
> La tesis central del trabajo es que esta capacidad no proviene de criptografía de clave pública sino de dos **primitivas simétricas** muy específicas: las funciones pseudoaleatorias (PRF) y las permutaciones pseudoaleatorias (PRP), que son órdenes de magnitud más rápidas.
>
> Nos basamos en el paper fundacional de **Curtmola, Garay, Kamara y Ostrovsky** del año 2006, que propone las construcciones SSE-1 y SSE-2 con las primeras pruebas formales de seguridad del área."

---

## Filmina 2 — El Problema: Buscar sin ver

### 📋 Qué dice la filmina
- Un **cliente** cifra sus documentos y los delega a un **servidor no confiable**.
- El cliente necesita recuperar documentos que contienen una palabra clave **sin que el servidor aprenda el contenido** y **sin descargar todo el dataset**.
- Flujo: Cliente (posee K, cifra y sube) → Servidor (almacena cifrado + índice cifrado, nunca ve texto plano) → Cliente autorizado (genera trapdoor con K para buscar).
- **Objetivo de SSE:** confidencialidad + capacidad de búsqueda, sin servidor confiable y sin cifrado de clave pública en el camino crítico.

### 🧠 Qué tenés que saber
- El modelo de adversario es el **honest-but-curious** (honesto pero curioso): el servidor cumple el protocolo correctamente pero intenta aprender todo lo que pueda de los datos que almacena.
- La palabra **trapdoor** es el token criptográfico que el cliente genera localmente a partir de su clave secreta K y la palabra que quiere buscar. El servidor puede usar ese token para buscar pero no puede deducir qué palabra representa.
- El problema fundamental: si descifro en el servidor pierdo confidencialidad; si descifro todo en el cliente no escala.

### 🗣️ Discurso sugerido
> "El escenario de partida es el siguiente: tenemos un **cliente** que posee una colección de documentos sensibles y una clave simétrica secreta K. Este cliente necesita delegar el almacenamiento a un **servidor externo**, que bajo un modelo de amenazas realista en ciberdefensa no consideramos confiable.
>
> Ahora bien, delegar el almacenamiento es trivial si sólo ciframos y subimos los archivos. El verdadero desafío aparece cuando el cliente necesita **buscar**. ¿Cómo recupero los documentos que contienen una palabra clave específica sin que el servidor vea el contenido en claro y sin tener que descargarme todo el dataset para filtrar localmente?
>
> Acá es donde entra el concepto de **trapdoor**: el cliente computa localmente un token criptográfico derivado de su clave K y de la palabra que quiere buscar. Le envía ese valor al servidor. El servidor lo usa como clave de búsqueda contra el índice cifrado, encuentra las coincidencias y devuelve los identificadores. Pero en ningún momento el servidor aprende cuál era la palabra original ni puede descifrar los documentos.
>
> El objetivo de SSE es lograr esta dualidad: **confidencialidad absoluta de los datos** más **capacidad operativa de búsqueda**, sin recurrir a criptografía de clave pública que sería demasiado costosa computacionalmente."

---

## Filmina 3 — ¿Por qué no alcanza con AES estándar?

### 📋 Qué dice la filmina
- El cifrado simétrico semánticamente seguro (**IND-CPA**) es exactamente lo que rompe la búsqueda: dos cifrados del mismo texto son indistinguibles, por lo que el servidor no puede comparar nada.
- Se presentan **3 alternativas descartadas** y por qué fallan:
  1. **Descifrar en el servidor** → Rompe la confidencialidad (el servidor ve todo en claro).
  2. **Cifrado determinista simple** → Mismo texto da mismo cifrado, permite indexar, pero expone patrones de frecuencia (análisis estadístico revela el vocabulario).
  3. **Descargar todo y filtrar en el cliente** → Preserva la seguridad pero es lineal en el tamaño del dataset: inviable a escala.
- **La salida:** no es abandonar el cifrado simétrico, es **estructurarlo distinto**: separar el índice de búsqueda del contenido, y usar primitivas específicas (PRF, PRP) para generar accesos controlados.

### 🧠 Qué tenés que saber
- **IND-CPA** = *Indistinguishability under Chosen Plaintext Attack*. Significa que cifrar el mismo texto plano dos veces genera textos cifrados distintos (gracias al IV/nonce aleatorio). Es la definición estándar de seguridad semántica.
- El cifrado determinista permite buscar pero destruye la seguridad semántica: un atacante con estadísticas de frecuencia de palabras puede recuperar el vocabulario sin la clave.
- La clave conceptual de esta filmina: **el problema no es cifrar, es cifrar manteniendo una estructura de acceso controlada**. SSE resuelve esto separando el índice de búsqueda (estructura) del contenido (documentos).

### 🗣️ Discurso sugerido
> "Antes de explicar cómo funciona SSE, necesitamos entender **por qué las soluciones obvias no funcionan**.
>
> Si usamos un cifrado simétrico estándar como AES-GCM, obtenemos seguridad semántica en el sentido formal de **IND-CPA**: el mismo texto plano cifrado dos veces produce dos textos cifrados completamente distintos gracias al vector de inicialización aleatorio. Esto es excelente para la confidencialidad, pero **destruye toda posibilidad de búsqueda** desde el servidor, porque no puede comparar nada.
>
> ¿Qué alternativas tenemos? La primera sería descifrar en el servidor para que pueda indexar. Obviamente esto destruye la confidencialidad y es inaceptable. La segunda sería usar un **cifrado determinista** donde el mismo texto plano siempre produzca el mismo texto cifrado. Esto permitiría buscar por igualdad, pero expone los **patrones de frecuencia**: un atacante con una distribución conocida de palabras puede reconstruir el vocabulario por análisis estadístico elemental. La tercera opción es que el cliente descargue todo el dataset cifrado y filtre localmente. Esto preserva la seguridad pero es **lineal en el tamaño del dataset**, completamente inviable a escala.
>
> La conclusión clave es que la solución **no es abandonar el cifrado simétrico** sino **reestructurarlo**: separar un índice de búsqueda cifrado del contenido cifrado, y usar primitivas simétricas específicas — PRF y PRP — para generar accesos controlados y acotados. Esto es exactamente lo que construye SSE."

---

## Filmina 4 — Primitivas Base: PRF y PRP

### 📋 Qué dice la filmina
- **PRF — Función Pseudoaleatoria**: F : {0,1}^λ × {0,1}^m → {0,1}^n
  - *Uso en SSE:* Deriva claves e identificadores por palabra clave a partir de una clave maestra K y el término w.
  - *Rol estructural:* Genera el trapdoor de búsqueda y las claves por-nodo del índice.
- **PRP — Permutación Pseudoaleatoria**: P : {0,1}^λ × {0,1}^n → {0,1}^n (biyectiva)
  - *Uso en SSE:* Un cifrador de bloque (ej. AES) modelado como permutación indistinguible de una aleatoria.
  - *Rol estructural:* Cifra los nodos del índice de forma que sean indistinguibles sin la clave.
- Ambas son **órdenes de magnitud más rápidas** que operaciones de clave pública.

### 🧠 Qué tenés que saber
- **PRF:** Dada una clave secreta K y una entrada x, produce una salida determinista que es **indistinguible de aleatoria** para cualquier adversario sin K. En la práctica se instancia con **HMAC-SHA256**. Es determinista (misma entrada → misma salida), lo cual es crucial para que el cliente pueda regenerar el mismo trapdoor.
- **PRP:** Es una PRF que además es **biyectiva** (invertible). En la práctica se instancia con **AES**. Se usa para cifrar cada nodo individual del índice.
- La diferencia clave: PRF no necesita ser invertible (se usa para derivar valores); PRP sí necesita ser invertible (se usa para cifrar/descifrar nodos).
- La velocidad: una evaluación de HMAC o AES tarda **nanosegundos**, mientras que una operación de clave pública (RSA, emparejamientos bilineales) tarda **milisegundos** o más. Esto es lo que permite que SSE escale a millones de documentos.

### 🗣️ Discurso sugerido
> "Todo esquema de SSE se construye sobre dos primitivas simétricas fundamentales.
>
> La primera es la **Función Pseudoaleatoria (PRF)**. Formalmente, es una función que toma una clave secreta de λ bits y una entrada de m bits, y produce una salida de n bits. La propiedad fundamental es que para cualquier adversario computacionalmente acotado que no posea la clave K, la salida es **indistinguible de una cadena aleatoria**. En la práctica, la instanciamos con **HMAC-SHA256**. Dentro de SSE, la PRF cumple dos roles: primero, genera los **trapdoors** de búsqueda derivando un valor pseudoaleatorio a partir de K y la palabra buscada w; segundo, deriva las **claves individuales por nodo** del índice invertido.
>
> La segunda primitiva es la **Permutación Pseudoaleatoria (PRP)**. A diferencia de la PRF, la PRP es **biyectiva**: tiene una inversa eficiente. En la práctica, esto es un cifrador de bloque como **AES**. Su rol en SSE es cifrar cada nodo del índice de manera individual, de forma que sin la clave el contenido sea indistinguible de bytes aleatorios.
>
> El punto crucial es que ambas primitivas operan en **nanosegundos**, órdenes de magnitud más rápido que cualquier operación de clave pública. Esta es la razón por la cual SSE puede escalar a colecciones de millones de documentos."

---

## Filmina 5 — La Idea Central: El índice invertido cifrado

### 📋 Qué dice la filmina
- En vez de cifrar documentos y esperar poder inspeccionarlos, SSE construye un **índice invertido** (palabra clave → lista de documentos) y lo cifra como estructura completa usando PRF y PRP.
- **Flujo:** palabra clave w (en claro, solo del lado cliente) → F(K, w) con PRF → trapdoor (valor pseudoaleatorio enviado al servidor) → lookup en T (el servidor solo compara bytes).
- **Tabla de búsqueda T:** Indexada por el trapdoor de cada palabra. Cada entrada está cifrada y apunta al primer nodo de la lista de documentos correspondiente en A, junto con la clave para desencadenarla.
- **Arreglo enlazado A:** Nodos cifrados individualmente, cada uno con un identificador de documento y un puntero al siguiente nodo, cifrado con una clave distinta derivada por PRF, de forma que no revela la longitud de la lista de antemano.

### 🧠 Qué tenés que saber
- Un **índice invertido** es una estructura clásica de recuperación de información (la usan Google, Elasticsearch, etc.): para cada palabra del vocabulario, se mantiene la lista de documentos que la contienen.
- La **tabla T** es una tabla hash. La clave de búsqueda no es la palabra en claro, sino el **trapdoor** F(K, w). El servidor busca ese valor en T y obtiene: (a) la dirección del primer nodo de la lista enlazada en A, y (b) la clave para descifrar ese primer nodo.
- El **arreglo A** contiene nodos cifrados individualmente. Cada nodo al descifrarse revela: el ID del documento y la dirección + clave del siguiente nodo. Esto forma una **lista enlazada ciega** que el servidor recorre nodo a nodo.
- Las direcciones físicas de los nodos en A están **dispersas pseudoaleatoriamente**, por lo que el servidor no puede deducir la longitud de la lista sin recorrerla.

### 🗣️ Discurso sugerido
> "El avance conceptual clave de SSE es no intentar buscar *dentro* de documentos cifrados, sino construir una **estructura de índice separada** — un índice invertido cifrado — que permite localizar los documentos sin tocar su contenido.
>
> En un índice invertido clásico, para cada palabra del vocabulario se mantiene una lista de documentos que la contienen. SSE cifra esta estructura completa usando las primitivas que acabamos de ver.
>
> La estructura tiene dos componentes. Primero, una **Tabla de búsqueda T**: para cada palabra w del vocabulario, el cliente computa el trapdoor F(K, w) usando la PRF y lo usa como clave de índice en T. La entrada correspondiente contiene, cifrada, la dirección del primer nodo de una lista enlazada y la clave para descifrar ese primer nodo.
>
> Segundo, un **Arreglo enlazado A**: los nodos están dispersos pseudoaleatoriamente en la memoria del servidor. Cada nodo, al ser descifrado con su clave específica derivada por PRF, revela dos cosas: el **identificador del documento** que contiene la palabra, y la **dirección y clave del siguiente nodo** de la lista. De esta forma, el servidor puede recorrer la cadena nodo a nodo, pero **no puede saber de antemano cuántos nodos tiene la lista**, porque las direcciones son pseudoaleatorias y cada nodo se cifra con una clave distinta."

---

## Filmina 6 — Construcción SSE-1 (Curtmola et al., 2006)

### 📋 Qué dice la filmina
- El primer esquema con **prueba formal de seguridad** y **complejidad de búsqueda sublineal**: proporcional a los documentos que coinciden, no al tamaño del dataset.
- **4 algoritmos:**
  1. **Setup:** El cliente genera claves maestras para las PRF y construye T y A a partir de la colección de documentos en claro.
  2. **Encrypt:** Cada nodo de A se cifra con una clave por-palabra derivada por PRF; cada entrada de T se cifra con una clave derivada de una PRF distinta.
  3. **Trapdoor:** Para buscar w, el cliente calcula F(K, w) y lo envía — un valor pseudoaleatorio que no revela w.
  4. **Search:** El servidor usa el trapdoor para ubicar la entrada en T, desencadena el puntero inicial y recorre A devolviendo solo los IDs cifrados de esa lista.
- **Modelo de seguridad:** CKA1 — seguro contra un adversario que elige sus consultas **sin** ver resultados previos (no adaptativo).

### 🧠 Qué tenés que saber
- **CKA1** = *Chosen-Keyword Attack 1*. El adversario debe elegir todas sus consultas por adelantado, antes de ver cualquier resultado. Es un modelo de seguridad más débil (pero más fácil de probar).
- La complejidad de búsqueda es **O(t)** donde t es el número de documentos que coinciden, **no** O(N) donde N es el total. Esto es la sublinealidad.
- El Setup y Encrypt son operaciones **offline** que el cliente ejecuta una sola vez. Trapdoor y Search son operaciones **online** que se ejecutan cada vez que se busca.
- El cliente destruye los textos planos locales después de subir T y A al servidor.

### 🗣️ Discurso sugerido
> "La construcción SSE-1 de Curtmola y colaboradores fue la primera en lograr dos hitos simultáneos: una **prueba formal de seguridad** y una **complejidad de búsqueda sublineal**.
>
> El protocolo se define mediante cuatro algoritmos. Primero, **Setup**: el cliente genera las claves maestras para las PRF que usará en todo el sistema. Segundo, **Encrypt**: con esas claves, el cliente construye la tabla T y el arreglo A a partir de sus documentos en claro. Cada nodo de A se cifra con una clave por-palabra derivada por PRF, y cada entrada de T se cifra con una clave derivada de una PRF independiente. Una vez construido, el cliente sube T, A y los documentos cifrados al servidor, y destruye los textos planos locales.
>
> Cuando el cliente necesita buscar, ejecuta el algoritmo **Trapdoor**: calcula F(K, w) para la palabra w que quiere buscar y envía ese valor pseudoaleatorio al servidor. El servidor ejecuta **Search**: usa el trapdoor para ubicar la entrada en T, descifra el puntero inicial, y recorre la lista enlazada en A devolviendo los identificadores de los documentos coincidentes. La complejidad de esta búsqueda es **O(t)**, proporcional únicamente al número de coincidencias, no al tamaño total del dataset.
>
> El modelo de seguridad de SSE-1 se denomina **CKA1** (*Chosen-Keyword Attack 1*), donde el adversario debe fijar todas sus consultas por adelantado sin ver resultados previos. Es un modelo no adaptativo."

---

## Filmina 7 — SSE-2: Seguridad adaptativa

### 📋 Qué dice la filmina
- SSE-1 **no protege** si el atacante elige la siguiente consulta en función de las respuestas anteriores.
- SSE-2 cierra esa brecha con **dos PRF independientes** y una construcción del índice que evita que la fuga se acumule entre consultas.
- **SSE-1 (CKA1, No adaptativo):** El adversario fija todas sus consultas por adelantado. Una sola PRF deriva claves de nodo y de trapdoor. Vulnerable si el servidor correlaciona consultas sucesivas con resultados previos.
- **SSE-2 (CKA2, Adaptativo):** El adversario puede elegir cada consulta tras ver las respuestas anteriores. Dos PRF independientes separan la derivación de claves y de identificadores. La fuga queda acotada al patrón de acceso y de búsqueda — nada más, consulta tras consulta.
- **Nota importante:** adaptativo vs. no-adaptativo **no es un matiz académico** — define si el esquema resiste a un servidor que observa patrones de tráfico en producción, que es el caso real.

### 🧠 Qué tenés que saber
- **CKA2** = *Chosen-Keyword Attack 2*. El adversario es más poderoso: puede observar los resultados de cada consulta y adaptar la siguiente en consecuencia. Esto modela mejor un servidor real en producción que observa el tráfico.
- El problema de SSE-1: si el servidor ve que la consulta A devolvió los documentos {1, 3, 5} y luego adapta su siguiente ataque sabiendo eso, puede acumular información entre consultas.
- La solución de SSE-2: usar **dos PRF completamente independientes** — una para derivar las claves de los nodos del índice y otra para derivar los trapdoors e identificadores. Esto aísla criptográficamente las dos funciones y evita la acumulación de fuga.
- Si te preguntan por qué importa: **todo servidor real en la nube es adaptativo** — observa los patrones de tráfico consulta tras consulta.

### 🗣️ Discurso sugerido
> "SSE-1 es seguro bajo un modelo no adaptativo, pero esto tiene una limitación práctica importante. En el mundo real, un servidor de almacenamiento en la nube **observa cada consulta y sus resultados** antes de ver la siguiente. Es un adversario adaptativo por naturaleza.
>
> SSE-2 cierra esta brecha elevando el modelo de seguridad a **CKA2**, donde el adversario puede elegir cada consulta después de observar las respuestas de las anteriores. La mejora técnica clave es el uso de **dos PRF completamente independientes**: una se dedica exclusivamente a derivar las claves de cifrado de los nodos del arreglo A, y la otra se usa para derivar los trapdoors y los identificadores de la tabla T. Esta separación evita que la información que el servidor gana en una consulta le permita correlacionarla con consultas futuras.
>
> Esto no es un matiz académico menor: define si el esquema resiste en un entorno de producción real donde el servidor acumula observaciones de tráfico. Bajo CKA2, la fuga queda formalmente acotada al **patrón de acceso** y al **patrón de búsqueda** — nada más, consulta tras consulta, sin acumulación."

---

## Filmina 8 — El perfil de fuga (leakage)

### 📋 Qué dice la filmina
- **Ningún esquema de SSE es de fuga cero** — esa es la concesión que compra la eficiencia.
- La seguridad formal consiste en probar que **no se filtra nada más allá de un perfil de fuga explícito y acotado**.
- Tres fugas aceptadas:
  1. **Patrón de acceso:** Qué documentos (identificadores cifrados) coinciden con cada consulta, aunque no su contenido.
  2. **Patrón de búsqueda:** Si dos trapdoors son iguales, el servidor sabe que corresponden a la misma palabra clave, aunque no cuál.
  3. **Tamaño de la colección:** Cantidad de documentos y, según el esquema, longitud aproximada del índice.
- **Lo que las primitivas simétricas garantizan:** más allá de este perfil, cifrado y trapdoors son indistinguibles de valores aleatorios para cualquier adversario computacionalmente acotado. Sin ese límite formal, "SSE seguro" es solo marketing.

### 🧠 Qué tenés que saber
- La fuga **no es un bug**: es una decisión de diseño explícita que se paga a cambio de eficiencia sublineal. La seguridad formal de SSE consiste en demostrar que **nada más que este perfil** se filtra.
- **Patrón de acceso (access pattern):** El servidor ve cuáles identificadores de documentos devuelve para cada consulta. No ve su contenido, pero puede agrupar consultas que devuelven los mismos documentos.
- **Patrón de búsqueda (search pattern):** Como el trapdoor es determinista (F(K, w) siempre da el mismo resultado para la misma w), el servidor puede detectar si la misma palabra fue buscada dos veces.
- La prueba formal utiliza una **simulación**: si existe un simulador que, conociendo solo la fuga declarada, puede generar una vista indistinguible de la real para el adversario, entonces el esquema no filtra nada extra.
- Si te preguntan: "¿Es realmente seguro si filtra el patrón de acceso?" — la respuesta es: depende del caso de uso y del modelo de amenazas. Para muchos escenarios prácticos es aceptable. Pero existen ataques de inferencia que explotan esta fuga (se puede mencionar como conocimiento adicional).

### 🗣️ Discurso sugerido
> "Un punto que debemos abordar con honestidad académica es que **ningún esquema práctico de SSE tiene fuga cero**. Esta no es una debilidad sino una decisión de diseño explícita: la fuga controlada es el precio que pagamos por la eficiencia sublineal.
>
> La seguridad formal de SSE consiste en demostrar que el esquema **no filtra nada más allá de un perfil de fuga declarado y acotado**. Este perfil incluye tres componentes.
>
> Primero, el **patrón de acceso**: el servidor observa qué identificadores de documentos coinciden con cada consulta, aunque no puede leer su contenido. Segundo, el **patrón de búsqueda**: como los trapdoors son deterministas, el servidor puede detectar si dos consultas corresponden a la misma palabra clave, aunque no puede saber cuál. Tercero, el **tamaño de la colección**: la cantidad total de documentos y la longitud aproximada del índice.
>
> Lo fundamental es que **fuera de este perfil**, todo lo que el servidor observa — los trapdoors, las claves derivadas, los nodos cifrados — es indistinguible de valores aleatorios para cualquier adversario computacionalmente acotado. Esta garantía formal es lo que separa un esquema de SSE con prueba de seguridad de una afirmación de seguridad vacía."

---

## Filmina 9 — Simétrico vs. Clave Pública (PEKS)

### 📋 Qué dice la filmina
- Existe una alternativa de clave pública: **PEKS** (*Public-Key Encryption with Keyword Search*), pero su costo computacional la deja fuera de escala para colecciones grandes.
- **Tabla comparativa:**

| | SSE (simétrico) | PEKS (clave pública) |
|:---|:---|:---|
| Primitiva base | PRF / PRP (ej. AES) | Emparejamientos bilineales / RSA |
| Generar un trapdoor | Una evaluación de PRF | Una operación de clave pública |
| Costo relativo | Órdenes de magnitud más rápido | Cientos-miles de veces más lento |
| Complejidad de búsqueda | Sublineal (∝ docs que matchean) | Lineal en el tamaño del índice |
| Escala práctica | Millones de documentos | Colecciones pequeñas / nichos |

- **Conclusión:** Esto no es un detalle de rendimiento marginal — es la diferencia entre un sistema operable en producción y uno que solo funciona en el paper.

### 🧠 Qué tenés que saber
- **PEKS** usa criptografía de clave pública (típicamente emparejamientos bilineales sobre curvas elípticas). Permite que cualquiera cifre (usando la clave pública) pero solo el poseedor de la clave privada pueda generar trapdoors. Es conceptualmente elegante pero **extremadamente lento**.
- Una evaluación de HMAC-SHA256 (PRF simétrica) tarda ~100 nanosegundos. Un emparejamiento bilineal tarda ~1-10 milisegundos. La diferencia es de **4 a 5 órdenes de magnitud**.
- PEKS además es típicamente **lineal** en la búsqueda: debe escanear todo el índice, porque su estructura no permite la organización sublineal que logra SSE con las listas enlazadas cifradas.
- Si te preguntan "¿Cuándo usaría PEKS?": en escenarios multi-escritor donde múltiples emisores cifran con la clave pública y un solo receptor busca con la privada (ej. email cifrado buscable). Pero no escala para Big Data.

### 🗣️ Discurso sugerido
> "Para entender por qué SSE utiliza exclusivamente criptografía simétrica, necesitamos compararlo con la alternativa de clave pública: **PEKS**, *Public-Key Encryption with Keyword Search*.
>
> PEKS utiliza emparejamientos bilineales sobre curvas elípticas o esquemas de tipo RSA. Permite que cualquiera cifre usando la clave pública, pero tiene un costo computacional **desproporcionado**. Generar un trapdoor en SSE requiere una sola evaluación de PRF, que tarda del orden de nanosegundos. En PEKS, la misma operación requiere una operación de clave pública que puede ser **cientos a miles de veces más lenta**.
>
> Pero la diferencia más crítica es la **complejidad de búsqueda**. SSE logra búsquedas sublineales — proporcionales solo a los documentos que coinciden — gracias a la estructura de índice invertido con listas enlazadas cifradas. PEKS típicamente opera de forma lineal, escaneando todo el índice.
>
> En términos prácticos, esta brecha es la diferencia entre un sistema que puede operar sobre **millones de documentos en producción** y uno que solo es viable en colecciones pequeñas o en un paper académico."

---

## Filmina 10 — El trade-off: eficiencia vs. fuga controlada

### 📋 Qué dice la filmina
- Todo el espacio de diseño de SSE se mueve sobre **un mismo eje**:
  - **Extremo izquierdo:** MÁXIMA SEGURIDAD → ORAM / fuga ~nula → costo alto.
  - **Extremo derecho:** MÁXIMA EFICIENCIA → cifrado determinista → fuga alta.
  - **Centro:** SSE-1 / SSE-2 (PRF + PRP) → equilibrio práctico.
- **El límite no es la clave pública:** El problema nunca fue cifrar — fue cifrar de forma que el patrón de acceso resultante siga siendo demostrablemente acotado.
- **El diseño está en la estructura:** PRF y PRP dan la velocidad; la estructura del índice (T + A) decide exactamente qué se filtra y cuándo.

### 🧠 Qué tenés que saber
- **ORAM (Oblivious RAM):** Protocolo que oculta completamente el patrón de acceso reordenando y recifrando la memoria tras cada lectura. Fuga casi nula, pero con una sobrecarga logarítmica severa en el ancho de banda (cada lectura real implica leer y reescribir O(log N) bloques).
- **Cifrado determinista:** En el otro extremo, genera el mismo cifrado para el mismo texto plano. Permite búsqueda trivial pero filtra toda la distribución de frecuencias.
- SSE-1/SSE-2 se ubican en un **punto medio diseñado**: filtran el patrón de acceso y búsqueda (que son formalmente acotados) pero mantienen la velocidad de las primitivas simétricas.
- La frase clave: **"PRF y PRP dan la velocidad; la estructura del índice (T + A) decide qué se filtra"**. No es solo la criptografía la que da seguridad, sino el diseño de la estructura de datos.

### 🗣️ Discurso sugerido
> "Todo el espacio de diseño de esquemas de búsqueda cifrada puede visualizarse sobre un **único eje** que va de máxima seguridad a máxima eficiencia.
>
> En un extremo tenemos **ORAM** (*Oblivious RAM*), que oculta completamente el patrón de acceso reordenando y recifrando la memoria del servidor tras cada lectura. La fuga es prácticamente nula, pero el costo es severo: cada operación de lectura implica leer y reescribir O(log N) bloques, lo que introduce una sobrecarga de red prohibitiva para muchos escenarios.
>
> En el otro extremo tenemos el **cifrado determinista**, que es extremadamente eficiente pero filtra toda la distribución de frecuencias de las palabras, destruyendo la seguridad semántica.
>
> SSE-1 y SSE-2 se ubican en un **punto medio diseñado con precisión**. Las primitivas simétricas PRF y PRP proveen la velocidad; la estructura del índice — la tabla T y el arreglo A — es la que determina exactamente qué información se filtra y qué se oculta. La innovación no está solo en la criptografía, sino en el **diseño de la estructura de datos** que la acompaña."

---

## Filmina 11 — Síntesis y conclusiones

### 📋 Qué dice la filmina
- **"El cifrado simétrico no es un detalle de implementación de SSE. Es la razón por la que la búsqueda sobre datos cifrados es viable en la práctica — no solo un resultado teórico de un paper."**
- Cuatro puntos de cierre:
  1. PRF y PRP dan la velocidad que el cifrado de clave pública no puede ofrecer a escala.
  2. La estructura del índice (T + A) — no la primitiva sola — determina qué se filtra.
  3. SSE-2 muestra que la seguridad adaptativa se logra sin abandonar el modelo simétrico.
  4. Todo esquema real de SSE elige un punto explícito en el eje eficiencia ↔ fuga controlada.
- **Referencia:** Curtmola, Garay, Kamara, Ostrovsky — *"Searchable Symmetric Encryption: Improved Definitions and Efficient Constructions"* (2006).

### 🧠 Qué tenés que saber
- Esta filmina es el cierre. No agregues conceptos nuevos. Tu trabajo es **sintetizar con autoridad** los 4 mensajes principales que atravesaron toda la presentación.
- Si te preguntan por **trabajo futuro o extensiones**, podés mencionar: SSE dinámico (permitir inserciones y borrados sin reconstruir el índice), Forward Privacy (que las inserciones no se correlacionen con búsquedas pasadas), Backward Privacy (que las búsquedas no revelen documentos eliminados), y esquemas multi-usuario.
- El paper de Curtmola (2006) es la referencia canónica obligatoria. Si te preguntan por otros, podés mencionar: Song, Wagner, Perrig (2000) como los pioneros, y Bost (2016) para Forward Privacy.

### 🗣️ Discurso sugerido
> "Para cerrar, quiero sintetizar los cuatro mensajes principales de esta presentación.
>
> **Primero**, el cifrado simétrico no es un detalle de implementación menor dentro de SSE. Es literalmente la razón por la que la búsqueda sobre datos cifrados es viable en la práctica y no solo un resultado teórico. Las funciones pseudoaleatorias y las permutaciones pseudoaleatorias proveen una velocidad que el cifrado de clave pública simplemente no puede ofrecer a escala.
>
> **Segundo**, la seguridad de SSE no la da únicamente la primitiva criptográfica, sino el **diseño de la estructura de datos**. La tabla de búsqueda T y el arreglo enlazado A son los que determinan exactamente qué información se filtra y cuánto se acota esa fuga.
>
> **Tercero**, SSE-2 demuestra que es posible alcanzar seguridad adaptativa — el modelo que refleja cómo operan los servidores reales en producción — sin abandonar las primitivas simétricas.
>
> Y **cuarto**, todo esquema real de SSE es una decisión de diseño explícita sobre un eje que va de la máxima seguridad a la máxima eficiencia. No existen soluciones gratuitas: siempre se elige un punto concreto en ese espectro, y el rigor formal consiste en demostrar que no se filtra nada más allá de lo declarado.
>
> Muchas gracias por su atención. Quedo a disposición para sus preguntas."

---

## 🔥 Preguntas Frecuentes del Jurado y Cómo Responder

### ❓ "¿Qué pasa si el servidor es malicioso, no solo curioso?"
> "Los esquemas SSE-1 y SSE-2 de Curtmola asumen un modelo *honest-but-curious*: el servidor ejecuta el protocolo correctamente pero intenta aprender de los datos. Si el servidor es activamente malicioso — por ejemplo, inyectando documentos falsos o modificando resultados — necesitamos esquemas verificables que agreguen pruebas de integridad. Eso queda fuera del alcance de esta construcción, pero existen extensiones como Verifiable SSE que incorporan MACs o firmas sobre los resultados."

### ❓ "¿Qué diferencia hay entre PRF y PRP en la práctica?"
> "Una PRF no necesita ser invertible; se usa para derivar valores pseudoaleatorios a partir de claves y entradas. Se instancia como HMAC-SHA256. Una PRP sí necesita ser invertible: es un cifrador de bloque como AES. En SSE, la PRF genera trapdoors y claves derivadas; la PRP cifra y descifra los nodos individuales del arreglo enlazado."

### ❓ "Si la fuga del patrón de acceso es inevitable, ¿no es inseguro?"
> "No necesariamente. La seguridad formal de SSE no afirma fuga cero, sino que la fuga está **acotada y demostrada formalmente**. Para la mayoría de escenarios prácticos, saber que dos consultas devuelven los mismos documentos sin saber qué palabra fue buscada ni qué contienen esos documentos es un riesgo aceptable. Sin embargo, existen ataques de inferencia publicados que explotan esta fuga cruzándola con distribuciones conocidas. La mitigación pasa por padding, consultas dummy o, en el extremo, ORAM."

### ❓ "¿Por qué no usar cifrado homomórfico completo (FHE) en vez de SSE?"
> "FHE permite computar arbitrariamente sobre datos cifrados, lo cual es más general que SSE. Pero su costo computacional es prohibitivo: una operación elemental en FHE puede tardar segundos o minutos, mientras que SSE opera en microsegundos. Para el caso específico de búsqueda por palabra clave, SSE es la primitiva correcta porque está diseñada para ese problema exacto y ofrece una eficiencia incomparablemente superior."

### ❓ "¿Se puede actualizar el índice sin reconstruirlo desde cero?"
> "En la construcción original de Curtmola (2006) el índice es estático: se construye una vez offline. Pero existen extensiones llamadas **Dynamic SSE** que permiten agregar y eliminar documentos incrementalmente. El desafío principal es mantener las garantías de seguridad durante las actualizaciones, lo que lleva a las nociones de **Forward Privacy** (las inserciones no revelan búsquedas pasadas) y **Backward Privacy** (las búsquedas no revelan documentos eliminados)."
