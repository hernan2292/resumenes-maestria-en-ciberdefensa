# Trabajo Práctico Final: Auto-hospedaje Seguro de Credenciales

## Integrantes
Guarnieri · Herrera · Aguilera

## Materia
Introducción a la Seguridad Informática - Maestría en Ciberdefensa

---

## SLIDE 1: Portada
**Título:** Auto-hospedaje Seguro de Credenciales
**Subtítulo:** Un análisis técnico y de riesgos sobre Vaultwarden: Criptografía Zero-Knowledge, implementación de infraestructuras y mitigación de amenazas.

### 📋 Notas del Orador
Buenos días, profesor. Somos Franco Guarnieri, Hernán Herrera y Jhonatan Aguilera, y este es nuestro trabajo práctico final para la materia Introducción a la Seguridad Informática, dentro de la Maestría en Ciberdefensa.

El tema que elegimos es el **auto-hospedaje seguro de credenciales**, centrándonos en **Vaultwarden**, que es una reimplementación open source del backend de Bitwarden, escrita en Rust. Lo que vamos a analizar es la criptografía Zero-Knowledge que utiliza, la implementación de infraestructura segura, y las estrategias de mitigación de amenazas asociadas a auto-hospedar un servicio tan crítico como un gestor de contraseñas.

---

## SLIDE 2: Introducción al Problema
**La paradoja de los Gestores de Contraseñas**
La centralización de credenciales mitiga el problema de la reutilización de contraseñas y contraseñas débiles, pero crea un único punto de fallo altamente atractivo para los atacantes.
- **Bitwarden:** Solución robusta de código abierto basada en una arquitectura Zero-Knowledge.
- **Vaultwarden:** Re-implementación en Rust del backend de Bitwarden orientada a entornos locales y auto-hospedados (self-hosted).

**¿Por qué auto-hospedar?**
Control absoluto sobre la infraestructura de almacenamiento físico del cofre de credenciales, mitigando riesgos de fugas en la nube pública y garantizando soberanía de datos.

**¿Qué es Vaultwarden?**
Un servidor ligero compatible con la API de Bitwarden. Permite utilizar todas las aplicaciones oficiales sin el pesado consumo de recursos de la pila oficial.

### 📋 Notas del Orador
El problema que abordamos parte de una realidad operativa concreta: los usuarios de cualquier organización manejan decenas de credenciales distintas. Esto genera lo que se conoce como **fatiga de contraseñas**, que lleva inevitablemente a la reutilización de contraseñas entre servicios, al uso de contraseñas débiles y al almacenamiento inseguro.

La solución estándar a este problema son los gestores de contraseñas. Sin embargo, presentan una paradoja desde el punto de vista de la seguridad: **centralizar todas las credenciales en un solo punto mejora enormemente la gestión, pero convierte a ese gestor en un activo crítico**. Si un atacante logra comprometer el gestor, compromete potencialmente todas las credenciales de la organización.

Dentro de este contexto, **Bitwarden** se destaca como una solución de código abierto basada en una arquitectura Zero-Knowledge. Y **Vaultwarden** es una reimplementación ligera de ese backend, orientada específicamente a entornos auto-hospedados. La pregunta central de nuestro trabajo es: ¿se puede auto-hospedar un gestor de contraseñas de forma segura, y qué controles se necesitan para que sea viable?

---

## SLIDE 3: ¿Cómo funciona un gestor de contraseñas?
**Del usuario al cofre cifrado: flujo operativo de Vaultwarden**
Un gestor de contraseñas no "guarda claves sueltas": organiza credenciales dentro de un cofre cifrado, genera contraseñas robustas, sincroniza dispositivos y permite compartir accesos.

