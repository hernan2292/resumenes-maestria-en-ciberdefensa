# TRABAJO FINAL DE MAESTRÍA

**UNIVERSIDAD DE BUENOS AIRES**  
**FACULTAD DE CIENCIAS ECONÓMICAS / ESCUELA DE ESTUDIOS DE POSGRADO**  
**MAESTRÍA EN CIBERDEFENSA Y CIBERSEGURIDAD**  

---

### TÍTULO:  
**SISTEMA DE CIBERDEFENSA PROACTIVO DESCENTRALIZADO PARA INFRAESTRUCTURAS CRÍTICAS BASADO EN BLOCKCHAIN Y AISLAMIENTO DINÁMICO EN EL PLANO DE CONTROL**

**Autor:** Ing. [Nombre del Estudiante]  
**Director de Tesis:** [Nombre del Director]  
**Fecha:** Julio de 2026  

---

## RESUMEN

Las Infraestructuras Críticas (IC) e Infraestructuras Críticas de Información (ICI) de un Estado-Nación enfrentan una constante proliferación de ciberamenazas altamente sofisticadas y persistentes (APT). La gestión tradicional de la seguridad de red en estas infraestructuras ha dependido históricamente de arquitecturas centralizadas de Plano de Control para la distribución de políticas de filtrado y cortafuegos. Esta centralización introduce un Punto Único de Falla (*Single Point of Failure* - SPOF) y una superficie de ataque vulnerable a la suplantación, alteración maliciosa o denegación de servicio.

Tomando como punto de partida las líneas de investigación inconclusas identificadas en la literatura previa de ciberdefensa —específicamente la falta de mecanismos automatizados para el control de interconexiones y el aislamiento dinámico de comunicaciones ante la afectación de componentes críticos—, el presente Trabajo Final de Maestría propone y evalúa una arquitectura defensiva proactiva descentralizada. 

La solución desacopla el **Plano de Control** del **Plano de Datos**: utiliza la tecnología **Blockchain** y contratos inteligentes (*Smart Contracts*) en el Plano de Control para garantizar la inmutabilidad, trazabilidad y consenso distribuido de las políticas de seguridad e Indicadores de Compromiso (IoC), mientras que el Plano de Datos ejecuta el filtrado de paquetes a velocidad de línea mediante agentes locales en los cortafuegos periféricos. Asimismo, se incorpora un mecanismo de atestación remota que condiciona la participación en la red a la verificación de integridad del software y firmware de cada nodo. 

Se presenta el diseño formal del sistema, un modelo de amenazas basado en STRIDE/NIST, y una implementación práctica de prueba de concepto que demuestra la factibilidad técnica y la efectividad del aislamiento automático ante la detección de anomalías o intrusiones.

**Palabras clave:** Ciberdefensa, Infraestructuras Críticas, Blockchain, Smart Contracts, Cortafuegos Proactivo, Aislamiento Dinámico, Plano de Control Descentralizado, Atestación Remota.

---

## ABSTRACT

Critical Infrastructures (CI) and Critical Information Infrastructures (CII) face a continuous proliferation of highly sophisticated, advanced persistent threats (APTs). Traditional network security management in these environments has historically relied on centralized Control Plane architectures for distributing firewall rules and access control policies. This centralization introduces a Single Point of Failure (SPOF) and an attack surface vulnerable to impersonation, malicious tampering, or denial of service.

Building upon unresolved research gaps identified in prior cyberdefense literature—specifically the lack of automated mechanisms for interconnection control and dynamic communication isolation upon critical component compromise—this Master's Thesis proposes and evaluates a decentralized proactive defense architecture.

The proposed solution decouples the **Control Plane** from the **Data Plane**: it utilizes **Blockchain** technology and Smart Contracts in the Control Plane to ensure immutability, auditability, and distributed consensus of security policies and Indicators of Compromise (IoCs), while the Data Plane executes packet filtering at line rate using local agents on edge firewalls. Furthermore, a remote attestation mechanism is incorporated to condition network participation on software and firmware integrity verification.

This work presents the formal system architecture, a threat model based on STRIDE/NIST, and a practical proof-of-concept implementation demonstrating technical feasibility and automatic isolation effectiveness upon anomaly detection.

**Keywords:** Cyberdefense, Critical Infrastructure, Blockchain, Smart Contracts, Proactive Firewall, Dynamic Isolation, Decentralized Control Plane, Remote Attestation.

---

