# Vacíos Legales y Seguridad Jurídica en los Smart Contracts aplicados al Real Estate Local

**Trabajo Final de Investigación Integrador**
**Materia:** Régimen Legal del Manejo de Datos
**Docente:** Prof. Dra. PhD Johanna Caterina Faliero
**Estudiante:** Hernán
**Año:** 2023

---

## Índice

1. Introducción
2. Smart Contracts y el Código Civil y Comercial de la Nación
3. Estructuras Jurídicas Indirectas en el Mercado Local
4. Valor Probatorio de los Smart Contracts en el Proceso Civil Argentino
5. Encuadre Penal ante Estafas Informáticas y Fallas Técnicas
6. Propuesta de Reforma y Adecuación Regulatoria
7. Conclusión
8. Bibliografía

---

## 1. Introducción

El constante avance de las tecnologías de la información y la comunicación ha permeado en casi todas las áreas de la economía y el derecho. En los últimos años, la tecnología *blockchain* y los contratos inteligentes (*smart contracts*) han emergido como herramientas disruptivas en el sector inmobiliario (*Real Estate*). La "tokenización" inmobiliaria promete democratizar el acceso al mercado mediante la inversión fraccionada, reduciendo la fricción en las transferencias de valor y automatizando la ejecución de transacciones a través de códigos informáticos inmutables.

Sin embargo, esta innovación tecnológica colisiona frontalmente con el rígido y formalista marco legal del Código Civil y Comercial de la Nación Argentina (CCyCN). El ordenamiento jurídico argentino exige, como regla general para la constitución, modificación o transmisión de derechos reales sobre inmuebles, la instrumentación mediante escritura pública (Art. 1017, inc. a) y su consiguiente inscripción registral para la oponibilidad ante terceros (Art. 1893).

Esta situación genera un profundo vacío legal y una marcada inseguridad jurídica. Las transferencias automatizadas en la *blockchain* carecen de la solemnidad exigida y del control de legalidad notarial y registral obligatorio. Como resultado, en la práctica actual, los *tokens* inmobiliarios terminan representando meros derechos personales u obligaciones crediticias bajo figuras indirectas —típicamente fideicomisos o sociedades— en lugar de verdaderos derechos reales de dominio.

### Problema de Investigación

Ante un eventual incumplimiento contractual, una falla de programación en el código (*bug*) o una maniobra delictiva (como la estafa informática tipificada en el Art. 173, inc. 16 del Código Penal), la validez probatoria de estos contratos auto-ejecutables resulta sumamente difusa en un proceso judicial civil. Existe una gran dificultad para encuadrar a los *smart contracts* como documentos electrónicos con o sin firma digital en los términos de la Ley 25.506 y el Art. 287 del CCyCN. Esta indefinición relativiza la eficacia jurídica de las transacciones y dificulta tanto la atribución de responsabilidad civil como la persecución penal de conductas ilícitas, especialmente en entornos donde prima el pseudonimato.

### Pregunta de Investigación

> ¿En qué medida la falta de adecuación del marco legal civil y penal argentino —especialmente respecto a las exigencias solemnes de escritura pública e inscripción registral— afecta la seguridad jurídica, la eficacia probatoria y la tutela jurisdiccional de los adquirentes de activos inmobiliarios tokenizados mediante smart contracts frente a incumplimientos contractuales o estafas informáticas?

### Hipótesis de Trabajo

La implementación de *smart contracts* para la tokenización de bienes inmuebles en Argentina genera una situación de inseguridad jurídica estructural debido a la incompatibilidad ontológica entre la autoejecución tecnológica de la *blockchain* (donde el código actúa como ley) y los requisitos solemnes e imperativos del Código Civil y Comercial. Esta brecha debilita significativamente la eficacia probatoria de estos instrumentos en sede judicial —al no asimilarse plenamente a instrumentos públicos o privados con firma digital homologada— y restringe severamente la tutela penal y civil ante estafas informáticas. En definitiva, esta disociación imposibilita la ejecución forzada del derecho real de propiedad, relegando al inversor a una precaria acción personal por daños y perjuicios contra intermediarios a menudo inidentificables.

