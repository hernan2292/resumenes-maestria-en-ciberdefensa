## 🗺️ Mapa Mental General de la Presentación Técnico-AES

Este esquema representa la transición lógica de la exposición, centrada en la matemática y los algoritmos de la implementación de AES en Cifrado Simétrico Buscable (SSE):

```text
[AES & BUSQUEDA CIEGA: IMPLEMENTACIÓN Y ALGORITMOS]
        │
        ├──► Bloque 1: Fundamentos y Tensión de Diseño (Diapo 1 - 2)
        │       ├── Intro: Privacidad en la nube (Zero Trust) y Cifrado Buscable
        │       └── Tensión: Confidencialidad IND-CPA vs. Capacidad de Búsqueda
        │
        ├──► Bloque 2: Arquitectura y Generación de Registros (Diapo 3 - 5)
        │       ├── Primitivas: Derivación de claves con PRF (HMAC-SHA256)
        │       ├── Cifrado de Datos: AES-256-GCM para confidencialidad de logs
        │       └── Cifrado de Índices: Estructuración de nodos enlazados con AES-CBC
        │
        ├──► Bloque 3: Algoritmos en Acción y Búsqueda (Diapo 6 - 7)
        │       ├── BuildIndex: Generación de la tabla hash de direccionamiento ciego
        │       └── Search: Recorrido y descifrado AES iterativo en el servidor
        │
        └──► Bloque 4: Seguridad y Caso Práctico (Diapo 8 - 9)
                ├── Leakage & Defensas: Mitigaciones (Padding de bloques AES y ORAM)
                └── Caso de Uso SOC: Telemetría Zero Trust y auditoría inmutable
```

---

## 📑 Guía de Desarrollo Detallada por Diapositiva

### Diapositiva 1: Portada e Introducción al Cifrado Buscable
* **Concepto a desarrollar:** Presentación formal ante la cátedra. Explicar la importancia de mantener la confidencialidad de datos en infraestructuras distribuidas de terceros, asumiendo un modelo de adversario honesto pero curioso (Zero Trust).
* **Términos obligatorios:** *Symmetric Searchable Encryption* (SSE), Adversario *Honest-but-Curious*, Confidencialidad y Utilidad.
* **Oratoria:** *"Buenos días. Hoy presentaré el análisis de la implementación técnica de AES para habilitar búsquedas a ciegas en entornos distribuidos..."*

### Diapositiva 2: Confidencialidad Semántica IND-CPA vs. Utilidad
* **Concepto a desarrollar:** Explicar por qué el cifrado simétrico clásico (AES-GCM o AES-CBC estándar) destruye la utilidad de búsqueda. Para cumplir IND-CPA, el cifrado debe ser probabilístico (mismo plano genera distinto cifrado). Buscar obliga a descargar y descifrar todo localmente. El cifrado determinista soluciona la búsqueda pero destruye la seguridad semántica al filtrar frecuencias.
* **Términos obligatorios:** Seguridad Semántica (IND-CPA), Cifrado Probabilístico, Cifrado Determinista, Fugas de Frecuencia.
* **Oratoria:** *"El dilema de diseño reside en que si protegemos los datos con seguridad IND-CPA, bloqueamos la capacidad del servidor de indexar o buscar directamente..."*

### Diapositiva 3: Derivación de Claves por PRF (HMAC-SHA256)
* **Concepto a desarrollar:** Detallar cómo el cliente genera y aísla claves. A partir de una clave maestra $K$, se derivan mediante una PRF ($HMAC-SHA256$) tres claves: $K_1$ para direcciones hash, $K_2$ para llaves de enmascaramiento de lista, y $K_3$ para cifrar los documentos.
* **Términos obligatorios:** Función Pseudoaleatoria (PRF), Aislamiento de Claves, HMAC-SHA256.
* **Oratoria:** *"El aislamiento de claves es vital. El servidor nunca ve la clave maestra ni las claves individuales, solo etiquetas derivadas..."*

### Diapositiva 4: Cifrado de Documentos con AES-256-GCM
* **Concepto a desarrollar:** Detallar el cifrado de los archivos de logs. Se utiliza AES en modo GCM (Galois/Counter Mode). Cada documento se cifra con un IV aleatorio y genera un tag de autenticación de 128 bits para garantizar confidencialidad e integridad del registro en el almacenamiento externo.
* **Términos obligatorios:** AES-GCM, Vector de Inicialización (IV), Galois Field ($\mathbb{GF}(2^{128})$), Cifrado Autenticado (AEAD).
* **Oratoria:** *"Para el resguardo de la telemetría propiamente dicha, implementamos AES-GCM, garantizando que el servidor externo no pueda alterar los registros..."*

