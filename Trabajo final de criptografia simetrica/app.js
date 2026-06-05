/**
 * SSE-CRYPT: Main Application Logic for the Symmetric Searchable Encryption Simulator
 * Designed with high fidelity using Web Crypto API concepts and detailed simulations.
 */

// Global Application State
const state = {
    activeTab: 'tab-dashboard',
    activeStep: 'step-setup',
    keys: {
        master: '',
        k1: null, // Hex String
        k2: null, // Hex String
        k3: null  // Hex String
    },
    logs: [
        { id: 'LOG_01', text: '192.168.1.105 failed admin password login attempt' },
        { id: 'LOG_02', text: '192.168.1.105 success admin login console SSH' },
        { id: 'LOG_03', text: '10.0.0.4 database server root connection timeout' },
        { id: 'LOG_04', text: '10.0.0.4 beaconing activity malware Trojan detect' },
        { id: 'LOG_05', text: '192.168.1.100 root failed login firewall deny' }
    ],
    encryptedDocs: {}, // ID -> Crypted Hex
    encryptedIndex: {}, // HexAddr -> Encrypted Node
    searchHistory: [], // Array of queries searched
    mitigations: {
        sizePadding: false,
        volumePadding: false,
        dummyQueries: false
    }
};

// --- HELPER CRYPTO FUNCTIONS ---
// Helper: Convert array buffer to Hex string
function bufToHex(buffer) {
    return Array.prototype.map.call(new Uint8Array(buffer), x => ('00' + x.toString(16)).slice(-2)).join('');
}

// Helper: Convert string to UTF-8 Uint8Array
function strToBuf(str) {
    return new TextEncoder().encode(str);
}

// Helper: Pseudo-random HMAC generation (simulated fallback & real Crypto API structure)
async function computeHMAC(keyHex, message) {
    try {
        if (window.crypto && window.crypto.subtle) {
            // High fidelity Web Crypto API simulation
            const encoder = new TextEncoder();
            const keyData = encoder.encode(keyHex);
            const msgData = encoder.encode(message);
            
            const cryptoKey = await window.crypto.subtle.importKey(
                "raw",
                keyData,
                { name: "HMAC", hash: { name: "SHA-256" } },
                false,
                ["sign"]
            );
            
            const signature = await window.crypto.subtle.sign(
                "HMAC",
                cryptoKey,
                msgData
            );
            return bufToHex(signature);
        }
    } catch (e) {
        console.warn("Web Crypto API error, utilizing fallback.", e);
    }
    
    // Fallback deterministic pseudo-HMAC for sandbox/offline consistency
    let hash = 0;
    const combined = keyHex + message;
    for (let i = 0; i < combined.length; i++) {
        hash = (hash << 5) - hash + combined.charCodeAt(i);
        hash |= 0;
    }
    let hex = Math.abs(hash).toString(16).padStart(8, '0');
    // duplicate to match length of SHA-256 for visual fidelity
    return (hex + hex + hex + hex + hex + hex + hex + hex).slice(0, 64);
}

// Helper: Symmetric encryption (simulated probabilistic AES-GCM)
function encryptAES_GCM(keyHex, plaintext) {
    const iv = Math.random().toString(36).substring(2, 10); // Random nonce
    let cryptText = '';
    // Simple XOR with key + IV bytes to simulate robust IND-CPA output
    const mix = keyHex + iv;
    for (let i = 0; i < plaintext.length; i++) {
        const charCode = plaintext.charCodeAt(i);
        const keyChar = mix.charCodeAt(i % mix.length);
        cryptText += ('00' + (charCode ^ keyChar).toString(16)).slice(-2);
    }
    return {
        iv: iv,
        ciphertext: cryptText
    };
}

// Helper: Decryption for probabilistic AES-GCM simulation
function decryptAES_GCM(keyHex, iv, ciphertext) {
    let plainText = '';
    const mix = keyHex + iv;
    for (let i = 0; i < ciphertext.length; i += 2) {
        const hexByte = ciphertext.substr(i, 2);
        const charCode = parseInt(hexByte, 16);
        const keyChar = mix.charCodeAt((i/2) % mix.length);
        plainText += String.fromCharCode(charCode ^ keyChar);
    }
    return plainText;
}

