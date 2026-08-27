#!/usr/bin/env python3
"""
Agente Defensivo Local de Ciberdefensa (Plano de Datos)
Escucha los eventos del Contrato Inteligente SecurityPolicyRegistry en la Blockchain
y aplica de manera proactiva las reglas de aislamiento en el firewall del Sistema Operativo.
"""

import sys
import time
import subprocess

try:
    from web3 import Web3
except ImportError:
    print("[!] Instale web3 via: pip install web3")

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
        try:
            self.w3 = Web3(Web3.HTTPProvider(rpc_url))
            self.connected = self.w3.is_connected()
        except Exception:
            self.connected = False

        if not self.connected:
            print(f"[!] Aviso: No se detectó nodo RPC en {rpc_url}. Modo demostrativo disponible.")
        else:
            print(f"[+] Conectado a la Blockchain local. Bloque actual: {self.w3.eth.block_number}")
            self.contract = self.w3.eth.contract(address=contract_address, abi=abi)

    def apply_isolation(self, ip_address, reason):
        """Aplica la regla de aislamiento directo en el firewall local."""
        print("\n" + "="*70)
        print(f"[ALERT MEGALOCK] EVENTO RECIBIDO DESDE PLANO DE CONTROL BLOCKCHAIN")
        print(f"               - IP A AISLAR : {ip_address}")
        print(f"               - RAZÓN       : {reason}")
        print("="*70)
        
        if sys.platform.startswith("linux"):
            try:
                cmd = f"sudo iptables -A INPUT -s {ip_address} -j DROP"
                print(f"[+] Ejecutando comando en Kernel Linux: {cmd}")
                subprocess.run(cmd, shell=True, check=True)
                print(f"[✓] REGLA APLICADA EXITOSAMENTE: IP {ip_address} BLOQUEADA EN IPTABLES.")
            except Exception as e:
                print(f"[!] Error ejecutando iptables: {e}")
        else:
            print(f"[+] Ejecutando regla de bloqueo en Firewall OS (Windows/MacOS Simulado):")
            print(f"    netsh advfirewall firewall add rule name='PROACTIVE_BLOCK_{ip_address}' dir=in action=block remoteip={ip_address}")
            print(f"[✓] IP {ip_address} ISOLATED IN CONTROL PLANE.")

    def run_simulation_demo(self):
        print("[*] Ejecutando demostración local del Agente Defensivo...")
        sample_ip = "192.168.1.150"
        sample_reason = "Invasión detectada: Ataque de Tampering / Inyección en Nodo SCADA #01"
        time.sleep(1)
        self.apply_isolation(sample_ip, sample_reason)

    def listen_for_events(self):
        if not self.connected:
            self.run_simulation_demo()
            return

        print("[*] Escuchando eventos del contrato inteligente en la Blockchain...")
        event_filter = self.contract.events.ProactiveIsolationTriggered.create_filter(fromBlock='latest')
        
        while True:
            try:
                for event in event_filter.get_new_entries():
                    target_ip = event['args']['targetIp']
                    reason = event['args']['reason']
                    self.apply_isolation(target_ip, reason)
                time.sleep(1)
            except KeyboardInterrupt:
                print("\n[*] Agente defensivo finalizado.")
                break
            except Exception as e:
                print(f"[!] Excepción en escucha: {e}")
                time.sleep(2)

if __name__ == "__main__":
    agent = FirewallAgent(RPC_URL, CONTRACT_ADDRESS, CONTRACT_ABI)
    agent.listen_for_events()