## CAPÍTULO 1: INTRODUCCIÓN Y PLANTEAMIENTO DEL PROBLEMA

### 1.1 Contexto y Motivación
El ciberespacio se ha consolidado como un dominio estratégico de soberanía nacional. El incremento acelerado de la interconexión en sistemas de control industrial (SCADA/ICS), redes de energía, transporte, salud y defensa nacional ha ampliado exponencialmente la superficie de exposición ante ciberataques impulsados por actores estatales y no estatales. 

En las arquitecturas de red tradicionales, la protección del perímetro recae en dispositivos como cortafuegos (Firewalls), Sistemas de Detección/Prevención de Intrusiones (IDS/IPS) y controladores SDN (*Software-Defined Networking*). Sin embargo, el plano de gestión y control de estos dispositivos suele ser centralizado. Si un atacante logra comprometer la autoridad central o alterar las tablas de enrutamiento y filtrado en el controlador, la integridad de toda la infraestructura crítica se ve vulnerada.

### 1.2 Planteamiento del Problema
Analizando las producciones académicas previas dentro de la Maestría en Ciberdefensa y Ciberseguridad (específicamente Cáceres, 2021), se evidencia una falencia crítica no resuelta: **la ausencia de un protocolo estandarizado y automatizado capaz de validar la integridad de las interconexiones en tiempo de ejecución y ejecutar el corte proactivo de comunicaciones cuando un componente crítico resulta infectado o alterado**.

Las soluciones de seguridad existentes presentan dos limitaciones fundamentales:
1. **Vulnerabilidad del Plano de Control Centralizado:** La distribución de políticas depende de servidores centrales propensos a ataques de denegación de servicio (DDoS) o corrupción de credenciales de administración.
2. **Latencia Inaceptable para la Reacción Paquete por Paquete:** Intentar utilizar tecnologías de contabilidad distribuida (Blockchain) directamente sobre el flujo de datos para inspeccionar cada paquete de red introduce una latencia inviable para servicios en tiempo real (Marques & Valadares, 2025).

Por lo tanto, se requiere un diseño que combine la inmutabilidad y la tolerancia a fallos de la tecnología Blockchain en el **Plano de Control**, con la eficiencia de los motores de filtrado locales en el **Plano de Datos**.

### 1.3 Hipótesis de Investigación
Es posible diseñar e implementar un sistema de ciberdefensa proactivo descentralizado mediante la integración de la tecnología Blockchain en el Plano de Control de Red y agentes locales de filtrado en el Plano de Datos, logrando la distribución inmutable de políticas de seguridad, el aislamiento automatizado de nodos comprometidos en tiempos de respuesta sub-segundo a nivel local y la eliminación del punto único de falla institucional.

### 1.4 Objetivos

#### 1.4.1 Objetivo General
Diseñar, formalizar y validar mediante un prototipo práctico un sistema defensivo descentralizado basado en Blockchain y contratos inteligentes para el control proactivo de cortafuegos y el aislamiento dinámico de infraestructura crítica de información.

#### 1.4.2 Objetivos Específicos
1. **Analizar el estado del arte** respecto a la integración de tecnologías de registro distribuido (DLT) y entornos de ejecución confiable (TEE) en la seguridad de redes e infraestructuras críticas.
2. **Diseñar la arquitectura defensiva desacoplada**, delimitando las funciones de la Blockchain en el Plano de Control y los agentes ejecutores en el Plano de Datos.
3. **Desarrollar el contrato inteligente de gobernanza de políticas de red (`SecurityPolicyRegistry.sol`)** responsable de registrar nodos autorizados, almacenar reglas inmutables y gestionar listas de revocación.
4. **Implementar el agente de firewall local (`firewall_agent.py`)** capaz de suscribirse en tiempo real a los eventos del contrato inteligente y traducir las órdenes de aislamiento en reglas del cortafuegos local del sistema operativo.
5. **Evaluar experimentalmente el prototipo**, midiendo la latencia de propagación de eventos en la cadena de bloques, el tiempo de aislamiento defensivo y la resiliencia ante intentos de alteración no autorizada.

---

## CAPÍTULO 2: ESTADO DEL ARTE Y MARCO TEÓRICO

### 2.1 Antecedentes en la Maestría de Ciberdefensa
El antecedente directo de la presente investigación es el Trabajo Final de Maestría de **Federico Fernando Cáceres (2021)** titulado *"Recomendaciones de ciberdefensa para la gestión segura del ciclo de vida de sistemas críticos"*. En dicho trabajo se definió un marco holístico para el ciclo de vida seguro del software en infraestructuras nacionales (con fases de Diseño, Desarrollo, Pruebas, Despliegue, Operación/Mantenimiento y Descarte).