// --- APP INITIALIZATION ---
document.addEventListener('DOMContentLoaded', () => {
    // Initializing Lucide Icons
    lucide.createIcons();
    
    // Bind Tab Switching
    document.querySelectorAll('.nav-item').forEach(button => {
        button.addEventListener('click', (e) => {
            const tabId = button.getAttribute('data-tab');
            switchTab(tabId);
        });
    });

    // Bind Stepper Step Switching
    document.querySelectorAll('.step-nav-btn').forEach(button => {
        button.addEventListener('click', () => {
            const stepId = button.getAttribute('data-step');
            // Allow tab transition only if keys are generated or step-setup is completed
            if (stepId !== 'step-setup' && !state.keys.k1) {
                alert('Debe generar las claves simétricas primero en la Fase 1.');
                return;
            }
            goToStep(stepId);
        });
    });

    // Storage tab toggle (Server side index vs docs)
    document.querySelectorAll('.storage-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.storage-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.storage-tab-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const storageId = btn.getAttribute('data-storage');
            document.getElementById(storageId).classList.add('active');
        });
    });

    // Leakage tab toggle
    document.querySelectorAll('.leakage-tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.leakage-tab-btn').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.leak-tab-content').forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            const leakId = btn.getAttribute('data-leak');
            document.getElementById(leakId).classList.add('active');
            
            if (leakId === 'leak-access') {
                renderAccessPatternGraph();
            }
        });
    });

    // Setup action listeners
    document.getElementById('btn-generate-keys').addEventListener('click', handleGenerateKeys);
    document.getElementById('btn-add-log-row').addEventListener('click', handleAddLogRow);
    document.getElementById('btn-build-index').addEventListener('click', handleBuildIndex);
    document.getElementById('btn-search-trapdoor').addEventListener('click', handleSearch);
    document.getElementById('btn-clear-leak-history').addEventListener('click', handleClearLeakHistory);
    
    // Bind Mitigations
    document.getElementById('mitigation-size-padding').addEventListener('change', (e) => {
        state.mitigations.sizePadding = e.target.checked;
        calculateExposureMeter();
    });
    document.getElementById('mitigation-volume-padding').addEventListener('change', (e) => {
        state.mitigations.volumePadding = e.target.checked;
        calculateExposureMeter();
    });
    document.getElementById('mitigation-dummy-queries').addEventListener('change', (e) => {
        state.mitigations.dummyQueries = e.target.checked;
        calculateExposureMeter();
    });

    // Load and render thesis documentation
    loadThesisDocumentation();
});

// Switch major views (SPA mechanism)
function switchTab(tabId) {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active');
        }
    });

    document.querySelectorAll('.tab-pane').forEach(pane => {
        pane.classList.remove('active');
    });

    document.getElementById(tabId).classList.add('active');
    state.activeTab = tabId;
    
    if (tabId === 'tab-leakage') {
        calculateExposureMeter();
        const activeLeakTab = document.querySelector('.leakage-tab-btn.active').getAttribute('data-leak');
        if (activeLeakTab === 'leak-access') {
            renderAccessPatternGraph();
        }
    }
}

// Switch simulator steps
function goToStep(stepId) {
    document.querySelectorAll('.step-nav-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-step') === stepId) {
            btn.classList.add('active');
        }
    });

    document.querySelectorAll('.step-pane').forEach(pane => {
        pane.classList.remove('active');
    });

    document.getElementById(stepId).classList.add('active');
    state.activeStep = stepId;
}

// --- EVENT HANDLERS & PROTOCOL OPERATIONS ---

