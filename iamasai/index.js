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
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

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
  
  // Prevenir desbordamiento de contexto (Ollama token limit crash)
  // Mantenemos el primer mensaje (system) y los últimos 10 turnos.
  let trimmedMessages = messages;
  if (messages.length > 11) {
    trimmedMessages = [
      messages[0],
      ...messages.slice(-10)
    ];
  }
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        messages: trimmedMessages,
        options: {
          temperature: temperature,
          num_ctx: 16384 // Ampliamos la ventana de contexto
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

// Function to process agent actions (Tool Calling)
async function processAgentActions(agentName, text) {
  let executedSomething = false;
  let actionResults = `Resultados del entorno para ${agentName}:\n`;

  // Parse <write_file path="...">...</write_file>
  const writeRegex = /<write_file\s+path="([^"]+)">([\s\S]*?)<\/write_file>/g;
  let match;
  while ((match = writeRegex.exec(text)) !== null) {
    // Restringir al directorio de iamasai
    const baseDir = __dirname;
    const resolvedPath = path.resolve(baseDir, match[1]);
    
    if (!resolvedPath.startsWith(baseDir)) {
      actionResults += `[write_file] Error de seguridad: No puedes escribir fuera del directorio iamasai (${match[1]})\n`;
      executedSomething = true;
      continue;
    }

    const content = match[2];
    try {
      await fs.writeFile(resolvedPath, content, 'utf8');
      console.log(`${colors.green}✔ ${agentName} creó/escribió el archivo: ${resolvedPath}${colors.reset}`);
      actionResults += `[write_file] Éxito al escribir ${path.basename(resolvedPath)}\n`;
      executedSomething = true;
    } catch (err) {
      console.error(`${colors.red}✘ Error al escribir ${resolvedPath}:${colors.reset}`, err.message);
      actionResults += `[write_file] Error al escribir ${path.basename(resolvedPath)}: ${err.message}\n`;
      executedSomething = true;
    }
  }

  // Parse <execute_command>...</execute_command>
  const execRegex = /<execute_command>([\s\S]*?)<\/execute_command>/g;
  while ((match = execRegex.exec(text)) !== null) {
    const command = match[1].trim();
    console.log(`${colors.yellow}► Ejecutando comando de ${agentName}: ${command}${colors.reset}`);
    try {
      const { stdout, stderr } = await execAsync(command, { timeout: 30000, cwd: __dirname });
      console.log(`${colors.dim}${stdout}${colors.reset}`);
      if (stderr) console.error(`${colors.red}${stderr}${colors.reset}`);
      
      actionResults += `[execute_command] Comando: ${command}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}\n`;
      executedSomething = true;
    } catch (err) {
      console.error(`${colors.red}✘ Fallo la ejecución:${colors.reset} ${err.message}`);
      actionResults += `[execute_command] Error ejecutando '${command}': ${err.message}\nSTDOUT:\n${err.stdout || ''}\nSTDERR:\n${err.stderr || ''}\n`;
      executedSomething = true;
    }
  }

  return { executedSomething, actionResults };
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
  const topic = cliArgs.topic || config.topic;
  const maxTurns = cliArgs.turns !== undefined ? cliArgs.turns : (config.maxTurns !== undefined ? config.maxTurns : 0);
  const outputFile = cliArgs.output || config.outputFile || 'historial_interaccion.md';
  const temperature = config.temperature !== undefined ? config.temperature : 0.7;
  const delayMs = cliArgs.delay !== undefined ? cliArgs.delay : (config.delay !== undefined ? config.delay : 1500);

  const agentA = config.agentA;
  const agentB = config.agentB;

  console.log(`\n${colors.bright}Parámetros de la simulación:${colors.reset}`);
  console.log(`  ${colors.bright}Modelo Agente A:${colors.reset} ${colors.green}✔ ${agentA.model}${colors.reset} (${agentA.ollamaUrl})`);
  console.log(`  ${colors.bright}Modelo Agente B:${colors.reset} ${colors.green}✔ ${agentB.model}${colors.reset} (${agentB.ollamaUrl})`);
  console.log(`  ${colors.bright}Turnos:${colors.reset} ${maxTurns === 0 ? colors.cyan + 'Continuo (Infinito)' : maxTurns}`);
  console.log(`  ${colors.bright}Archivo de salida:${colors.reset} ${outputFile}`);
  console.log(`  ${colors.bright}Modo interactivo:${colors.reset} ${cliArgs.interactive ? '\x1b[32mActivado\x1b[0m' : colors.dim + 'Desactivado'}`);
  console.log(`  ${colors.bright}Temática:${colors.reset} "${colors.yellow}${topic}${colors.reset}"`);

  // Verify Ollama connection and check if the model is loaded
  console.log(`\n${colors.cyan}Verificando conexiones con Ollama...${colors.reset}`);
  
  async function verifyAgentEndpoint(agentKey, agentConfig) {
    const status = await checkOllama(agentConfig.ollamaUrl, agentConfig.model);
    if (!status.online) {
      console.error(`${colors.red}${colors.bright}¡ERROR DE CONEXIÓN (${agentKey})!${colors.reset}`);
      console.error(`${colors.red}No se pudo conectar con Ollama en ${agentConfig.ollamaUrl}.${colors.reset}`);
      process.exit(1);
    }
    console.log(`\x1b[32m✔ Conexión establecida con Ollama para ${agentKey} (${agentConfig.ollamaUrl}).${colors.reset}`);
    
    if (!status.exists) {
      console.log(`${colors.yellow}⚠ ADVERTENCIA: El modelo '${agentConfig.model}' no se encuentra en ${agentConfig.ollamaUrl}.${colors.reset}`);
    } else {
      console.log(`\x1b[32m✔ El modelo '${agentConfig.model}' está listo en ${agentConfig.ollamaUrl}.${colors.reset}`);
    }
  }

  await verifyAgentEndpoint('Agente A', agentA);
  await verifyAgentEndpoint('Agente B', agentB);

  console.log(`\n${colors.cyan}${colors.bright}Configuración de Agentes:${colors.reset}`);
  console.log(`  ${colors.bgBlue}${colors.white} Agente A: ${agentA.name} ${colors.reset}`);
  console.log(`    ${colors.dim}System Prompt: ${agentA.systemPrompt}${colors.reset}`);
  console.log(`  ${colors.bgMagenta}${colors.white} Agente B: ${agentB.name} ${colors.reset}`);
  console.log(`    ${colors.dim}System Prompt: ${agentB.systemPrompt}${colors.reset}\n`);

  // Initialize output file
  const fullOutputPath = path.resolve(__dirname, outputFile);
  const headerMarkdown = `# Registro de Interacción: ${agentA.name} ⬌ ${agentB.name}
**Fecha:** ${new Date().toLocaleString()}
**Modelos:** ${agentA.name} (\`${agentA.model}\`) vs ${agentB.name} (\`${agentB.model}\`)
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
    let agentA_acting = true;
    let loopCountA = 0;
    while (agentA_acting && loopCountA < 3 && conversationActive) {
      loopCountA++;
      console.log(`${colors.cyan}[Generando respuesta de ${agentA.name}... (Ollama)]${colors.reset}`);
      
      if (loopCountA === 1) {
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
      }

      try {
        const responseA = await callOllamaChat(agentA.ollamaUrl, agentA.model, historyA, temperature);
        lastResponse = responseA;
        historyA.push({ role: 'assistant', content: responseA });

        console.log(`\n${colors.cyan}${colors.bright}${agentA.name}:${colors.reset}`);
        console.log(`${colors.cyan}${responseA}${colors.reset}\n`);

        const turnMarkdownA = `### Turno ${turn}.${loopCountA} - ${agentA.name}\n\n${responseA}\n\n---\n\n`;
        await fs.appendFile(fullOutputPath, turnMarkdownA, 'utf8');

        // Check for tools execution
        const { executedSomething, actionResults } = await processAgentActions(agentA.name, responseA);
        if (executedSomething) {
          historyA.push({ role: 'user', content: `(Sistema de Ejecución):\n${actionResults}\nAnaliza los resultados. Si hay errores, corrígelos usando las herramientas de nuevo. Si fue exitoso, continúa tu argumento final o pasa el turno.` });
          console.log(`${colors.dim}>> Retroalimentación enviada al ${agentA.name}... iterando (Intento ${loopCountA}/3)${colors.reset}`);
        } else {
          agentA_acting = false; // finished acting
        }
      } catch (error) {
        console.error(`\n${colors.red}Error al obtener respuesta de ${agentA.name}:${colors.reset}`, error.message);
        conversationActive = false;
        break;
      }
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
    let agentB_acting = true;
    let loopCountB = 0;
    while (agentB_acting && loopCountB < 3 && conversationActive) {
      loopCountB++;
      console.log(`${colors.magenta}[Generando respuesta de ${agentB.name}... (Ollama)]${colors.reset}`);
      
      if (loopCountB === 1) {
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
      }

      try {
        const responseB = await callOllamaChat(agentB.ollamaUrl, agentB.model, historyB, temperature);
        lastResponse = responseB;
        historyB.push({ role: 'assistant', content: responseB });

        console.log(`\n${colors.magenta}${colors.bright}${agentB.name}:${colors.reset}`);
        console.log(`${colors.magenta}${responseB}${colors.reset}\n`);

        const turnMarkdownB = `### Turno ${turn}.${loopCountB} - ${agentB.name}\n\n${responseB}\n\n---\n\n`;
        await fs.appendFile(fullOutputPath, turnMarkdownB, 'utf8');

        // Check for tools execution
        const { executedSomething, actionResults } = await processAgentActions(agentB.name, responseB);
        if (executedSomething) {
          historyB.push({ role: 'user', content: `(Sistema de Ejecución):\n${actionResults}\nAnaliza los resultados. Si hay errores, corrígelos usando las herramientas de nuevo. Si fue exitoso, continúa tu argumento final o pasa el turno.` });
          console.log(`${colors.dim}>> Retroalimentación enviada al ${agentB.name}... iterando (Intento ${loopCountB}/3)${colors.reset}`);
        } else {
          agentB_acting = false; // finished acting
        }
      } catch (error) {
        console.error(`\n${colors.red}Error al obtener respuesta de ${agentB.name}:${colors.reset}`, error.message);
        conversationActive = false;
        break;
      }
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
      const synthesisResult = await callOllamaChat(agentA.ollamaUrl, agentA.model, synthesisPrompt, 0.4);

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