### Objetivos

**Objetivos Generales:**
* Analizar la compatibilidad jurídica de los *smart contracts* aplicados al *Real Estate* local con el régimen de derechos reales y la teoría general del contrato del CCyCN, evaluando los riesgos de inseguridad jurídica.
* Determinar la eficacia probatoria y el encuadre penal de los *smart contracts* ante conductas delictivas, para proponer lineamientos de adecuación regulatoria.

**Objetivos Específicos:**
* Identificar y caracterizar las estructuras jurídicas indirectas (fideicomisos, sociedades) utilizadas actualmente en Argentina para la tokenización inmobiliaria.
* Evaluar el valor probatorio de los *smart contracts* en el proceso civil argentino (Ley 25.506 y Arts. 287 y 319 CCyCN).
* Analizar la tipicidad del delito de estafa informática (Art. 173, inc. 16 CP) y la responsabilidad civil ante fallas de programación o manipulación de oráculos.
* Elaborar una propuesta de bases regulatorias que integre la función notarial y registral en las transmisiones digitales.

---

## 2. Smart Contracts y el Código Civil y Comercial de la Nación

El término *smart contract* o contrato inteligente fue acuñado en la década de 1990 por Nick Szabo, quien lo definió como un conjunto de promesas, especificadas en forma digital, incluyendo los protocolos mediante los cuales las partes cumplen dichas promesas. En la actualidad, su soporte técnico fundamental es la *blockchain* (cadena de bloques), que garantiza la inmutabilidad y la autoejecución del código de manera descentralizada.

Desde la perspectiva del derecho privado argentino, un contrato es el acto jurídico mediante el cual dos o más partes manifiestan su consentimiento para crear, regular, modificar, transferir o extinguir relaciones jurídicas patrimoniales (Art. 957 CCyCN). El *smart contract*, en sentido estricto, no es un nuevo tipo de contrato, sino una forma de instrumentación y ejecución automatizada de la voluntad de las partes.

El conflicto principal surge en la aplicación de esta tecnología a la transmisión de bienes inmuebles. El sistema inmobiliario argentino está edificado sobre pilares de seguridad jurídica preventiva, cuyo fin es proteger la buena fe y evitar litigios. El Art. 1017, inc. a del CCyCN establece imperativamente que "deben ser otorgados por escritura pública los contratos que tienen por objeto la adquisición, modificación o extinción de derechos reales sobre inmuebles". Esta formalidad *ad solemnitatem* requiere la intervención de un oficial público (el escribano), quien da fe de la identidad de las partes, su capacidad, la legalidad del acto y el libre consentimiento.

Sumado a ello, el Art. 1893 del CCyCN exige la inscripción en el Registro de la Propiedad Inmueble para que la transmisión sea oponible a terceros interesados y de buena fe. La mera ejecución de una línea de código en una red Ethereum o Polygon, transfiriendo un *token* de una *wallet* (billetera virtual) a otra, no cumple con ninguno de estos dos requisitos de orden público. Por lo tanto, dicha transferencia digital es inoponible jurídicamente frente a la exigencia de un derecho real de dominio.

---

## 3. Estructuras Jurídicas Indirectas en el Mercado Local

Ante la imposibilidad fáctica y jurídica de transferir el dominio de un inmueble directamente mediante un *token* (dado que el Registro de la Propiedad no inscribe transacciones generadas en la *blockchain* ni reconoce *wallets* como titulares de dominio), el mercado local ha recurrido a lo que la doctrina denomina "estructuras jurídicas indirectas".

La figura más utilizada es el **Fideicomiso Inmobiliario**. En este esquema, el propietario original (fiduciante) transfiere el inmueble a un fiduciario (que suele ser una sociedad administradora), quien detenta la propiedad fiduciaria. Los *tokens* emitidos en la *blockchain* no representan "metros cuadrados" de dominio, sino que se configuran como un derecho de participación contractual o un certificado de participación en el fideicomiso. El inversor, al adquirir el *token*, adquiere un derecho personal (de crédito) contra el fiduciario para exigir los beneficios económicos del inmueble (por ejemplo, rentas por alquiler o utilidades por una futura venta).