// Step 1: Handle Key Generation
async function handleGenerateKeys() {
    const password = document.getElementById('master-password').value;
    if (!password) {
        alert('Por favor, introduzca una contraseña maestra.');
        return;
    }

    state.keys.master = password;
    
    // We derive K1, K2, K3 by feeding distinct salts/constants to PBKDF2/HMAC
    // Deterministic simulation based on Web Crypto API for instant display
    state.keys.k1 = await computeHMAC(password, "SALT_ADDRESS_DERIVATION_K1");
    state.keys.k2 = await computeHMAC(password, "SALT_LIST_MASK_K2");
    state.keys.k3 = await computeHMAC(password, "SALT_AES_DOCUMENTS_K3");

    // Display Hex values
    document.getElementById('key-k1-display').innerText = state.keys.k1;
    document.getElementById('key-k2-display').innerText = state.keys.k2;
    document.getElementById('key-k3-display').innerText = state.keys.k3;

    // Update master key status in Sidebar
    const shortened = state.keys.k1.substring(0, 16) + '...';
    document.getElementById('master-key-state').innerText = shortened;
    document.getElementById('master-key-state').classList.remove('key-hex');
    document.getElementById('master-key-state').style.color = 'var(--accent-green)';

    // Enable next button
    document.getElementById('btn-next-to-index').removeAttribute('disabled');
    
    // Success feedback
    const btn = document.getElementById('btn-generate-keys');
    btn.innerHTML = `<i data-lucide="check" class="text-green"></i> <span>Claves Derivadas Exitosamente</span>`;
    lucide.createIcons();
    setTimeout(() => {
        btn.innerHTML = `<i data-lucide="key-round"></i> <span>Re-derivar Claves Simétricas</span>`;
        lucide.createIcons();
    }, 3000);
}

// Step 2: Dynamically add log row
function handleAddLogRow() {
    const tbody = document.getElementById('logs-tbody');
    const rowCount = tbody.querySelectorAll('tr').length + 1;
    const padCount = rowCount.toString().padStart(2, '0');
    const id = `LOG_${padCount}`;
    
    const tr = document.createElement('tr');
    tr.innerHTML = `
        <td><code>${id}</code></td>
        <td><input type="text" class="log-input-row" value="log entry message text" data-id="${id}"></td>
    `;
    tbody.appendChild(tr);
}

// Step 2: Build the Encrypted Index & Encrypt Logs (SSE-1 Construction)
async function handleBuildIndex() {
    if (!state.keys.k1) {
        alert('Debe inicializar las claves primero en el Paso 1.');
        return;
    }

    // Collect current logs text
    const inputs = document.querySelectorAll('.log-input-row');
    state.logs = [];
    inputs.forEach(inp => {
        state.logs.push({
            id: inp.getAttribute('data-id'),
            text: inp.value.trim()
        });
    });

    // 1. Encrypt Documents using K3 (AES-GCM simulation with IV)
    state.encryptedDocs = {};
    const docsTbody = document.getElementById('server-docs-tbody');
    docsTbody.innerHTML = '';

    state.logs.forEach(log => {
        let textToEncrypt = log.text;
        
        // Mitigation: Size Padding
        if (state.mitigations.sizePadding) {
            // Pad document to a standard blocks length (e.g. 128 characters)
            textToEncrypt = textToEncrypt.padEnd(128, '0');
        }

        const crypt = encryptAES_GCM(state.keys.k3, textToEncrypt);
        // Display representation: IV + Ciphertext
        const fullCipher = `IV:${crypt.iv}::CIPHER:${crypt.ciphertext}`;
        state.encryptedDocs[log.id] = fullCipher;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><code>${log.id}</code></td>
            <td class="font-mono text-green">${fullCipher.substring(0, 50)}...</td>
        `;
        docsTbody.appendChild(tr);
    });

    // 2. Build Inverted Index Crypted (Curtmola et al.)
    // Step A: Extract words and build local inverted dictionary
    const dictionary = {};
    state.logs.forEach(log => {
        // Clean words: alphanumeric lowercased
        const words = log.text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
        const uniqueWords = [...new Set(words)].filter(w => w.length > 1);
        
        uniqueWords.forEach(w => {
            if (!dictionary[w]) {
                dictionary[w] = [];
            }
            dictionary[w].push(log.id);
        });
    });

    // Step B: For each keyword, encrypt its documents list as a linked list in the server
    state.encryptedIndex = {};
    const indexTbody = document.getElementById('server-index-tbody');
    indexTbody.innerHTML = '';

    for (const word in dictionary) {
        let docList = [...dictionary[word]];

        // Mitigation: Volume Padding (append dummy document IDs to obscure true length)
        if (state.mitigations.volumePadding) {
            // Rellenar todas las listas de palabras hasta una longitud estándar, ej. 4
            const targetLen = 4;
            let dummyIndex = 1;
            while (docList.length < targetLen) {
                docList.push(`DUMMY_LOG_${dummyIndex++}`);
            }
        }

        // Derive list mask key Kw = PRF(K2, word)
        const kw = await computeHMAC(state.keys.k2, word);
        // Derive initial address lookup tag T1 = PRF(K1, word)
        const t1 = await computeHMAC(state.keys.k1, word);
        const t1Addr = `0x${t1.substring(0, 16)}`; // Display hex address

        // Build list chain backward or forward
        let currentNextAddr = 'NULL';
        
        for (let j = docList.length - 1; j >= 0; j--) {
            const docId = docList[j];
            // Determine storage address for current node:
            // For the first node (j=0), it must reside exactly at T1 address so search starts there.
            // For subsequent nodes, it's a random lookups address in the hash table.
            let nodeAddr;
            if (j === 0) {
                nodeAddr = t1Addr;
            } else {
                // Generate a pseudo-random hash address
                const randomSeed = word + docId + j + state.keys.k1;
                const randHash = await computeHMAC(state.keys.k1, randomSeed);
                nodeAddr = `0x${randHash.substring(0, 16)}`;
            }

            // Create payload: ID || nextAddr
            const payload = `${docId}||${currentNextAddr}`;
            // Encrypt payload with Kw (simulated GCM GCM)
            const nodeCrypt = encryptAES_GCM(kw, payload);
            const nodePayloadStr = `${nodeCrypt.iv}:${nodeCrypt.ciphertext}`;

            // Save in simulated server memory
            state.encryptedIndex[nodeAddr] = {
                payload: nodePayloadStr,
                wordDebug: word // stored for visual simulation debugging, obviously server doesn't see this!
            };

            // Set current address as the "next" pointer for the previous iteration
            currentNextAddr = nodeAddr;
        }
    }

    // Render server index hash table visually (sorted randomly to obscure links)
    const serverAddresses = Object.keys(state.encryptedIndex);
    // Shuffle addresses
    serverAddresses.sort(() => Math.random() - 0.5);

    serverAddresses.forEach(addr => {
        const item = state.encryptedIndex[addr];
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><code class="text-cyan">${addr}</code></td>
            <td class="font-mono text-muted">${item.payload.substring(0, 40)}...</td>
        `;
        indexTbody.appendChild(tr);
    });

    // Enable next step
    document.getElementById('btn-next-to-search').removeAttribute('disabled');
    
    // Feedback
    const buildBtn = document.getElementById('btn-build-index');
    buildBtn.innerHTML = `<i data-lucide="check" class="text-green"></i> <span>Índice Cifrado Construido</span>`;
    lucide.createIcons();
    setTimeout(() => {
        buildBtn.innerHTML = `<i data-lucide="shield-check"></i> <span>Construir e Indexar Cifrado (SSE-1)</span>`;
        lucide.createIcons();
    }, 3000);
}

