# IAMASAI - Sistema de Interacción Multi-Agente con Ollama

Este programa permite simular un debate y colaboración proactiva entre dos agentes de inteligencia artificial alojados en una instancia local de **Ollama**. Su objetivo principal es profundizar en un tema de investigación o ciberdefensa y estructurar el conocimiento generado en un reporte markdown de síntesis final.

El programa está desarrollado en **Node.js** de forma nativa (sin dependencias de terceros), aprovechando la API nativa de Ollama `/api/chat`.

---

## Requisitos Previos

1. **Node.js** instalado (versión 18 o superior para soporte nativo de `fetch`).
2. **Ollama** instalado y ejecutándose localmente (`http://localhost:11434`).
3. El modelo de IA que planees usar debe estar previamente descargado. Por ejemplo:
   ```bash
   ollama pull gemma4:26b
   ```
   *(O cualquier otro modelo de tu preferencia, como `llama3`, `mistral`, `gemma2`, `phi3`, etc.)*

---

## Estructura del Proyecto

* `config.json`: Archivo de configuración central (modelo, parámetros, temas y roles de los agentes).
* `index.js`: Script principal de orquestación y comunicación.
* `historial_interaccion.md`: Archivo generado automáticamente con la transcripción y síntesis de la discusión (el nombre puede cambiar según la configuración).

---

## Configuración (`config.json`)

Puedes editar el archivo `config.json` para ajustar los siguientes parámetros:

* `model`: El nombre del modelo local de Ollama (ej. `"gemma4:26b"`, `"llama3"`, `"mistral"`).
* `ollamaUrl`: Dirección del servidor local de Ollama (por defecto `"http://localhost:11434"`).
* `topic`: La temática o consigna sobre la cual debatirán los agentes.
* `maxTurns`: El número de intercambios o turnos de debate. **Establécelo en `0` para que el debate sea continuo e infinito.**
* `outputFile`: Nombre del archivo `.md` donde se guardará el registro.
* `temperature`: Valor de creatividad/coherencia (0.0 a 1.0).
* `agentA` y `agentB`:
  * `name`: Nombre descriptivo asignado a la instancia del agente.
  * `systemPrompt`: Instrucciones de personalidad y comportamiento que guiarán el rol y enfoque del agente.

---

## Cómo Ejecutar

Para iniciar la simulación con la configuración establecida en `config.json`, abre una terminal en esta carpeta y ejecuta:

```bash
node index.js
```

### Opciones y Parámetros por Consola

Puedes anular o cambiar las configuraciones definidas en `config.json` usando argumentos desde la línea de comandos:

```bash
# Cambiar el modelo para esta ejecución
node index.js --model mistral

# Cambiar el tema del debate
node index.js --topic "Implicaciones del phishing asistido por IA"

# Definir un límite de turnos (ej. 5) o ponerlo en continuo (0)
node index.js --turns 5

# Cambiar el retraso entre respuestas (en milisegundos)
node index.js --delay 2000

# Activar el Modo Interactivo
node index.js --interactive
```

Para ver la ayuda rápida de opciones en la consola, ejecuta:
```bash
node index.js --help
```

---

## Características Especiales

### 1. Debate Continuo (Sin Fin)
Por defecto (si `maxTurns` es `0`), los agentes seguirán debatiendo indefinidamente sobre el tema propuesto. Esto permite que el flujo de ideas no tenga una limitación artificial de turnos y se asemeje a un chat real.

### 2. Finalización y Síntesis Grácil (Ctrl+C)
Cuando consideres que el debate ha cubierto suficiente terreno, presiona **`Ctrl+C`** en la terminal. El programa capturará la señal, detendrá el bucle y tomará **todo el historial discutido hasta ese momento** para enviarlo a un proceso de síntesis en Ollama. 
Generará un informe estructurado que contiene:
* **Resumen Ejecutivo**
* **Puntos Clave Discutidos**
* **Consensos y Disensos**
* **Conclusiones y Recomendaciones**

Este informe se mostrará en pantalla y se agregará al final de tu archivo markdown de salida automáticamente.

### 3. Modo Interactivo (`--interactive` o `-i`)
Si ejecutas con el flag `--interactive` o `-i`, el programa se pausará antes de la intervención de cada agente, brindándote la oportunidad de:
* **Presionar Enter**: Para dejar que el agente correspondiente responda de forma autónoma.
* **Escribir una directiva o pregunta**: Para intervenir como moderador. La directiva ingresada se inyectará en el contexto inmediato del agente para dirigir o encauzar su respuesta.
* **Escribir `salir`**: Para finalizar el debate y disparar la síntesis de manera inmediata.
