document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURATION ---
    const API_KEY = "pfbO4KFP7TriMY3iZYm6mzRlfhFCmsQw";
    const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";
    const SERVER_URL = "http://localhost:3000";

    // --- STATE ---
    let currentUser = JSON.parse(localStorage.getItem('cqcd_session_user')) || null;
    let currentLang = 'c';
    let lastOutput = "";
    let lastError = "";

    // --- NAVIGATION ---
    const navLinks = document.querySelectorAll('.nav-link');
    const sections = document.querySelectorAll('.view-section');

    function switchView(targetId) {
        navLinks.forEach(l => l.classList.remove('active'));
        const activeLink = document.querySelector(`.nav-link[data-target="${targetId}"]`);
        if (activeLink) activeLink.classList.add('active');

        sections.forEach(sec => {
            sec.style.opacity = '0';
            setTimeout(() => { sec.classList.remove('active'); }, 200);
        });

        setTimeout(() => {
            const target = document.getElementById(targetId);
            if (target) {
                target.classList.add('active');
                setTimeout(() => { target.style.opacity = '1'; }, 50);
                if (targetId === 'view-gogs') renderGogs();
                if (targetId === 'view-editor' && codeEditor) codeEditor.refresh();
            }
        }, 200);
    }

    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            const targetId = link.getAttribute('data-target');

            // Handle Profile Button specifically TO TOGGLE POPOVER
            if (link.id === 'btn-profile') {
                if (currentUser) {
                    const pop = document.getElementById('logout-popover');
                    if (pop) {
                        pop.classList.toggle('active');
                    }
                    return; // Stop navigation
                } else {
                    openAuthView();
                    return;
                }
            }

            if (targetId) {
                // FIX: If clicking "Le Savoir", always reset to muscu landing
                // We do this BEFORE checking active state to ensure reset happens
                if (targetId === 'view-courses') {
                    openMuscuView('muscu-menu');
                }

                // CHECK IF ALREADY ACTIVE -> RE-TRIGGER ANIMATION (Fast Fade Up)
                const currentSection = document.getElementById(targetId);
                if (currentSection && currentSection.classList.contains('active')) {
                    currentSection.style.animation = 'none';
                    void currentSection.offsetWidth; // Force Reflow
                    currentSection.style.animation = 'fadeUp 0.4s ease';
                    return;
                }

                switchView(targetId);
            }
        });
    });

    // --- HISTORY LOGIC ---
    function addToHistory(type, item) {
        if (!currentUser) return;
        if (!currentUser.data.history) currentUser.data.history = { quizzes: [], courses: [] };

        const list = currentUser.data.history[type];
        // Prevent duplicates at top
        if (list.length > 0 && list[0].title === item) return;

        list.unshift({ title: item, date: new Date().toLocaleDateString() });
        if (list.length > 5) list.pop();

        syncData('history', currentUser.data.history);
    }

    function renderHistory() {
        if (!currentUser) return;

        const qList = document.getElementById('hist-quiz');
        const cList = document.getElementById('hist-cours');
        const emptyMsg = `<div class="mini-hist-empty">Ton historique est vide, va travailler.</div>`;

        if (qList) {
            if (currentUser.data.history && currentUser.data.history.quizzes && currentUser.data.history.quizzes.length > 0) {
                qList.innerHTML = currentUser.data.history.quizzes.slice(0, 5).map(i =>
                    `<div class="history-item">
                        <h4>${i.title}</h4>
                        <p>${i.date}</p>
                     </div>`
                ).join('');
            } else {
                qList.innerHTML = emptyMsg;
            }
        }

        if (cList) {
            if (currentUser.data.history && currentUser.data.history.courses && currentUser.data.history.courses.length > 0) {
                cList.innerHTML = currentUser.data.history.courses.slice(0, 5).map(i =>
                    `<div class="history-item">
                        <h4>${i.title}</h4>
                        <p>${i.date}</p>
                     </div>`
                ).join('');
            } else {
                cList.innerHTML = emptyMsg;
            }
        }
    }

    // --- BUTTONS MAPPING ---
    document.getElementById('btn-enter-now')?.addEventListener('click', () => switchView('view-editor'));
    document.getElementById('card-hack')?.addEventListener('click', () => switchView('view-editor'));
    document.getElementById('card-rabbit')?.addEventListener('click', () => {
        openMuscuView('muscu-menu');
        switchView('view-courses');
    });
    document.getElementById('card-neo')?.addEventListener('click', () => switchView('view-gogs'));
    document.getElementById('btn-login-archives')?.addEventListener('click', () => openAuthView());

    // --- AUTH LOGIC (Server Based) ---
    const authTabs = document.querySelectorAll('.auth-tab');

    function openAuthView() {
        switchView('view-auth');
        // Reset forms
        document.querySelectorAll('#view-auth input').forEach(i => i.value = '');
        document.querySelectorAll('.status-msg').forEach(s => s.textContent = '');
    }

    // Tab Switch
    authTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // UI Toggle
            authTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Form Toggle
            document.querySelectorAll('.auth-form').forEach(f => f.style.display = 'none');
            const target = document.getElementById(tab.dataset.target);
            if (target) {
                target.style.display = 'block';
                target.classList.add('active');
            }
        });
    });

    // API Calls
    async function apiCall(endpoint, data) {
        const res = await fetch(`${SERVER_URL}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        });
        return await res.json();
    }

    // LOGIN
    document.getElementById('btn-submit-login')?.addEventListener('click', async () => {
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        const status = document.getElementById('login-status');

        if (!email || !pass) { status.textContent = "Champs vides."; return; }
        status.textContent = "Connexion...";

        try {
            const res = await apiCall('/login', { email, password: pass });
            if (res.success) {
                loginSuccess(res.user);
                switchView('view-gogs');
            } else {
                status.textContent = res.error;
                status.style.color = '#e74c3c';
            }
        } catch (e) {
            status.textContent = "Erreur Serveur.";
        }
    });

    // REGISTER
    document.getElementById('btn-submit-register')?.addEventListener('click', async () => {
        const user = document.getElementById('reg-username').value;
        const email = document.getElementById('reg-email').value;
        const pass = document.getElementById('reg-password').value;
        const status = document.getElementById('reg-status');

        if (!user || !email || !pass) { status.textContent = "Tout remplir stp."; return; }
        status.textContent = "Création...";

        try {
            const res = await apiCall('/register', { username: user, email, password: pass });
            if (res.success) {
                loginSuccess(res.user);
                switchView('view-gogs');
            } else {
                status.textContent = res.error;
                status.style.color = '#e74c3c';
            }
        } catch (e) {
            status.textContent = "Erreur Serveur.";
        }
    });

    function loginSuccess(user) {
        currentUser = user;
        // Init Stats if missing
        if (!currentUser.data.stats) {
            currentUser.data.stats = {
                questionsAnswered: 0,
                totalErrors: 0
            };
        }
        localStorage.setItem('cqcd_session_user', JSON.stringify(user));
        updateUserUI();
        console.log("Logged in:", user);
    }

    function logoutUser() {
        currentUser = null;
        localStorage.removeItem('cqcd_session_user');
        updateUserUI();
        switchView('view-landing');
    }

    function updateUserUI() {
        const status = document.getElementById('user-status');
        const btn = document.getElementById('btn-profile');
        const guestMsg = document.getElementById('guest-warning-msg');

        if (currentUser) {
            if (status) status.textContent = `Connecté en tant que : ${currentUser.username}`;
            if (btn) {
                btn.textContent = currentUser.username.toUpperCase();
                btn.style.color = '#2ecc71';
            }
            if (guestMsg) guestMsg.style.display = 'none';
        } else {
            if (status) status.textContent = 'Non connecté';
            if (btn) {
                btn.textContent = 'PROFIL';
                btn.style.color = '#fff';
            }
            if (guestMsg) guestMsg.style.display = 'block';
        }
    }
    updateUserUI();

    // Data Sync Helper
    async function syncData(key, value) {
        if (!currentUser) return; // Local Only
        // Update Local Object
        currentUser.data[key] = value;
        localStorage.setItem('cqcd_session_user', JSON.stringify(currentUser));

        // Push to Server
        try {
            await apiCall('/save-data', {
                email: currentUser.email,
                key: key,
                value: value
            });
        } catch (e) { console.error("Sync Failure", e); }
    }


    // --- EDITOR LOGIC ---
    const codeEditor = CodeMirror.fromTextArea(document.getElementById('code-input'), {
        mode: 'text/x-csrc',
        lineNumbers: true,
        autoCloseBrackets: true,
        lineWrapping: true
    });
    codeEditor.setSize("100%", "100%");
    window.addEventListener('resize', () => codeEditor.refresh());

    const langSelect = document.getElementById('language-select');
    langSelect.addEventListener('change', () => {
        currentLang = langSelect.value;
        if (currentLang === 'c') codeEditor.setOption('mode', 'text/x-csrc');
        if (currentLang === 'cpp') codeEditor.setOption('mode', 'text/x-c++src');
        if (currentLang === 'csharp') codeEditor.setOption('mode', 'text/x-csharp');
        if (currentLang === 'java') codeEditor.setOption('mode', 'text/x-java');
        if (currentLang === 'javascript') codeEditor.setOption('mode', 'javascript');
        if (currentLang === 'python') codeEditor.setOption('mode', 'python');
        if (currentLang === 'php') codeEditor.setOption('mode', 'php');
    });

    // --- SIDE PANEL TOGGLE ---
    const btnToggleChat = document.getElementById('btn-toggle-chat');
    const closeSidePanel = document.getElementById('close-side-panel');
    const mainPanel = document.getElementById('editor-main-panel');
    const sidePanel = document.getElementById('editor-side-panel');
    const userInput = document.getElementById('ai-user-input');

    function setPanelState(isOpen) {
        if (isOpen) {
            mainPanel.classList.remove('panel-full');
            mainPanel.classList.add('panel-shrink');
            sidePanel.classList.remove('panel-closed');
            sidePanel.classList.add('panel-open');
        } else {
            mainPanel.classList.add('panel-full');
            mainPanel.classList.remove('panel-shrink');
            sidePanel.classList.add('panel-closed');
            sidePanel.classList.remove('panel-open');
        }
        setTimeout(() => codeEditor.refresh(), 600);
    }

    btnToggleChat?.addEventListener('click', () => {
        const isClosed = sidePanel.classList.contains('panel-closed');
        setPanelState(isClosed);
    });

    closeSidePanel?.addEventListener('click', () => setPanelState(false));

    // --- COMPILATION LOGIC ---
    const terminalOutput = document.getElementById('terminal-output');

    // Extracted function so AI can use it too
    async function runCompilation() {
        const code = codeEditor.getValue();
        // FORCE READ LANGUAGE FROM DOM
        const currentLangDOM = document.getElementById('language-select').value;

        terminalOutput.textContent = "> Compilation & Execution en cours...";
        terminalOutput.style.color = '#8ab095';

        lastOutput = "";
        lastError = "";

        try {
            const response = await fetch(`${SERVER_URL}/compile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    code: code,
                    language: currentLangDOM
                })
            });
            const data = await response.json();
            lastOutput = data.output;
            if (!data.success) {
                lastError = "Erreur de compilation/Execution";
                terminalOutput.style.color = '#ff8080';
            } else {
                terminalOutput.style.color = '#e0fff0';
            }
            terminalOutput.textContent = lastOutput;

        } catch (e) {
            terminalOutput.textContent = "Erreur serveur : verifie node server.js (Et redémarre-le !)";
            terminalOutput.style.color = '#ff8080';
        }
    }

    document.getElementById('btn-compile')?.addEventListener('click', runCompilation);

    // --- CHAT SYSTEM LOGIC ---
    const chatHistory = document.getElementById('ai-chat-history');
    const btnSend = document.getElementById('btn-send-chat');

    // CURRENT CONVERSATION STATE
    let activeConversationId = null;

    // AUTO-GROW TEXTAREA (Strict Logic)
    userInput?.addEventListener('input', function () {
        this.style.height = 'auto'; // Reset
        const maxHeight = 120;
        const newHeight = Math.min(this.scrollHeight, maxHeight);

        this.style.height = newHeight + 'px';

        if (this.scrollHeight > maxHeight) {
            this.style.overflowY = 'auto'; // Show scrollbar ONLY when needed
        } else {
            this.style.overflowY = 'hidden';
        }
    });

    function appendMessage(html, isUser) {
        const div = document.createElement('div');
        div.className = isUser ? 'ai-msg ai-user' : 'ai-msg ai-system';
        div.innerHTML = html;
        chatHistory.appendChild(div);
        chatHistory.scrollTop = chatHistory.scrollHeight; // Auto-scroll to bottom

        // AUTO-SAVE LOGIC
        if (currentUser) {
            saveMessageToHistory(html, isUser);
        }
    }

    function saveMessageToHistory(html, isUser) {
        if (!currentUser.data.conversations) currentUser.data.conversations = [];

        // Find or Create Active Conversation
        let conv = currentUser.data.conversations.find(c => c.id === activeConversationId);
        if (!conv || !activeConversationId) {
            activeConversationId = Date.now().toString();
            conv = {
                id: activeConversationId,
                date: Date.now(),
                title: "Nouvelle Transmission",
                messages: []
            };
            currentUser.data.conversations.unshift(conv); // Add to top
        }

        // Add Message
        conv.messages.push({
            content: html,
            isUser: isUser,
            timestamp: Date.now()
        });

        // Update Title based on first user message if needed
        if (conv.messages.length === 1 && isUser) {
            conv.title = html.substring(0, 30) + "...";
        }

        // Sync
        syncData('conversations', currentUser.data.conversations);
    }

    async function processAiInteraction() {
        setPanelState(true);

        // AUTO-COMPILE ON SEND (So AI sees the result)
        await runCompilation();

        const txt = userInput.value.trim();
        const code = codeEditor.getValue();

        // FORCE READ LANGUAGE FROM DOM TO BE SURE
        const langSelectVal = document.getElementById('language-select').value;
        const langName = langSelectVal.toUpperCase();

        let finalPrompt = "";

        // CASE 1: USER ASKS SOMETHING
        if (txt) {
            appendMessage(txt, true);
            userInput.value = '';
            userInput.style.height = 'auto';

            finalPrompt = `
            L'utilisateur te dit : "${txt}"
            
             IMPORTANT !!! LE LANGAGE SÉLECTIONNÉ EST : *** ${langName} ***
            (Ignore tout code qui ressemble à du C, JS ou autre si ce n'est pas du ${langName})
            
            Code Actuel : \n${code}\n
            Résultat de l'exécution (Terminal) : \n${lastOutput || lastError || "Rien"}\n

            TES ORDRES :
            1. Réponds en JSON STRICT selon le format défini.
            2. Analyse les variables et la logique UNIQUEMENT pour le langage ${langName}.
            3. Si le code ressemble à du C mais que le langage est ${langName}, dis-lui qu'il s'est trompé de syntaxe !
            `;
        }
        // CASE 2: EMPTY INPUT -> ANALYZE
        else {
            appendMessage("Check mon code stp.", true);

            finalPrompt = `
             Analyse ce code : \n${code}\n
             
             IMPORTANT !!! LE LANGAGE SÉLECTIONNÉ EST : *** ${langName} ***
             (Si le code n'est pas du ${langName}, c'est une faute grave !)
             
             Résultat Terminal : \n${lastOutput || lastError || "Rien"}\n
             
             TES ORDRES :
             1. Réponds en JSON STRICT.
             2. Si le code est pourri (noms débiles, erreurs, mauvaise syntaxe pour ${langName}) -> Insulte-le.
             3. Si le code est bien -> Dis "C'est carré".
             4. VERIFIE L'INDENTATION et les deux-points ':' en Python.
             `;
        }

        // Show loading
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'ai-msg ai-system';
        loadingDiv.innerHTML = '<i class="fas fa-ellipsis-h fa-pulse"></i>';
        chatHistory.appendChild(loadingDiv);

        const systemPrompt = `
        Tu es "Le Chef". Pas d'emojis.
        CONTEXTE : L'utilisateur utilise l'éditeur configuré en : ${langName}.
        TOUTE RÉPONSE DOIT ÊTRE BASÉE SUR LA SYNTAXE ${langName}.
        
        STYLE : Argot de la street, agressif mais juste. Expert technique.
        RÈGLE D'OR : VARIE TES INSULTES. Ne répète jamais "C'est carré" ou "Massacré". Sois créatif.
        
        FORMAT REPONSE : JSON UNIQUEMENT.
        
        Structure JSON attendue :
        {
            "message": "Ton analyse principale (insultes ou félicitations)...",
            "errors": [
                { 
                    "line": 12, 
                    "msg": "Syntaxe invalide pour ${langName}", 
                    "explanation": "Petit cours pédagogique : En ${langName}, on ne met pas de point-virgule (ou autre règle spécifique). Tu confonds avec le C wesh." 
                }
            ]
        }
        
        Règles Erreurs :
        - 'msg' : L'erreur en bref.
        - 'explanation' : Un court paragraphe PÉDAGOGIQUE (2-3 phrases) qui explique la bonne syntaxe en ${langName}.
        - ATTENTION PYTHON : 
           - Regarde si la ligne 'def' ou 'if' ou 'for' se termine par ':'. Si OUI, alors ne dis JAMAIS "deux p-oints manquants".
           - Si les deux-points sont là, mais que la ligne suivante n'est pas décalée (indentée), alors l'erreur est "Indentation incorrecte".
           - Ne confonds pas les deux ! ':' présent = Indentation problème. ':' absent = Syntaxe problème.
        - Si pas d'erreurs : "errors" est [].
        `;

        try {
            const response = await fetch(MISTRAL_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
                body: JSON.stringify({
                    model: "mistral-small-latest",
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: finalPrompt }
                    ]
                })
            });

            chatHistory.removeChild(loadingDiv);
            const data = await response.json();
            let content = data.choices[0].message.content;

            // PARSE JSON
            let json = {};
            try {
                // Try to clean potential markdown wrappers
                content = content.replace(/```json/g, '').replace(/```/g, '').trim();
                json = JSON.parse(content);
            } catch (e) {
                // Fallback attempt: find first { and last }
                try {
                    const first = content.indexOf('{');
                    const last = content.lastIndexOf('}');
                    if (first >= 0 && last > first) {
                        json = JSON.parse(content.substring(first, last + 1));
                    } else {
                        throw new Error("No JSON found");
                    }
                } catch (z) {
                    json = { message: content, errors: [] };
                }
            }

            // RENDER MESSAGE
            appendMessage(json.message, false);

            // RENDER ERRORS
            if (json.errors && json.errors.length > 0) {
                const errDiv = document.createElement('div');
                errDiv.className = 'ai-msg ai-system';
                errDiv.style.borderColor = '#ff5555';
                errDiv.innerHTML = '<strong>ERREURS DÉTECTÉES (Clique pour comprendre):</strong><br>';

                json.errors.forEach(err => {
                    // Container for the error item
                    const item = document.createElement('div');
                    item.className = 'error-item'; // Class for easier styling if needed
                    item.style.marginTop = '8px';
                    item.style.padding = '8px';
                    item.style.cursor = 'pointer';
                    item.style.border = '1px solid rgba(255, 85, 85, 0.3)';
                    item.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
                    item.style.transition = 'all 0.2s';

                    // The Visible Error Message
                    const header = document.createElement('div');
                    header.innerHTML = `<span style="color:#ff5555; font-weight:bold;">Ligne ${err.line}:</span> ${err.msg} <i class="fas fa-chevron-down" style="float:right; opacity:0.7;"></i>`;
                    item.appendChild(header);

                    // The Hidden Explanation (Mini-Course)
                    const explanation = document.createElement('div');
                    explanation.className = 'ai-error-explanation';
                    explanation.style.display = 'none'; // Hidden by default
                    explanation.style.marginTop = '10px';
                    explanation.style.padding = '10px';
                    explanation.style.background = 'rgba(0,0,0,0.5)';
                    explanation.style.borderLeft = '2px solid #ff5555';
                    explanation.style.fontSize = '0.85rem';
                    explanation.style.color = '#e0fff0';
                    explanation.innerHTML = `<strong>LE COURS DU CHEF :</strong><br>${err.explanation || "Pas d'explication dispo, débrouille-toi."}`;
                    item.appendChild(explanation);

                    // CLICK INTERACTION: Toggle Explanation
                    item.addEventListener('click', (e) => {
                        // Prevent triggering if clicking inside the explanation itself (optional, but good UX)
                        // Actually, clicking anywhere on the item should toggle it for ease of use
                        const isVisible = explanation.style.display === 'block';
                        explanation.style.display = isVisible ? 'none' : 'block';
                        header.querySelector('.fa-chevron-down').style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
                    });

                    // HOVER INTERACTION: Highlight Code
                    item.addEventListener('mouseenter', () => {
                        const lineIdx = err.line - 1;
                        codeEditor.addLineClass(lineIdx, 'background', 'CodeMirror-selected');
                        // Optional: Scroll only if we really want to, might be annoying if toggling
                        // codeEditor.scrollIntoView({ line: lineIdx, ch: 0 }, 100); 
                    });

                    item.addEventListener('mouseleave', () => {
                        const lineIdx = err.line - 1;
                        codeEditor.removeLineClass(lineIdx, 'background', 'CodeMirror-selected');
                    });

                    errDiv.appendChild(item);
                });
                chatHistory.appendChild(errDiv);
                chatHistory.scrollTop = chatHistory.scrollHeight;
                // Track Stats: ERRORS
                if (currentUser) {
                    // We count distinct errors blocks, or just increment by 1 per bad response? 
                    // Let's count total errors found.
                    const errCount = json.errors.length;
                    if (errCount > 0) {
                        currentUser.data.stats.totalErrors = (currentUser.data.stats.totalErrors || 0) + errCount;
                        syncData('stats', currentUser.data.stats);
                    }
                }
            }

        } catch (e) {
            if (chatHistory.contains(loadingDiv)) chatHistory.removeChild(loadingDiv);
            appendMessage("Wesh le serveur est en PLS. " + e.message, false);
        }
    }

    btnSend?.addEventListener('click', processAiInteraction);

    userInput?.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            processAiInteraction();
        }
    });

    // --- ARCHIVES LOGIC (Chat History) ---
    const conversationsList = document.getElementById('conversations-list');

    function renderGogs() {
        // --- PROFILE POPULATION ---
        const content = document.getElementById('archives-content');
        const unauth = document.getElementById('gogs-unauth');
        const status = document.getElementById('user-status-gogs');

        // Elements to fill
        const pUser = document.getElementById('profile-username');
        const pEmail = document.getElementById('profile-email');
        const statLogins = document.getElementById('stat-questions'); // Remapped ID
        const statErrors = document.getElementById('stat-errors');
        const statLevel = document.getElementById('stat-level');

        if (!currentUser) {
            if (content) content.style.display = 'none';
            if (unauth) unauth.style.display = 'block';
            if (status) {
                status.textContent = "ACCÈS RESTREINT";
                status.style.color = '#e74c3c';
            }
            return;
        }

        // LOGGED IN
        if (content) content.style.display = 'block';
        if (unauth) unauth.style.display = 'none';
        if (status) {
            status.textContent = "FICHE SUSPECT - NIVEAU 1";
            status.style.color = '#2ecc71';
        }

        // Fill Data
        if (pUser) pUser.textContent = currentUser.username;
        if (pEmail) pEmail.textContent = currentUser.email;

        // Real Stats
        const stats = currentUser.data.stats || { questionsAnswered: 0, totalErrors: 0 };
        const totalQ = stats.questionsAnswered || 0;
        const totalErr = stats.totalErrors || 0;

        let errorRate = 0;
        if (totalQ > 0) {
            errorRate = Math.round((totalErr / totalQ) * 100);
        }

        // Rank Logic
        let rank = "FANTÔME";
        let rankColor = "#666";

        if (totalQ > 0) {
            if (totalQ < 5) {
                rank = "TOURISTE";
                rankColor = "#ccc";
            } else {
                if (errorRate > 80) { rank = "MERGUEZ"; rankColor = "#e74c3c"; }
                else if (errorRate > 60) { rank = "SCRATCH KIDO"; rankColor = "#e67e22"; }
                else if (errorRate > 40) { rank = "STAGIAIRE"; rankColor = "#f1c40f"; }
                else if (errorRate > 20) { rank = "DEV JUNIOR"; rankColor = "#3498db"; }
                else if (errorRate > 5) { rank = "SENIOR MATRIX"; rankColor = "#9b59b6"; }
                else { rank = "NEO (L'ÉLU)"; rankColor = "#2ecc71"; textShadow = "0 0 10px #2ecc71"; }
            }
        }

        if (statLogins) statLogins.textContent = totalQ; // Questions answered
        // Show Error Rate instead of raw count
        if (statErrors) {
            statErrors.textContent = totalQ > 0 ? `${errorRate}%` : "N/A";
            if (errorRate > 50) statErrors.style.color = "#e74c3c";
            else statErrors.style.color = "#2ecc71";
        }

        if (statLevel) {
            statLevel.textContent = rank;
            statLevel.style.color = rankColor;
            if (rank.includes("NEO")) statLevel.style.textShadow = "0 0 10px #2ecc71";
            else statLevel.style.textShadow = "none";
        }

        // --- SKILLS MATRIX ---
        const skillsContainer = document.getElementById('skills-list');
        const lStats = currentUser.data.stats.languages;

        if (skillsContainer) {
            skillsContainer.innerHTML = '';
            if (lStats && Object.keys(lStats).length > 0) {
                Object.keys(lStats).forEach(langKey => {
                    const lStat = lStats[langKey];
                    const ratio = lStat.total ? Math.round((lStat.success / lStat.total) * 100) : 0;
                    let color = '#2ecc71';
                    if (ratio < 50) color = '#e74c3c';
                    else if (ratio < 80) color = '#f1c40f';

                    const div = document.createElement('div');
                    div.style.marginBottom = '15px';

                    let themesHtml = '';
                    if (lStat.themes) {
                        Object.values(lStat.themes).forEach(t => {
                            const tRatio = t.total ? Math.round((t.success / t.total) * 100) : 0;
                            let tColor = '#2ecc71';
                            if (tRatio < 50) tColor = '#e74c3c';

                            themesHtml += `
                                <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:#8ab095; margin-top:3px; padding-left:10px; border-left:1px solid #333;">
                                    <span>${t.name}</span>
                                    <span style="color:${tColor}">${tRatio}% (${t.success}/${t.total})</span>
                                </div>
                             `;
                        });
                    }

                    div.innerHTML = `
                        <div style="display:flex; justify-content:space-between; font-size:0.9rem; margin-bottom:5px;">
                            <span style="font-weight:bold; color:#fff;">${langKey.toUpperCase()}</span>
                            <span style="color:${color}; font-family:'Share Tech Mono';">${ratio}%</span>
                        </div>
                        <div style="height:6px; background:#111; border-radius:3px; overflow:hidden; margin-bottom:5px;">
                            <div style="width:${ratio}%; height:100%; background:${color}; box-shadow: 0 0 10px ${color};"></div>
                        </div>
                        ${themesHtml}
                     `;
                    skillsContainer.appendChild(div);
                });
            } else {
                skillsContainer.innerHTML = '<em style="color:#666; font-size:0.8rem;">Aucune donnée de combat. Va charbonner.</em>';
            }
        }

        // --- CONVERSATIONS LIST (ARCHIVES) ---
        const conversationsList = document.getElementById('conversations-list');
        if (!conversationsList) return;
        conversationsList.innerHTML = '';

        const convs = currentUser.data?.conversations || [];

        if (convs.length === 0) {
            conversationsList.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">Ce suspect n\'a encore rien cassé.</div>';
            return;
        }

        convs.forEach(conv => {
            const div = document.createElement('div');
            div.className = 'conversation-item';

            // Stats
            const msgCount = conv.messages ? conv.messages.length : 0;

            div.innerHTML = `
                <span class="conv-date">${new Date(conv.date).toLocaleDateString()}</span>
                <span class="conv-preview">${conv.title || "Délit non nommé"}</span>
                <span class="conv-meta">${msgCount} PREUVES</span>
            `;

            div.addEventListener('click', () => {
                restoreConversation(conv);
            });

            conversationsList.appendChild(div);
        });
    }

    function restoreConversation(conv) {
        // Switch to editor
        switchView('view-editor');
        setPanelState(true); // Open chat

        // Restore ID
        activeConversationId = conv.id;

        // Render Messages
        chatHistory.innerHTML = '<div class="ai-msg ai-system">RESTAURATION DE LA TRANSMISSION...</div>';

        if (conv.messages) {
            conv.messages.forEach(m => {
                // Re-use logic but avoid double save (so we pass custom flag or just manually append)
                // Actually appendMessage saves... so we need a "silent" append or distinct function.
                // Simplest: just build HTML directly here.
                const div = document.createElement('div');
                div.className = m.isUser ? 'ai-msg ai-user' : 'ai-msg ai-system';
                div.innerHTML = m.content;
                chatHistory.appendChild(div);
            });
        }
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    // LISTENER FOR ARCHIVES VIEW
    document.querySelector('.nav-link[data-target="view-gogs"]')?.addEventListener('click', () => {
        if (currentUser) renderGogs();
    });

    // --- LOGOUT POPOVER LOGIC ---
    document.getElementById('btn-pop-yes')?.addEventListener('click', () => {
        logoutUser();
        document.getElementById('logout-popover').classList.remove('active');
    });

    document.getElementById('btn-pop-no')?.addEventListener('click', () => {
        document.getElementById('logout-popover').classList.remove('active');
    });

    // Close popover if clicking outside
    document.addEventListener('click', (e) => {
        const wrap = document.querySelector('.profile-nav-wrapper');
        if (wrap && !wrap.contains(e.target)) {
            document.getElementById('logout-popover')?.classList.remove('active');
        }
    });

    // Removed btn-login-gogs listener here as it's handled in top mapping


    // --- MUSCU SAVOIR: LOGIC ENGINE ---

    // 1. STATE & DATA
    const MUSCU_VIEWS = ['muscu-menu', 'muscu-quiz-setup', 'muscu-course-list', 'muscu-active-quiz', 'muscu-active-course'];

    // --- MOCK DATA: COURSES (UPGRADED) ---
    const COURSES_DB = [
        // --- C LANGUAGE (Hardware/Architecture) ---
        {
            id: 'c_basics', lang: 'c', title: "Variables & Mem",
            content: `
### Primitives & Mémoire
En C, tu parles direct au processeur. Pas de garbage collector pour nettoyer derrière toi.
Chaque variable a une taille fixe en mémoire.

\`\`\`c
char a = 'A'; // 1 octet (8 bits)
int b = 42;   // 4 octets (souvent)
float c = 3.14; // 4 octets (flottant)
double d = 3.14159; // 8 octets
\`\`\`

Si tu dépasse la taille (overflow), tu corromps la mémoire voisine. C'est comme ça qu'on hack.
            `,
            exercises: [
                { instruction: "Déclare un `int` nommé `age` à 25. Affiche-le avec printf.", baseCode: "#include <stdio.h>\n\nint main() {\n    // Code ici\n    \n    return 0;\n}" },
                { instruction: "Déclare un `char` nommé `grade` = 'A' et affiche-le.", baseCode: "#include <stdio.h>\n\nint main() {\n    // Code ici\n    return 0;\n}" },
                { instruction: "Crée deux floats `x` et `y` (3.5 et 2.5), affiche leur somme.", baseCode: "#include <stdio.h>\n\nint main() {\n    // Code ici\n    return 0;\n}" }
            ]
        },
        {
            id: 'c_pointers', lang: 'c', title: "Les Pointeurs",
            content: `
### Le Pouvoir Absolu
Une variable stocke une valeur. Un **pointeur** stocke l'adresse mémoire de cette variable.
C'est la base de tout en C.

- \`&\` : Donne l'adresse (Où ça habite ?)
- \`*\` : Donne la valeur à l'adresse (Qui habite ici ?)

\`\`\`c
int a = 10;
int *p = &a; // p contient l'adresse de a (ex: 0x7ffd...)
*p = 20;     // Je vais à l'adresse de p, et je mets 20.
// a vaut maintenant 20.
\`\`\`

Sans ça, pas de tableaux dynamiques, pas de structures complexes.
            `,
            exercises: [
                { instruction: "Crée `int x = 50`. Crée un pointeur `ptr` vers `x`. Modifie la valeur de `x` en passant UNIQUEMENT par `ptr` pour la mettre à 100.", baseCode: "#include <stdio.h>\n\nint main() {\n    int x = 50;\n    // Code ici\n    \n    return 0;\n}" },
                { instruction: "Affiche l'ADRESSE de `x` avec printf (`%p`).", baseCode: "#include <stdio.h>\n\nint main() {\n    int x = 10;\n    // Affiche &x\n    return 0;\n}" },
                { instruction: "Déclare un pointeur `p` qui pointe sur `NULL` (sécurité).", baseCode: "#include <stdio.h>\n\nint main() {\n    // Code ici\n    return 0;\n}" }
            ]
        },
        {
            id: 'c_malloc', lang: 'c', title: "Malloc/Free",
            content: `
### Allocation Dynamique
La stack (pile) c'est pour les variables locales rapides. Le heap (tas) c'est pour les grosses data.
\`malloc\` demande de la place au système. \`free\` la rend. Oublie \`free\` = Fuite mémoire.

\`\`\`c
int *arr = (int*)malloc(5 * sizeof(int)); // Tableau de 5 entiers
if (arr == NULL) exit(1); // Toujours vérifier si l'OS a dit oui

arr[0] = 10;
// ...
free(arr); // Indispensable !
\`\`\`
            `,
            exercises: [
                { instruction: "Alloue un tableau de 3 entiers avec malloc.", baseCode: "#include <stdlib.h>\n#include <stdio.h>\n\nint main() {\n    // Code ici\n    return 0;\n}" },
                { instruction: "Remplis ce tableau avec 10, 20, 30.", baseCode: "" },
                { instruction: "N'oublie pas de libérer la mémoire (free).", baseCode: "" }
            ]
        },

        // --- JAVASCRIPT (Web/Async) ---
        {
            id: 'js_dom', lang: 'javascript', title: "DOM Hacking",
            content: `
### Contrôler la Page
Le DOM (Document Object Model) c'est l'arbre HTML vu par JS.
Tu peux tout changer en temps réel.

\`\`\`javascript
const btn = document.getElementById('mon-bouton');
btn.style.backgroundColor = 'red';
btn.addEventListener('click', () => {
    alert('Touché !');
});
\`\`\`

C'est lent d'écrire dans le DOM, donc optimise tes accès.
            `,
            exercises: [
                { instruction: "Sélectionne l'élément avec l'id 'demo'.", baseCode: "// const el = ..." },
                { instruction: "Change son texte (`textContent`) pour dire 'HACKED'.", baseCode: "" },
                { instruction: "Change sa couleur en rouge (`style.color`).", baseCode: "" }
            ]
        },
        {
            id: 'js_async', lang: 'javascript', title: "Async/Await",
            content: `
### Ne pas bloquer le thread
JS est monothread. Si tu fais une boucle infinie, la page fige.
Pour le réseau ou les timers, on utilise l'asynchrone.

\`\`\`javascript
// Old school : Callbacks (L'enfer)
// Mid school : Promises (.then)
// New gen : Async/Await

async function getData() {
    try {
        const response = await fetch('https://api.com/users');
        const data = await response.json();
        console.log(data);
    } catch (e) {
        console.error("Erreur rézo", e);
    }
}
\`\`\`
            `,
            exercises: [
                { instruction: "Crée une fonction async `checkServer`.", baseCode: "async function checkServer() {\n}" },
                { instruction: "Dans cette fonction, attends 2 secondes (mock basic).", baseCode: "" },
                { instruction: "Retourne la chaine 'SERVER OK'.", baseCode: "" }
            ]
        },
        {
            id: 'js_closures', lang: 'javascript', title: "Closures",
            content: `
### Mémoire persistante
Une closure c'est une fonction qui se souvient des variables de son parent, même après que le parent ait fini.

\`\`\`javascript
function createCounter() {
    let count = 0; // Privé
    return function() {
        count++;
        return count;
    };
}

const c = createCounter();
console.log(c()); // 1
console.log(c()); // 2
\`\`\`
C'est la base de la data privacy en JS.
            `,
            exercises: [
                { instruction: "Crée une fonction `secretBox(secret)` qui retourne une fonction.", baseCode: "function secretBox(secret) {\n}" },
                { instruction: "La fonction retournée doit renvoyer le `secret`.", baseCode: "" },
                { instruction: "Teste avec `const b = secretBox('key'); b();`.", baseCode: "" }
            ]
        },

        // --- PYTHON (Data/Scripting) ---
        {
            id: 'py_lists', lang: 'python', title: "Listes & Slicing",
            content: `
### Manipulation de Données
Python est le roi des tableaux (Listes). Le **slicing** permet d'extraire des morceaux en une ligne.

Syntaxes : \`liste[début:fin:pas]\`

\`\`\`python
data = [0, 1, 2, 3, 4, 5]
print(data[0:3])  # [0, 1, 2] (3 exclu)
print(data[-1])   # 5 (Dernier)
print(data[::-1]) # [5, 4, 3, 2, 1, 0] (Reverse)
\`\`\`
            `,
            exercises: [
                { instruction: "On a `nums = [10, 20, 30, 40, 50]`. Récupère les 3 derniers éléments.", baseCode: "nums = [10, 20, 30, 40, 50]\n# res = ..." },
                { instruction: "Inverse la liste avec le slicing.", baseCode: "" },
                { instruction: "Récupère un élément sur deux.", baseCode: "" }
            ]
        },
        {
            id: 'py_classes', lang: 'python', title: "Classes & OOP",
            content: `
### Objets Python
Tout est objet en Python. \`self\` représente l'instance actuelle.

\`\`\`python
class Droid:
    def __init__(self, name):
        self.name = name
        self.battery = 100
    
    def hack(self):
        self.battery -= 10
        return "Hack en cours..."

r2 = Droid("R2D2")
print(r2.hack())
\`\`\`
            `,
            exercises: [
                { instruction: "Crée une classe `Soldat` avec attribut `vie` = 100.", baseCode: "class Soldat:\n    pass" },
                { instruction: "Ajoute une méthode `tirer()` qui print 'PAN'.", baseCode: "" },
                { instruction: "Instancie le soldat et fais-le tirer.", baseCode: "" }
            ]
        },
        {
            id: 'py_dict', lang: 'python', title: "Dictionnaires",
            content: `
### Hashmaps
Accès instantané via clé. C'est la structure la plus optimisée.

\`\`\`python
user = {
    "id": 42,
    "role": "admin",
    "skills": ["python", "c"]
}

# Accès
print(user["role"])

# Itération
for k, v in user.items():
    print(f"{k}: {v}")
\`\`\`
            `,
            exercises: [
                { instruction: "Crée un dico `stock` avec 'pomme': 10.", baseCode: "stock = {}" },
                { instruction: "Ajoute 'poire': 5.", baseCode: "" },
                { instruction: "Modifie 'pomme' pour ajouter +2.", baseCode: "" }
            ]
        },

        // --- JAVA (Enterprise/Strong Types) ---
        {
            id: 'java_class', lang: 'java', title: "Classes & Objets",
            content: `
### Le Monde Objet
Java est strictement orienté objet. Tout code vit dans une classe.
Le point d'entrée est \`public static void main\`.

\`\`\`java
public class Matrix {
    private int stability;

    public Matrix(int s) {
        this.stability = s;
    }

    public void glitch() {
        this.stability -= 10;
        System.out.println("Glitch detected.");
    }
}
\`\`\`
            `,
            exercises: [
                { instruction: "Crée une classe `Box`.", baseCode: "class Box {\n}" },
                { instruction: "Ajoute un attribut privé `items` (int).", baseCode: "" },
                { instruction: "Ajoute un getter `getItems()`.", baseCode: "" }
            ]
        },
        {
            id: 'java_inherit', lang: 'java', title: "Héritage",
            content: `
### Ne pas se répéter (DRY)
Une classe peut hériter d'une autre (\`extends\`).

\`\`\`java
class Enemy {
    void attack() { System.out.println("Bam"); }
}

class Boss extends Enemy {
    @Override
    void attack() { 
        System.out.println("BOOOOM (Gros dégâts)"); 
    }
}

Enemy e = new Boss();
e.attack(); // Affiche BOOOOM
\`\`\`
            `,
            exercises: [
                { instruction: "Crée une classe `Animal`.", baseCode: "class Animal {}" },
                { instruction: "Crée `Chat` qui extends `Animal`.", baseCode: "" },
                { instruction: "Override une méthode `cri()` pour dire 'Miaou'.", baseCode: "" }
            ]
        },
        {
            id: 'java_streams', lang: 'java', title: "Streams",
            content: `
### Manipulation Moderne
Depuis Java 8, on utilise les Streams pour filtrer/mapper des collections comme un pro.

\`\`\`java
List<String> names = Arrays.asList("Neo", "Morpheus", "Trinity");

// Filtrer et afficher
names.stream()
    .filter(n -> n.startsWith("N"))
    .map(String::toUpperCase)
    .forEach(System.out::println);
\`\`\`
            `,
            exercises: [
                { instruction: "Crée une liste d'entiers 1, 2, 3, 4.", baseCode: "List<Integer> l =" },
                { instruction: "Filtre pour garder les pairs (x % 2 == 0).", baseCode: "" },
                { instruction: "Affiche le résultat.", baseCode: "" }
            ]
        },

        // --- PHP (Web Backend) ---
        {
            id: 'php_basics', lang: 'php', title: "Le Sale (Base)",
            content: `
### Le Dinosaure du Web
PHP propulse 80% du web. C'est sale mais ça marche.
Variables commencent par \`$\`. Tableaux associatifs (le coeur de PHP).

\`\`\`php
$nom = "Jean";
$data = [
    "user_id" => 12,
    "status" => "active"
];

echo "Salut " . $nom;
\`\`\`
            `,
            exercises: [
                { instruction: "Crée un tableau `$user` avec 'login' => 'admin'.", baseCode: "<?php\n\n// Code ici" },
                { instruction: "Affiche le login.", baseCode: "" },
                { instruction: "Change le login en 'root'.", baseCode: "" }
            ]
        },
        {
            id: 'php_pdo', lang: 'php', title: "PDO (Database)",
            content: `
### Parler à la DB
On utilise PDO (PHP Data Objects) pour éviter les injections SQL. JAMAIS de concaténation dans les requêtes.

\`\`\`php
$pdo = new PDO('mysql:host=localhost;dbname=test', 'root', '');
$stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
$stmt->execute([$email]);
$user = $stmt->fetch();
\`\`\`
            `,
            exercises: [
                { instruction: "Crée une instance PDO vers sqlite::memory:", baseCode: "<?php\n//" },
                { instruction: "Prépare un INSERT dans 'logs'.", baseCode: "" },
                { instruction: "Exécute avec un message sécurisé.", baseCode: "" }
            ]
        },
        {
            id: 'php_forms', lang: 'php', title: "Superglobales",
            content: `
### Recevoir de la data
PHP est né pour ça. \`$_GET\` et \`$_POST\` contiennent les données envoyées par le navigateur.

\`\`\`php
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = htmlspecialchars($_POST['email']); // Sécurité XSS
    // Traitement...
}
\`\`\`
            `,
            exercises: [
                { instruction: "Check si la méthode est POST.", baseCode: "<?php\n" },
                { instruction: "Récupère `$_POST['user']`.", baseCode: "" },
                { instruction: "Affiche-le avec htmlspecialchars.", baseCode: "" }
            ]
        }
    ];

    // MOCK DATA: STANDARD QUIZZES
    const QUIZ_DB = {
        'c': [
            { q: "En C, quelle est la taille de 'char' ?", opts: ["1 octet", "2 octets", "4 octets", "Ca dépend du climat"], a: 0 },
            { q: "Que signifie 'malloc' ?", opts: ["Memory Allocation", "Make ALL O-Complexity", "My Allocation", "Rien"], a: 0 }
        ],
        'javascript': [
            { q: "[] + [] = ?", opts: ["[]", "0", "undefined", "\"\" (String vide)"], a: 3 },
            { q: "NaN === NaN", opts: ["Vrai", "Faux", "Peut-être", "Kamoulox"], a: 1 }
        ],
        'python': [
            { q: "Comment tu fais une boucle ?", opts: ["for i in range(x)", "loop(x)", "foreach i", "tourne()"], a: 0 },
            { q: "Python est ?", opts: ["Compilé", "Interprété", "Cuit à la vapeur", "Un serpent"], a: 1 }
        ]
    };

    // 2. NAVIGATION HELPER
    function openMuscuView(viewId) {
        MUSCU_VIEWS.forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.style.display = 'none';
                el.classList.remove('active');
            }
        });
        const target = document.getElementById(viewId);
        if (target) {
            target.style.display = 'block';
            setTimeout(() => target.classList.add('active'), 50);

            // Render History if landing
            if (viewId === 'muscu-menu') renderHistory();
        }
    }

    // Breadcrumbs
    document.getElementById('muscu-breadcrumbs')?.addEventListener('click', () => {
        openMuscuView('muscu-menu');
    });

    // 3. MENU EVENTS
    document.getElementById('btn-mode-quiz')?.addEventListener('click', () => {
        openMuscuView('muscu-quiz-setup');
    });

    document.getElementById('btn-mode-cours')?.addEventListener('click', () => {
        renderCourseListUI();
        openMuscuView('muscu-course-list');
    });

    document.querySelectorAll('.btn-back-menu').forEach(btn => {
        btn.addEventListener('click', () => openMuscuView('muscu-menu'));
    });

    // 4. QUIZ LOGIC
    let currentQuizState = { questions: [], idx: 0, score: 0 };
    let loadedThemesData = null; // Cache for the current language's JSON

    // Helper: Shuffle array
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // Load Themes from JSON
    async function loadQuizThemes(lang) {
        const themeSelect = document.getElementById('quiz-theme-select');
        themeSelect.innerHTML = '<option value="all">Chargement...</option>';
        themeSelect.disabled = true;

        try {
            // Try fetch local JSON
            const res = await fetch(`data/questions/${lang}.json`);
            if (res.ok) {
                const data = await res.json();
                loadedThemesData = data;

                // Populate Select
                themeSelect.innerHTML = '<option value="all">TOUT (MÉLANGE EXPLOSIF)</option>';
                if (data.themes) {
                    data.themes.forEach(t => {
                        const opt = document.createElement('option');
                        opt.value = t.id;
                        opt.textContent = t.name.toUpperCase();
                        themeSelect.appendChild(opt);
                    });
                }
            } else {
                throw new Error("Pas de fichier JSON");
            }
        } catch (e) {
            console.error("ERREUR CHARGEMENT THEMES:", e);
            // DEBUG: Show alert to user to understand what's wrong
            alert("DEBUG: Erreur chargement thèmes: " + e.message + "\nCheck la console (F12) pour plus de détails.");

            loadedThemesData = null;
            themeSelect.innerHTML = '<option value="all">STANDARD (LIMITÉ) - ERREUR</option>';
        }
        themeSelect.disabled = false;
    }

    // Init Logic: Load default logic (C)
    loadQuizThemes('c');
    document.getElementById('quiz-lang-select')?.addEventListener('change', (e) => {
        loadQuizThemes(e.target.value);
    });

    // Quiz Options Select
    document.querySelectorAll('.btn-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const row = e.target.parentElement;
            row.querySelectorAll('.btn-option').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');

            // Show warning for AI
            if (e.target.dataset.type === 'ai') {
                const warningMsg = document.getElementById('ai-quiz-warning');

                if (!currentUser) {
                    // Not connected: BLOCKING WARNING
                    if (warningMsg) {
                        warningMsg.style.display = 'block';
                        warningMsg.innerHTML = '<i class="fas fa-times-circle"></i> STOP ! Connexion requise pour l\'IA.';
                        warningMsg.style.color = '#e74c3c'; // Red
                        warningMsg.style.borderColor = '#e74c3c';
                    }
                } else {
                    // Connected: INFO WARNING
                    if (warningMsg) {
                        warningMsg.style.display = 'block';
                        warningMsg.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Nécessite d\'être connecté pour analyser ton historique.';
                        warningMsg.style.color = '#f0ad4e'; // Original Orange
                        warningMsg.style.borderColor = 'transparent'; // Reset border if any
                    }
                }
            } else {
                document.getElementById('ai-quiz-warning').style.display = 'none';
            }
        });
    });

    document.getElementById('btn-start-quiz')?.addEventListener('click', async () => {
        const type = document.querySelector('#muscu-quiz-setup .btn-option.active')?.dataset.type;

        // NEW: Block start if AI selected and not connected
        if (type === 'ai' && !currentUser) {
            const warningMsg = document.getElementById('ai-quiz-warning');
            if (warningMsg) {
                // Shake effect or just highlight
                warningMsg.style.animation = 'none';
                warningMsg.offsetHeight; /* trigger reflow */
                warningMsg.style.animation = 'shake 0.5s';
            }
            return;
        }

        const lang = document.getElementById('quiz-lang-select').value;
        const themeId = document.getElementById('quiz-theme-select').value;
        const diff = document.getElementById('quiz-diff-select').value;
        const length = parseInt(document.getElementById('quiz-length-select').value);

        startQuiz(type, lang, themeId, diff, length);
    });

    async function startQuiz(type, lang, themeId, diff, length) {
        addToHistory('quizzes', `Quiz ${lang.toUpperCase()} (${diff})`);
        openMuscuView('muscu-active-quiz');
        const feedback = document.getElementById('quiz-feedback');
        feedback.style.display = 'none';
        document.getElementById('btn-next-question').style.display = 'none';

        // Hide Finish actions
        document.getElementById('quiz-actions').style.display = 'block';
        document.getElementById('quiz-finish-actions').style.display = 'none';
        document.getElementById('btn-quit-quiz').style.display = 'block';

        if (type === 'standard') {
            let questions = [];

            if (loadedThemesData && loadedThemesData.themes) {
                // Use Loaded JSON
                if (themeId === 'all') {
                    // Collect ALL questions with theme attribution
                    loadedThemesData.themes.forEach(t => {
                        const themeQs = t.questions.map(q => ({ ...q, themeId: t.id, themeName: t.name }));
                        questions = questions.concat(themeQs);
                    });
                } else {
                    // Specific Theme
                    const theme = loadedThemesData.themes.find(t => t.id === themeId);
                    if (theme) {
                        questions = theme.questions.map(q => ({ ...q, themeId: theme.id, themeName: theme.name }));
                    }
                }
            } else {
                // Fallback to hardcoded QUIZ_DB
                questions = QUIZ_DB[lang] || QUIZ_DB['c'];
            }

            // Shuffle
            questions = shuffleArray([...questions]);

            // Filter by Difficulty (Mock Logic for now - assume questions might have 'difficulty' field later)
            // If we had difficulty in JSON, we would filter here.
            // For now, we ignore 'diff' or just shuffle.

            // Slice by Length
            if (questions.length > length) questions = questions.slice(0, length);

            currentQuizState = { questions: questions, idx: 0, score: 0 };
            renderQuestion();
        } else {
            // IA QUIZ
            // ... existing IA logic (simplified for length) ...
            // For now we keep default IA logic but could inject 'length' in prompt
            document.getElementById('quiz-question-text').textContent = "L'IA analyse ton dossier (Génération)...";
            document.getElementById('quiz-options-list').innerHTML = "";
            document.getElementById('quiz-code-container').innerHTML = ""; // Clear IDE

            try {
                // Generate N questions
                const userHistory = localStorage.getItem('cqcd_chat_history_v1') || "Pas d'historique.";
                const prompt = `Génère ${length} questions de quiz QCM sur le langage ${lang}. 
                Niveau : ${diff === 'hard' ? 'DIFFICILE/EXPERT' : 'DÉBUTANT'}.
                Adapté à l'historique suivant : "${userHistory.substring(0, 500)}...".
                FORMAT JSON STRICT: [{"q":"Question", "code":"(optionnel)", "opts":["A","B","C","D"], "correct":index_0_3, "explanation":"Pourquoi..."], ...]`;

                const r = await fetch(MISTRAL_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
                    body: JSON.stringify({
                        model: "mistral-small-latest",
                        messages: [{ role: "user", content: prompt }]
                    })
                });

                const d = await r.json();
                let txt = d.choices[0].message.content;
                if (txt.includes('```json')) txt = txt.split('```json')[1].split('```')[0];
                const generatedQuestions = JSON.parse(txt);

                currentQuizState = { questions: generatedQuestions, idx: 0, score: 0 };
                renderQuestion();

            } catch (e) {
                alert("Erreur IA: " + e.message + ". Retour au standard.");
                openMuscuView('muscu-quiz-setup');
            }
        }
    }

    function renderQuestion() {
        const qData = currentQuizState.questions[currentQuizState.idx];
        if (!qData) {
            finishQuiz();
            return;
        }

        document.getElementById('quiz-progress').textContent = `QUESTION ${currentQuizState.idx + 1}/${currentQuizState.questions.length}`;
        document.getElementById('quiz-score').textContent = `SCORE: ${currentQuizState.score}`;

        // Handle BOTH formats (Old specific Q/Opts/A vs New Id/Question/Explanation/Options/Correct)
        const qText = qData.question || qData.q;
        const qOpts = qData.options || qData.opts;

        // SPLIT Question Text and Code
        document.getElementById('quiz-question-text').innerHTML = qData.question || qData.q;

        const codeContainer = document.getElementById('quiz-code-container');
        if (codeContainer) codeContainer.innerHTML = ''; // Clear prev

        // Render Code Block as Mini-IDE if present
        if (qData.code && qData.code.trim() !== "") {
            // Create container if not exists (it should exist in HTML, but we'll inject if missing)
            let container = codeContainer;
            if (!container) {
                container = document.createElement('div');
                container.id = 'quiz-code-container';
                container.className = 'quiz-code-box';
                document.getElementById('quiz-question-text').after(container);
            }

            const ta = document.createElement('textarea');
            container.appendChild(ta);

            // Get Lang
            const lang = document.getElementById('quiz-lang-select').value;
            let mode = 'text/x-csrc';
            if (lang === 'python') mode = 'python';
            if (lang === 'javascript') mode = 'javascript';
            if (lang === 'java') mode = 'text/x-java';
            if (lang === 'php') mode = 'application/x-httpd-php';

            const cm = CodeMirror.fromTextArea(ta, {
                mode: mode,
                theme: 'default', // We will override CSS
                readOnly: 'nocursor',
                lineNumbers: true,
                viewportMargin: Infinity
            });
            cm.setValue(qData.code);
            // Height Auto
            const height = qData.code.split('\n').length * 20 + 30;
            cm.setSize("100%", Math.min(height, 300) + "px");
        } else {
            if (codeContainer) codeContainer.style.display = 'none';
        }
        if (codeContainer && qData.code) codeContainer.style.display = 'block';

        const list = document.getElementById('quiz-options-list');
        list.innerHTML = '';

        qOpts.forEach((opt, i) => {
            const btn = document.createElement('button');
            btn.className = 'quiz-option-btn';
            btn.textContent = opt;
            btn.onclick = () => handleAnswer(i, btn);
            list.appendChild(btn);
        });

        // Render Explanation Box (Hidden)
        const feedback = document.getElementById('quiz-feedback');
        feedback.style.display = 'none';
        feedback.innerHTML = ''; // Clear prev content

        document.getElementById('btn-next-question').style.display = 'none';
    }

    function handleAnswer(selectedIndex, btnElement) {
        // Disable all
        document.querySelectorAll('.quiz-option-btn').forEach(b => b.style.pointerEvents = 'none');

        const qData = currentQuizState.questions[currentQuizState.idx];
        // Handle mixed formats
        const correctIdx = (qData.correct !== undefined) ? qData.correct : qData.a;
        const isCorrect = selectedIndex === correctIdx;
        const explanation = qData.explanation || "Pas d'explication. Cherche sur Google.";

        if (isCorrect) {
            btnElement.classList.add('correct');
            currentQuizState.score += 100;
            showQuizFeedback(true, "Bien joué bg.<br><br>" + explanation);
        } else {
            btnElement.classList.add('wrong');
            // Highlight correct one
            document.querySelectorAll('.quiz-option-btn')[correctIdx].classList.add('correct');
            showQuizFeedback(false, "T'es claqué au sol.<br><br>" + explanation);
        }

        // Track Stats: QUESTIONS ANSWERED (Accumulate in global object)
        if (currentUser) {
            if (!currentUser.data.stats) currentUser.data.stats = { questionsAnswered: 0, totalErrors: 0, languages: {} };

            // Increment global count
            currentUser.data.stats.questionsAnswered = (currentUser.data.stats.questionsAnswered || 0) + 1;

            if (!isCorrect) {
                currentUser.data.stats.totalErrors = (currentUser.data.stats.totalErrors || 0) + 1;
            }

            // Sync immediately
            syncData('stats', currentUser.data.stats);

            // Increment Language Specific Stats
            // We need to know which language we are playing. 
            // It's in document.getElementById('quiz-lang-select').value
            const lang = document.getElementById('quiz-lang-select').value;

            if (!currentUser.data.stats.languages) currentUser.data.stats.languages = {};
            if (!currentUser.data.stats.languages[lang]) currentUser.data.stats.languages[lang] = { success: 0, total: 0, themes: {} };

            // Lang Stats
            currentUser.data.stats.languages[lang].total++;
            if (isCorrect) currentUser.data.stats.languages[lang].success++;

            // Theme Stats
            const themeId = qData.themeId || "general";
            const themeName = qData.themeName || "Général";

            if (!currentUser.data.stats.languages[lang].themes[themeId]) {
                currentUser.data.stats.languages[lang].themes[themeId] = { success: 0, total: 0, name: themeName };
            }
            const tStats = currentUser.data.stats.languages[lang].themes[themeId];
            tStats.total++;
            if (isCorrect) tStats.success++;

            syncData('stats', currentUser.data.stats);
        }

        document.getElementById('quiz-score').textContent = `SCORE: ${currentQuizState.score}`;
        document.getElementById('btn-next-question').style.display = 'block';
    }

    function showQuizFeedback(isSuccess, msg) {
        const fb = document.getElementById('quiz-feedback');
        fb.style.display = 'block';
        fb.innerHTML = `<strong>${isSuccess ? 'SUCCÈS' : 'ÉCHEC'}</strong><br>${msg}`;
        fb.style.borderColor = isSuccess ? '#2ecc71' : '#e74c3c';
    }

    document.getElementById('btn-next-question')?.addEventListener('click', () => {
        currentQuizState.idx++;
        renderQuestion();
    });

    // --- QUIT MODAL LOGIC ---
    const modalQuit = document.getElementById('modal-quit');
    const btnQuitConfirm = document.getElementById('btn-quit-confirm');
    const btnQuitCancel = document.getElementById('btn-quit-cancel');

    document.getElementById('btn-quit-quiz')?.addEventListener('click', () => {
        if (modalQuit) modalQuit.classList.add('active');
    });

    btnQuitConfirm?.addEventListener('click', () => {
        if (modalQuit) modalQuit.classList.remove('active');
        openMuscuView('muscu-menu');
    });

    btnQuitCancel?.addEventListener('click', () => {
        if (modalQuit) modalQuit.classList.remove('active');
    });

    // Close modal on outside click
    modalQuit?.addEventListener('click', (e) => {
        if (e.target === modalQuit) modalQuit.classList.remove('active');
    });

    // Updated Finish Logic
    function finishQuiz() {
        document.getElementById('quiz-question-text').innerHTML = `
            <div style="text-align:center; animation:fadeIn 0.5s;">
                <h2 style="color:#e0fff0; margin-bottom:10px;">MISSION TERMINÉE</h2>
                <div style="font-size:3rem; color:${currentQuizState.score > 0 ? '#2ecc71' : '#e74c3c'}; margin:20px 0;">
                    ${currentQuizState.score} PTS
                </div>
                <p style="color:#8ab095;">Retourne au charbon ou va voir tes stats.</p>
            </div>
        `;
        document.getElementById('quiz-options-list').innerHTML = '';
        const codeContainer = document.getElementById('quiz-code-container');
        if (codeContainer) {
            codeContainer.innerHTML = '';
            codeContainer.style.display = 'none';
        }

        document.getElementById('quiz-feedback').style.display = 'none';

        // Show Actions
        document.getElementById('btn-next-question').style.display = 'none';
        document.getElementById('quiz-finish-actions').style.display = 'flex';
        document.getElementById('btn-quit-quiz').style.display = 'none';
    }

    // New Button Listeners
    document.getElementById('btn-quiz-back-menu')?.addEventListener('click', () => openMuscuView('muscu-menu'));
    document.getElementById('btn-quiz-gogs')?.addEventListener('click', () => {
        if (currentUser) {
            switchView('view-gogs');
        } else {
            alert("T'es pas connecté. Tes stats sont parties dans le néant.");
            openMuscuView('muscu-menu');
        }
    });


    // 5. COURSE LOGIC
    let courseEditors = {};

    function renderCourseListUI() {
        const container = document.getElementById('course-list-container');
        container.innerHTML = '';
        container.className = 'course-columns-wrapper';

        const langs = ['c', 'javascript', 'python', 'java', 'php'];
        const langNames = {
            'c': 'C (Guerrier)',
            'javascript': 'JS (Web)',
            'python': 'Py (Data)',
            'java': 'Java (Corpo)',
            'php': 'PHP (Old)'
        };

        langs.forEach(lang => {
            const col = document.createElement('div');
            col.className = 'course-column';

            const head = document.createElement('div');
            head.className = 'course-col-header';
            head.textContent = langNames[lang];
            head.title = langNames[lang];
            col.appendChild(head);

            const content = document.createElement('div');
            content.className = 'course-col-content';

            const courses = COURSES_DB.filter(c => c.lang === lang);

            if (courses.length === 0) {
                content.innerHTML = '<em style="color:#666; font-size:0.7rem;">Vide.</em>';
            } else {
                courses.forEach(c => {
                    const card = document.createElement('div');
                    card.className = 'course-card';
                    card.innerHTML = `
                        <h3 style="color:#e0fff0; margin-bottom:5px; font-size:0.8rem;">${c.title}</h3>
                        <p style="font-size:0.65rem; color:#8ab095;">XP: Lourd</p>
                    `;
                    card.onclick = () => startCourse(c);
                    content.appendChild(card);
                });
            }
            col.appendChild(content);
            container.appendChild(col);
        });
    }


    function startCourse(courseData) {
        window.scrollTo(0, 0);
        openMuscuView('muscu-active-course');
        addToHistory('courses', courseData.title);

        document.getElementById('course-title').textContent = courseData.title;

        // Better Markdown Parser logic for deep content
        let htmlContent = courseData.content
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/\n\n/g, '<br><br>') // Double newline = paragraph
            .replace(/### (.*)/g, '<h3>$1</h3>')
            .replace(/## (.*)/g, '<h2>$1</h2>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>')
            .replace(/```(\w+)([\s\S]*?)```/g, '<pre><code class="lang-$1">$2</code></pre>');

        document.getElementById('course-body').innerHTML = htmlContent;

        // NAVIGATION BUTTONS LOGIC
        // Filter peers (same language) to allow logical navigation
        const peerCourses = COURSES_DB.filter(c => c.lang === courseData.lang);
        const currentIndex = peerCourses.findIndex(c => c.id === courseData.id);

        const btnPrev = document.getElementById('btn-prev-chapter');
        const btnNext = document.getElementById('btn-next-chapter');

        if (btnPrev) {
            if (currentIndex > 0) {
                btnPrev.style.display = 'inline-block';
                btnPrev.onclick = () => startCourse(peerCourses[currentIndex - 1]);
            } else {
                btnPrev.style.display = 'none';
            }
        }

        if (btnNext) {
            if (currentIndex < peerCourses.length - 1) {
                btnNext.style.display = 'inline-block';
                btnNext.onclick = () => startCourse(peerCourses[currentIndex + 1]);
            } else {
                btnNext.style.display = 'none';
            }
        }

        // Clear previous editors
        courseEditors = {};
        const exArea = document.getElementById('course-exercise-area');
        exArea.innerHTML = ''; // Full Reset

        if (courseData.exercises && courseData.exercises.length > 0) {
            exArea.style.display = 'block';
            exArea.innerHTML = `
                <div class="laser-separator-container">
                    <div class="laser-line"></div>
                </div>
                <h3>EXERCICES PRATIQUES (${courseData.exercises.length})</h3>
            `;

            courseData.exercises.forEach((ex, idx) => {
                const exId = `ex-${courseData.id}-${idx}`;

                const wrapper = document.createElement('div');
                wrapper.className = 'exercise-wrapper';
                wrapper.style.marginBottom = '40px';
                wrapper.style.padding = '20px';
                wrapper.style.background = 'rgba(255,255,255,0.02)';
                wrapper.style.border = '1px solid #333';

                wrapper.innerHTML = `
                    <div class="mission-header" id="header-${exId}" style="cursor:pointer; padding:15px; background:rgba(255,255,255,0.05); border:1px solid #333; border-radius:4px; display:flex; align-items:center;">
                        <h4 style="color:#e0fff0; margin:0; flex:1;">Exercice ${idx + 1}</h4>
                        <span style="font-size:0.8rem; color:#888;">(Cliquer pour ouvrir)</span>
                    </div>
                    
                    <div id="content-${exId}" style="display:none; margin-top:10px; padding:20px; background:rgba(0,0,0,0.2); border:1px solid #444; border-radius:4px;">
                        <p style="color:#ccc; margin-bottom:15px; font-style:italic;">"${ex.instruction}"</p>
                        <div class="mini-ide-wrapper">
                            <textarea id="code-${exId}"></textarea>
                        </div>
                        <button class="btn-hero btn-submit-ex" data-exid="${exId}" style="margin-top:10px;">SOUMETTRE</button>
                        <div id="feedback-${exId}" class="terminal-box" style="display:none;"></div>
                    </div>
                `;
                exArea.appendChild(wrapper);

                // Init CodeMirror
                const ta = wrapper.querySelector(`#code-${exId}`);
                let mode = 'text/x-csrc';
                if (courseData.lang === 'python') mode = 'python';
                if (courseData.lang === 'javascript') mode = 'javascript';
                if (courseData.lang === 'java') mode = 'text/x-java';
                if (courseData.lang === 'php') mode = 'application/x-httpd-php';

                const cm = CodeMirror.fromTextArea(ta, {
                    mode: mode,
                    lineNumbers: true,
                    theme: 'default'
                });
                cm.setSize("100%", "200px");
                cm.setValue(ex.baseCode || "// Ton code ici");

                // Toggle Logic (Moved AFTER Init to access cm)
                const header = wrapper.querySelector(`#header-${exId}`);
                header.onclick = () => {
                    const content = document.getElementById(`content-${exId}`);
                    const isHidden = content.style.display === 'none';
                    content.style.display = isHidden ? 'block' : 'none';
                    header.style.background = isHidden ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)';

                    if (isHidden) {
                        setTimeout(() => cm.refresh(), 10);
                    }
                };

                // Store ref
                courseEditors[exId] = {
                    cm: cm,
                    instruction: ex.instruction,
                    solution: ex.solution // Optional: Hidden solution concept for later
                };
            });

            // Re-attach listeners for all buttons we just created
            document.querySelectorAll('.btn-submit-ex').forEach(btn => {
                btn.onclick = (e) => handleCourseSubmit(e.target.dataset.exid);
            });

        } else {
            exArea.style.display = 'none';
        }
    }

    async function handleCourseSubmit(exId) {
        if (!currentUser) { alert("Connecte-toi pour la correction !"); loginUser(); return; }

        const feedbackEl = document.getElementById(`feedback-${exId}`);
        feedbackEl.style.display = 'block';
        feedbackEl.textContent = "Analyse en cours...";
        feedbackEl.style.color = "#ccc";

        const editorData = courseEditors[exId];
        const code = editorData.cm.getValue();
        const instruction = editorData.instruction;

        const prompt = `
        Toi : Coach codeur du quartier ("Lezar"). T'es un monstre en code mais tu parles mal.
        Ton élève (le "noob") tente cet exo : "${instruction}"
        
        Son code :
        "${code}"
        
        Tâche : Corrige-le.
        1. Si c'est BON : Commence par "[SUCCES]" (obligatoire) puis lâche un "C'est carré" ou un "Propre" avec un ton fier mais arrogant.
        2. Si c'est FAUX : Commence par "[ECHEC]" (obligatoire). Insulte-le gentiment (ex: "T'es sérieux ?", "Miskine", "Wesh l'effort ??"). Explique comme à un teubé. Pas de solution directe.
        
        Style : Sarcasme, tutoiement, argot, emojis interdits par l'élève donc évite-les.
        `;

        try {
            const r = await fetch(MISTRAL_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
                body: JSON.stringify({
                    model: "mistral-small-latest",
                    messages: [{ role: "user", content: prompt }]
                })
            });
            const d = await r.json();
            const reply = d.choices[0].message.content;

            // Aesthetics formatting
            const cleanReply = reply.replace('[SUCCES]', '').replace('[ECHEC]', '');

            if (reply.includes('[SUCCES]')) {
                feedbackEl.className = 'terminal-box success-glitch';
                feedbackEl.innerHTML = `<i class="fas fa-check-circle" style="margin-right:10px;"></i>` + cleanReply.replace(/\n/g, '<br>');
                feedbackEl.style.color = "#2ecc71";
                feedbackEl.style.borderColor = "#2ecc71";
                feedbackEl.style.background = "rgba(46, 204, 113, 0.1)";
            } else {
                feedbackEl.className = 'terminal-box error-shake';
                feedbackEl.innerHTML = `<i class="fas fa-times-circle" style="margin-right:10px;"></i>` + cleanReply.replace(/\n/g, '<br>');
                feedbackEl.style.color = "#e74c3c";
                feedbackEl.style.borderColor = "#e74c3c";
                feedbackEl.style.background = "rgba(231, 76, 60, 0.1)";
            }

        } catch (e) {
            feedbackEl.textContent = "Erreur IA: " + e.message;
        }
    }

    document.getElementById('btn-quit-course')?.addEventListener('click', () => {
        openMuscuView('muscu-course-list');
    });

});

