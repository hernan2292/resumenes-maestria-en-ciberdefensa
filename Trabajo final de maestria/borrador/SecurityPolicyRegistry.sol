// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title SecurityPolicyRegistry
 * @dev Contrato Inteligente para la Gobernanza Descentralizada de Políticas de Ciberdefensa
 * y Aislamiento Automatizado de Nodos Comprometidos en Infraestructuras Críticas.
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

    // Eventos emitidos hacia los Agentes Defensivos Locales
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

    /**
     * @dev Registra un nuevo nodo de Infraestructura Crítica con su hash de atestación inicial.
     */
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

    /**
     * @dev Publica una nueva regla de filtrado inmutable en la red.
     */
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

    /**
     * @dev ACCIÓN PROACTIVA: Alerta de amenaza emitida por una sonda o nodo atestado.
     * Desencadena el evento de aislamiento global inmediato.
     */
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

    /**
     * @dev Revoca un nodo cuyo hash de atestación ha sido vulnerado.
     */
    function revokeNode(bytes32 _nodeId, string memory _reason) external onlyOwner {
        require(nodes[_nodeId].nodeId != bytes32(0), "Nodo inexistente");
        nodes[_nodeId].status = NodeStatus.Revoked;
        nodes[_nodeId].lastUpdate = block.timestamp;

        emit NodeStatusChanged(_nodeId, NodeStatus.Revoked, _reason);
        emit ProactiveIsolationTriggered(nodes[_nodeId].ipAddress, _reason, block.timestamp);
    }
}
