// Respaldo de texto del Trabajo Académico para evitar restricciones CORS en protocolo file://
const thesisMarkdown = `# Análisis de esquemas de Cifrado Simétrico Buscable (SSE) para el almacenamiento confidencial y auditabilidad inmutable en entornos distribuidos

**Autor:** Trabajo Final de Criptografía Simétrica  
**Especialización/Maestría:** Ciberseguridad y Criptografía  
**Fecha:** Junio de 2026  

---

## Resumen Ejecutivo

El Cifrado Simétrico Buscable (SSE, *Symmetric Searchable Encryption*) es una primitiva criptográfica avanzada de la criptografía simétrica que resuelve una de las mayores tensiones de la seguridad de la información moderna: **la coexistencia entre confidencialidad de datos y utilidad de búsqueda en infraestructuras de terceros no confiables (ej. almacenamiento en la nube o nodos distribuidos de Blockchain)**.

En la criptografía simétrica convencional (como AES en modos de operación CBC o GCM), el texto cifrado actúa como una "caja negra" probabilística e indistinguible. Para buscar una palabra clave dentro de una base de datos cifrada tradicionalmente, el cliente se ve obligado a descargar la totalidad de los datos, descifrarlos localmente y ejecutar la búsqueda en texto plano. Esto consume un ancho de banda masivo y recursos de procesamiento locales intolerables para dispositivos móviles o entornos de Big Data.

SSE rompe este paradigma al permitir que un servidor de almacenamiento ejecute búsquedas de palabras clave directamente sobre el texto cifrado de manera "ciega", es decir, sin conocer la clave secreta, sin descifrar el contenido y sin aprender el significado semántico de las consultas ni de los documentos. El núcleo de esta investigación se centra en evaluar los fundamentos matemáticos y las construcciones simétricas de los esquemas de SSE, analizar el goteo de información (*leakage*) inherente y proponer un modelado de arquitectura segura y auditable para el almacenamiento de registros (*logs*) de ciberseguridad en infraestructuras críticas descentralizadas.

---

## 1. Introducción y Planteamiento del Problema

El paradigma de la computación distribuida y el almacenamiento en la nube exige delegar el almacenamiento y la computación sobre bases de datos a proveedores externos. No obstante, en un modelo de seguridad *Zero Trust* (Confianza Cero), el servidor de almacenamiento externo se clasifica típicamente como un adversario **Honesto pero Curioso** (*Honest-but-Curious* o *Semi-Honesto*). Este tipo de adversario ejecuta fielmente el protocolo asignado y no altera los datos (garantizando integridad pasiva), pero intenta activamente recopilar y analizar el texto cifrado y las consultas del cliente para extraer información confidencial.

El cifrado simétrico clásico (por ejemplo, AES-256 en modo GCM) proporciona **Confidencialidad Semántica** (formalizada como seguridad IND-CPA), lo que implica que dos textos cifrados del mismo tamaño no revelan ninguna pista sobre el texto plano subyacente. Sin embargo, esta indistinguibilidad destruye la estructura de los datos, impidiendo indexar y buscar. 

Para solucionar esto, los primeros enfoques propusieron técnicas ingenuas como el Cifrado Determinista (donde un mismo texto plano siempre genera el mismo texto cifrado), pero esto es altamente vulnerable a ataques de análisis de frecuencia y no cumple con IND-CPA.

El Cifrado Simétrico Buscable (SSE) surge para proporcionar una solución de compromiso óptima: permite realizar búsquedas sublineales sobre datos cifrados con seguridad provable. El cliente cifra localmente sus datos y un índice especial, enviándolos al servidor. Al realizar una búsqueda, el cliente genera una "trampa" criptográfica (*Trapdoor*) simétrica para una palabra clave específica. El servidor utiliza esta trampa para filtrar los documentos coincidentes sin descifrar nada más.

---

## 2. Preliminares Criptográficos (El Núcleo Simétrico)

Para comprender matemáticamente las construcciones de SSE, debemos definir las primitivas simétricas elementales que garantizan su seguridad y eficiencia.

### 2.1. Funciones Pseudoaleatorias (PRFs)
La seguridad de casi todas las construcciones eficientes de SSE descansa sobre la existencia de Funciones Pseudoaleatorias (PRFs).

Una función pseudoaleatoria es una familia de funciones eficientemente computables que son indistinguibles de una función verdaderamente aleatoria para cualquier adversario computacionalmente acotado.

Formalmente, sea \$F: \\{0,1\\}^\\lambda \\times \\{0,1\\}^m \\to \\{0,1\\}^n\$ una función determinista que toma una clave simétrica \$K \\in \\{0,1\\}^\\lambda\$ y una entrada \$x \\in \\{0,1\\}^m\$, y devuelve una salida en \$\\{0,1\\}^n\$. Decimos que \$F\$ es una PRF segura si para todo adversario eficiente en tiempo polinómico \$D\$:

$$\\operatorname{Adv}_{F}^{prf}(D) = \\left| \\Pr[D^{F_K(\\cdot)} = 1] - \\Pr[D^{g(\\cdot)} = 1] \\right| \\leq \\operatorname{negl}(\\lambda)$$

donde \$K \\leftarrow \\{0,1\\}^\\lambda\$ se elige uniformemente al azar, \$g\$ es una función elegida al azar del espacio de todas las funciones de \$\\{0,1\\}^m\$ a \$\\{0,1\\}^n\$, y \$\\operatorname{negl}(\\lambda)\$ es una función despreciable con respecto al parámetro de seguridad \$\\lambda\$.

En la práctica, las PRFs se instancian a partir de cifradores de bloque simétricos (como AES con modos de generación de claves o AES-CMAC) o mediante funciones de dispersión con clave criptográfica, principalmente **HMAC-SHA256**:

$$\\operatorname{HMAC}_K(w) = H\\Big( (K \\oplus opad) \\mathbin{\\Vert} H\\big( (K \\oplus ipad) \\mathbin{\\Vert} w \\big) \\Big)$$

### 2.2. Esquemas de Cifrado Simétrico Clásicos (SKE)
Un esquema de cifrado simétrico probabilístico \$\\Pi = (\\operatorname{Gen}, \\operatorname{Enc}, \\operatorname{Dec})\$ consta de tres algoritmos de tiempo polinómico:
1. \$K \\leftarrow \\operatorname{Gen}(1^\\lambda)\$: Genera una clave simétrica \$K\$.
2. \$C \\leftarrow \\operatorname{Enc}_K(M)\$: Cifra un mensaje \$M\$ de manera probabilística introduciendo un vector de inicialización o *nonce* aleatorio, asegurando que cifrar el mismo mensaje dos veces resulte en textos cifrados completamente distintos.
3. \$M \\leftarrow \\operatorname{Dec}_K(C)\$: Descifra el texto cifrado \$C\$ de manera determinista utilizando la misma clave \$K\$.

Para el almacenamiento de los archivos propiamente dichos en SSE, se utiliza un SKE que cumpla con la noción de indistinguibilidad bajo ataques de texto plano elegido (**IND-CPA**), típicamente instanciado con **AES-GCM** o **AES-CTR** combinados con un código de autenticación de mensajes (HMAC) si se requiere cifrado autenticado (AEAD).

### 2.3. Definición Formal de un Esquema SSE
Un esquema de cifrado simétrico buscable indexado de un solo usuario consta de cuatro algoritmos de tiempo polinómico ejecutados entre el Cliente y el Servidor:

1. \$(K_1, K_2, \\dots) \\leftarrow \\operatorname{Setup}(1^\\lambda)\$: Algoritmo probabilístico ejecutado por el cliente para inicializar las claves criptográficas simétricas secretas.
2. \$(I, \\mathbf{C}) \\leftarrow \\operatorname{BuildIndex}(K, \\mathbf{D})\$: Algoritmo ejecutado por el cliente que toma el conjunto de claves \$K\$, una colección de documentos en texto plano \$\\mathbf{D} = (D_1, \\dots, D_N)\$, y genera un índice cifrado \$I\$ y una colección de documentos cifrados \$\\mathbf{C} = (C_1, \\dots, C_N)\$. El cliente sube \$(I, \\mathbf{C})\$ al servidor y borra los textos planos locales.
3. \$T_w \\leftarrow \\operatorname{Trapdoor}(K, w)\$: Algoritmo determinista ejecutado por el cliente para generar un token de búsqueda o trampa \$T_w\$ para una palabra clave elegida \$w\$. Se envía de forma segura al servidor.
4. \$X \\leftarrow \\operatorname{Search}(I, T_w)\$: Algoritmo determinista ejecutado por el servidor que toma el índice cifrado \$I\$ y la trampa \$T_w\$, realiza el emparejamiento ciego, y devuelve el conjunto de identificadores de documentos \$X \\subseteq \\{1, \\dots, N\\}\$ que contienen la palabra clave \$w\$. El servidor no aprende \$w\$, ni el contenido de los documentos correspondientes.

---

## 3. Evolución de los Esquemas de SSE Simétricos

### 3.1. Esquema Secuencial de Song, Wagner y Perrig (2000)
El trabajo seminal de Song, Wagner y Perrig representó el nacimiento del cifrado buscable. Propusieron un esquema donde cada palabra de un documento se cifra de forma independiente bajo una construcción simétrica especial.

Para cifrar una palabra de \$l\$ bits \$W_i\$ en un documento:
1. El cliente genera un valor pseudoaleatorio \$X_i = \\operatorname{Enc}_{K_{priv}}(W_i) = (L_i, R_i)\$ usando un cifrador de flujo, donde \$L_i\$ representa los primeros \$l-k\$ bits y \$R_i\$ los restantes \$k\$ bits.
2. El cliente calcula un valor de comprobación \$S_i = F_{k_i}(L_i)\$ donde \$F\$ es una PRF con una clave \$k_i = f_{K_{key}}(L_i)\$.
3. El texto cifrado final de la palabra es \$C_i = W_i \\oplus X_i\$ modificado para incrustar el valor de comprobación de modo que \$C_i = (X_i \\oplus S_i)\$.

**Búsqueda Secuencial (\$O(N)\$):**
Para buscar la palabra \$W\$, el cliente genera el Trapdoor enviando la palabra descifrada y las claves de derivación de nivel inferior al servidor. El servidor debe escanear secuencialmente **cada palabra de cada documento cifrado en la base de datos**, computando la función PRF en cada paso para verificar si la ecuación de emparejamiento se cumple.

* **Desventajas Críticas:**
  * **Tiempo de Búsqueda Lineal:** Escanear toda la base de datos para cada consulta es inviable para grandes volúmenes de datos (\$O(N \\cdot L)\$ donde \$N\$ es el número de documentos y \$L\$ la longitud máxima).
  * **Filtración Alta:** El servidor aprende la posición exacta de las palabras coincidentes dentro del texto cifrado de los documentos.

---

### 3.2. Esquema de Curtmola, Garay, Ostrovsky y Yong (2006): La Revolución Sublineal
Curtmola et al. transformaron radicalmente el diseño de SSE al introducir el concepto de **Índice Invertido Cifrado** basado en estructuras de listas enlazadas cifradas. Su esquema (denominado **SSE-1**) logra un tiempo de búsqueda óptimo de \$O(t)\$, donde \$t\$ es el número de documentos que contienen la palabra clave consultada, independientemente del tamaño total de la base de datos \$N\$.

#### 3.2.1. Construcción del Índice Invertido Cifrado
Un índice invertido asocia a cada palabra clave \$w\$ una lista de identificadores de los documentos que la contienen: \$\\mathbf{D}(w) = \\{id_1, id_2, \\dots, id_t\\}\$.

El cliente cifra este índice mediante el siguiente algoritmo simétrico:

1. **Generación de Claves:** El cliente inicializa tres claves simétricas independientes:
   * \$K_1 \\leftarrow \\operatorname{Gen}(1^\\lambda)\$ (Para derivar las direcciones del índice).
   * \$K_2 \\leftarrow \\operatorname{Gen}(1^\\lambda)\$ (Para derivar las claves de cifrado de nodos).
   * \$K_3 \\leftarrow \\operatorname{Gen}(1^\\lambda)\$ (Para cifrar los identificadores de documentos con AES).

2. **Cifrado de Listas Enlazadas (Fase Cliente):**
   Para cada palabra clave única \$w\$ en el diccionario:
   * Sea \$\\mathbf{D}(w) = \\{id_1, id_2, \\dots, id_t\\}\$ el conjunto de identificadores.
   * El cliente genera una clave de enmascaramiento local para la lista de \$w\$: \$K_{w} = \\operatorname{PRF}_{K_2}(w)\$.
   * Para cada identificador \$id_j\$ en la lista (desde \$j = 1\$ hasta \$t\$):
     * Genera un valor pseudoaleatorio aleatorio para la siguiente dirección en la tabla hash del servidor: \$N_{j} = \\operatorname{Addr}_{j}\$ (excepto para el último elemento \$j=t\$, donde el puntero al siguiente es nulo: \$ptr_t = \\text{NULL}\$).
     * Cifra el nodo actual. Cada nodo \$N_j\$ de la lista enlazada se almacena cifrado y contiene el identificador del documento y la dirección de memoria del siguiente nodo en el servidor:
       
       \$\$V_j = \\operatorname{Enc}_{K_{w}}(id_j \\mathbin{\\Vert} \\operatorname{Addr}_{j+1})\$\$
       
       donde \$\\operatorname{Addr}_{j+1}\$ es la dirección física/lógica donde se guardará el nodo \$N_{j+1}\$ en la tabla hash del servidor.
     * El nodo \$N_j\$ se guarda en la tabla del servidor en la dirección pseudoaleatoria calculada como \$\\operatorname{Addr}_j\$.

3. **La Tabla Hash de Direccionamiento Ciego (\$A\$):**
   Para que el servidor encuentre el *primer* nodo de la lista de la palabra \$w\$, el cliente calcula una entrada en un mapa o tabla hash indexada por la etiqueta de búsqueda:
   * Etiqueta de Búsqueda (Dirección del primer nodo): \$T_1(w) = \\operatorname{PRF}_{K_1}(w)\$.
   * Valor en la tabla: \$\\text{Entrada} = (\\operatorname{Addr}_1 \\oplus K_A) \\mathbin{\\Vert} (K_{w} \\oplus K_B)\$.

#### 3.2.2. Generación del Trapdoor y Proceso de Búsqueda
Cuando el cliente desea buscar la palabra clave \$w\$:
1. Genera localmente el Trapdoor dual \$T_w = (T_1(w), K_{w})\$ donde:
   * \$T_1(w) = \\operatorname{PRF}_{K_1}(w)\$ (Permite al servidor localizar el inicio de la lista).
   * \$K_{w} = \\operatorname{PRF}_{K_2}(w)\$ (Permite al servidor descifrar los nodos de esa lista específica).
2. Envía \$T_w\$ al servidor.

**Búsqueda Ciega en el Servidor:**
1. El servidor recibe \$T_w = (A, B)\$.
2. Va a la posición del índice cifrado determinada por la dirección \$A\$.
3. Utiliza la clave simétrica temporal \$B\$ para descifrar el contenido del nodo en esa dirección.
4. Obtiene el identificador del documento \$id_1\$ y la dirección del siguiente nodo \$\\operatorname{Addr}_2\$.
5. Se desplaza a la dirección \$\\operatorname{Addr}_2\$, descifra con la misma clave \$B\$, y obtiene \$id_2\$ y \$\\operatorname{Addr}_3\$.
6. Repite el proceso iterativamente hasta encontrar un puntero \`NULL\`.
7. Retorna el conjunto \$\\{id_1, id_2, \\dots, id_t\\}\$ al cliente.

---

## 4. Análisis de Filtraciones (Leakage) y Criptoanálisis

A pesar de las sólidas garantías matemáticas de SSE, en criptografía simétrica aplicada debemos analizar el **goteo de información involuntario o filtración (leakage)**.

### 4.1. Definición Matemática del Leakage
1. **Filtración en Setup (\$\\mathcal{L}_{setup}\$):** Información revelada al servidor en la fase de inicialización. Típicamente incluye el número total de documentos cifrados \$N\$, el tamaño de cada documento cifrado \$\|C_i\|\$, y el número total de pares palabra-documento en el índice cifrado.
2. **Filtración en Consulta (\$\\mathcal{L}_{query}\$):** Información revelada al servidor durante la ejecución de consultas de búsqueda. Se compone principalmente de dos patrones:
   * **Search Pattern (Patrón de Búsqueda) \\operatorname{SP}(w):** Revela si dos consultas de búsqueda corresponden a la misma palabra clave. Se define formalmente como una matriz de coincidencia o un historial de consultas indexado donde el servidor aprende si el token \$T_{w,i} == T_{w,j}\$.
   * **Access Pattern (Patrón de Acceso) \\operatorname{AP}(w):** El conjunto de identificadores de documentos que son devueltos para una consulta específica. \$\\operatorname{AP}(w) = \\mathbf{D}(w) = \\{id_1, \\dots, id_t\\}\$.

---

### 4.2. Criptoanálisis: Por qué el Leakage es Peligroso
El análisis del goteo ha dado lugar a ataques criptoanalíticos avanzados que demuestran que un servidor pasivo o activo puede reconstruir parcial o totalmente el diccionario de palabras clave consultadas.

#### 4.2.1. Ataques de Inyección de Archivos (Zhang, Papamanthou y Katz, 2016)
En este escenario de ataque:
1. El atacante inyecta un conjunto de documentos diseñados con un subconjunto conocido de palabras clave seleccionadas del diccionario.
2. El cliente indexa y cifra automáticamente estos archivos inyectados en su índice SSE.
3. Cuando el cliente realiza búsquedas legítimas subsiguientes, el servidor observa el **Access Pattern** sobre los documentos inyectados.
4. Cruzando el patrón de acceso con la estructura de las palabras inyectadas, el servidor puede recuperar de forma determinista y con 100% de precisión la palabra clave exacta correspondiente a cada Trapdoor enviado.

#### 4.2.2. Ataques de Reconstrucción por Volumen (Volume Attacks)
Incluso en un modelo pasivo donde no se inyectan archivos:
* El atacante observa el volumen de documentos devueltos para cada Trapdoor (es decir, el tamaño del Access Pattern \$\|AP(w)\|\$).
* Al comparar los volúmenes de documentos de las consultas con las frecuencias de palabras del canal auxiliar, el atacante puede resolver un problema de asignación probabilística y emparejar con alta precisión qué Trapdoor corresponde a qué palabra clave real.

---

### 4.3. Estrategias de Mitigación en el Dominio Simétrico

1. **Alineación de Tamaño (Size Padding):**
   * **Padding de Documentos:** Cifrar todos los documentos con un tamaño fijo (mediante PKCS#7 en bloques simétricos) para ocultar diferencias de longitud exactas.
   * **Padding del Índice (Volume Padding):** El cliente añade identificadores de documentos ficticios (*dummy documents*) para que todas las palabras clave devuelvan el mismo número de resultados.

2. **Consultas Ficticias (Dummy Queries):**
   * El cliente genera periódicamente Trapdoors aleatorios para palabras que no necesita buscar para aplanar el Search Pattern.

3. **ORAM (Oblivious RAM):**
   * La técnica definitiva para eliminar por completo el Access Pattern. ORAM baraja y recifra continuamente los bloques de almacenamiento del servidor cada vez que se realiza un acceso de lectura o escritura.

4. **Propiedades de Privacidad Avanzadas (Forward & Backward Privacy):**
   * **Forward Privacy (Privacidad Hacia Adelante):** Garantiza que una operación de adición de un nuevo documento no revele si este contiene palabras que ya han sido buscadas en el pasado.
   * **Backward Privacy (Privacidad Hacia Atrás):** Garantiza que las consultas de búsqueda actuales no revelen información sobre documentos que ya han sido eliminados de la base de datos distribuida.

---

## 5. Modelado del Caso de Uso: Auditabilidad Inmutable Zero Trust en Entornos Distribuidos

Para demostrar el valor de SSE en ciberdefensa, modelamos una infraestructura crítica que genera registros de acceso tácticos y telemetría de red altamente sensibles. Los analistas de incidentes (SOC) deben buscar indicadores de compromiso (IoC) rápidamente, pero los logs deben almacenarse cifrados en un entorno distribuido debido a estrictas regulaciones de privacidad.

### Arquitectura del Ciclo de Vida:
1. **Generación e Indexación Táctica (Local):**
   * El recolector de logs del cliente recopila la telemetría.
   * Genera el índice invertido asociando cada IoC con el ID del log correspondiente.
   * Aplica la PRF simétrica con la clave secreta local \$K_1\$ para generar las etiquetas del índice invertido, cifra los punteros usando \$K_2\$ y cifra cada archivo con la clave \$K_3\$ (AES-GCM).
   * Realiza un padding estructurado de las listas para evitar ataques de volumen.

2. **Almacenamiento Descentralizado e Inmutable:**
   * El índice cifrado y los archivos de log cifrados se publican en una infraestructura de almacenamiento distribuido. Los nodos distribuidores solo ven cadenas pseudoaleatorias indistinguibles de ruido blanco.

3. **Auditoría Ciega y Respuesta ante Incidentes:**
   * Ante una alerta de seguridad, el analista del SOC genera localmente el Trapdoor \$T_{IoC}\$ y lo envía a la red distribuida.
   * Los nodos ejecutan la búsqueda a ciegas recorriendo las listas enlazadas en tiempo óptimo y devuelven los bloques de logs correspondientes al cliente, quien los descifra localmente.
   * **Resultado:** La privacidad de las operaciones de búsqueda táctica del SOC se preserva íntegramente.

---

## 6. Conclusiones

El Cifrado Simétrico Buscable (SSE) constituye una de las primitivas más elegantes y prácticas de la criptografía simétrica moderna. El esquema de Curtmola et al. basado en índices invertidos cifrados resolvió la ineficiencia lineal del esquema clásico de Song et al., estableciendo la sublinealidad en tiempo de búsqueda como el estándar de oro. Sin embargo, los patrones de búsqueda y de acceso representan goteos de información sumamente explotables por adversarios avanzados mediante ataques de inyección y volumen, lo que exige un diseño cuidadoso por parte del cliente incorporando mitigaciones simétricas.

---

## Referencias Bibliográficas

1. **Song, D. X., Wagner, D., & Perrig, A. (2000).** *Practical cryptographic techniques for search on encrypted data.* In IEEE Symposium on Security and Privacy (S&P 2000).
2. **Curtmola, R., Garay, J., Ostrovsky, R., & Yong, G. (2006).** *Searchable symmetric encryption: improved definitions and efficient constructions.* In 13th ACM Conference on Computer and Communications Security (CCS 2006).
3. **Cash, D., Jarecki, S., Jutla, C., Krawczyk, H., Rosu, M. C., & Steiner, M. (2013).** *Highly-scalable searchable symmetric encryption with support for boolean queries.* In CRYPTO 2013.
4. **Zhang, Y., Papamanthou, C., & Katz, J. (2016).** *An honest-but-curious server can learn everything: Practical file-injection attacks on searchable encryption.* In 2016 ACM SIGSAC Conference on Computer and Communications Security (CCS 2016).
5. **Bost, R. (2016).** *Sophos: Forward-secure searchable symmetric encryption.* In 2016 ACM SIGSAC Conference on Computer and Communications Security (CCS 2016).
`;