1. **Usuario y contraseña maestra:** El usuario recuerda una única clave fuerte. (clave maestra, identidad)
2. **Derivación en el cliente:** La app aplica PBKDF2 o Argon2id para transformar la clave. (KDF, salt)
3. **Cifrado local del cofre:** Credenciales y notas seguras se cifran antes de salir del dispositivo. (AES-256, Zero-Knowledge)
4. **Servidor Vaultwarden:** El servidor autentica, sincroniza y almacena blobs cifrados, pero no puede leerlos. (API, TLS)
5. **Sincronización y control:** Los dispositivos reciben el cofre y lo descifran localmente. (MFA, logs, backups)

### 📋 Notas del Orador
Antes de entrar en la arquitectura, necesitamos entender cómo funciona el flujo operativo de un gestor como Vaultwarden. La diferencia fundamental con almacenar contraseñas en un archivo es que el gestor no guarda claves sueltas: organiza todas las credenciales dentro de un **cofre cifrado**.

El flujo tiene cinco etapas. **Primero**, el usuario recuerda una única contraseña maestra fuerte. Esta clave nunca se envía al servidor en texto plano. **Segundo**, la aplicación cliente aplica una Key Derivation Function — PBKDF2 con SHA-256 o Argon2id — para transformar esa contraseña maestra en material criptográfico resistente a ataques de fuerza bruta. **Tercero**, el cofre se cifra localmente con AES-256 antes de salir del dispositivo del usuario. **Cuarto**, el servidor Vaultwarden recibe, almacena y sincroniza esos blobs cifrados, pero **nunca puede leer su contenido** porque no posee la clave de descifrado. Y **quinto**, cuando el usuario accede desde otro dispositivo, el cofre cifrado se descarga y se descifra localmente con su clave maestra.

Este esquema protege la **confidencialidad** porque el servidor nunca ve los datos en claro; la **integridad** porque AES en modo autenticado detecta alteraciones; y la **disponibilidad** porque la sincronización entre dispositivos permite acceso incluso si un dispositivo se pierde.

---

## SLIDE 4: Arquitectura y Lenguaje: C# vs. Rust
**Optimización y reducción de la superficie de ataque**
La arquitectura oficial requiere múltiples contenedores Docker en C# (.NET) y SQL Server (2-3 GB de RAM).
**Vaultwarden** optimiza esta pila: escrito enteramente en **Rust**, compilado a código nativo, menos de **50 MB** de RAM, en un solo contenedor.

- **Seguridad de Memoria en Rust:** Elimina clases enteras de vulnerabilidades (buffer overflows) sin recolector de basura.
- **Compatibilidad de API:** Implementa exactamente los mismos puntos de acceso de la API de Bitwarden.
- **Bases de Datos Flexibles:** Soporte integrado para SQLite, PostgreSQL y MySQL.

### 📋 Notas del Orador
La arquitectura oficial de Bitwarden está escrita en **C# sobre .NET Core**. Requiere múltiples contenedores Docker — para la API, el portal web, la base de datos SQL Server, y otros servicios auxiliares. Esto implica un consumo mínimo de 2 a 3 GB de RAM y una configuración relativamente compleja.

**Vaultwarden** simplifica toda esta pila: está escrito enteramente en Rust, se compila a código nativo, y ejecuta todo el backend en un solo contenedor Docker que consume menos de 50 MB de RAM. Esto tiene un impacto directo en seguridad por tres razones:

**Primero**, Rust elimina en tiempo de compilación clases enteras de vulnerabilidades de memoria — buffer overflows, null pointer dereferences, data races — sin necesidad de un recolector de basura. El compilador garantiza memory safety.

**Segundo**, Vaultwarden implementa exactamente los mismos endpoints REST y WebSocket de la API oficial de Bitwarden, por lo que mantiene compatibilidad total con todas las aplicaciones cliente oficiales — móvil, navegador y desktop.

**Tercero**, soporta SQLite para entornos pequeños, y PostgreSQL o MySQL para escalabilidad. Esto lo hace ideal para ejecutar en un VPS mínimo, una Raspberry Pi o un laboratorio de ciberdefensa con recursos limitados.