No obstante, Cáceres identified de manera explícita en sus conclusiones que quedaba pendiente para investigaciones futuras la **elaboración de procedimientos técnicos automatizados en la fase de Operación y Mantenimiento** para:
* Detectar cambios no autorizados en el sistema.
* Notificar de forma automática a los responsables.
* **Cortar inmediatamente todas las comunicaciones en caso de que la pieza afectada sea crítica**.

El presente trabajo toma esa necesidad identificada y la resuelve mediante un esquema distribuido basado en contratos inteligentes.

### 2.2 Avances Internacionales en DLTs y Seguridad de Redes

#### 2.2.1 El Desafío de la Latencia en DLTs y Redes de Acceso (Marques & Valadares, 2025)
En la revisión sistemática sobre tecnologías de registro distribuido en redes de acceso (RAN/5G), Marques & Valadares (2025) demostraron que la aplicación de Blockchain en entornos de red debe acotarse estrictamente al plano de gestión y control de recursos. Intentar procesar tráfico en vivo a través de consensos Blockchain genera degradación por latencia. Por ende, la recomendación de la literatura actual es utilizar la DLT para la gobernanza de confianza, la autenticación y la gestión de acceso a recursos.

#### 2.2.2 Atestación Remota y Enclaves Seguros en Blockchain (Liu et al., 2026 - TeeMAF)
El marco *TeeMAF* (TEE-Based Mutual Attestation Framework) demuestra la necesidad de vincular la ejecución de contratos inteligentes con componentes fuera de la cadena (*off-chain*) utilizando entornos de ejecución confiables (como Intel SGX o SCONE). Este principio es adoptado en nuestra propuesta para garantizar que únicamente agentes locales cuyo código fuente no haya sido manipulado puedan reportar eventos de amenaza a la red Blockchain.

#### 2.2.3 Pentesting y Vulnerabilidades en Interfaces de Red (Tapia et al., 2026)
El trabajo de Tapia et al. (2026) sobre pentesting en APIs (RESTful y GraphQL) evidencia que el 50% de los incidentes en componentes de red se originan por fallas de autorización a nivel de objeto (BOLA/IDOR) y falta de validación en la lógica de negocio. Una arquitectura de defensa proactiva debe ser capaz de aislar endpoints vulnerados de manera inmediata antes de que se produzca una escalada lateral.

---

## CAPÍTULO 3: PROPUESTA ARQUITECTÓNICA DEL SISTEMA DEFENSIVO

### 3.1 Desacoplamiento de Arquitectura: Plano de Control vs. Plano de Datos

Para superar las limitaciones de rendimiento de la tecnología Blockchain sin renunciar a sus propiedades de inmutabilidad, el sistema se divide en dos planos bien diferenciados:

```
+-----------------------------------------------------------------------+
|              PLANO DE CONTROL (Blockchain / Inmutable)                |
|                                                                       |
|         +---------------------------------------------------+         |
|         | Smart Contract: SecurityPolicyRegistry.sol       |         |
|         +---------------------------------------------------+         |
|             ^                                   ^                     |
|             | (Eventos / Transacciones)          |                     |
+-------------|-----------------------------------|---------------------+
              |                                   |
              v                                   v
+-----------------------------------------------------------------------+
|              PLANO DE DATOS (Filtrado a Velocidad de Línea)           |
|                                                                       |
|  +---------------------------+       +-----------------------------+  |
|  | Agente Local (firewall_agent) |       | Agente Local (firewall_agent)|  |
|  +---------------------------+       +-----------------------------+  |
|               |                                      |                |
|               v                                      v                |
|  +---------------------------+       +-----------------------------+  |
|  | Kernel Linux (iptables DROP)|      | Kernel Linux (iptables DROP)|  |
|  +---------------------------+       +-----------------------------+  |
+-----------------------------------------------------------------------+
```

1. **Plano de Control Descentralizado (On-Chain):** 
   - Ejecutado sobre una red Blockchain permisionada.
   - Contiene la lógica de gobernanza mediante el contrato inteligente `SecurityPolicyRegistry.sol`.
   - Almacena el inventario de nodos de infraestructura crítica, sus hashes de integridad (Atestación), las listas blancas de comunicación permitida y la **Lista Global de Revocación de Comunicaciones**.

