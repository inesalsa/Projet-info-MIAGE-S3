document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURATION ---
    const API_KEY = "pfbO4KFP7TriMY3iZYm6mzRlfhFCmsQw";
    const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";
    const SERVER_URL = "http://localhost:3000";

    // --- STATE ---
    let currentUser = localStorage.getItem('cqcd_user') || null;
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
            const t = link.getAttribute('data-target');
            if (t) switchView(t);
        });
    });

    // --- BUTTONS MAPPING ---
    document.getElementById('btn-enter-now')?.addEventListener('click', () => switchView('view-editor'));
    document.getElementById('card-hack')?.addEventListener('click', () => switchView('view-editor'));
    document.getElementById('card-neo')?.addEventListener('click', () => switchView('view-gogs'));
    document.getElementById('btn-login')?.addEventListener('click', loginUser);
    document.getElementById('btn-profile')?.addEventListener('click', loginUser);

    function loginUser() {
        const name = prompt("Entre ton blaze (pseudo) :", currentUser || "");
        if (name) {
            currentUser = name;
            localStorage.setItem('cqcd_user', currentUser);
            alert(`Wesh ${currentUser}, bien ou quoi ?`);
            updateUserUI();
        }
    }

    function updateUserUI() {
        const status = document.getElementById('user-status');
        if (status && currentUser) status.textContent = `Connecté en tant que : ${currentUser}`;
        const btn = document.getElementById('btn-profile');
        if (btn && currentUser) btn.textContent = currentUser.toUpperCase();
    }
    updateUserUI();

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

    // --- GOGS LOGIC ---
    const gogsTimeline = document.getElementById('gogs-timeline-list');
    function renderGogs() {
        if (!gogsTimeline) return;
        gogsTimeline.innerHTML = '';
        const allCommits = JSON.parse(localStorage.getItem('cqcd_commits_v7') || '[]');
        if (allCommits.length === 0) {
            gogsTimeline.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">Aucune version.</div>';
            return;
        }
        allCommits.forEach(commit => {
            const div = document.createElement('div');
            div.className = 'feature-card';
            div.style.marginBottom = '20px';
            div.style.textAlign = 'left';
            div.style.border = '1px solid rgba(140,180,160,0.1)';
            div.innerHTML = `
                <h3 style="color:#e0fff0;">${commit.message}</h3>
                <p style="font-family:'Share Tech Mono'; font-size:0.7rem;">
                    <span style="color:#66cca0;">${commit.user || 'Anon'}</span> | 
                    ${new Date(commit.date).toLocaleString()}
                </p>
            `;
            div.addEventListener('click', () => {
                if (confirm("Revenir à cette version ?")) {
                    codeEditor.setValue(commit.code);
                    switchView('view-editor');
                }
            });
            gogsTimeline.appendChild(div);
        });
    }

    document.getElementById('btn-gogs-commit')?.addEventListener('click', () => {
        if (!currentUser) { alert("Connecte-toi d'abord !"); loginUser(); return; }
        const msg = prompt("Message du commit :");
        if (msg) {
            const commits = JSON.parse(localStorage.getItem('cqcd_commits_v7') || '[]');
            commits.unshift({
                hash: Math.random().toString(36).substring(2, 7).toUpperCase(),
                date: Date.now(),
                message: msg,
                user: currentUser,
                code: codeEditor.getValue()
            });
            localStorage.setItem('cqcd_commits_v7', JSON.stringify(commits));
            renderGogs();
        }
    });

    document.getElementById('btn-login-gogs')?.addEventListener('click', loginUser);

    // --- QUIZ (Minified) ---
    document.getElementById('btn-gen-quiz')?.addEventListener('click', async () => {
        const c = document.getElementById('quiz-container');
        c.style.display = 'block'; c.innerHTML = 'Chargement...';
        try {
            const r = await fetch(MISTRAL_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
                body: JSON.stringify({
                    model: "mistral-small-latest",
                    messages: [{ role: "user", content: `Génère un QCM ${currentLang} JSON: {question:"", options:[""], answer:0}` }]
                })
            });
            const d = await r.json();
            let txt = d.choices[0].message.content;
            if (txt.includes('```json')) txt = txt.split('```json')[1].split('```')[0];
            const q = JSON.parse(txt);
            c.innerHTML = `<h3 style="color:#e0fff0;">${q.question}</h3>` + q.options.map((o, i) => `<button class="btn-box" onclick="check(${i},${q.answer},this)">${o}</button>`).join('<br>');
        } catch (e) { c.innerHTML = "Erreur."; }
    });
    window.check = (i, a, b) => { b.style.background = i === a ? '#00ff41' : '#ff0000'; };

});