---

## SLIDE 5: Criptografía Zero-Knowledge
**Derivación en Cliente y Cifrado Simétrico**
El servidor nunca recibe la contraseña maestra en texto plano. Todo el cifrado se realiza en el cliente mediante **AES-256**.

**Puntos clave:**
- **Key Derivation Function:** PBKDF2 (SHA-256) o Argon2id.
- **Separación de Funciones:** Mitad cifra el cofre, mitad se hashea para autenticación HTTP.
- **Zero-Knowledge:** Si el servidor se compromete, el atacante solo obtiene datos cifrados y hashes bcrypt/Argon2.

### 📋 Notas del Orador
Esta es probablemente la diapositiva más importante desde el punto de vista criptográfico. El principio de **Zero-Knowledge** en Vaultwarden significa que el servidor nunca recibe la contraseña maestra en texto plano, ni tampoco la clave simétrica que cifra el cofre. Todo el proceso de cifrado y descifrado ocurre exclusivamente en el cliente.

El algoritmo de derivación funciona así: la aplicación toma la contraseña maestra del usuario y su email como salt, y los pasa por una **Key Derivation Function** — PBKDF2 con SHA-256 o, en configuraciones más recientes, Argon2id — para generar la Clave Maestra derivada. Esta KDF está diseñada para ser computacionalmente costosa, de modo que dificulta ataques de fuerza bruta incluso si un atacante obtiene los hashes.

La Clave Maestra se divide en dos funciones: una mitad se usa para cifrar y descifrar el cofre localmente con AES-256, y la otra mitad se hashea una vez más para generar un **hash de autenticación**, que es lo único que se envía al servidor para verificar la identidad del usuario. El servidor almacena ese hash procesado con bcrypt o Argon2, pero nunca tiene acceso a la clave que descifra los datos.

La consecuencia práctica es clara: si un atacante compromete la base de datos de Vaultwarden, obtiene cofres cifrados con AES-256 y hashes bcrypt de autenticación. No puede descifrar las credenciales almacenadas.

*(En este punto se puede hacer una demostración del flujo de derivación en la presentación).*

---