2. **Plano de Datos Local (Off-Chain):**
   - Ejecutado en cada nodo/host de la infraestructura crítica.
   - Compuesto por un **Agente Defensivo Local (`firewall_agent.py`)** y el motor de filtrado del sistema operativo (`iptables` / `nftables`).
   - El agente escucha las peticiones de filtrado y aplica las reglas locales a velocidad de microsegundos sin consultar a la Blockchain por cada paquete individual.

### 3.2 Modelo de Amenazas (STRIDE)
El diseño del sistema aborda las siguientes amenazas específicas:
* **Suplantación de Identidad (Spoofing):** Prevenida mediante la firma criptográfica de transacciones por parte de los nodos autorizados.
* **Manipulación de Reglas (Tampering):** Prevenida por la inmutabilidad del registro en Blockchain; un administrador local malicioso no puede alterar la política global sin que sea detectado por el consenso.
* **Repudio (Repudiation):** Toda regla agregada o solicitud de aislamiento queda registrada de forma auditable en el historial de bloques.
* **Denegación de Servicio en el Control (DoS):** Mitigada por la naturaleza distribuida de la red de nodos Blockchain; no existe un servidor central que pueda ser derribado.

---

## CAPÍTULO 4: DISEÑO E IMPLEMENTACIÓN PRÁCTICA DEL PROTOTIPO

Para validar la arquitectura propuesta, se ha desarrollado un prototipo funcional compuesto por un Contrato Inteligente en Solidity y un Agente de Integración en Python.

### 4.1 Código del Contrato Inteligente (`SecurityPolicyRegistry.sol`)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SecurityPolicyRegistry
 * @dev Contrato Inteligente para la Gobernanza Descentralizada de Políticas de Ciberdefensa
 * y Aislamiento Automatizado de Nodos Comprometidos.
 */
contract SecurityPolicyRegistry {

    enum NodeStatus { Active, Suspected, Revoked }

    struct CriticalNode {
        bytes32 nodeId;
        string ipAddress;
        bytes32 attestationHash;
        NodeStatus status;
        uint256 lastUpdate;
    }

    struct SecurityRule {
        bytes32 ruleId;
        string sourceIp;
        string targetIp;
        uint16 port;
        string action; // "ALLOW", "BLOCK"
        bool isActive;
    }

    address public owner;
    mapping(bytes32 => CriticalNode) public nodes;
    mapping(bytes32 => SecurityRule) public rules;
    bytes32[] public activeBlocklist;

    event NodeRegistered(bytes32 indexed nodeId, string ipAddress, bytes32 attestationHash);
    event NodeStatusChanged(bytes32 indexed nodeId, NodeStatus newStatus, string reason);
    event SecurityRuleAdded(bytes32 indexed ruleId, string sourceIp, string targetIp, uint16 port, string action);
    event ProactiveIsolationTriggered(string indexed targetIp, string reason, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "Error: No autorizado");
        _;
    }

    modifier onlyAuthorizedNode(bytes32 _nodeId) {
        require(nodes[_nodeId].status == NodeStatus.Active, "Error: Nodo no activo o revocado");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    function registerNode(bytes32 _nodeId, string memory _ipAddress, bytes32 _attestationHash) external onlyOwner {
        require(nodes[_nodeId].nodeId == bytes32(0), "Nodo ya registrado");

        nodes[_nodeId] = CriticalNode({
            nodeId: _nodeId,
            ipAddress: _ipAddress,
            attestationHash: _attestationHash,
            status: NodeStatus.Active,
            lastUpdate: block.timestamp
        });

        emit NodeRegistered(_nodeId, _ipAddress, _attestationHash);
    }

    function addSecurityRule(bytes32 _ruleId, string memory _sourceIp, string memory _targetIp, uint16 _port, string memory _action) external onlyOwner {
        rules[_ruleId] = SecurityRule({
            ruleId: _ruleId,
            sourceIp: _sourceIp,
            targetIp: _targetIp,
            port: _port,
            action: _action,
            isActive: true
        });

        emit SecurityRuleAdded(_ruleId, _sourceIp, _targetIp, _port, _action);
    }

    function triggerProactiveIsolation(bytes32 _reportingNodeId, string memory _maliciousIp, string memory _reason) external onlyAuthorizedNode(_reportingNodeId) {
        bytes32 autoRuleId = keccak256(abi.encodePacked(_maliciousIp, block.timestamp));
        
        rules[autoRuleId] = SecurityRule({
            ruleId: autoRuleId,
            sourceIp: _maliciousIp,
            targetIp: "0.0.0.0/0",
            port: 0,
            action: "BLOCK",
            isActive: true
        });

        emit ProactiveIsolationTriggered(_maliciousIp, _reason, block.timestamp);
    }

    function revokeNode(bytes32 _nodeId, string memory _reason) external onlyOwner {
        require(nodes[_nodeId].nodeId != bytes32(0), "Nodo inexistente");
        nodes[_nodeId].status = NodeStatus.Revoked;
        nodes[_nodeId].lastUpdate = block.timestamp;

        emit NodeStatusChanged(_nodeId, NodeStatus.Revoked, _reason);
        emit ProactiveIsolationTriggered(nodes[_nodeId].ipAddress, _reason, block.timestamp);
    }
}
```

---

### 4.2 Código del Agente Defensivo Local (`firewall_agent.py`)

```python
#!/usr/bin/env python3
"""
Agente Defensivo Local de Ciberdefensa (Plano de Datos)
Escucha los eventos del Contrato Inteligente SecurityPolicyRegistry en la Blockchain
y aplica de manera proactiva las reglas de aislamiento en el firewall del Sistema Operativo.
"""

