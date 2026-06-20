# Implementación Técnica de AES en Cifrado Simétrico Buscable (SSE)

Este documento detalla la implementación formal y la matemática detrás de la cifración con el **Estándar de Cifrado Avanzado (AES)** en el contexto de esquemas de **Cifrado Simétrico Buscable (SSE)**. Se describe el ciclo completo: la criptografía de los documentos, la generación estructurada de los registros (índice enlazado) y el procedimiento técnico de búsqueda ciega en el servidor.

---

## 1. Fundamentos de AES en SSE

En un esquema de Cifrado Simétrico Buscable indexado (como el esquema sublineal *SSE-1* de Curtmola et al.), el almacenamiento y procesamiento se dividen en dos componentes lógicos distintos que utilizan AES con objetivos operacionales diferentes:

1. **Confidencialidad de Documentos (Caja Negra)**: Cifrado de la base de datos o de los registros de telemetría (*syslogs*). Se requiere seguridad semántica estricta (**IND-CPA**) y de preferencia autenticación de datos (**AEAD**). Se resuelve mediante **AES-256-GCM**.
2. **Cifrado del Índice Invertido (Nodos de Búsqueda)**: Cifrado de los nodos de la estructura de búsqueda que apuntan a los identificadores de documentos y a las direcciones del siguiente salto. Para evitar la filtración de metadatos, los nodos se cifran usando claves específicas derivadas por palabra clave $K_w$ mediante **AES-256-CBC** o **AES-256-CTR**.

```
                           +----------------------------------------+
                           |           CLAVE MAESTRA (K)            |
                           +-------------------+--------------------+
                                               |
                     +-------------------------+-------------------------+
                     | Derivación (HMAC)                                 | Derivación (HMAC)
                     v                                                   v
         +-----------+-----------+                           +-----------+-----------+
         |     Clave de Datos    |                           |    Clave de Búsqueda  |
         |         (K_3)         |                           |         (K_2)         |
         +-----------+-----------+                           +-----------+-----------+
                     |                                                   |
                     | AES-GCM (Probabilístico)                          | HMAC por palabra
                     v                                                   v
         +-----------+-----------+                           +-----------+-----------+
         | Documentos Cifrados  |                           |  Clave de Lista (K_w) |
         |      en S3/Cloud      |                           |    = HMAC(K_2, w)     |
         +-----------------------+                           +-----------+-----------+
                                                                         |
                                                                         | AES-CBC (Nodos)
                                                                         v
                                                             +-----------+-----------+
                                                             |   Nodos de Lista      |
                                                             |   Cifrados en Tabla   |
                                                             +-----------------------+
```

---

## 2. Cifrado de los Archivos de Datos (Logs) con AES-GCM

Cada registro de log o documento $D_i \in \mathbf{D}$ es cifrado de forma independiente por el cliente utilizando **AES en Modo Galois/Counter (GCM)** con la clave de datos $K_3$.

### 2.1. Algoritmo de Cifrado
Para un documento $D_i$ con datos asociados opcionales (como el ID del log para verificar el enlace $AAD = id_i$):

1. **Generación de Nonce**: Se genera un valor aleatorio único (Vector de Inicialización o *Nonce*) $IV_i \leftarrow \{0,1\}^{96}$ de 96 bits.
2. **Cifrado y Autenticación**: El motor AES-GCM procesa la clave $K_3$, el $IV_i$, el texto plano $D_i$ y los datos asociados $AAD$:
   
   $$(C_i, T_i) \leftarrow \operatorname{AES-GCM}_{K_3}(IV_i, D_i, AAD)$$
   
   Donde:
   * $C_i$ es el texto cifrado del mismo tamaño que $D_i$.
   * $T_i \in \{0,1\}^{128}$ es la etiqueta de autenticación de 128 bits generada por multiplicación polinomial en el Campo de Galois $\mathbb{GF}(2^{128})$.
3. **Registro Cifrado Final**: El archivo subido al servidor es la tupla:
   
   $$\operatorname{Registro}_i = IV_i \mathbin{\Vert} C_i \mathbin{\Vert} T_i$$