// Step 3: Handle Blind Search Flow
async function handleSearch() {
    const query = document.getElementById('search-query').value.trim().toLowerCase();
    if (!query) {
        alert('Por favor, introduzca una palabra clave para buscar.');
        return;
    }

    if (!state.keys.k1 || Object.keys(state.encryptedIndex).length === 0) {
        alert('Debe construir el índice cifrado en el Paso 2 primero.');
        return;
    }

    // 1. Generate Trapdoor on Client Side
    // T1 = PRF(K1, query) - starting pointer
    // Kw = PRF(K2, query) - mask key
    const t1 = await computeHMAC(state.keys.k1, query);
    const kw = await computeHMAC(state.keys.k2, query);
    const t1Addr = `0x${t1.substring(0, 16)}`;

    document.getElementById('trapdoor-t1').innerText = t1Addr;
    document.getElementById('trapdoor-kw').innerText = kw.substring(0, 32) + '...';

    // Log this search into leakage history
    logSearchLeakage(query, t1Addr, kw);

    // 2. Perform Server Side Traversal Simulation (Visual & Algorithmic)
    const viewport = document.getElementById('server-anim-viewport');
    document.getElementById('anim-idle-message').classList.add('hidden');
    
    const runningContainer = document.getElementById('anim-running-container');
    runningContainer.classList.remove('hidden');
    
    const track = document.getElementById('traversal-track');
    track.innerHTML = ''; // reset track
    
    let currentAddr = t1Addr;
    let foundDocIds = [];
    let stepCount = 0;
    
    // Visual Step-by-Step Traversal with timeouts for gorgeous micro-animations
    async function traverseStep() {
        document.getElementById('anim-current-addr').innerText = `Dirección: ${currentAddr}`;
        
        const node = state.encryptedIndex[currentAddr];
        if (node) {
            // Found a node! Let's display the decrypting animation
            const parts = node.payload.split(':');
            const iv = parts[0];
            const cipher = parts[1];
            
            // Server blind decryptions
            const decrypted = decryptAES_GCM(kw, iv, cipher);
            const decParts = decrypted.split('||');
            const docId = decParts[0];
            const nextAddr = decParts[1];

            // Render node in UI
            const nodeDiv = document.createElement('div');
            nodeDiv.className = 'traversal-node';
            nodeDiv.innerHTML = `
                <div class="node-title-bar">
                    <span>Nodo Cifrado Encontrado</span>
                    <span class="node-addr">${currentAddr}</span>
                </div>
                <div class="node-payload">Payload Cifrado: ${node.payload.substring(0, 26)}...</div>
            `;
            track.appendChild(nodeDiv);
            track.scrollTop = track.scrollHeight; // Auto-scroll

            // Small delay to simulate computation
            await new Promise(resolve => setTimeout(resolve, 800));

            // Mark node matching and show decrypted info
            nodeDiv.classList.add('matching');
            nodeDiv.innerHTML = `
                <div class="node-title-bar">
                    <span class="text-green">Coincidencia Ciega Decodificada</span>
                    <span class="node-addr text-green">${currentAddr}</span>
                </div>
                <div class="node-payload">ID Recuperado: <strong>${docId}</strong> | Siguiente: <span class="text-cyan">${nextAddr}</span></div>
            `;
            
            if (!docId.startsWith('DUMMY_LOG_')) {
                foundDocIds.push(docId);
            }

            if (nextAddr !== 'NULL') {
                // Show connecting arrow
                const arrowDiv = document.createElement('div');
                arrowDiv.className = 'node-arrow';
                arrowDiv.innerHTML = `<i data-lucide="arrow-down"></i>`;
                track.appendChild(arrowDiv);
                lucide.createIcons();
                track.scrollTop = track.scrollHeight;

                currentAddr = nextAddr;
                stepCount++;
                if (stepCount < 10) { // Safety guard against infinite loops
                    setTimeout(traverseStep, 600);
                }
            } else {
                // Completed!
                finishTraversal();
            }
        } else {
            // Null state / Not found
            const noMatchDiv = document.createElement('div');
            noMatchDiv.className = 'traversal-node';
            noMatchDiv.style.borderColor = 'var(--accent-red)';
            noMatchDiv.innerHTML = `
                <div class="node-title-bar">
                    <span class="text-danger">Dirección Vacía en Servidor</span>
                    <span class="node-addr">${currentAddr}</span>
                </div>
                <div class="node-payload text-center text-muted">Ningún nodo coincide con la etiqueta. Búsqueda terminada.</div>
            `;
            track.appendChild(noMatchDiv);
            finishTraversal();
        }
    }

    function finishTraversal() {
        // Display pills of found document IDs
        const pillsBox = document.getElementById('found-ids-pills');
        pillsBox.innerHTML = '';
        if (foundDocIds.length > 0) {
            foundDocIds.forEach(id => {
                const span = document.createElement('span');
                span.className = 'badge badge-green';
                span.innerText = id;
                pillsBox.appendChild(span);
            });
            // Perform decryption of logs on the client side
            renderDecryptedLogs(foundDocIds);
        } else {
            pillsBox.innerHTML = `<span class="badge badge-muted">Sin Coincidencias</span>`;
            document.getElementById('decrypted-results-container').innerHTML = `
                <div class="text-muted text-center py-3">No se encontraron documentos para la palabra "${query}".</div>
            `;
        }
    }

    // Trigger sequential traversal loop
    traverseStep();

    // Mitigation: Dummy Queries execution in background if checked
    if (state.mitigations.dummyQueries) {
        // Execute background dummy searches to obfuscate traffic patterns
        setTimeout(async () => {
            const dummies = ["connection", "SSH", "timeout", "firewall", "success"];
            const randomDummy = dummies[Math.floor(Math.random() * dummies.length)];
            const dummyT1 = await computeHMAC(state.keys.k1, randomDummy);
            const dummyKw = await computeHMAC(state.keys.k2, randomDummy);
            logSearchLeakage(randomDummy, `0x${dummyT1.substring(0, 16)}`, dummyKw, true);
        }, 1200);
    }
}