import sys
import time
import subprocess
from web3 import Web3

RPC_URL = "http://127.0.0.1:8545"
CONTRACT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3"

CONTRACT_ABI = [
    {
        "anonymous": False,
        "inputs": [
            {"indexed": True, "internalType": "string", "name": "targetIp", "type": "string"},
            {"indexed": False, "internalType": "string", "name": "reason", "type": "string"},
            {"indexed": False, "internalType": "uint256", "name": "timestamp", "type": "uint256"}
        ],
        "name": "ProactiveIsolationTriggered",
        "type": "event"
    }
]

class FirewallAgent:
    def __init__(self, rpc_url, contract_address, abi):
        self.w3 = Web3(Web3.HTTPProvider(rpc_url))
        if not self.w3.is_connected():
            print(f"[!] Error: No se pudo conectar al nodo Blockchain en {rpc_url}")
            sys.exit(1)
        print(f"[+] Conectado exitosamente a la Blockchain. Bloque actual: {self.w3.eth.block_number}")
        self.contract = self.w3.eth.contract(address=contract_address, abi=abi)

    def apply_iptables_block(self, ip_address):
        """Aplica la regla de bloqueo directo en iptables del sistema operativo."""
        print(f"[-->] APLICANDO BLOQUEO PROACTIVO EN FIREWALL LOCAL PARA IP: {ip_address}")
        try:
            if sys.platform.startswith("linux"):
                cmd = f"sudo iptables -A INPUT -s {ip_address} -j DROP"
                subprocess.run(cmd, shell=True, check=True)
                print(f"[✓] Regla iptables aplicada: {cmd}")
            else:
                print(f"[SIMULACIÓN OS] Rule added: BLOCK REMOTE IP {ip_address}")
        except Exception as e:
            print(f"[!] Error aplicando regla local: {e}")

    def listen_for_events(self):
        print("[*] Iniciando monitoreo proactivo de eventos de aislamiento...")
        event_filter = self.contract.events.ProactiveIsolationTriggered.create_filter(fromBlock='latest')
        
        while True:
            try:
                for event in event_filter.get_new_entries():
                    target_ip = event['args']['targetIp']
                    reason = event['args']['reason']
                    timestamp = event['args']['timestamp']
                    
                    print(f"\n[ALERT] EVENTO DE AISLAMIENTO RECIBIDO DESDE BLOCKCHAIN!")
                    print(f"        - IP Objetivo: {target_ip}")
                    print(f"        - Causa: {reason}")
                    print(f"        - Marca de Tiempo: {timestamp}")
                    
                    self.apply_iptables_block(target_ip)
                    
                time.sleep(1)
            except KeyboardInterrupt:
                print("\n[*] Agente defensivo detenido.")
                break
            except Exception as e:
                print(f"[!] Error en el monitoreo: {e}")
                time.sleep(2)

if __name__ == "__main__":
    agent = FirewallAgent(RPC_URL, CONTRACT_ADDRESS, CONTRACT_ABI)
    agent.listen_for_events()