Otra estructura habitual es la constitución de **Sociedades Comerciales** (como una S.A. o SAS) cuyo único patrimonio es el inmueble objeto de negocio. La tokenización recae sobre las acciones de dicha sociedad. Quien compra el *token* es, en los hechos, accionista de la empresa.

El grave problema de estas estructuras es la brecha conceptual y comercial entre lo que se publicita ("sea dueño de un departamento con 100 dólares") y lo que jurídicamente se adquiere. El inversor carece de la acción reivindicatoria propia de los derechos reales frente a ocupaciones ilegítimas, no posee el señorío directo sobre la cosa y asume el riesgo crediticio, operativo y de mala administración de la sociedad fiduciaria intermediaria. Esto pulveriza el paradigma descentralizado que promete la tecnología.

---

## 4. Valor Probatorio de los Smart Contracts en el Proceso Civil Argentino

En el escenario de que un contrato inteligente falle (ya sea porque no liberó los fondos correspondientes, o porque un "oráculo" alimentó información errónea al sistema), la víctima deberá acudir a los tribunales ordinarios. Aquí se presenta el desafío de la validez probatoria.

El CCyCN y la Ley 25.506 de Firma Digital regulan la incorporación de tecnología a los actos jurídicos. El documento digital es asimilado al instrumento privado siempre que cuente con "firma digital" (Art. 288 CCyCN y Art. 2 Ley 25.506). La firma digital, en Argentina, requiere un certificado emitido por un certificador licenciado por el Estado (como la ONTI). Las firmas criptográficas asimétricas utilizadas en las *blockchains* públicas (claves privadas y públicas) no son emitidas por certificadores licenciados nacionales, por lo que jurídicamente recaen en la categoría de "firma electrónica" (Art. 5 Ley 25.506).

En consecuencia, un *smart contract* no constituye un instrumento privado, sino un **instrumento particular no firmado** (Art. 287 CCyCN). Su valor probatorio, según el Art. 319, quedará librado a la apreciación judicial, debiendo el juez ponderar la confiabilidad de los soportes y los usos del tráfico. Si bien la tecnología *blockchain* ofrece peritajes informáticos irrefutables sobre la existencia y temporalidad de la transacción, el anonimato o pseudonimato inherente a las *wallets* dificulta enormemente probar la imputabilidad (quién apretó el botón) y la intención real de las partes al momento de contratar.

---

## 5. Encuadre Penal ante Estafas Informáticas y Fallas Técnicas

El entorno criptográfico es fértil para el fraude. Supongamos que un desarrollador introduce maliciosamente una puerta trasera en el código de un *smart contract* (*rug pull*) que le permite vaciar los fondos aportados por los inversores para un proyecto inmobiliario.

Esta conducta halla asidero típico en el **Art. 173, inc. 16 del Código Penal de la Nación**, que sanciona como caso especial de defraudación la **estafa informática**: "El que defraudare a otro mediante cualquier técnica de manipulación informática que altere el envío, transmisión, recepción, entrada, procesamiento o salida de datos informáticos, con el propósito de obtener un beneficio indebido".

Si bien la figura legal abarca la maniobra, la tutela jurisdiccional se ve frustrada en la práctica por la arquitectura tecnológica:

1. **Pseudonimato:** Identificar a la persona física detrás de una dirección alfanumérica de Ethereum requiere complejas medidas probatorias internacionales y cooperación de *exchanges* (si es que los fondos tocaron el sistema financiero tradicional).
2. **Responsabilidad en Oráculos (Oracles):** Los *smart contracts* de Real Estate suelen depender de oráculos (proveedores externos de datos, como entidades que informan el fin de la construcción de la obra o el tipo de cambio). Si el oráculo es manipulado (*oracle manipulation attack*) para que el contrato auto-ejecute una orden perjudicial, deslindar la responsabilidad civil (falla técnica sin dolo) de la responsabilidad penal (defraudación premeditada) resulta técnicamente complejo.
3. **La máxima "Code is Law":** Parte de la comunidad cripto defiende que si el código permite una acción, esta es legítima por definición de las reglas del juego. Sin embargo, el derecho penal argentino no admite convenciones que eximan el dolo. Aprovechar una vulnerabilidad o *bug* no intencional para desviar fondos (*exploits*) configura delito, independientemente de que el código defectuoso lo haya permitido.

