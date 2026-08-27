/**
 * Simulación de Ciberdefensa Proactiva Basada en Blockchain
 * Ejecución directa vía Node.js
 */

function runSimulation() {
    console.log("=" .repeat(75));
    console.log("  SISTEMA DE CIBERDEFENSA PROACTIVO DESCENTRALIZADO BASADO EN BLOCKCHAIN  ");
    console.log("=" .repeat(75));
    
    console.log("\n[1] FASE DE INICIALIZACIÓN Y ATESTACIÓN DE NODOS:");
    console.log("    - Sonda Sensor / Nodo Crítico: ID 'NODE_SCADA_SUBSTATION_01'");
    printDelay("    - Atestación Remota TEE (Intel SGX / TeeMAF): INTEGRIDAD VERIFICADA [✓]", 500);
    printDelay("    - Estado en Smart Contract: REGISTRADO Y AUTORIZADO [NodeStatus.Active]", 1000);

    setTimeout(() => {
        console.log("\n[2] DETECCIÓN DE EVENTO DE AMENAZA (PLANO DE DATOS):");
        console.log("    [!] ANOMALÍA CRÍTICA DETECTADA en tráfico de entrada de 192.168.1.150");
        console.log("    [!] Categoría STRIDE: Tampering / Intentos de inyección en subestación de energía");
        
        setTimeout(() => {
            console.log("\n[3] TRANSMISIÓN AL PLANO DE CONTROL DESCENTRALIZADO (ON-CHAIN):");
            console.log("    - Invocación de Smart Contract: triggerProactiveIsolation(nodeId, '192.168.1.150', 'Intrusión SCADA')");
            console.log("    - Hash de Transacción: 0x8f2a1b4c9e7d3f6a5b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a");
            console.log("    - Consenso de Red: MINADO Y CONFIRMADO EN BLOQUE #104928");

            setTimeout(() => {
                console.log("\n[4] APLICACIÓN DE AISLAMIENTO PROACTIVO EN CORTAFUEGOS LOCALES:");
                console.log("    - Evento broadcast 'ProactiveIsolationTriggered' capturado por Agentes Defensivos.");
                console.log("    - Comando ejecutado en kernel local: sudo iptables -A INPUT -s 192.168.1.150 -j DROP");
                console.log("\n[✓] SIMULACIÓN COMPLETADA: Aislamiento defensivo ejecutado en < 150 ms sin punto único de falla.");
                console.log("=" .repeat(75));
            }, 1000);
        }, 1000);
    }, 1000);
}

function printDelay(msg, delay) {
    setTimeout(() => console.log(msg), delay);
}

runSimulation();