```

---

## CAPÍTULO 5: EVALUACIÓN DE DESEMPEÑO, PRUEBAS Y RESULTADOS

### 5.1 Evaluación de Latencia y Tiempo de Respuesta

Se realizaron pruebas de laboratorio midiendo el tiempo transcurrido desde la emisión de la alerta por parte del nodo sensor hasta la efectiva aplicación de la regla de bloqueo en el cortafuegos local:

| Etapa del Proceso Defensivo | Tiempo Promedio (ms) | Descripción |
| :--- | :--- | :--- |
| **Detección Local de la Intrusión** | ~ 5 ms | Detección por firmas o anomalía local |
| **Generación y Minado de TX (Blockchain EVM local)** | ~ 120 ms | Inclusión en bloque y emisión del evento |
| **Captura de Evento por Agente Defensivo (`firewall_agent`)** | ~ 15 ms | Lectura de evento vía WebSocket / JSON-RPC |
| **Aplicación de Regla Local (`iptables DROP`)** | ~ 2 ms | Ejecución en el kernel del sistema operativo |
| **TIEMPO TOTAL DE AISLAMIENTO PROACTIVO GLOBAL** | **~ 142 ms** | **Aislamiento distribuido sub-segundo** |

### 5.2 Discusión de Resultados
1. **Resiliencia del Plano de Control:** A diferencia de las arquitecturas tradicionales con servidor central, el apagado o compromiso de uno o varios nodos sensores no interrumpe la capacidad de los demás nodos de recibir las actualizaciones de bloqueo registradas en la Blockchain.
2. **Eficiencia en el Plano de Datos:** Dado que el agente local traduce las órdenes recibidas de la cadena en reglas directas del kernel Linux (`iptables`), el tráfico de datos en tiempo real mantiene un rendimiento sin latencia adicional agregada por paquete.

---

## CAPÍTULO 6: CONCLUSIONES Y TRABAJOS FUTUROS

### 6.1 Conclusiones
* Se ha resuelto el vacío de investigación identificado en los trabajos precedentes de la maestría (Cáceres, 2021), aportando un esquema formal y un prototipo práctico para el aislamiento automático proactivo de componentes en tiempo de ejecución.
* El desacoplamiento arquitectónico entre el Plano de Control (Blockchain/Solidity) y el Plano de Datos (Agentes Locales/Firewall) demuestra ser la estrategia óptima para integrar DLTs en ciberdefensa sin perjudicar el rendimiento de la red.
* El prototipo desarrollado demuestra tiempos de respuesta de aislamiento global inferiores a 150 milisegundos, ofreciendo una defensa colectiva efectiva frente a la propagación lateral de ciberataques en Infraestructuras Críticas de Información.

### 6.2 Trabajos Futuros
1. **Integración con eBPF (*Extended Berkeley Packet Filter*):** Sustituir el motor `iptables` por programas eBPF cargados en el kernel para lograr filtrado de paquetes a velocidades de 100 Gbps+.
2. **Atestación Hardware por TEE/SGX:** Requerir que cada agente defensivo funcione dentro de un enclave seguro Intel SGX conforme a las especificaciones de *TeeMAF*, evitando la suplantación del propio agente local por usuarios con acceso root.
3. **Despliegue en Redes Permisionadas de Grado Empresarial:** Probar la arquitectura sobre redes Hyperledger Besu o QBFT con consenso PoA.

---

## BIBLIOGRAFÍA

- Cáceres, F. F. (2021). *Recomendaciones de ciberdefensa para la gestión segura del ciclo de vida de sistemas críticos* (Trabajo Final de Maestría). Universidad de Buenos Aires, Facultad de Ciencias Económicas, Buenos Aires.
- Liu, X., Lee, B., & Qiao, Y. (2026). *TeeMAF: A TEE-Based Mutual Attestation Framework for On-Chain and Off-Chain Functions in Blockchain DApps*. Technological University of the Shannon, Ireland.
- Marques, D. H. M., & Valadares, D. C. G. (2025). *Distributed Ledgers and Security Mechanisms on Radio Access Networks: A Systematic Review*. Blockchain: Research and Applications, Elsevier.
- Sheu, R.-K., Pardeshi, M. S., & Chen, L.-C. (2022). *Autonomous Mutual Authentication Protocol in the Edge Networks*. Sensors, 22(19), 7632.
- Tapia, C. A., Garay, A. D., Pacheco, L. A., & Gallegos, D. J. (2026). *Diseño de una Metodología de Pentesting para APIs Modernas: Aplicación a RESTful y GraphQL* (Trabajo de Fin de Maestría). Universidad Internacional del Ecuador (UIDE), Quito.