### 2.2. Garantía Criptográfica
Debido a que el $IV_i$ se genera uniformemente al azar para cada documento, dos logs idénticos (ej. `"failed login attempt"`) producen textos cifrados completamente disímiles. Esto garantiza seguridad semántica (**IND-CPA**) e integridad ante modificaciones físicas en el almacenamiento (**IND-CCA2**).

---

## 3. Generación del Índice y Nodos Cifrados (Fase BuildIndex)

La fase crucial en la cual se habilita la búsqueda ciega es la construcción del **Índice Invertido Cifrado**. A nivel técnico, el diccionario de palabras clave del cliente se procesa y se transforma en una colección de listas enlazadas que se almacenan desordenadas en una tabla hash en el servidor.

### 3.1. Estructura de un Nodo Cifrado
Para cada palabra clave única $w$ en el diccionario del cliente:

1. **Derivación de la Clave de Lista ($K_w$)**:
   Se calcula una clave simétrica específica para la palabra clave $w$ a partir de la clave maestra $K_2$:
   
   $$K_w = \operatorname{HMAC-SHA256}_{K_2}(w)$$
   
2. **Construcción de la Cadena de Nodos**:
   Si los identificadores de documentos que contienen la palabra $w$ son $\mathbf{D}(w) = \{id_1, id_2, \dots, id_t\}$:
   * Para cada elemento $j$ (de $1$ a $t$):
     * El cliente determina la dirección lógica o índice hash $\operatorname{Addr}_{j+1}$ donde se almacenará el siguiente nodo $N_{j+1}$. (Para el último nodo $j = t$, el puntero es nulo: $\operatorname{Addr}_{t+1} = \text{NULL}$).
     * Se empaqueta la carga útil del nodo concatenando el identificador del documento con la dirección del siguiente nodo:
       
       $$P_j = id_j \mathbin{\Vert} \operatorname{Addr}_{j+1}$$
       
     * Para ocultar la estructura, el cliente cifra $P_j$ usando la clave de lista $K_w$ con **AES-CBC** o **AES-CTR**:
       
       $$V_j = \operatorname{AES-Enc}_{K_w}(P_j)$$
       
       Si se utiliza **AES-256-CBC**, se genera un IV aleatorio de 128 bits para el nodo:
       
       $$V_j = IV_{\text{node}} \mathbin{\Vert} \operatorname{AES-CBC-Enc}_{K_w}(IV_{\text{node}}, P_j)$$
       
     * El nodo cifrado resultante $V_j$ se asocia con una dirección lógica de almacenamiento en el servidor $\operatorname{Addr}_j$.
     * Para el primer nodo ($j=1$), su dirección es fija y reproducible únicamente por el cliente a través de la clave de direccionamiento $K_1$:
       
       $$\operatorname{Addr}_1 = \operatorname{HMAC-SHA256}_{K_1}(w)$$
       
     * Para los nodos intermedios ($j > 1$), sus direcciones $\operatorname{Addr}_j$ son valores generados aleatoriamente o pseudoaleatoriamente por el cliente y guardados de forma desordenada en el servidor, de modo que un observador externo no pueda correlacionar la secuencia de saltos.

```
       CONSTRUCCIÓN LOCAL DEL NODO CIFRADO (CLIENTE):
       
       Carga útil (P_j):        [  id_j (Document ID)  |  Addr_{j+1} (Siguiente Salto)  ]
                                                        |
                                                        v  (Cifrado simétrico AES)
       Clave de Lista (K_w) -----------------------> [ AES-256 ]
                                                        |
                                                        v
       Nodo Cifrado (V_j):     [ IV_nodo | Texto Cifrado de la Carga Útil ]
       
       Almacenamiento:         El cliente guarda V_j en el servidor bajo la dirección Addr_j.
```

---

## 4. Búsqueda y Descifrado Ciego en el Servidor (Fase Search)

La búsqueda en el servidor no requiere descifrar el índice completo ni conocer la palabra clave en texto plano. Se realiza mediante navegación ciega usando el **Trapdoor** generado por el cliente.