---

## 6. Propuesta de Reforma y Adecuación Regulatoria

La tensión entre innovación (rapidez, desintermediación) y el orden público (seguridad jurídica preventiva) requiere una síntesis legislativa y reglamentaria. No se trata de eliminar la función notarial, que es el garante de la fe pública y el control de legalidad (previniendo lavado de activos y fraudes), sino de digitalizarla y amalgamarla con la tecnología de registros distribuidos (DLT).

Se propone:

* **Escribanos como Nodos Oráculo (Oracles Notariales):** Los notarios pueden actuar como oráculos institucionales que validen legalmente eventos del mundo físico (certificación de identidad de las partes, verificación del título antecedente, constatación del estado de ocupación del inmueble) y envíen este estado verificado a la *blockchain* para que el *smart contract* proceda.
* **Registro de la Propiedad Inmueble Digital:** Habilitar a los Registros locales para emitir *Tokens No Fungibles (NFT)* oficiales que representen el derecho real de dominio. La transferencia de este "NFT oficial" en una red permisionada estatal, con la firma digital habilitada del escribano interviniente, cumpliría simultáneamente los requisitos del Art. 1017 y el Art. 1893 del CCyCN.
* **Homologación de Identidad Digital:** Para dotar de firma digital con presunción de autoría (Ley 25.506) a las transacciones inmobiliarias on-chain, las *wallets* de los participantes deben estar vinculadas a un sistema de Identidad Digital Soberana estatal (como el Renaper), eliminando el pseudonimato en negocios de alto impacto patrimonial y social.

---

## 7. Conclusión

La presente investigación ratifica la hipótesis planteada: en la actualidad, la tokenización del *Real Estate* en Argentina, impulsada mediante *smart contracts* puros, se asienta sobre un profundo vacío legal que engendra inseguridad jurídica. La exigencia insoslayable de la escritura pública y la inscripción registral condena a los *tokens* inmobiliarios a ser meras representaciones de derechos personales (vía fideicomisos o sociedades), privando al inversor de las prerrogativas absolutas de un verdadero derecho real de propiedad.

Asimismo, ante litigios civiles o ataques informáticos tipificados como estafa informática, la precaria asimilación de los *smart contracts* como instrumentos particulares no firmados debilita la posición procesal de la víctima. El anonimato y la irrevocabilidad de la *blockchain* se convierten así en un arma de doble filo que, sin control notarial ni de identidad, facilita la impunidad.

La solución no reside en la resistencia pasiva frente al avance de la *Web3*, ni en la claudicación del orden público del Código Civil y Comercial. Se requiere una reforma regulatoria audaz que integre a los notarios y registros públicos como garantes en la cadena de bloques, evolucionando hacia un ecosistema de *smart contracts* institucionalizados, que brinden la eficiencia prometida por la tecnología bajo el resguardo irrenunciable de la seguridad jurídica argentina.

---

## 8. Bibliografía

* Alterini, J. H. (2016). *Código Civil y Comercial Comentado*. Tratado Exegético. Thomson Reuters La Ley.
* Congreso de la Nación Argentina. (2014). *Código Civil y Comercial de la Nación*. Ley N° 26.994.
* Congreso de la Nación Argentina. (2001). *Ley de Firma Digital*. Ley N° 25.506.
* Congreso de la Nación Argentina. (1921 y modif.). *Código Penal de la Nación Argentina*. Ley N° 11.179.
* Faliero, J. C. (2020). *Criptomonedas: la nueva frontera regulatoria del derecho informático*. Ad-Hoc.
* Lorenzetti, R. L. (2015). *Tratado de los Contratos*. Rubinzal-Culzoni Editores.
* Szabo, N. (1996). *Smart Contracts: Building Blocks for Digital Markets*. Extropy.
