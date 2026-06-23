#!/usr/bin/env node

/**
 * IAMASAI - Multi-Agent Local Ollama Interaction System
 * Facilitates a structured, proactive dialogue between two local AI agents
 * to generate knowledge and synthesize insights on a given topic.
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline/promises';

// Define __dirname and __filename for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Console colors for premium terminal UI
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32' + 'm', // split to avoid raw ansi character sequence parsing issues
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m'
};

// Help print
function printHelp() {
  console.log(`
${colors.bright}${colors.cyan}IAMASAI - Sistema de Interacción Multi-Agente con Ollama${colors.reset}

${colors.bright}Uso:${colors.reset}
  node index.js [opciones]

${colors.bright}Opciones:${colors.reset}
  --config <path>     Ruta al archivo de configuración JSON (por defecto: config.json)
  --model <name>      Sobrescribe el modelo de Ollama (ej. llama3, mistral, gemma2)
  --topic "<topic>"   Sobrescribe la temática del debate
  --turns <number>    Cantidad de turnos. Pon 0 para modo continuo infinito. (por defecto: config.json)
  --output <file>     Sobrescribe el nombre del archivo de salida
  --delay <ms>        Retraso en milisegundos entre respuestas en modo continuo (por defecto: 1500)
  --interactive, -i   Activa el modo interactivo para guiar o moderar a los agentes
  --help, -h          Muestra este mensaje de ayuda
`);
}

// Simple CLI arguments parser
function parseArgs(args) {
  const parsed = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') {
      parsed.help = true;
    } else if (arg === '--config' && args[i + 1]) {
      parsed.config = args[++i];
    } else if (arg === '--model' && args[i + 1]) {
      parsed.model = args[++i];
    } else if (arg === '--topic' && args[i + 1]) {
      parsed.topic = args[++i];
    } else if (arg === '--turns' && args[i + 1]) {
      parsed.turns = parseInt(args[++i], 10);
    } else if (arg === '--output' && args[i + 1]) {
      parsed.output = args[++i];
    } else if (arg === '--delay' && args[i + 1]) {
      parsed.delay = parseInt(args[++i], 10);
    } else if (arg === '--interactive' || arg === '-i') {
      parsed.interactive = true;
    }
  }
  return parsed;
}

// Function to call the Ollama API
async function callOllamaChat(url, model, messages, temperature = 0.7) {
  const endpoint = `${url}/api/chat`;
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        messages: messages,
        options: {
          temperature: temperature
        },
        stream: false
      })
    });

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return data.message.content;
  } catch (error) {
    throw new Error(`Error en la llamada a Ollama: ${error.message}`);
  }
}

// Function to check if Ollama is online and list pulled models
async function checkOllama(url, modelName) {
  try {
    const res = await fetch(`${url}/api/tags`);
    if (!res.ok) return { online: false };
    
    const data = await res.json();
    const models = data.models || [];
    
    const target = modelName.toLowerCase();
    const exists = models.some(m => {
      const name = m.name.toLowerCase();
      return name === target || name === `${target}:latest` || target === `${name}:latest`;
    });

    return {
      online: true,
      exists,
      models: models.map(m => m.name)
    };
  } catch (error) {
    return { online: false, error: error.message };
  }
}

async function main() {
  const cliArgs = parseArgs(process.argv.slice(2));

  if (cliArgs.help) {
    printHelp();
    process.exit(0);
  }

  // Determine config path
  const configPath = path.resolve(__dirname, cliArgs.config || 'config.json');

  console.log(`${colors.cyan}${colors.bright}=== INICIALIZANDO IAMASAI ===${colors.reset}`);
  console.log(`${colors.dim}Cargando configuración desde: ${configPath}${colors.reset}`);

  let config;
  try {
    const configData = await fs.readFile(configPath, 'utf8');
    config = JSON.parse(configData);
  } catch (error) {
    console.error(`${colors.red}Error al leer el archivo de configuración:${colors.reset}`, error.message);
    console.log(`${colors.yellow}Asegúrate de que config.json existe o especifica uno válido con --config <ruta>.${colors.reset}`);
    process.exit(1);
  }

  // Override config parameters with CLI arguments if present
  const model = cliArgs.model || config.model;
  const ollamaUrl = config.ollamaUrl || 'http://localhost:11434';
  const topic = cliArgs.topic || config.topic;
  const maxTurns = cliArgs.turns !== undefined ? cliArgs.turns : (config.maxTurns !== undefined ? config.maxTurns : 0);
  const outputFile = cliArgs.output || config.outputFile || 'historial_interaccion.md';
  const temperature = config.temperature !== undefined ? config.temperature : 0.7;
  const delayMs = cliArgs.delay !== undefined ? cliArgs.delay : (config.delay !== undefined ? config.delay : 1500);

  console.log(`\n${colors.bright}Parámetros de la simulación:${colors.reset}`);
  console.log(`  ${colors.bold}Modelo:${colors.reset} ${colors.green}✔ ${model}${colors.reset}`);
  console.log(`  ${colors.bold}Servidor Ollama:${colors.reset} ${ollamaUrl}`);
  console.log(`  ${colors.bold}Turnos:${colors.reset} ${maxTurns === 0 ? colors.cyan + 'Continuo (Infinito)' : maxTurns}`);
  console.log(`  ${colors.bold}Archivo de salida:${colors.reset} ${outputFile}`);
  console.log(`  ${colors.bold}Modo interactivo:${colors.reset} ${cliArgs.interactive ? '\x1b[32mActivado\x1b[0m' : colors.dim + 'Desactivado'}`);
  console.log(`  ${colors.bold}Temática:${colors.reset} "${colors.yellow}${topic}${colors.reset}"`);

  // Verify Ollama connection and check if the model is loaded
  console.log(`\n${colors.cyan}Verificando conexión con Ollama...${colors.reset}`);
  const ollamaStatus = await checkOllama(ollamaUrl, model);

  if (!ollamaStatus.online) {
    console.error(`${colors.red}${colors.bright}¡ERROR DE CONEXIÓN!${colors.reset}`);
    console.error(`${colors.red}No se pudo conectar con Ollama en ${ollamaUrl}.${colors.reset}`);
    console.error(`${colors.yellow}Por favor, asegúrate de que el servicio de Ollama está ejecutándose.${colors.reset}`);
    process.exit(1);
  }

  console.log(`\x1b[32m✔ Conexión establecida con Ollama.${colors.reset}`);

  if (!ollamaStatus.exists) {
    console.log(`\n${colors.yellow}${colors.bright}⚠ ADVERTENCIA: Modelo no detectado${colors.reset}`);
    console.log(`${colors.yellow}El modelo '${model}' no se encuentra en la lista de modelos descargados localmente.${colors.reset}`);
    console.log(`${colors.dim}Modelos encontrados:${colors.reset} ${ollamaStatus.models.join(', ') || 'Ninguno'}`);
    console.log(`${colors.yellow}Si Ollama no lo tiene descargado, la llamada fallará. Te sugerimos ejecutar: ${colors.reset}${colors.bright}ollama pull ${model}${colors.reset}\n`);
    console.log(`${colors.dim}Intentando continuar de todas formas...${colors.reset}\n`);
  } else {
    console.log(`\x1b[32m✔ El modelo '${model}' está listo en la instancia local de Ollama.${colors.reset}\n`);
  }

  const agentA = config.agentA;
  const agentB = config.agentB;

  console.log(`${colors.cyan}${colors.bright}Configuración de Agentes:${colors.reset}`);
  console.log(`  ${colors.bgBlue}${colors.white} Agente A: ${agentA.name} ${colors.reset}`);
  console.log(`    ${colors.dim}System Prompt: ${agentA.systemPrompt}${colors.reset}`);
  console.log(`  ${colors.bgMagenta}${colors.white} Agente B: ${agentB.name} ${colors.reset}`);
  console.log(`    ${colors.dim}System Prompt: ${agentB.systemPrompt}${colors.reset}\n`);

  // Initialize output file
  const fullOutputPath = path.resolve(__dirname, outputFile);
  const headerMarkdown = `# Registro de Interacción: ${agentA.name} ⬌ ${agentB.name}
**Fecha:** ${new Date().toLocaleString()}
**Modelo de Ollama:** \`${model}\`
**Temática:** ${topic}

## Configuración de los Agentes
* **Agente A - ${agentA.name}:**
  > ${agentA.systemPrompt}
* **Agente B - ${agentB.name}:**
  > ${agentB.systemPrompt}

---

## Desarrollo del Debate

`;

  try {
    await fs.writeFile(fullOutputPath, headerMarkdown, 'utf8');
    console.log(`\x1b[32m✔ Archivo de registro creado en:${colors.reset} ${fullOutputPath}`);
  } catch (error) {
    console.error(`${colors.red}Error al crear el archivo de salida:${colors.reset}`, error.message);
    process.exit(1);
  }

  // Initialize histories
  const historyA = [
    { role: 'system', content: agentA.systemPrompt }
  ];

  const historyB = [
    { role: 'system', content: agentB.systemPrompt }
  ];

  console.log(`\n${colors.bright}\x1b[32m=== COMENZANDO LA INTERACCIÓN ===${colors.reset}`);
  if (maxTurns === 0) {
    console.log(`${colors.yellow}Presiona Ctrl+C en cualquier momento para detener el debate y generar el reporte de síntesis.${colors.reset}\n`);
  } else {
    console.log(`${colors.yellow}El debate durará ${maxTurns} turnos (o presiona Ctrl+C para finalizar antes y generar síntesis).${colors.reset}\n`);
  }

  let conversationActive = true;
  let rl = null;
  
  if (cliArgs.interactive) {
    rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  // Handle SIGINT cleanly
  const handleSigInt = async () => {
    if (!conversationActive) {
      process.exit(0);
    }
    console.log(`\n\n${colors.yellow}${colors.bright}⚠ Interrupción detectada (Ctrl+C). Finalizando la charla de forma segura y generando reporte de síntesis...${colors.reset}`);
    conversationActive = false;
    if (rl) {
      try { rl.close(); } catch (e) {}
    }
  };

  process.on('SIGINT', handleSigInt);

  let lastResponse = "";
  let userIntervention = "";
  let turn = 1;
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  while (conversationActive) {
    // If turns are limited, break when reached
    if (maxTurns > 0 && turn > maxTurns) {
      console.log(`\n\x1b[32mSe completaron los ${maxTurns} turnos de conversación programados.${colors.reset}`);
      break;
    }

    const turnLabel = maxTurns > 0 ? `Turno ${turn} / ${maxTurns}` : `Turno ${turn} (Continuo)`;
    console.log(`${colors.bright}${colors.yellow}--- ${turnLabel} ---${colors.reset}`);

    // --- INTERACTIVE OPTION: BEFORE AGENT A ---
    if (cliArgs.interactive && rl && conversationActive) {
      try {
        const userInput = await rl.question(`${colors.yellow}Presiona Enter para la respuesta de ${agentA.name}, escribe tu intervención para guiarla, o escribe 'salir': ${colors.reset}`);
        if (userInput.toLowerCase().trim() === 'salir') {
          console.log(`\n${colors.yellow}Finalizando debate por petición del usuario...${colors.reset}`);
          break;
        } else if (userInput.trim() !== '') {
          userIntervention = userInput.trim();
          console.log(`\x1b[32mIntervención registrada: "${userIntervention}"${colors.reset}`);
        }
      } catch (err) {
        break;
      }
    }

    if (!conversationActive) break;

    // --- AGENTE A ---
    console.log(`${colors.cyan}[Generando respuesta de ${agentA.name}... (Ollama)]${colors.reset}`);
    
    let promptA;
    if (turn === 1) {
      promptA = `Comencemos nuestra discusión de investigación sobre el tema: "${topic}". Introduce tu primera propuesta, tesis o pregunta para iniciar la interacción.`;
    } else {
      promptA = `${agentB.name} respondió:\n\n"${lastResponse}"\n\nAnaliza su postura, responde con base en tu perfil y continúa aportando valor y conocimiento nuevo al debate.`;
    }

    if (userIntervention) {
      promptA = `El usuario/moderador ha intervenido con la siguiente directiva o pregunta:\n\n"${userIntervention}"\n\nTeniendo esto en cuenta y la respuesta previa de ${agentB.name}, responde y avanza el debate.`;
      userIntervention = ""; // Reset
    }

    historyA.push({ role: 'user', content: promptA });

    try {
      const responseA = await callOllamaChat(ollamaUrl, model, historyA, temperature);
      lastResponse = responseA;
      historyA.push({ role: 'assistant', content: responseA });

      console.log(`\n${colors.cyan}${colors.bright}${agentA.name}:${colors.reset}`);
      console.log(`${colors.cyan}${responseA}${colors.reset}\n`);

      const turnMarkdownA = `### Turno ${turn} - ${agentA.name}\n\n${responseA}\n\n---\n\n`;
      await fs.appendFile(fullOutputPath, turnMarkdownA, 'utf8');
    } catch (error) {
      console.error(`\n${colors.red}Error al obtener respuesta de ${agentA.name}:${colors.reset}`, error.message);
      break;
    }

    if (!conversationActive) break;

    // Optional delay between agents
    if (!cliArgs.interactive && delayMs > 0) {
      await sleep(delayMs);
    }

    // --- INTERACTIVE OPTION: BEFORE AGENT B ---
    if (cliArgs.interactive && rl && conversationActive) {
      try {
        const userInput = await rl.question(`${colors.yellow}Presiona Enter para la respuesta de ${agentB.name}, escribe tu intervención para guiarla, o escribe 'salir': ${colors.reset}`);
        if (userInput.toLowerCase().trim() === 'salir') {
          console.log(`\n${colors.yellow}Finalizando debate por petición del usuario...${colors.reset}`);
          break;
        } else if (userInput.trim() !== '') {
          userIntervention = userInput.trim();
          console.log(`\x1b[32mIntervención registrada: "${userIntervention}"${colors.reset}`);
        }
      } catch (err) {
        break;
      }
    }

    if (!conversationActive) break;

    // --- AGENTE B ---
    console.log(`${colors.magenta}[Generando respuesta de ${agentB.name}... (Ollama)]${colors.reset}`);
    
    let promptB;
    if (turn === 1) {
      promptB = `Aquí está la propuesta inicial de ${agentA.name} sobre el tema "${topic}":\n\n"${lastResponse}"\n\nAnaliza esta propuesta, evalúa sus implicaciones prácticas, complementa con tus conocimientos y finaliza con una nueva perspectiva o pregunta para continuar el debate.`;
    } else {
      promptB = `${agentA.name} respondió:\n\n"${lastResponse}"\n\nAnaliza su postura, responde con base en tu perfil y continúa aportando valor y conocimiento nuevo al debate.`;
    }

    if (userIntervention) {
      promptB = `El usuario/moderador ha intervenido con la siguiente directiva o pregunta:\n\n"${userIntervention}"\n\nTeniendo esto en cuenta y la respuesta previa de ${agentA.name}, responde y avanza el debate.`;
      userIntervention = ""; // Reset
    }

    historyB.push({ role: 'user', content: promptB });

    try {
      const responseB = await callOllamaChat(ollamaUrl, model, historyB, temperature);
      lastResponse = responseB;
      historyB.push({ role: 'assistant', content: responseB });

      console.log(`\n${colors.magenta}${colors.bright}${agentB.name}:${colors.reset}`);
      console.log(`${colors.magenta}${responseB}${colors.reset}\n`);

      const turnMarkdownB = `### Turno ${turn} - ${agentB.name}\n\n${responseB}\n\n---\n\n`;
      await fs.appendFile(fullOutputPath, turnMarkdownB, 'utf8');
    } catch (error) {
      console.error(`\n${colors.red}Error al obtener respuesta de ${agentB.name}:${colors.reset}`, error.message);
      break;
    }

    if (!conversationActive) break;

    // Optional delay after turn
    if (!cliArgs.interactive && delayMs > 0) {
      await sleep(delayMs);
    }

    turn++;
  }

  // Deactivate custom SIGINT handler so next Ctrl+C kills instantly
  process.removeListener('SIGINT', handleSigInt);
  conversationActive = false;
  if (rl) {
    try { rl.close(); } catch (e) {}
  }

  // Check if we have at least one message before doing synthesis
  const hasHistory = historyA.length > 1 || historyB.length > 1;

  if (hasHistory) {
    console.log(`\n${colors.bright}\x1b[32m=== GENERANDO SÍNTESIS DE CONOCIMIENTO ===${colors.reset}`);
    console.log(`${colors.dim}Compilando las conclusiones de los agentes sobre "${topic}"...${colors.reset}`);

    // Compile clean log of the conversation
    const conversationLog = [];
    const maxLen = Math.max(historyA.length, historyB.length);
    
    // Interleave messages in order of turns
    for (let i = 1; i < maxLen; i++) {
      if (historyA[i] && historyA[i].role === 'assistant') {
        conversationLog.push(`**[${agentA.name}]**: ${historyA[i].content}`);
      }
      if (historyB[i] && historyB[i].role === 'assistant') {
        conversationLog.push(`**[${agentB.name}]**: ${historyB[i].content}`);
      }
    }

    const synthesisPrompt = [
      {
        role: 'system',
        content: 'Eres un redactor académico y sintetizador de conocimiento. Tu tarea es analizar la interacción completa entre dos expertos y generar una síntesis organizada y valiosa del conocimiento construido durante su debate.'
      },
      {
        role: 'user',
        content: `A continuación se muestra el debate entre ${agentA.name} y ${agentB.name} sobre la temática: "${topic}".

--- HISTORIAL DE INTERACCIÓN ---
${conversationLog.join('\n\n')}
--------------------------------

Genera un informe final de síntesis estructurado en español que contenga:
1. **Resumen Ejecutivo**: Una visión de alto nivel del debate y su importancia.
2. **Puntos Clave Discutidos**: Desglose técnico y de seguridad de las propuestas.
3. **Consensos y Áreas de Tensión**: En qué puntos coincidieron los agentes y cuáles quedan abiertos como debates o desafíos complejos.
4. **Conclusiones y Recomendaciones**: Medidas de ciberdefensa, mitigación o investigación que se deducen de este intercambio para generar valor práctico.`
      }
    ];

    try {
      const synthesisResult = await callOllamaChat(ollamaUrl, model, synthesisPrompt, 0.4);

      console.log(`\n\x1b[32m${colors.bright}Síntesis de Conocimiento Generado:${colors.reset}`);
      console.log(`${colors.white}${synthesisResult}${colors.reset}\n`);

      // Write synthesis to file
      const synthesisMarkdown = `## Síntesis de Conocimiento Generado

${synthesisResult}

---
*Fin del registro generado automáticamente por IAMASAI.*
`;
      await fs.appendFile(fullOutputPath, synthesisMarkdown, 'utf8');
      console.log(`\x1b[32m✔ Síntesis añadida con éxito al archivo de salida.${colors.reset}`);
    } catch (error) {
      console.error(`${colors.red}Error al generar la síntesis final:${colors.reset}`, error.message);
    }
  } else {
    console.log(`\n${colors.yellow}No se completaron turnos suficientes para generar una síntesis.${colors.reset}`);
  }

  console.log(`\n${colors.bright}${colors.cyan}=== INTERACCIÓN FINALIZADA ===${colors.reset}`);
  console.log(`${colors.dim}El registro completo se encuentra guardado en:${colors.reset} ${fullOutputPath}\n`);
}

main().catch(error => {
  console.error(`${colors.red}Ha ocurrido un error inesperado:${colors.reset}`, error);
});