### Diapositiva 5: Generación del Registro: Nodos Cifrados con AES
* **Concepto a desarrollar:** Explicar cómo el cliente construye la lista enlazada del índice. Cada nodo de la lista para la palabra $w$ contiene el ID del documento y la dirección física del siguiente nodo ($id_j \mathbin{\Vert} \operatorname{Addr}_{j+1}$). Este bloque se cifra usando AES-CBC o AES-CTR con una clave de enmascaramiento específica $K_w = \operatorname{PRF}(K_2, w)$.
* **Términos obligatorios:** Lista Enlazada Cifrada, Enmascaramiento Local ($K_w$), AES-CBC.
* **Oratoria:** *"Cada nodo del índice se cifra de forma independiente usando AES-CBC con la clave de lista específica Kw, ocultando la dirección del próximo salto..."*

### Diapositiva 6: Algoritmo BuildIndex: Direccionamiento Ciego
* **Concepto a desarrollar:** Describir la colocación física de los nodos en la tabla hash del servidor. Los nodos intermedios se guardan en direcciones lógicas aleatorias de forma desordenada. El primer nodo de la palabra $w$ se coloca en la dirección predecible por el cliente $\operatorname{Addr}_1 = \operatorname{PRF}(K_1, w)$. El servidor ve una tabla hash desordenada que parece ruido aleatorio.
* **Términos obligatorios:** Tabla Hash, Direccionamiento Ciego, Índice Invertido Cifrado.
* **Oratoria:** *"La tabla hash almacena de forma dispersa y ciega los nodos cifrados. Para el servidor, el índice es indistinguible de ruido blanco..."*

### Diapositiva 7: Algoritmo Search: Descifrado AES Iterativo en el Servidor
* **Concepto a desarrollar:** Detallar cómo funciona la búsqueda. El cliente envía el Trapdoor $T_w = (\operatorname{Addr}_1, K_w)$. El servidor accede a $\operatorname{Addr}_1$, lee el nodo, usa $K_w$ para descifrarlo con AES, recupera el ID del documento y la dirección del segundo nodo $\operatorname{Addr}_2$, salta a ese nodo y repite recursivamente hasta encontrar un puntero `NULL`.
* **Términos obligatorios:** Trapdoor Dual, Descifrado Iterativo, Complejidad Sublineal $O(t)$.
* **Oratoria:** *"Al recibir el Trapdoor, el servidor ejecuta un descifrado iterativo con AES de forma ciega, navegando por las direcciones lógicas sin descifrar el resto de la base de datos..."*

### Diapositiva 8: Mitigación de Fugas: Padding de Bloques y ORAM
* **Concepto a desarrollar:** Abordar las fugas (Search Pattern y Access Pattern) y cómo mitigarlas. Explicar el padding de bloques de AES utilizando PKCS#7 y la inserción de registros ficticios (*dummies*) para aplanar la distribución de volumen. Mencionar ORAM como la solución teórica para ocultar el patrón de acceso.
* **Términos obligatorios:** Padding AES, PKCS#7, Registros Dummy, ORAM (Oblivious RAM).
* **Oratoria:** *"Para evitar que el servidor haga un análisis estadístico del tamaño de los archivos cifrados, aplicamos padding PKCS#7 de bloques de AES e inyectamos dummies..."*

### Diapositiva 9: Conclusiones y Caso de Uso en Centro de Operaciones (SOC)
* **Concepto a desarrollar:** Integración de la teoría en un SOC Zero Trust. Los syslogs se cifran localmente con AES y se suben a la nube. El analista busca amenazas usando trapdoors. Los nodos distribuidos ejecutan la búsqueda a ciegas en milisegundos, garantizando la inmutabilidad y la privacidad del analista.
* **Términos obligatorios:** SOC Zero Trust, Telemetría Confidencial, Búsqueda de IoCs, Auditabilidad Inmutable.
* **Oratoria:** *"En conclusión, esta arquitectura permite realizar búsquedas en milisegundos manteniendo el control total de las claves simétricas en el cliente..."*