// Client Side Log Decryption using K3
function renderDecryptedLogs(docIds) {
    const container = document.getElementById('decrypted-results-container');
    container.innerHTML = '';

    docIds.forEach(id => {
        // Retrieve ciphertext from server
        const cipher = state.encryptedDocs[id];
        if (cipher) {
            // Cipher structure is IV:xxxx::CIPHER:yyyy
            const parts = cipher.split('::');
            const iv = parts[0].replace('IV:', '');
            const cryptText = parts[1].replace('CIPHER:', '');

            // Decrypt local
            let plainText = decryptAES_GCM(state.keys.k3, iv, cryptText);
            
            // Clean size padding if it was active
            if (state.mitigations.sizePadding) {
                plainText = plainText.replace(/0+$/, ''); // Strip padded zero chars
            }

            const item = document.createElement('div');
            item.className = 'decrypted-log-item';
            item.innerHTML = `
                <code>${id}</code>
                <div class="decrypted-log-text">${plainText}</div>
            `;
            container.appendChild(item);
        }
    });
}

// --- LEAKAGE SIMULATION ENGINE ---

// Log a query search into the leakage timeline
function logSearchLeakage(query, t1Addr, kwHex, isDummy = false) {
    const timestamp = new Date().toLocaleTimeString();
    
    // Check if query is already searched before (Search Pattern analysis)
    const isRepeated = state.searchHistory.some(h => h.query === query);
    
    state.searchHistory.push({
        query: query,
        tag: t1Addr,
        kw: kwHex,
        time: timestamp,
        isDummy: isDummy,
        isRepeated: isRepeated
    });

    // Update Leakage timeline UI
    const timeline = document.getElementById('timeline-query-track');
    // Clear initial state text if present
    if (state.searchHistory.length === 1) {
        timeline.innerHTML = '';
    }

    const bubble = document.createElement('div');
    bubble.className = 'leak-bubble';
    
    let leakVerdict = '';
    if (isDummy) {
        leakVerdict = `<span class="bubble-leak-verdict verdict-masked">Dummy (Ruido)</span>`;
    } else if (isRepeated) {
        leakVerdict = `<span class="bubble-leak-verdict verdict-leak">Search Pattern Revelado</span>`;
    } else {
        leakVerdict = `<span class="bubble-leak-verdict verdict-masked">Nueva Consulta</span>`;
    }

    bubble.innerHTML = `
        <div class="bubble-left">
            <span class="bubble-time">${timestamp}</span>
            <span>Trapdoor:</span>
            <code class="bubble-tag">${t1Addr}</code>
        </div>
        ${leakVerdict}
    `;
    timeline.appendChild(bubble);
    timeline.scrollTop = timeline.scrollHeight;
}