## SLIDE 6: Seguridad en la Capa de Transporte (TLS)
- **Cliente:** App Bitwarden (Derivación local, cifrado AES-256)
- **Proxy Inverso:** Caddy / Nginx (TLS 1.2/1.3, Let's Encrypt, HSTS/CORS)
- **Vaultwarden:** Contenedor Docker (Sincroniza blobs cifrados sin root)
- **Base de Datos:** SQLite / Postgres (Guarda blobs cifrados)

### 📋 Notas del Orador
El cifrado Zero-Knowledge protege los datos en reposo, pero necesitamos proteger también el **canal de comunicación** entre el cliente y el servidor. Aquí es donde entra la capa de transporte.

La arquitectura de red que proponemos tiene cuatro componentes.

**El cliente** — las aplicaciones oficiales de Bitwarden para móvil, navegador y desktop — realiza toda la derivación criptográfica localmente. Nunca transmite la contraseña maestra en texto plano.

**El proxy inverso** — Caddy, Nginx o Traefik — es obligatorio en producción. Escucha en el puerto 443, negocia la sesión TLS versión 1.2 o 1.3, y gestiona la renovación automática de certificados con Let's Encrypt. Además, aplica cabeceras HSTS para forzar que el navegador nunca acepte una conexión sin cifrar, y políticas CORS para prevenir ataques cross-origin.

**Vaultwarden** corre dentro de un contenedor Docker aislado. Procesa las peticiones REST y WebSocket, pero no maneja TLS directamente — esa responsabilidad la delega al proxy inverso, siguiendo el principio de separación de funciones.

**La base de datos** — SQLite o PostgreSQL — almacena los cofres ya cifrados y los hashes de autenticación. Todo esto protege contra sniffing, robo de sesión y ataques Man-in-the-Middle.

---

## SLIDE 7: Hardening del Servidor Vaultwarden
**Reducción del Vector de Ataque en el Host**
Alojar tu propio gestor implica asumir responsabilidad completa del host y la app.

- **Desactivar Registros Abiertos:** `SIGNUPS_ALLOWED=false` para evitar nuevos cofres no autorizados.
- **Aislamiento de Docker:** Ejecutar sin root (`user: "1000:1000"`).
- **Protección del Panel Admin:** Deshabilitar `/admin` o proteger con `ADMIN_TOKEN` y filtro IP.
- **Fail2ban:** Banear IPs tras intentos fallidos de login.
- **Copias de Seguridad (Backups):** Cifradas y externas.

### 📋 Notas del Orador
Alojar tu propio gestor de contraseñas implica asumir la **responsabilidad completa** de la seguridad del sistema operativo, de la red y de la aplicación. Esto nos lleva al concepto de hardening: reducir la superficie de ataque del host.

Las medidas de hardening que proponemos son cuatro. **Primera**: desactivar los registros abiertos estableciendo la variable de entorno SIGNUPS_ALLOWED en false inmediatamente después de crear las cuentas autorizadas. Si dejamos el registro público activo, cualquier atacante puede crear un cofre en nuestro servidor.

**Segunda**: ejecutar el contenedor Docker como usuario no root, usando la directiva user 1000:1000 en el docker-compose. Esto mitiga vulnerabilidades de escape de contenedor, porque incluso si un atacante logra salir del contenedor, no tiene privilegios de root en el host.

**Tercera**: proteger el panel de administración. El endpoint /admin debe estar deshabilitado o protegido con un ADMIN_TOKEN aleatorio fuerte y filtrado por IP. Si un atacante accede al panel admin, puede cambiar la configuración de todo el servidor.

**Cuarta**: configurar Fail2ban para monitorear los logs de Vaultwarden y banear automáticamente direcciones IP tras múltiples intentos fallidos de login. Y como control de continuidad, implementar backups automatizados, cifrados y almacenados externamente — fuera de la red local — para resiliencia frente a ransomware.

---

## SLIDE 8: Políticas de Autenticación y MFA
**Mitigación del Credential Stuffing**
El login expuesto requiere validar identidad digital antes de despachar el cofre cifrado. Priorizar criptografía asimétrica sobre SMS/Email.

- **WebAuthn / FIDO2:** YubiKeys (Protección robusta contra phishing).
- **Duo Security / TOTP:** Códigos basados en tiempo o Push.
- **Yubico OTP:** Integración directa con servidores Yubico.

### 📋 Notas del Orador
Incluso con toda la criptografía Zero-Knowledge que acabamos de ver, el portal de login de Vaultwarden está expuesto a Internet. Esto significa que un atacante puede intentar acceder usando credenciales robadas de otras brechas — lo que se conoce como **credential stuffing**. Por eso necesitamos un segundo factor de autenticación.

Vaultwarden soporta múltiples esquemas de MFA. Nosotros los clasificamos por nivel de robustez.

El más robusto es **WebAuthn con FIDO2**, implementado típicamente con llaves hardware como YubiKeys. Este esquema usa firmas criptográficas asimétricas que están vinculadas al dominio específico del servidor. Esto lo hace resistente al phishing: incluso si un usuario cae en un sitio falso, la llave no firmará la autenticación porque el dominio no coincide.

El segundo nivel es **TOTP** — Time-based One-Time Password — donde la app generadora crea códigos de 6 dígitos que cambian cada 30 segundos. Es una buena opción, pero es susceptible a ataques de phishing en tiempo real donde el atacante intercepta y usa el código antes de que expire.

También se soporta **Duo Security** para organizaciones que ya tienen esa infraestructura, y **Yubico OTP** como alternativa. En un entorno de ciberdefensa, la recomendación es clara: WebAuthn para cuentas administrativas y TOTP como mínimo para todos los usuarios.

---

## SLIDE 9: Bitwarden vs. Vaultwarden
| Característica | Bitwarden Oficial | Vaultwarden (Self-Hosted) |
| --- | --- | --- |
| Lenguaje | C# (.NET Core) | **Rust** (Ligero) |
| RAM | 2-4 GB | **< 50 MB** |
| Base de Datos | SQL Server | SQLite, Postgres, MySQL |
| Funciones Premium | Pago / Licencia | **Gratis** |
| Auditorías | SOC2, GDPR | Ninguna oficial |
| Riesgos Clave | Fallos en la nube | **API Drift** |

### 📋 Notas del Orador
En esta tabla comparamos las opciones disponibles: Bitwarden en la nube oficial, Bitwarden autohospedado oficial y Vaultwarden.

En cuanto al **lenguaje y motor**, tanto la nube como el autohospedado oficial usan C# sobre .NET Core. Vaultwarden usa Rust compilado a nativo, lo que reduce dramáticamente los requerimientos de RAM — de 2 a 4 GB a menos de 50 MB.

En **bases de datos**, Bitwarden oficial requiere Microsoft SQL Server. Vaultwarden es más flexible: soporta SQLite, PostgreSQL y MySQL.

Un punto clave son las **funciones premium**. En Bitwarden oficial requieren pago mensual o anual. En Vaultwarden vienen desbloqueadas gratuitamente: organizaciones, 2FA avanzado, Bitwarden Send, informes de seguridad, etc.

Sin embargo, hay que ser honestos con los **riesgos**. Bitwarden oficial tiene certificaciones SOC 2, HIPAA y GDPR, soporte técnico con SLA contractual. Vaultwarden no tiene ninguna certificación oficial y depende de la comunidad para soporte. Además existe el riesgo de **API drift**: si Bitwarden cambia su API, las aplicaciones oficiales podrían dejar de ser compatibles con Vaultwarden hasta que la comunidad actualice el código.

La conclusión es que **Bitwarden oficial es la opción correcta para entornos corporativos con requisitos de cumplimiento**. Vaultwarden es ideal para laboratorios, pymes, homelab o escenarios donde el equipo tiene la capacidad técnica de administrar el servicio.

---

## SLIDE 10: Gestión de Riesgo: Inversión en Ciberseguridad
**Cálculo Cuantitativo del Riesgo en Auto-hospedaje**
`ALE = SLE × ARO` (Pérdida Anual = Costo de incidente × Frecuencia anual)

- **Transferencia de Riesgo:** En la Nube, se transfiere el riesgo operativo al proveedor.
- **Mitigación Directa:** Auto-hospedar elimina el costo de licencias, pero requiere inversión en horas de ingeniería para hardening y mantenimiento para no disparar el ARO.

### 📋 Notas del Orador
Pasamos ahora al análisis cuantitativo del riesgo. Cuando una organización migra de Bitwarden Cloud a un Vaultwarden autohospedado, está asumiendo tareas de administración, disponibilidad y hardening que antes estaban en manos del proveedor. Esto altera la **expectativa de pérdida anual**.

El marco que usamos es la fórmula **ALE = SLE × ARO**. Donde SLE es la Single Loss Expectancy — cuánto cuesta un incidente individual —, que se calcula como el valor del activo multiplicado por el factor de exposición. ARO es la Annual Rate of Occurrence — cuántas veces al año esperamos que ese evento ocurra. Y ALE es la pérdida anual esperada.

En el caso de un gestor de contraseñas corporativo, el valor del activo es muy alto porque un compromiso de todas las credenciales puede implicar acceso a todos los sistemas de la organización. El factor de exposición también es elevado.

Con **Bitwarden Cloud**, se transfiere parte del riesgo operativo al proveedor mediante SLAs contractuales — es una estrategia de transferencia del riesgo. Con **Vaultwarden autohospedado**, el costo financiero de licencias baja a cero, pero se necesita invertir en horas de ingeniería de seguridad para hardening, monitoreo y mantenimiento. Si esa inversión no se hace, el ARO se dispara y la pérdida anual esperada puede superar el ahorro.

La decisión debe alinearse con el **apetito de riesgo** de la organización y con su capacidad real de administrar el servicio.

---

## SLIDE 11: Matriz de Riesgo Aplicada a Vaultwarden
- **Credential stuffing:** Alta prob, Alto impacto. Control: MFA, passwords fuertes.
- **Fuerza bruta:** Media prob, Alto impacto. Control: Fail2ban, rate limit.
- **Panel admin expuesto:** Media prob, Alto impacto. Control: ADMIN_TOKEN fuerte.
- **Pérdida de BD:** Media prob, Alto impacto. Control: Backups externos y cifrados.
- **Mala config TLS:** Baja prob, Alto impacto. Control: HTTPS, TLS 1.2/1.3.

### 📋 Notas del Orador
En esta matriz concretamos el análisis de riesgo con cinco eventos específicos que pueden afectar la confidencialidad, integridad y disponibilidad de las credenciales almacenadas en Vaultwarden.

El primer riesgo es **credential stuffing**: cuando un atacante usa credenciales filtradas de otras brechas para intentar acceder al cofre. La probabilidad es alta porque las brechas de datos son frecuentes, y el impacto es alto porque puede resultar en la descarga completa del cofre cifrado. El control principal es MFA obligatorio más contraseña maestra robusta.

El segundo es **fuerza bruta**: intentos masivos contra el endpoint de login expuesto a Internet. El control aquí es Fail2ban con rate limiting y alertas automatizadas.

El tercero es el **panel admin expuesto**: si el endpoint /admin queda accesible sin protección, un atacante puede cambiar la configuración del servidor completo. El control es deshabilitar el panel o protegerlo con ADMIN_TOKEN y filtrado por IP.

El cuarto es la **pérdida de base de datos** por falla de disco, borrado accidental o ransomware. Afecta directamente la disponibilidad. El control son backups cifrados, externos y automatizados con pruebas periódicas de restauración.

El quinto es **mala configuración TLS**: certificados vencidos, HTTP sin cifrar o proxy mal configurado. El control es HTTPS obligatorio con TLS 1.2/1.3, HSTS y renovación automática.

Lo importante es notar que los controles **bajan la probabilidad** de ocurrencia, pero no eliminan completamente el impacto. Por eso es fundamental tener un enfoque de defensa en profundidad con múltiples capas.

---

## SLIDE 12: Apetito, Tolerancia y Riesgo Residual
**Ciclo de vida del riesgo:**
Riesgo inherente (Alto) -> Controles (Mitigación) -> Riesgo residual (Aceptable)

**Criterios de Aceptación:**
- **Apetito de riesgo:** Muy bajo para confidencialidad, bajo para integridad.
- **Tolerancia técnica:** No panel admin abierto, MFA obligatorio.
- **Continuidad:** Backups externos.
- **Gobierno:** Gestión de acceso, actualización en 72h.

### 📋 Notas del Orador
Esta diapositiva muestra el ciclo completo del riesgo desde la perspectiva de la Alta Gerencia. Partimos del **riesgo inherente** — la situación inicial sin controles: contraseñas reutilizadas, sin MFA, backups no probados y administración manual. El nivel es alto.

Luego aplicamos los **controles** que hemos descrito: Vaultwarden con Zero-Knowledge, MFA obligatorio, hardening del servidor, Fail2ban, TLS configurado correctamente, backups cifrados y capacitación de usuarios. Cada control reduce la probabilidad o el impacto de los riesgos identificados.

Después de aplicar todos los controles, queda el **riesgo residual**: el riesgo que permanece incluso con todas las medidas implementadas. En nuestro caso, eso incluye el error humano, la aparición de vulnerabilidades zero-day, mala operación del servicio o la pérdida de la clave maestra por parte del usuario. Este riesgo residual lo clasificamos como aceptable.

Los criterios de aceptación para la Alta Gerencia son cuatro. **Apetito de riesgo**: muy bajo para confidencialidad, bajo para integridad, medio-bajo para disponibilidad. **Tolerancia técnica**: no se aceptan cuentas administrativas sin MFA ni panel admin expuesto. **Continuidad**: los backups deben ser externos, cifrados y restaurables — nunca en el mismo servidor. **Gobierno**: política de contraseñas, gestión de altas y bajas de usuarios, revisión periódica de logs y parches críticos aplicados dentro de las 72 horas.

---

## SLIDE 13: Conclusiones del Análisis
1. **Vaultwarden no es magia:** Es un control técnico eficiente, pero el auto-hospedaje exitoso depende del diseño, monitoreo y mantenimiento del servicio completo.
2. **Entornos de Producción:** Bitwarden oficial es ideal por certificaciones de cumplimiento.
3. **Power Users y Labs:** Vaultwarden ofrece rendimiento y libertad insuperables.
4. **La Ciberseguridad como un Proceso Continuo.**

### 📋 Notas del Orador
Para cerrar el análisis técnico, queremos destacar tres conclusiones principales.

**Primera**: Vaultwarden es una pieza excepcional de ingeniería de software. Su implementación en Rust es eficiente, segura a nivel de memoria, y compatible con todas las aplicaciones oficiales de Bitwarden. Pero desde la perspectiva de la seguridad informática, la herramienta es solo un control técnico dentro de un sistema más amplio. No es una solución mágica.

**Segunda**: el auto-hospedaje exitoso depende del diseño, monitoreo y mantenimiento del ciclo de vida completo del servicio. Esto incluye hardening, MFA, backups, actualizaciones, revisión de logs y capacitación de usuarios. Si alguna de estas capas falla, la seguridad se degrada independientemente de lo buena que sea la criptografía.

**Tercera**: para entornos corporativos con requisitos de cumplimiento como SOC 2 o HIPAA, la opción correcta sigue siendo Bitwarden oficial, sea en la nube o autohospedado, debido a las certificaciones y el soporte contractual. Vaultwarden es la opción ideal para desarrolladores, power users, laboratorios de ciberdefensa o pymes que tienen la capacidad técnica de operar el servicio y no necesitan certificaciones formales.

En última instancia, la ciberseguridad es un **proceso continuo**: revisar, medir, ajustar y actualizar controles de forma permanente.

---

## SLIDE 14: Preguntas e Interacción
**"El único sistema verdaderamente seguro es aquel que está apagado..." - Gene Spafford**

### 📋 Notas del Orador
Con esto finalizamos nuestra presentación. Queremos agradecer al profesor y al tribunal por su tiempo y atención.

Quedamos a disposición para cualquier pregunta sobre la arquitectura propuesta, las decisiones de diseño, los controles de seguridad o el análisis de riesgo.

**Posibles preguntas del jurado:**
- **"¿Qué pasa si el usuario pierde la contraseña maestra?"** -> No hay forma de recuperarla (Zero-Knowledge). Protocolo de recovery clave (exportación cifrada, códigos).
- **"¿Cómo manejan las actualizaciones de seguridad?"** -> Pull de imagen Docker, parches críticos aplicados en menos de 72 horas.
- **"¿No es más seguro usar la nube oficial?"** -> Depende del modelo de amenazas. La nube oficial transfiere riesgo pero implica confiar en un tercero.
- **"¿Qué ventaja tiene Rust sobre C# en seguridad?"** -> Rust previene vulnerabilidades de memoria (como buffer overflows) en tiempo de compilación. El 70% de los bugs de seguridad históricamente son por manejo de memoria.