### 4.1. Generación del Trapdoor (Cliente)
Cuando el analista ingresa la palabra a buscar $w$, el software cliente calcula en su zona segura:

1. **Tag de Entrada (Dirección Inicial)**: $\operatorname{Addr}_1 = \operatorname{HMAC-SHA256}_{K_1}(w)$.
2. **Clave de Descifrado de Nodos**: $K_w = \operatorname{HMAC-SHA256}_{K_2}(w)$.
3. **Tupla del Trapdoor**: $T_w = (\operatorname{Addr}_1, K_w)$.

El cliente envía $T_w$ al servidor.

### 4.2. Recorrido de Listas y Descifrado AES (Servidor)
El servidor recibe el token $T_w = (A, B)$ y realiza el siguiente bucle determinista de descifrado y salto:

```text
Algoritmo Search(A, B):
-----------------------
1. Inicializar lista de identificadores recuperados: IDs = []
2. Establecer dirección actual: dirección_actual = A
3. Bucle:
   Mientras dirección_actual != NULL:
      a. Buscar en la tabla hash el nodo guardado en la dirección: V = Servidor_Index[dirección_actual]
      Si V no existe:
         Romper bucle (fin o error)
      b. Extraer el IV y el texto cifrado:
         IV = V[0..15]
         Ciphertext = V[16..fin]
      c. Ejecutar el descifrado AES con la clave de lista B (K_w):
         Payload = AES-CBC-Dec(B, IV, Ciphertext)
      d. Desempaquetar carga útil:
         (id_doc, siguiente_dirección) = Desempaquetar(Payload)
      e. Agregar id_doc a la lista de resultados:
         IDs.append(id_doc)
      f. Actualizar puntero para el siguiente salto:
         dirección_actual = siguiente_dirección
4. Retornar IDs al cliente
```

```
       RECORRIDO EN EL SERVIDOR (BLIND TRAVERSAL):
       
       Trapdoor (Addr_1, K_w)
          |
          v
       [ Dirección Addr_1 ] ---> Obtiene V_1
                                   |
                                   v  Descifra con K_w (AES)
                                [ id_1 | Addr_2 ]
                                           |
                                           v  (Salto a la dirección Addr_2)
                                [ Dirección Addr_2 ] ---> Obtiene V_2
                                                            |
                                                            v  Descifra con K_w (AES)
                                                         [ id_2 | NULL ] (Fin)
```

---

## 5. Análisis Técnico de Seguridad y Mitigaciones con AES

### 5.1. Seguridad IND-CPA de las Listas
Mientras el cliente no busque la palabra clave $w$, su clave de lista $K_w$ y su tag de dirección inicial $\operatorname{Addr}_1$ son computacionalmente imposibles de deducir para el servidor externo. Dado que los nodos $V_j$ se cifran con AES, permanecen indistinguibles de cadenas pseudoaleatorias y no filtran ninguna información sobre el identificador del documento ni sobre el enlace al siguiente nodo.

### 5.2. Mitigación del Goteo de Volumen (Volume Leakage)
Aun cifrando con AES, el servidor aprende la longitud de la lista enlazada al recorrerla (es decir, el número de documentos devueltos $t$). Para mitigar esto, en la fase de generación del registro, el cliente puede aplicar:

* **Relleno de Nodos Dummy**: Insertar nodos adicionales en la lista enlazada que contengan identificadores de documentos falsos y direcciones válidas. Al descifrar, el cliente filtra y descarta los IDs ficticios, pero el servidor realiza la misma cantidad de operaciones de descifrado AES, enmascarando el volumen real de resultados.
* **Padding de Bloques**: Alinear la longitud de los registros de datos a múltiplos exactos de un tamaño de bloque establecido utilizando el algoritmo estándar de relleno PKCS#7.

$$P_{\text{padded}} = D_i \mathbin{\Vert} \operatorname{PaddingBytes}$$

Esto asegura que el servidor no pueda deducir el contenido de los logs analizando el tamaño en bytes del texto cifrado por AES-GCM.