function handleClearLeakHistory() {
    state.searchHistory = [];
    document.getElementById('timeline-query-track').innerHTML = `
        <div class="text-center text-muted py-5">Esperando que realices búsquedas en la pestaña 'Lab Criptográfico'.</div>
    `;
    document.getElementById('access-graph-canvas').innerHTML = `
        <div class="text-center text-muted py-5">Esperando que realices búsquedas para mapear qué logs son revelados al servidor.</div>
    `;
    calculateExposureMeter();
}

// Calculate mathematically how secure the cryptosystem is based on active mitigations
function calculateExposureMeter() {
    let exposure = 95;
    let verdict = "Riesgo Crítico: Un ataque de inyección o de reconstrucción por volumen puede deducir el 100% de las búsquedas en menos de 50 consultas.";
    let styleClass = "high";

    if (state.mitigations.sizePadding) {
        exposure -= 25;
    }
    if (state.mitigations.volumePadding) {
        exposure -= 35;
    }
    if (state.mitigations.dummyQueries) {
        exposure -= 20;
    }

    // Boundary constraints
    if (exposure < 15) { exposure = 15; }

    if (exposure >= 70) {
        styleClass = "high";
        verdict = "Riesgo Crítico: Las filtraciones de patrones de búsqueda (Search Pattern) y volumen (Access Pattern) permiten al servidor honesto-pero-curioso realizar criptoanálisis estadístico de IoCs.";
    } else if (exposure >= 40) {
        styleClass = "medium";
        verdict = "Riesgo Moderado: Mitigaciones parciales activas. Se oculta el tamaño de los logs y/o el volumen de resultados de consultas. Sigue expuesta la repetición temporal de búsquedas.";
    } else {
        styleClass = "low";
        verdict = "Nivel Seguro: Excelente robustez. El aplanamiento de volumen, padding del texto cifrado y ruido dinámico (dummies) ciegan la capacidad del servidor de reconstruir relaciones estadísticas.";
    }

    const percentageEl = document.getElementById('exposure-percentage');
    percentageEl.innerText = `${exposure}%`;
    percentageEl.className = `exposure-value ${styleClass}`;

    const barEl = document.getElementById('exposure-bar-fill');
    barEl.style.width = `${exposure}%`;
    barEl.className = `meter-bar-fill ${styleClass}`;

    const verdictEl = document.getElementById('exposure-verdict');
    verdictEl.className = `meter-warning mt-2 text-${styleClass === 'high' ? 'danger' : styleClass === 'medium' ? 'warning' : 'green'}`;
    verdictEl.innerHTML = `
        <i data-lucide="${styleClass === 'low' ? 'shield' : 'shield-alert'}"></i>
        <span>${verdict}</span>
    `;
    lucide.createIcons();
}

