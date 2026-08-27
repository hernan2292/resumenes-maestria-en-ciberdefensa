# Carpeta Borrador: Trabajo Final de Maestría en Ciberdefensa y Ciberseguridad

Esta carpeta contiene el **borrador escrito completo** del Trabajo Final de Maestría (TFM) y la **implementación práctica ejecutable** del prototipo defensivo basado en Blockchain y Aislamiento Dinámico.

## Contenido de la Carpeta

1. 📄 **`borrador_tesis_maestria_ciberdefensa.md`**:  
   Documento completo del Trabajo Final de Maestría estructurado académicamente (Resumen, Abstract, Capítulos 1 al 6 y Bibliografía).

2. 📋 **`implementation_plan.md`**:  
   Plan de implementación y hoja de ruta metodológica de la tesis y del prototipo práctico.

3. ⛓️ **`SecurityPolicyRegistry.sol`**:  
   Contrato Inteligente en Solidity (v0.8.20) para el **Plano de Control Descentralizado**, responsable del registro de nodos, inmutabilidad de reglas de seguridad y emisión de alertas de aislamiento proactivo.

4. 🐍 **`firewall_agent.py`**:  
   Agente defensivo local en Python (Plano de Datos) que escucha la Blockchain y aplica reglas de aislamiento en el kernel/firewall del sistema operativo (`iptables`/`netsh`).

5. ⚡ **`simulate_attack_and_defense.js`**:  
   Script ejecutable en Node.js que simula la detección de una intrusión en un nodo SCADA, emite la transacción a la Blockchain y verifica el aislamiento proactivo.

6. ⚡ **`simulate_attack_and_defense.py`**:  
   Versión en Python del script de simulación de ataque y aislamiento.

---

## Cómo Ejecutar la Simulación Práctica

### Opción 1: Simulación con Node.js (Sin dependencias externas)
```bash
node simulate_attack_and_defense.js
```

### Opción 2: Ejecución del Agente en Python
```bash
python firewall_agent.py
```
*(Nota: Si no hay una red Blockchain local activa como Anvil o Ganache, el agente ejecutará el modo de demostración defensiva automática).*