// Dynamic rendering of Access Pattern Leaks ( bipartite graph in HTML )
function renderAccessPatternGraph() {
    const graphBox = document.getElementById('access-graph-canvas');
    if (state.searchHistory.length === 0) {
        graphBox.innerHTML = `
            <div class="text-center text-muted py-5">Esperando que realices búsquedas para mapear qué logs son revelados al servidor.</div>
        `;
        return;
    }

    graphBox.innerHTML = '';
    
    // Create bipartite layout: left column is searched queries, right column is returned documents
    const layout = document.createElement('div');
    layout.className = 'access-nodes-grid';
    
    const colQueries = document.createElement('div');
    colQueries.className = 'access-col';
    colQueries.innerHTML = `<div class="access-col-title">Trapdoors Consultados</div>`;

    const colDocs = document.createElement('div');
    colDocs.className = 'access-col';
    colDocs.innerHTML = `<div class="access-col-title">Documentos Devueltos</div>`;

    layout.appendChild(colQueries);
    layout.appendChild(colDocs);
    graphBox.appendChild(layout);

    // Get unique queries and mapped documents from state
    const uniqueQueries = [...new Set(state.searchHistory.filter(h => !h.isDummy).map(h => h.query))];
    
    if (uniqueQueries.length === 0) {
        graphBox.innerHTML = `
            <div class="text-center text-muted py-5">Las consultas Dummy no devuelven documentos de producción, no hay fugas registradas.</div>
        `;
        return;
    }

    // Render Query Bubbles
    uniqueQueries.forEach(q => {
        const h = state.searchHistory.find(item => item.query === q);
        const bubble = document.createElement('div');
        bubble.className = 'graph-bubble query-node';
        bubble.innerText = `${h.tag} ("${q}")`;
        colQueries.appendChild(bubble);
    });

    // Render Doc Bubbles
    state.logs.forEach(log => {
        const bubble = document.createElement('div');
        bubble.className = 'graph-bubble doc-node';
        bubble.innerText = log.id;
        bubble.id = `graph-doc-${log.id}`;
        colDocs.appendChild(bubble);
    });

    // If volume padding is active, render dummy doc targets
    if (state.mitigations.volumePadding) {
        const dummyBubble = document.createElement('div');
        dummyBubble.className = 'graph-bubble dummy-node';
        dummyBubble.innerText = 'DUMMY_LOGS (Enmascarados)';
        colDocs.appendChild(dummyBubble);
    }
}

// --- THESIS DOCUMENT RENDERING ENGINE ---
// Reads the academic markdown file and dynamically formats it inside the application
async function loadThesisDocumentation() {
    const container = document.getElementById('thesis-body-content');
    
    const renderMarkdown = (markdown) => {
        const html = parseMarkdownToHTML(markdown);
        container.innerHTML = html;
        
        // Add smooth scrolling to local TOC anchors
        container.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function(e) {
                e.preventDefault();
                const targetId = this.getAttribute('href').replace('#', '');
                const targetEl = document.getElementById(targetId);
                if (targetEl) {
                    targetEl.scrollIntoView({ behavior: 'smooth' });
                }
            });
        });
    };

    try {
        const response = await fetch('SSE_Trabajo_Final.md');
        if (!response.ok) {
            throw new Error('No se pudo encontrar el archivo del documento final.');
        }
        const markdown = await response.text();
        renderMarkdown(markdown);
        console.log('Documento MD cargado dinámicamente vía HTTP Fetch.');
    } catch (e) {
        console.warn('Fallo en fetch local (normal en protocolo file:// debido a CORS). Cargando respaldo local de documento.js...');
        if (typeof thesisMarkdown !== 'undefined') {
            renderMarkdown(thesisMarkdown);
            console.log('Documento cargado desde el respaldo local en documento.js exitosamente.');
        } else {
            console.error('Error loading thesis markdown:', e);
            container.innerHTML = `
                <div class="text-center text-danger py-5">
                    <i data-lucide="alert-circle" class="giant-purple-icon text-danger"></i>
                    <p class="mt-2">Error al leer el archivo <code>SSE_Trabajo_Final.md</code> y no se encontró el archivo de respaldo <code>documento.js</code>.</p>
                    <p class="text-muted">Por favor, asegúrese de abrir este archivo desde el workspace correcto.</p>
                </div>
            `;
            lucide.createIcons();
        }
    }
}

// Simple but elegant Markdown parser to avoid large bundle libraries
function parseMarkdownToHTML(md) {
    let html = md;
    
    // Clean Windows carriage returns
    html = html.replace(/\r\n/g, '\n');

    // Parse Tables
    // Capture markdown tables and parse them cleanly
    const tableRegex = /\|(.+)\|[ \t]*\n\|[ :-]+\|[ \t]*\n((?:\|.+\|[ \t]*\n?)+)/g;
    html = html.replace(tableRegex, (match, headerRow, bodyRows) => {
        const headers = headerRow.split('|').map(h => h.trim()).filter(h => h !== '');
        const rows = bodyRows.trim().split('\n').map(row => {
            return row.split('|').map(r => r.trim()).filter(r => r !== '');
        });

        let tableHtml = '<table class="cyber-table"><thead><tr>';
        headers.forEach(h => { tableHtml += `<th>${h}</th>`; });
        tableHtml += '</tr></thead><tbody>';
        
        rows.forEach(row => {
            tableHtml += '<tr>';
            row.forEach(cell => { tableHtml += `<td>${cell}</td>`; });
            tableHtml += '</tr>';
        });
        
        tableHtml += '</tbody></table>';
        return tableHtml;
    });

    // Parse Headers
    html = html.replace(/^# (.*?)$/gm, '<h1 id="thesis-title">$1</h1>');
    html = html.replace(/^## (.*?)$/gm, (match, p1) => {
        // Derive ID for navigation links
        let id = '';
        if (p1.includes('Resumen')) id = 'thesis-abstract';
        else if (p1.includes('1.')) id = 'thesis-intro';
        else if (p1.includes('2.')) id = 'thesis-prelims';
        else if (p1.includes('3.')) id = 'thesis-evolution';
        else if (p1.includes('4.')) id = 'thesis-leakage';
        else if (p1.includes('5.')) id = 'thesis-case';
        else if (p1.includes('6.')) id = 'thesis-conclusion';
        else id = p1.toLowerCase().replace(/[^a-z0-9]/g, '-');
        return `<h2 id="${id}">${p1}</h2>`;
    });
    html = html.replace(/^### (.*?)$/gm, '<h3>$1</h3>');

    // Parse Code blocks (fenced)
    html = html.replace(/```(.*?)\n([\s\S]*?)```/g, '<pre><code class="language-$1">$2</code></pre>');
    
    // Parse inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Parse bold & italics
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // Parse lists
    html = html.replace(/^\s*-\s+(.*?)$/gm, '<li>$1</li>');
    // Wrap lists in ul
    html = html.replace(/((?:<li>.*<\/li>\s*)+)/g, '<ul>$1</ul>');

    // Parse paragraphs (excluding blocks already parsed like pre, h1-h3, ul, table)
    const lines = html.split('\n\n');
    const parsedLines = lines.map(line => {
        const trimmed = line.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('<h') || trimmed.startsWith('<pre') || trimmed.startsWith('<ul') || trimmed.startsWith('<table') || trimmed.startsWith('<hr') || trimmed.startsWith('<blockquote')) {
            return trimmed;
        }
        return `<p>${trimmed}</p>`;
    });
    
    return parsedLines.join('\n');
}
