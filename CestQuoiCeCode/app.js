document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURATION ---
    // --- CONFIGURATION ---
    const SERVER_URL = "http://localhost:3000";
    // Proxy URL (Key is now on server)
    const MISTRAL_URL = `${SERVER_URL}/ai-completion`;

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

        // VALIDATION STRICTE
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            status.textContent = "Mail invalide (Format: nom@domaine.com).";
            status.style.color = '#e74c3c';
            return;
        }
        if (pass.length < 6) {
            status.textContent = "Mdp trop court (Min 6 caractères).";
            status.style.color = '#e74c3c';
            return;
        }

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

        // CRITICAL FIX: RESET CONVERSATION STATE ON LOGIN
        activeConversationId = null;
        headerTitle.textContent = "BUREAU DU CHEF";
        updateNewChatBtnVisibility();
        chatHistory.innerHTML = '<div class="ai-msg ai-system">Wesh, t\'es connecté. On reprend les bonnes habitudes ?</div>';

        // CRITICAL FIX: RESET EDITOR STATE
        if (codeEditor) {
            codeEditor.setValue("// Session de " + user.username.toUpperCase() + "\n// Fais pas le malin, code proprement.\n");
            // Clear terminal too
            const term = document.getElementById('terminal-output');
            if (term) term.textContent = "_Nouveau départ.";
        }

        // Render UI
        updateUserUI();
        console.log("Logged in:", user);
    }

    function logoutUser() {
        currentUser = null;
        localStorage.removeItem('cqcd_session_user');

        // CRITICAL FIX: RESET CONVERSATION STATE ON LOGOUT
        activeConversationId = null;
        headerTitle.textContent = "BUREAU DU CHEF";
        updateNewChatBtnVisibility();
        chatHistory.innerHTML = '<div class="ai-msg ai-system">Tu veux quoi ? Pose ta question ou envoie du code, que je rigole.</div>';

        // CRITICAL FIX: RESET EDITOR STATE
        if (codeEditor) {
            codeEditor.setValue("// Mode Invité (Code non sauvegardé)\n// Connecte-toi pour ne pas tout perdre.\n");
            document.getElementById('language-select').value = 'c'; // Reset to default C
            const term = document.getElementById('terminal-output');
            if (term) term.textContent = "_Session fermée.";
        }

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

            // FILTRAGE INTELLIGENT DES ERREURS "NO MAIN" (POUR LES SNIPPETS)
            if (!data.success && (data.output.includes('WinMain') || data.output.includes('main undefined') || data.output.includes('entry point'))) {
                lastOutput = "[INFO] Code analysé comme un Snippet (Pas de main() détecté). Compilation ignorée.";
                lastError = "";
                terminalOutput.style.color = '#f1c40f'; // Orange/Yellow warn
            } else {
                lastOutput = data.output;
                if (!data.success) {
                    lastError = "Erreur de compilation/Execution";
                    terminalOutput.style.color = '#ff8080';
                } else {
                    terminalOutput.style.color = '#e0fff0';
                }
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

    // --- ARCHIVES / HISTORY UI ---
    const btnToggleArchives = document.getElementById('btn-toggle-archives');
    const sidebarArchives = document.getElementById('ai-archives-sidebar');
    const btnCloseArchives = document.getElementById('btn-close-archives');
    const containerArchives = document.getElementById('archives-list-container');
    const btnNewChatSide = document.getElementById('btn-new-chat-sidebar');
    const btnNewChatSmall = document.getElementById('btn-new-chat-small');
    const headerTitle = document.getElementById('ai-header-title');

    function toggleArchives(forceClose = false) {
        if (!sidebarArchives) return;
        if (forceClose) {
            sidebarArchives.classList.remove('open');
        } else {
            const isOpen = sidebarArchives.classList.contains('open');
            if (!isOpen) {
                renderArchives();
                sidebarArchives.classList.add('open');
            } else {
                sidebarArchives.classList.remove('open');
            }
        }
    }

    btnToggleArchives?.addEventListener('click', () => toggleArchives());
    btnCloseArchives?.addEventListener('click', () => toggleArchives(true));

    function startNewChat() {
        activeConversationId = null;
        chatHistory.innerHTML = `
             <div class="ai-msg ai-system">
                 Wesh ! Nouvelle session. Envoie la sauce.
            </div>`;
        if (headerTitle) headerTitle.textContent = "BUREAU DU CHEF";
        toggleArchives(true);
        updateNewChatBtnVisibility();
    }

    btnNewChatSide?.addEventListener('click', startNewChat);
    btnNewChatSmall?.addEventListener('click', startNewChat);

    function updateNewChatBtnVisibility() {
        if (btnNewChatSmall) {
            btnNewChatSmall.style.display = activeConversationId ? 'block' : 'none';
        }
    }

    // --- ARCHIVES RENDER LOGIC ---
    function renderArchives() {
        if (!currentUser) {
            containerArchives.innerHTML = `
                <div style="padding:20px; text-align:center; color:#888; font-size:0.8rem;">
                    <i class="fas fa-lock" style="font-size:1.5rem; margin-bottom:10px; color:#e74c3c;"></i><br>
                    Accès refusé.<br>
                    Connecte-toi pour sauvegarder tes dossiers.
                </div>`;
            return;
        }

        if (!currentUser.data.conversations || currentUser.data.conversations.length === 0) {
            containerArchives.innerHTML = '<div style="color:#666; text-align:center; padding:20px;">Aucune archive.</div>';
            return;
        }

        // CLEAR CONTAINER TO PREVENT DUPLICATION
        containerArchives.innerHTML = '';

        currentUser.data.conversations.forEach(conv => {
            const div = document.createElement('div');
            div.className = 'archive-item';
            if (conv.id === activeConversationId) div.classList.add('active');

            div.innerHTML = `
                <div class="archive-title">${conv.title || 'Sans titre'}</div>
                <div class="archive-date">${new Date(conv.date).toLocaleDateString()}</div>
                <div class="archive-actions">
                    <button class="archive-btn edit" title="Renommer"><i class="fas fa-pencil-alt"></i></button>
                    <button class="archive-btn delete" title="Supprimer"><i class="fas fa-trash"></i></button>
                </div>
            `;

            // Load Click
            div.addEventListener('click', (e) => {
                if (e.target.closest('.archive-btn')) return;
                if (conv.id === activeConversationId) return; // Prevent clicking current
                loadConversation(conv);
            });

            // Edit Click
            const btnEdit = div.querySelector('.edit');
            btnEdit.addEventListener('click', async () => {
                matrixPrompt("Nouveau titre pour ce dossier :", conv.title || "", async (newTitle) => {
                    if (newTitle) {
                        conv.title = newTitle;
                        await syncData('conversations', currentUser.data.conversations);
                        renderArchives();
                        if (conv.id === activeConversationId && headerTitle) headerTitle.textContent = newTitle.toUpperCase();
                    }
                }, "RENOMMER L'ARCHIVE");
            });

            // Delete Click
            const btnDel = div.querySelector('.delete');
            btnDel.addEventListener('click', () => {
                matrixConfirm("Supprimer définitivement cette conversation ?", async () => {
                    currentUser.data.conversations = currentUser.data.conversations.filter(c => c.id !== conv.id);
                    await syncData('conversations', currentUser.data.conversations);
                    renderArchives();
                    if (activeConversationId === conv.id) startNewChat();
                }, "SUPPRESSION D'ARCHIVE");
            });

            containerArchives.appendChild(div);
        });
    }

    function loadConversation(conv) {
        activeConversationId = conv.id;
        toggleArchives(true);
        if (headerTitle) headerTitle.textContent = (conv.title || "ARCHIVE").toUpperCase();
        updateNewChatBtnVisibility();

        chatHistory.innerHTML = '';
        conv.messages.forEach(msg => {
            appendMessageToUI(msg.content, msg.isUser, msg.rating);
            // Render Saved Errors
            if (msg.errors && msg.errors.length > 0) {
                renderAiErrors(msg.errors);
            }
        });
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    // NEW: Reusable Error Renderer
    function renderAiErrors(errors) {
        if (!errors || errors.length === 0) return;

        const errDiv = document.createElement('div');
        errDiv.className = 'ai-msg ai-system';
        errDiv.style.borderColor = '#ff5555';
        errDiv.innerHTML = '<strong>ERREURS DÉTECTÉES (Clique pour comprendre):</strong><br>';

        errors.forEach(err => {
            const item = document.createElement('div');
            item.className = 'error-item';
            item.style.marginTop = '8px';
            item.style.padding = '8px';
            item.style.cursor = 'pointer';
            item.style.border = '1px solid rgba(255, 85, 85, 0.3)';
            item.style.backgroundColor = 'rgba(255, 0, 0, 0.1)';
            item.style.transition = 'all 0.2s';

            const header = document.createElement('div');
            header.innerHTML = `<span style="color:#ff5555; font-weight:bold;">Ligne ${err.line}:</span> ${err.msg} <i class="fas fa-chevron-down" style="float:right; opacity:0.7;"></i>`;
            item.appendChild(header);

            const explanation = document.createElement('div');
            explanation.className = 'ai-error-explanation';
            explanation.style.display = 'none';
            explanation.style.marginTop = '10px';
            explanation.style.padding = '10px';
            explanation.style.background = 'rgba(0,0,0,0.5)';
            explanation.style.borderLeft = '2px solid #ff5555';
            explanation.style.fontSize = '0.85rem';
            explanation.style.color = '#e0fff0';
            explanation.innerHTML = `<strong>LE COURS DU CHEF :</strong><br>${err.explanation || "Pas d'explication dispo."}`;
            item.appendChild(explanation);

            item.addEventListener('click', () => {
                const isVisible = explanation.style.display === 'block';
                explanation.style.display = isVisible ? 'none' : 'block';
                header.querySelector('.fa-chevron-down').style.transform = isVisible ? 'rotate(0deg)' : 'rotate(180deg)';
            });

            // Hover effects on editor if simple line match
            item.addEventListener('mouseenter', () => {
                if (codeEditor) {
                    const lineIdx = err.line - 1;
                    codeEditor.addLineClass(lineIdx, 'background', 'CodeMirror-selected');
                }
            });

            item.addEventListener('mouseleave', () => {
                if (codeEditor) {
                    const lineIdx = err.line - 1;
                    codeEditor.removeLineClass(lineIdx, 'background', 'CodeMirror-selected');
                }
            });

            errDiv.appendChild(item);
        });
        chatHistory.appendChild(errDiv);
    }

    // AUTO-GROW TEXTAREA (Strict Logic)
    userInput?.addEventListener('input', function () {
        this.style.height = 'auto'; // Reset
        const maxHeight = 150; // Match CSS
        const newHeight = Math.min(this.scrollHeight, maxHeight);

        // If content is less than min-height, it stays at min-height (handled by CSS min-height mostly, but scrollHeight helps)
        if (newHeight < 40) {
            this.style.height = '40px';
        } else {
            this.style.height = newHeight + 'px';
        }

        if (this.scrollHeight > maxHeight) {
            this.style.overflowY = 'auto'; // Show scrollbar ONLY when needed
        } else {
            this.style.overflowY = 'hidden';
        }
    });

    function appendMessage(html, isUser) {
        appendMessageToUI(html, isUser, null); // New message = no rating yet
        // Save to DB
        if (currentUser) {
            saveMessageToHistory(html, isUser);
        }
    }

    function appendMessageToUI(html, isUser, currentRating) {
        const div = document.createElement('div');
        div.className = isUser ? 'ai-msg ai-user' : 'ai-msg ai-system';

        // Content
        const contentDiv = document.createElement('div');
        contentDiv.innerHTML = html;
        div.appendChild(contentDiv);

        // Actions (Only for AI)
        if (!isUser) {
            const actionsDiv = document.createElement('div');
            actionsDiv.className = 'ai-msg-actions';

            // Like
            const btnUp = document.createElement('button');
            btnUp.className = 'rate-btn ' + (currentRating === 'up' ? 'active' : '');
            btnUp.innerHTML = '<i class="fas fa-thumbs-up"></i>';
            btnUp.onclick = () => rateMessage(div, 'up');

            // Dislike
            const btnDown = document.createElement('button');
            btnDown.className = 'rate-btn dislike ' + (currentRating === 'down' ? 'active' : '');
            btnDown.innerHTML = '<i class="fas fa-thumbs-down"></i>';
            btnDown.onclick = () => rateMessage(div, 'down');

            actionsDiv.appendChild(btnUp);
            actionsDiv.appendChild(btnDown);
            div.appendChild(actionsDiv);
        }

        chatHistory.appendChild(div);
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    async function rateMessage(msgDiv, type) {
        // Visual Update
        const btns = msgDiv.querySelectorAll('.rate-btn');
        btns.forEach(b => b.classList.remove('active'));

        if (type === 'up') btns[0].classList.add('active');
        if (type === 'down') btns[1].classList.add('active');

        // Logic Update (Complex because we need to find WHICH message in the conversation array this is)
        if (currentUser && activeConversationId) {
            const conv = currentUser.data.conversations.find(c => c.id === activeConversationId);
            if (conv) {
                // Find message with same content (Risk of duplicates, but acceptable for MVP)
                const contentText = msgDiv.children[0].innerHTML;
                const msgObj = conv.messages.find(m => m.content === contentText && !m.isUser);
                if (msgObj) {
                    msgObj.rating = type;
                    await syncData('conversations', currentUser.data.conversations);
                }
            }
        }
    }

    function saveMessageToHistory(html, isUser, generatedTitle = null, errors = null) {
        if (!currentUser.data.conversations) currentUser.data.conversations = [];

        // Check if we need a NEW conversation (if activeId is null OR if user clicked New Chat)
        // Actually activeId is correctly managed by startNewChat().

        let conv = currentUser.data.conversations.find(c => c.id === activeConversationId);

        if (!conv || !activeConversationId) {
            // NEW CONVERSATION CREATION
            const newId = Date.now().toString();
            activeConversationId = newId;
            updateNewChatBtnVisibility();

            conv = {
                id: newId,
                date: Date.now(),
                title: generatedTitle || "Discussion...",
                codeSnapshot: codeEditor ? codeEditor.getValue() : "",
                messages: []
            };
            currentUser.data.conversations.unshift(conv);
        }

        // Update Title if provided and generic
        if (generatedTitle && (conv.title === "Discussion...")) {
            conv.title = generatedTitle;
            if (headerTitle) headerTitle.textContent = generatedTitle.toUpperCase();
        }

        conv.messages.push({
            content: html,
            isUser: isUser,
            rating: null, // New field
            errors: errors || null, // SAVE ERRORS
            timestamp: Date.now()
        });

        syncData('conversations', currentUser.data.conversations);

        // Refresh UI if open (Instant Update)
        if (sidebarArchives && sidebarArchives.classList.contains('open')) {
            renderArchives();
        }
    }


    async function processAiInteraction() {
        setPanelState(true);

        // CHECK CODE CONTENT
        const codeVal = codeEditor.getValue();
        const isCodeEmpty = !codeVal || codeVal.trim().length === 0;

        // AUTO-COMPILE ONLY IF CODE EXISTS (To avoid WinMain error)
        if (!isCodeEmpty) {
            await runCompilation();
        } else {
            terminalOutput.textContent = "_Pas de code = Pas de compilation (WinMain secure).";
            lastOutput = "";
            lastError = "";
        }

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

            // STRICT INSTRUCTION: ONLY IT
            finalPrompt = `
             [CONTEXTE CODE (${langName})]
             ${code}
             
             [TERMINAL RESULT]
             ${lastOutput || lastError || "Rien"}
             
             [USER MESSAGE]
             "${txt}"
             
             [ORDRES]
             1. Si l'utilisateur parle d'autre chose que du CODE/TECH/INFORMATIQUE -> Réponds : "J'suis pas ton psy. Parle code ou bouge." (En variant la formulation).
             2. Réponds en JSON STRICT.
             3. Analyse le code ET la question.
            `;
        }
        // CASE 2: EMPTY INPUT -> ANALYZE
        else {
            // JUST CHECK CODE
            appendMessage("Check mon code stp.", true);
            finalPrompt = `
             [CONTEXTE CODE (${langName})]
             ${isCodeEmpty ? "(VIDE - RIEN A ANALYSER. L'UTILISATEUR N'A RIEN ECRIT. PAS D'ERREURS TECHNIQUES POSSIBLES. JUSTE INSULTE LE.)" : code}
             
             [TERMINAL RESULT]
             ${lastOutput || lastError || "Rien"}
             
             [ORDRES]
             1. Analyse le code.
             2. Si le code est marqué (VIDE) : TU DOIS JUSTEDIRE QU'IL N'Y A RIEN ET L'INSULTER SUR SA PARESSE. N'INVENTE PAS D'ERREURS (Sauf si tu veux dire 'Erreur 404: Cerveau non trouvé').
             3. Réponds en JSON STRICT.
            `;
        }

        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'ai-msg ai-system';
        loadingDiv.innerHTML = '<i class="fas fa-ellipsis-h fa-pulse"></i>';
        chatHistory.appendChild(loadingDiv);

        // DYNAMIC CHAOS: RANDOM MOOD INJECTION (Fixing the repetition issue)
        const moods = [
            "HUMEUR : ENERVE (Marre des noobs)",
            "HUMEUR : FROID (Direct et méchant)",
            "HUMEUR : DÉSESPÉRÉ (Soupir long)",
            "HUMEUR : MOQUEUR (Rigole du code)",
            "HUMEUR : AGRESSIF (Cherche la bagarre)",
            "HUMEUR : DÉDAIGNEUX (Tu ne vaux rien)"
        ];
        const randomMood = moods[Math.floor(Math.random() * moods.length)];

        const systemPrompt = `
        Tu es "Le Chef". 
        STYLE : **Grand Frère du Quartier (Cité), Codeur de l'ombre, Toxique mais Expert.**
        Ton langage : **FULL ARGOT (Frérot, Claqué au sol, Éclaté, Dinguerie, La hess).**
        
        [PARAMÈTRE DE CHAOS ACTIVÉ]
        ${randomMood} -> ADAPTE TON TON A CELLE-CI. CHANGE DE VOCABULAIRE.
        
        RÈGLES D'OR (ANTI-BOUCLE & ANTI-PERROQUET) :
        1. **INTERDICTION DE RÉPÉTER UNE PHRASE** : Regarde l'historique de la conversation. Si tu as déjà dit "T'es en PLS", "Wesh" ou "T'es nul" récemment, TU N'AS PAS LE DROIT DE LE REDIRE. Trouve autre chose !
        2. **BAN LIST (MOTS INTERDITS CAR TROP UTILISÉS)** : N'utilise PLUS l'expression "En PLS" pour l'instant, tu l'as trop dite. Change de disque.
        3. **VARIE LES ATTAQUES** : Pioche dans cette liste ou INVENTE : 
           - "Mais c'est grave là...", 
           - "Oh le niveau de l'angoisse...", 
           - "J'ai mal à mon code...", 
           - "T'as codé ça avec des moufles ?", 
           - "Respecte-toi un peu...", 
           - "C'est criminel ce que tu fais...",
           - "Tu veux me tuer ou quoi ?".
        
        RÈGLES D'ANALYSE (CRITIQUE) :
        1. **CODE VIDE** : Varie l'insulte ! Ne dis jamais deux fois la même chose.
        2. **CODE VALIDE** : "Oklm, ça passe.", "Mouais, t'as eu de la chatte.", "C'est carré, pour une fois."
        3. **TITRES DES ERREURS** : **NOM TECHNIQUE** + **VANNE DE RUE**.
        4. **PÉDAGOGIE** : Explique la règle technique en parlant mal.
        5. **ANTI-HALLUCINATIONS (RÈGLES DU C)** :
        5. **ANTI-HALLUCINATIONS (RÈGLES DU C)** :
           - \`void fonction()\` : C'est **VALIDE**. Ce n'est PAS un type implicite.
           - \`void\` sans return : C'est **VALIDE**. Pas d'erreur "Fonction stérile".
           - **SNIPPET (Pas de main)** : Ne compte PAS ça comme une erreur.
           - **MANQUE DE BIBLIOTHÈQUES** : Idem, c'est pas grave pour un snippet.

        SCÉNARIOS SPÉCIFIQUES :
        - \`fonction()\` (sans nothing) -> FAUTE "Type Manquant (C'est la fête ?)".
        - \`int\` sans return -> FAUTE "Fonction Stérile (Et le return ?)".
        - \`printf\` sans include (SEULEMENT SI C'EST UN PROGRAMME COMPLET/MAIN) -> "Magie Noire".

        FORMAT JSON STRICT :
        {
            "message": "Ton avis global. (Si Pas d'erreur : Félicitations arrogantes. Si Erreurs : Massacrage.)",
            "errors": [ 
                { 
                    "line": 1, 
                    "msg": "NOM ERREUR + VANNE", 
                    "explanation": "POURQUOI + COMMENT CORRIGER." 
                } 
            ],
            "title": "Titre (court et drôle)",
            "remark": "Message bleu ici (ex: 'Pas de main, je juge la fonction seule'). Null si rien à signaler."
        }
        `;

        // BUILD CONTEXT
        let apiMessages = [];

        // DYNAMIC ANTI-REPETITION (Extract last AI messages)
        let forbiddenPhrases = [];
        if (currentUser && activeConversationId) {
            const conv = currentUser.data.conversations.find(c => c.id === activeConversationId);
            if (conv && conv.messages) {
                // Get last 10 messages
                const history = conv.messages.slice(-10);

                // Add to API messages
                history.forEach(m => {
                    apiMessages.push({
                        role: m.isUser ? "user" : "assistant",
                        content: m.content
                    });
                    // Capture AI messages for ban list
                    if (!m.isUser) {
                        // Extract just the main sentence to ban (approximate)
                        forbiddenPhrases.push(m.content.substring(0, 50) + "...");
                    }
                });
            }
        }

        // UPDATE SYSTEM PROMPT WITH BAN LIST
        let dynamicSystemPrompt = systemPrompt;
        if (forbiddenPhrases.length > 0) {
            // Increase ban window to last 10 phrases
            dynamicSystemPrompt += `\n\n[ATTENTION ROBOT - LISTE DES PHRASES INTERDITES (DÉJÀ DITES)] :\nTu as l'interdiction FORMELLE de réutiliser ces phrases exactes ou similaires :\n- ${forbiddenPhrases.slice(-10).join('\n- ')}\nSI TU RÉPÈTES, T'ES MORT.`;
        }

        // Prepend System Prompt
        apiMessages.unshift({ role: "system", content: dynamicSystemPrompt });

        // Add Current Prompt
        apiMessages.push({ role: "user", content: finalPrompt });

        try {
            const response = await fetch(MISTRAL_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: "mistral-small-latest",
                    messages: apiMessages
                })
            });

            chatHistory.removeChild(loadingDiv);
            const data = await response.json();
            let content = data.choices[0].message.content;

            // PARSE JSON
            let json = {};
            try {
                content = content.replace(/```json/g, '').replace(/```/g, '').trim();
                json = JSON.parse(content);
            } catch (e) {
                // Try salvage
                try {
                    const f = content.indexOf('{'); const l = content.lastIndexOf('}');
                    if (f >= 0) json = JSON.parse(content.substring(f, l + 1));
                    else throw new Error();
                } catch (z) {
                    json = { message: content, errors: [], title: null };
                }
            }

            // HANDLE REMARK (Blue Box)
            if (json.remark) {
                json.message += `<div class="ai-msg-remark"><strong>NOTE DU CHEF :</strong> ${json.remark}</div>`;
            }

            // Save & Render with Title Handling
            const detectedTitle = !activeConversationId && json.title ? json.title : null; // Only use title if new conv

            // Save FIRST
            if (currentUser) {
                saveMessageToHistory(json.message, false, detectedTitle, json.errors);
            }
            // Add UI (no rating yet)
            appendMessageToUI(json.message, false, null);

            // RENDER ERRORS
            renderAiErrors(json.errors);

            chatHistory.scrollTop = chatHistory.scrollHeight;

        } catch (e) {
            if (loadingDiv && chatHistory.contains(loadingDiv)) chatHistory.removeChild(loadingDiv);
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
                <span class="conv-meta">
                    <button class="archive-btn edit" title="Renommer" style="margin-right:5px; border:none; background:none; color:#2ecc71; cursor:pointer;"><i class="fas fa-pencil-alt"></i></button>
                    <button class="archive-btn delete" title="Supprimer" style="border:none; background:none; color:#e74c3c; cursor:pointer;"><i class="fas fa-trash"></i></button>
                </span>
            `;

            // Row Click (Open Conversation)
            div.addEventListener('click', (e) => {
                if (e.target.closest('.archive-btn')) return; // Ignore button clicks
                restoreConversation(conv);
            });

            // Edit Click
            const btnEdit = div.querySelector('.edit');
            btnEdit.addEventListener('click', async (e) => {
                e.stopPropagation();
                matrixPrompt("Nouveau titre pour ce dossier :", conv.title || "", async (newTitle) => {
                    if (newTitle) {
                        conv.title = newTitle;
                        await syncData('conversations', currentUser.data.conversations);
                        renderGogs();
                    }
                }, "RENOMMER DOSSIER");
            });

            // Delete Click
            const btnDel = div.querySelector('.delete');
            btnDel.addEventListener('click', async (e) => {
                e.stopPropagation();
                matrixConfirm("Supprimer définitivement ce dossier criminel ?", async () => {
                    currentUser.data.conversations = currentUser.data.conversations.filter(c => c.id !== conv.id);
                    // DEDUPLICATION SAFETY
                    currentUser.data.conversations = [...new Map(currentUser.data.conversations.map(item => [item.id, item])).values()];

                    await syncData('conversations', currentUser.data.conversations);
                    renderGogs();
                    if (activeConversationId === conv.id) startNewChat();
                }, "DESTRUCTION DE PREUVES");
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
        if (currentUser) {
            renderGogs();
            if (typeof renderCommits === 'function') renderCommits();
        }
    });

    // --- MATRIX MODALS SYSTEM ---
    function matrixAlert(msg, title = "MESSAGE SYSTÈME") {
        const modal = document.getElementById('modal-matrix-alert');
        const txt = document.getElementById('matrix-alert-msg');
        const tit = document.getElementById('matrix-alert-title');
        const btn = document.getElementById('btn-matrix-alert-ok');

        if (modal && txt) {
            txt.textContent = msg;
            if (tit) tit.textContent = title;
            modal.classList.add('active');

            // One-time listener to close
            const close = () => {
                modal.classList.remove('active');
                btn.removeEventListener('click', close);
            };
            btn.addEventListener('click', close);
        } else {
            // Fallback if HTML is missing
            alert(msg);
        }
    }

    function matrixConfirm(msg, onYes, title = "VALIDATION") {
        const modal = document.getElementById('modal-matrix-confirm');
        const txt = document.getElementById('matrix-confirm-msg');
        const tit = document.getElementById('matrix-confirm-title');
        const btnYes = document.getElementById('btn-matrix-confirm-yes');
        const btnNo = document.getElementById('btn-matrix-confirm-no');

        if (modal && txt) {
            txt.textContent = msg;
            if (tit) tit.textContent = title;
            modal.classList.add('active');

            // Clean previous listeners via clone
            const newYes = btnYes.cloneNode(true);
            const newNo = btnNo.cloneNode(true);
            btnYes.parentNode.replaceChild(newYes, btnYes);
            btnNo.parentNode.replaceChild(newNo, btnNo);

            newYes.addEventListener('click', () => {
                modal.classList.remove('active');
                if (onYes) onYes();
            });

            newNo.addEventListener('click', () => {
                modal.classList.remove('active');
            });
        } else {
            if (confirm(msg)) onYes();
        }
    }

    function matrixPrompt(msg, defaultValue, onValid, title = "SAISIE REQUISE") {
        const modal = document.getElementById('modal-matrix-prompt');
        const txt = document.getElementById('matrix-prompt-msg');
        const tit = document.getElementById('matrix-prompt-title');
        const input = document.getElementById('matrix-prompt-input');
        const btnOk = document.getElementById('btn-matrix-prompt-ok');
        const btnCancel = document.getElementById('btn-matrix-prompt-cancel');

        if (modal && txt && input) {
            txt.textContent = msg;
            if (tit) tit.textContent = title;
            input.value = defaultValue;
            modal.classList.add('active');
            input.focus();

            // Clone to remove listeners
            const newOk = btnOk.cloneNode(true);
            const newCancel = btnCancel.cloneNode(true);
            btnOk.parentNode.replaceChild(newOk, btnOk);
            btnCancel.parentNode.replaceChild(newCancel, btnCancel);

            newOk.addEventListener('click', () => {
                const val = input.value.trim();
                modal.classList.remove('active');
                if (onValid) onValid(val);
            });

            newCancel.addEventListener('click', () => {
                modal.classList.remove('active');
            });

            // Allow Enter key
            input.onkeydown = (e) => {
                if (e.key === 'Enter') newOk.click();
            };

        } else {
            const result = prompt(msg, defaultValue);
            if (result !== null && onValid) onValid(result);
        }
    }

    // --- COMMIT SYSTEM LOGIC ---
    const btnCommit = document.getElementById('btn-commit');
    const modalCommit = document.getElementById('modal-commit');
    const btnCommitConfirm = document.getElementById('btn-commit-confirm');
    const btnCommitCancel = document.getElementById('btn-commit-cancel');
    const inputCommitMsg = document.getElementById('commit-message-input');

    btnCommit?.addEventListener('click', () => {
        if (!currentUser) {
            matrixAlert("Connecte-toi pour sauvegarder ton code !", "ACCÈS REFUSÉ");
            openAuthView();
            return;
        }
        if (modalCommit) {
            modalCommit.classList.add('active');
            inputCommitMsg.value = "";
            inputCommitMsg.focus();
        }
    });

    btnCommitCancel?.addEventListener('click', () => {
        modalCommit.classList.remove('active');
    });

    btnCommitConfirm?.addEventListener('click', async () => {
        const msg = inputCommitMsg.value.trim() || "Mise à jour sans nom";
        const code = codeEditor.getValue();
        const lang = document.getElementById('language-select').value;

        // Visual Feedback
        btnCommitConfirm.textContent = "PUSHING...";

        try {
            const res = await apiCall('/commit', {
                email: currentUser.email,
                code: code,
                lang: lang,
                message: msg
            });

            if (res.success) {
                // Update local user data
                if (!currentUser.data.commits) currentUser.data.commits = [];
                currentUser.data.commits.unshift(res.commit);
                localStorage.setItem('cqcd_session_user', JSON.stringify(currentUser));

                modalCommit.classList.remove('active');
                matrixAlert("Code archivé avec succès dans GOGS.", "COMMIT REUSSI");
                btnCommitConfirm.textContent = "COMMIT";
            } else {
                matrixAlert("Erreur: " + res.error, "ÉCHEC DU COMMIT");
                btnCommitConfirm.textContent = "COMMIT";
            }
        } catch (e) {
            matrixAlert("Erreur Serveur de type critique.", "ERREUR FATALE");
            btnCommitConfirm.textContent = "COMMIT";
        }
    });

    // --- RENDER COMMITS IN GOGS ---
    function renderCommits() {
        const commitContainer = document.getElementById('commits-list');
        if (!commitContainer) return;
        commitContainer.innerHTML = '';

        const commits = currentUser.data?.commits || [];

        if (commits.length === 0) {
            commitContainer.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">Aucun commit. Le repaire est vide.</div>';
            return;
        }

        commits.forEach(commit => {
            const div = document.createElement('div');
            div.className = 'conversation-item';
            div.style.borderLeft = '3px solid #2ecc71';

            div.innerHTML = `
                <span class="conv-date">${new Date(commit.timestamp).toLocaleDateString()} ${new Date(commit.timestamp).toLocaleTimeString()}</span>
                <span class="conv-preview" style="color:#fff;">[${commit.lang.toUpperCase()}] ${commit.message}</span>
                <span class="conv-meta">
                     <button class="archive-btn edit" title="Renommer" style="margin-right:5px; border:none; background:none; color:#2ecc71; cursor:pointer;"><i class="fas fa-pencil-alt"></i></button>
                     <button class="archive-btn delete" title="Supprimer" style="border:none; background:none; color:#e74c3c; cursor:pointer;"><i class="fas fa-trash"></i></button>
                </span>
            `;

            // Row Click (Restore)
            div.addEventListener('click', (e) => {
                if (e.target.closest('.archive-btn')) return;
                matrixConfirm("Restaurer cette version dans l'éditeur ? Ton code actuel sera écrasé.", () => {
                    switchView('view-editor');
                    codeEditor.setValue(commit.code);
                    document.getElementById('language-select').value = commit.lang;
                    codeEditor.setOption('mode', getCodeMirrorMode(commit.lang));
                    setTimeout(() => codeEditor.refresh(), 100);
                }, "RESTAURATION SYSTÈME");
            });

            // Edit Click (Rename Commit)
            const btnEdit = div.querySelector('.edit');
            btnEdit.addEventListener('click', (e) => {
                e.stopPropagation();
                matrixPrompt("Nouveau message pour ce commit :", commit.message, async (newMsg) => {
                    if (newMsg) {
                        commit.message = newMsg;
                        await syncData('commits', currentUser.data.commits);
                        renderCommits();
                    }
                }, "RENOMMER VERSION");
            });

            // Delete Click (Commit)
            const btnDel = div.querySelector('.delete');
            btnDel.addEventListener('click', (e) => {
                e.stopPropagation();
                matrixConfirm("Supprimer cette sauvegarde de code ?", async () => {
                    currentUser.data.commits = currentUser.data.commits.filter(c => c.id !== commit.id);
                    await syncData('commits', currentUser.data.commits);
                    renderCommits();
                }, "NETTOYAGE HISTORIQUE");
            });

            commitContainer.appendChild(div);
        });
    }

    // Helper for Mode
    function getCodeMirrorMode(lang) {
        if (lang === 'c') return 'text/x-csrc';
        if (lang === 'cpp') return 'text/x-c++src';
        if (lang === 'csharp') return 'text/x-csharp';
        if (lang === 'java') return 'text/x-java';
        if (lang === 'javascript') return 'javascript';
        if (lang === 'python') return 'python';
        if (lang === 'php') return 'php';
        return 'text/plain';
    }

    // --- LOGOUT POPOVER LOGIC ---
    document.getElementById('btn-pop-yes')?.addEventListener('click', () => {
        logoutUser();
        document.getElementById('logout-popover').classList.remove('active');

        // PRIVACY CLEANUP: CLEAR ALL USER DATA FROM UI IMMEDIATELY
        const hQ = document.getElementById('hist-quiz');
        const hC = document.getElementById('hist-cours');
        const archives = document.getElementById('archives-list-container');
        const convSelector = document.getElementById('quiz-conv-selector');

        if (hQ) hQ.innerHTML = '<em style="color:#444;">Connexion requise pour l\'historique.</em>';
        if (hC) hC.innerHTML = '<em style="color:#444;">Connexion requise pour l\'historique.</em>';
        if (archives) archives.innerHTML = ''; // Clear sidebar archives
        if (convSelector) convSelector.innerHTML = ''; // Clear quiz selector

        // Reset Quiz UI state if needed
        const warningMsg = document.getElementById('ai-quiz-warning');
        if (warningMsg) warningMsg.style.display = 'none';

        // Force refresh of current view if needed
        const activeSection = document.querySelector('.view-section.active');
        if (activeSection && activeSection.id === 'view-gogs') {
            // Hide private data in Gogs view
            document.getElementById('archives-content').style.display = 'none';
            document.getElementById('gogs-unauth').style.display = 'block';
        }
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
            id: 'c_basics', lang: 'c', title: "Le Bizness (Variables & RAM)",
            content: `
            <h3>WESH L'ÉQUIPE. C'EST L'HEURE DE PAYER.</h3>
            <p>Ici on est pas en Python, y'a pas de magie. Le C, c'est comme le cash : si tu le perds, personne te rembourse.</p>
            <p>Ton ordi c'est une cité. La RAM c'est les bâtiments. Chaque variable, c'est une planque.</p>

            <div class="laser-separator-container"><div class="laser-line"></div></div>

            <h3>1. CHOISIS TON SAC (Les Types)</h3>
            <p>Quand tu vas faire les courses, tu prends pas une valise pour acheter un paquet de chewing-gum. En C c'est pareil.</p>

            <div class="feature-card" style="margin:20px 0; background:rgba(0,50,0,0.3); border:1px solid #2ecc71;">
                <h4 style="color:#2ecc71;">int (L'Entier) = LA VALISE</h4>
                <p>Ça sert à stocker ce qui se compte. Les lovés, les jours, les ennemis.</p>
                <p><strong>Exemple :</strong> <code>int oseille = 500;</code></p>
                <p style="color:#e74c3c; font-size:0.8rem;">⚠️ Si tu mets 3 milliards dedans, la valise craque (Overflow) et tu te retrouves avec du négatif.</p>
            </div>

            <div class="feature-card" style="margin:20px 0; background:rgba(0,50,0,0.3); border:1px solid #3498db;">
                <h4 style="color:#3498db;">double (La Précision) = LE COFFRE</h4>
                <p>Pour les trucs précis. La monnaie, les pourcentages, la drogue (médur).</p>
                <p><strong>Exemple :</strong> <code>double prix = 12.50;</code></p>
            </div>

            <div class="feature-card" style="margin:20px 0; background:rgba(0,50,0,0.3); border:1px solid #f1c40f;">
                <h4 style="color:#f1c40f;">char (Le Caractère) = LE SACHET</h4>
                <p>Attention. C'est UNE SEULE lettre. Pas un texte. Juste une lettre.</p>
                <p><strong>Exemple :</strong> <code>char note = 'A';</code> (Regarde bien les guillemets simples !)</p>
            </div>

            <div class="laser-separator-container"><div class="laser-line"></div></div>

            <h3>2. LA RÈGLE DE LA RUE (Initialisation)</h3>
            <p>Écoute bien. Quand tu loues un appart (variable) en C, le proprio fait PAS le ménage.</p>
            <p>Si tu dis juste <code>int compte;</code>, dedans y'a les poubelles du locataire d'avant. Des chiffres chelous genre <em>41294812</em>.</p>
            <p><strong>SOLUTION :</strong> Tu nettoies en entrant.</p>
            <pre><code class="lang-c">int compte = 0; // Toujours. C'est carré.</code></pre>

            <div class="laser-separator-container"><div class="laser-line"></div></div>

            <h3>3. PARLER AU CLIENT (printf)</h3>
            <p>Pour afficher, faut donner le format. Le C ne devine rien.</p>
            
            <ul style="margin-left:20px; color:#8ab095;">
                <li style="margin-bottom:10px;">Tu veux afficher un <strong>int</strong> ? Utilise <code>%d</code> (Decimal).</li>
                <li style="margin-bottom:10px;">Tu veux afficher un <strong>double</strong> ? Utilise <code>%f</code> (Float).</li>
                <li style="margin-bottom:10px;">Tu veux afficher un <strong>char</strong> ? Utilise <code>%c</code> (Char).</li>
            </ul>

            <pre><code class="lang-c">int prix = 10;
printf("Ça fera %d euros chef.", prix);
// Ça affiche : Ça fera 10 euros chef.</code></pre>

            <div class="laser-separator-container"><div class="laser-line"></div></div>

            <h3>4. ARITHMÉTIQUE DE RUE (Le Modulo)</h3>
            <p>L'addition (+), tout le monde sait faire.</p>
            <p>Mais le vrai boss utilise le <strong>MODULO (%)</strong>. C'est le reste de la division.</p>
            <p><em>Exemple :</em> T'as 10 balles, le kebab est à 3 balles. Tu peux en acheter 3. Il te reste combien ?</p>
            <pre><code class="lang-c">int reste = 10 % 3; // reste vaut 1</code></pre>
            <p>Ça sert grave pour savoir si un nombre est pair (reste de /2 est 0) ou pour faire des tours.</p>
            `,
            exercises: [
                {
                    instruction: "Déclare ton bénef (double) et ton stock (int). Initialise-les. Affiche une phrase propre.",
                    baseCode: "#include <stdio.h>\n\nint main() {\n    // Code ici\n    return 0;\n}",
                    solution: "#include <stdio.h>\n\nint main() {\n    double benef = 150.50;\n    int stock = 100;\n    printf(\"Benef: %.2f, Stock: %d\", benef, stock);\n    return 0;\n}"
                },
                {
                    instruction: "Calculatrice de l'épicier : Tu as 50€ (int argent). Tu achètes 3 trucs à 12€ (int prix). Calcule ce qu'il reste dans 'argent'.",
                    baseCode: "#include <stdio.h>\n\nint main() {\n    int argent = 50;\n    int prix = 12;\n    // Fais le calcul\n    \n    return 0;\n}",
                    solution: "#include <stdio.h>\n\nint main() {\n    int argent = 50;\n    int prix = 12;\n    argent = argent - (3 * prix);\n    printf(\"Il reste %d balles\", argent);\n    return 0;\n}"
                },
                {
                    instruction: "Modulo : Vérifie si 97 est un nombre pair ou impair (utilise % 2). Affiche 0 ou 1.",
                    baseCode: "#include <stdio.h>\n\nint main() {\n    int x = 97;\n    printf(\"%d\", ...);\n    return 0;\n}",
                    solution: "#include <stdio.h>\n\nint main() {\n    int x = 97;\n    printf(\"%d\", x % 2); // Affiche 1 (Impair)\n    return 0;\n}"
                }
            ]
        },
        {
            id: 'c_pointers', lang: 'c', title: "Les Pointeurs (Le GPS)",
            content: `
            <h3>LE SUJET QUI FAIT BÉGAYER.</h3>
            <p>Respire un grand coup. C'est le boss final du niveau 1. Si tu comprends ça, t'es plus un touriste.</p>
            <p>Une variable classique, c'est une boîte. <strong>Un pointeur, c'est l'adresse de la boîte.</strong> C'est le GPS.</p>

            <div class="laser-separator-container"><div class="laser-line"></div></div>

            <h3>1. LES DEUX SYMBOLES MAGIQUES</h3>
            <p>En C, on joue avec deux trucs :</p>

            <div class="features-grid" style="gap:20px; margin:20px 0;">
                <div class="feature-card" style="background:rgba(0,50,0,0.3); border:1px solid #9b59b6;">
                    <h4 style="color:#9b59b6;">& (L'Adresse / "Où ?")</h4>
                    <p>Ça te donne la position GPS de la variable dans la RAM.</p>
                    <p><em>Exemple :</em> <code>&oseille</code> -> <code>0x7ffee4</code></p>
                </div>

                <div class="feature-card" style="background:rgba(0,50,0,0.3); border:1px solid #e67e22;">
                    <h4 style="color:#e67e22;">* (La Valeur / "Quoi ?")</h4>
                    <p>Ça dit : "Va à cette adresse et regarde ce qu'il y a dedans".</p>
                    <p><em>Exemple :</em> <code>*mon_gps</code> -> <code>500</code></p>
                </div>
            </div>

            <div class="laser-separator-container"><div class="laser-line"></div></div>

            <h3>2. LE BRAQUAGE (Modification à distance)</h3>
            <p>Pourquoi on se fait chier avec ça ? Pour modifier des variables <strong>à distance</strong>.</p>
            <p>Imagine tu veux changer la variable <code>coffre</code>, mais t'as pas le droit d'y toucher directement. Tu passes par son adresse.</p>

            <pre><code class="lang-c">int coffre = 1000;
int *braqueur = &coffre; // Le braqueur chope l'adresse

// Le braqueur va à l'adresse (*) et met 0
*braqueur = 0; 
// Maintenant coffre vaut 0. Braquage réussi.</code></pre>

            <div class="laser-separator-container"><div class="laser-line"></div></div>

            <h3>3. TABLEAUX = POINTEURS (Le Secret)</h3>
            <p>Quand tu crées un tableau <code>int tab[3]</code>, le nom <code>tab</code> est en fait un pointeur vers la première case.</p>
            <p>Si tu fais <code>*(tab + 1)</code>, tu avances d'une case et tu regardes dedans. C'est pareil que <code>tab[1]</code>.</p>
            `,
            exercises: [
                {
                    instruction: "Mission Espion : Crée `int target = 99`. Crée un pointeur sur `target`. Affiche l'adresse (avec %p) et la valeur (avec *).",
                    baseCode: "#include <stdio.h>\n\nint main() {\n    int target = 99;\n    // Code ici\n    \n    return 0;\n}",
                    solution: "#include <stdio.h>\n\nint main() {\n    int target = 99;\n    int *espion = &target;\n    printf(\"Adresse: %p, Valeur: %d\", espion, *espion);\n    return 0;\n}"
                },
                {
                    instruction: "Chirurgie : Tu as `int a = 10` et `int b = 20`. En utilisant un SEUL pointeur `p`, modifie `a` pour mettre 0, puis déplace le pointeur sur `b` et mets 0 aussi.",
                    baseCode: "#include <stdio.h>\n\nint main() {\n    int a = 10;\n    int b = 20;\n    int *p;\n\n    // Opère ici\n\n    printf(\"%d %d\", a, b); // Doit afficher 0 0\n    return 0;\n}",
                    solution: "#include <stdio.h>\n\nint main() {\n    int a = 10, b = 20;\n    int *p;\n    p = &a; *p = 0; // a vaut 0\n    p = &b; *p = 0; // b vaut 0\n    printf(\"%d %d\", a, b);\n    return 0;\n}"
                },
                {
                    instruction: "Le Tableau Caché : Déclare `int tab[] = {10, 20, 30}`. Affiche le 3ème élément (30) sans utiliser les crochets [], mais en utilisant l'arithmétique de pointeur (*(t + ...)).",
                    baseCode: "#include <stdio.h>\n\nint main() {\n    int tab[] = {10, 20, 30};\n    // Affiche 30 avec des étoiles *\n    return 0;\n}",
                    solution: "#include <stdio.h>\n\nint main() {\n    int tab[] = {10, 20, 30};\n    printf(\"%d\", *(tab + 2)); // 3eme element\n    return 0;\n}"
                }
            ]
        },
        {
            id: 'c_malloc', lang: 'c', title: "Malloc/Free (L'Immobilier)",
            content: `
            <h3>L'HÔTEL vs LE TERRAIN VAGUE</h3>
            <p>Jusqu'à maintenant, tes variables vivaient dans la <strong>STACK</strong> (Pile). C'est comme un hôtel : tu rentres (fonction), tu dors, tu sors, la chambre est nettoyée direct.</p>
            <p>Mais si tu veux construire un château qui reste là tout le temps ? Il te faut la <strong>HEAP</strong> (Le Tas).</p>

            <div class="laser-separator-container"><div class="laser-line"></div></div>

            <h3>1. MALLOC (Louer le terrain)</h3>
            <p><code>malloc</code> (Memory Allocation). Tu demandes au système : "Eh chef, file-moi 100 octets".</p>
            <p>Si le système est d'accord, il te file une adresse (un pointeur). Sinon il te file <code>NULL</code> (Rien).</p>

            <pre><code class="lang-c">#include <stdlib.h> // Obligatoire pour malloc

// Je veux stocker 10 entiers
int *liste = malloc(10 * sizeof(int));</code></pre>

            <h3>2. LA RÈGLE DE SURVIE</h3>
            <p style="color:#e74c3c;"><strong>TOUJOURS VÉRIFIER SI C'EST NULL.</strong></p>
            <p>Si ton PC est full RAM, malloc peut échouer. Si tu écris sur NULL, le programme crashe.</p>

            <div class="laser-separator-container"><div class="laser-line"></div></div>

            <h3>3. FREE (Rendre les clés)</h3>
            <p>Dans la Heap, y'a pas de femme de ménage. C'est TOI le concierge.</p>
            <p>Si tu ne libères pas la mémoire avec <code>free()</code>, elle reste occupée pour toujours (jusqu'au reboot).</p>
            <p>Ça s'appelle une <strong>Memory Leak</strong> (Fuite Mémoire). Chrome adore ça.</p>

            <div class="feature-card" style="margin:20px 0; border:1px solid #e74c3c; background:rgba(50,0,0,0.2);">
                 <h4 style="color:#e74c3c;">LE CYCLE DE VIE PROPRE</h4>
                 <ol style="list-style:none; padding:0; text-align:left;">
                    <li>1. <code>malloc</code> : Tu prends.</li>
                    <li>2. <code>if (p != NULL)</code> : Tu vérifies.</li>
                    <li>3. Tu utilises.</li>
                    <li>4. <code>free</code> : Tu rends.</li>
                 </ol>
            </div>
            `,
            exercises: [
                {
                    instruction: "Alloue dynamiquement un tableau de 5 entiers. Vérifie si malloc a réussi (pas NULL).",
                    baseCode: "#include <stdlib.h>\n\nint main() {\n    // Code ici\n    return 0;\n}",
                    solution: "#include <stdlib.h>\n#include <stdio.h>\n\nint main() {\n    int *tab = malloc(5 * sizeof(int));\n    if (tab == NULL) return 1;\n    free(tab);\n    return 0;\n}"
                },
                {
                    instruction: "Remplis ce tableau avec les chiffres 0, 10, 20, 30, 40 (boucle for).",
                    baseCode: "",
                    solution: "// Suite...\nfor(int i=0; i<5; i++) tab[i] = i * 10;"
                },
                {
                    instruction: "Affiche-les, et surtout : LIBÈRE LA MÉMOIRE (free) à la fin.",
                    baseCode: "",
                    solution: "// Suite...\nfor(int i=0; i<5; i++) printf(\"%d \", tab[i]);\nfree(tab); // LIBERTÉ !"
                }
            ]
        },



        // --- PYTHON (Data/Scripting) ---
        {
            id: 'py_lists', lang: 'python', title: "Listes & Slicing (Le Couteau Suisse)",
            content: `
            <h3>LE SQUELETTE FLEXIBLE DU PYTHON</h3>
            <p>En C, un tableau c'est rigide. En Python, une <strong>Liste</strong> c'est un sac magique. Tu mets ce que tu veux dedans, ça grandit tout seul.</p>

            <div class="laser-separator-container"><div class="laser-line"></div></div>

            <h3>1. LE SLICING (La Découpe chirurgicale)</h3>
            <p>C'est LA feature qui tue. Tu peux couper, inverser, extraire des morceaux de listes en une ligne de code.</p>
            <p>La syntaxe est simple : <code>liste[début : fin : pas]</code></p>

            <div class="features-grid" style="gap:20px; margin:20px 0;">
                <div class="feature-card" style="background:rgba(0,0,50,0.3); border:1px solid #3498db;">
                    <h4 style="color:#3498db;">[0:3]</h4>
                    <p>Prends du début jusqu'à l'index 3 (exclu). "Les 3 premiers".</p>
                </div>
                <div class="feature-card" style="background:rgba(0,0,50,0.3); border:1px solid #9b59b6;">
                    <h4 style="color:#9b59b6;">[-1]</h4>
                    <p>Prends le dernier élément. Pas besoin de connaître la taille.</p>
                </div>
                <div class="feature-card" style="background:rgba(0,0,50,0.3); border:1px solid #e74c3c;">
                    <h4 style="color:#e74c3c;">[::-1]</h4>
                    <p>Inverse toute la liste. Le classique des entretiens.</p>
                </div>
            </div>

            <pre><code class="lang-python">data = [0, 10, 20, 30, 40, 50]

print(data[1:4])   # [10, 20, 30]
print(data[::-1])  # [50, 40, 30, 20, 10, 0]
print(data[::2])   # [0, 20, 40] (Un sur deux)</code></pre>

            <div class="laser-separator-container"><div class="laser-line"></div></div>

            <h3>2. LES MÉTHODES UTILES</h3>
            <ul style="margin-left:20px; color:#8ab095;">
                <li style="margin-bottom:10px;"><code>.append(x)</code> : Ajoute à la fin.</li>
                <li style="margin-bottom:10px;"><code>.pop()</code> : Retire et renvoie le dernier.</li>
                <li style="margin-bottom:10px;"><code>len(liste)</code> : La taille.</li>
                <li style="margin-bottom:10px;"><code>x in liste</code> : Vérifie si x est dedans (True/False).</li>
            </ul>
            `,
            exercises: [
                {
                    instruction: "Le Sniper : On a `cibles = ['A', 'B', 'C', 'D', 'E']`. Affiche une liste contenant seulement 'C' et 'D' en utilisant le slicing.",
                    baseCode: "cibles = ['A', 'B', 'C', 'D', 'E']\n# tir = ...\nprint(tir)",
                    solution: "cibles = ['A', 'B', 'C', 'D', 'E']\ntir = cibles[2:4] # Index 2 inclus, 4 exclu\nprint(tir)"
                },
                {
                    instruction: "Miroir : Crée une liste avec les chiffres de 1 à 5. Affiche-la à l'envers.",
                    baseCode: "",
                    solution: "nums = [1, 2, 3, 4, 5]\nprint(nums[::-1])"
                },
                {
                    instruction: "Filtre Rapide : On a `valeurs = [10, 5, 20, 3, 30]`. Ajoute '100' à la fin, puis retire le dernier élément (pop) et affiche-le.",
                    baseCode: "valeurs = [10, 5, 20, 3, 30]\n# Code ici",
                    solution: "valeurs.append(100)\nprint(valeurs.pop())"
                }
            ]
        },
        {
            id: 'py_dict', lang: 'python', title: "Dictionnaires (Le Casier Judiciaire)",
            content: `
            <h3>LA MÉMOIRE INSTANTANÉE</h3>
            <p>Une liste c'est bien, mais si tu cherches "Toto", tu dois parcourir toute la liste. C'est lent.</p>
            <p>Le <strong>Dictionnaire</strong> (Hashmap), c'est l'accès direct. Tu donnes la CLÉ, tu as la VALEUR. Immédiatement.</p>

            <div class="laser-separator-container"><div class="laser-line"></div></div>

            <h3>1. STRUCTURE JSON-STYLE</h3>
            <p>Ça ressemble à du JSON. C'est des paires <code>Clé : Valeur</code>.</p>

            <pre><code class="lang-python">suspect = {
    "nom": "Keyser Söze",
    "flic": False,
    "kills": 42,
    "skills": ["Intimidation", "Manipulation"]
}</code></pre>

            <div class="features-grid" style="gap:20px; margin:20px 0;">
                <div class="feature-card" style="background:rgba(0,50,50,0.3); border:1px solid #1abc9c;">
                    <h4 style="color:#1abc9c;">ACCÈS (Lecture)</h4>
                    <p><code>print(suspect["nom"])</code></p>
                    <p>Renvoie "Keyser Söze".</p>
                </div>
                <div class="feature-card" style="background:rgba(50,50,0,0.3); border:1px solid #f39c12;">
                    <h4 style="color:#f39c12;">MODIF (Écriture)</h4>
                    <p><code>suspect["kills"] = 43</code></p>
                    <p>Met à jour instantanément.</p>
                </div>
            </div>

            <div class="laser-separator-container"><div class="laser-line"></div></div>

            <h3>2. ITERATION (La Fouille)</h3>
            <p>Tu peux parcourir les clés et les valeurs ensemble comme un pro.</p>
            <pre><code class="lang-python">for cle, valeur in suspect.items():
    print(f"L'info {cle} vaut {valeur}")</code></pre>
            `,
            exercises: [
                {
                    instruction: "Fiche Policière : Crée un dico `profil` avec 'alias': 'The Boss', 'wanted': True. Affiche l'alias.",
                    baseCode: "# Code ici",
                    solution: "profil = {'alias': 'The Boss', 'wanted': True}\nprint(profil['alias'])"
                },
                {
                    instruction: "Mise à Jour : Change la valeur de 'wanted' à False. Ajoute une nouvelle clé 'prime' avec la valeur 1000000.",
                    baseCode: "profil = {'alias': 'The Boss', 'wanted': True}\n# Code ici\nprint(profil)",
                    solution: "profil['wanted'] = False\nprofil['prime'] = 1000000\nprint(profil)"
                },
                {
                    instruction: "L'Inventaire : Tu as `sac = {'pomme': 2, 'épée': 1}`. Utilise une boucle for pour afficher tout ce qu'il y a dans le sac.",
                    baseCode: "sac = {'pomme': 2, 'épée': 1}\n# Boucle for...",
                    solution: "for item, qte in sac.items():\n    print(f\"{item}: {qte}\")"
                }
            ]
        },
        {
            id: 'py_classes', lang: 'python', title: "Classes & OOP (L'Usine à Robots)",
            content: `
            <h3>LE PLAN vs LE ROBOT</h3>
            <p>La Programmation Orientée Objet (OOP), c'est simple :</p>
            <ul style="margin-left:20px; color:#ccc;">
                <li>La <strong>CLASSE</strong> c'est le plan de construction (le blueprint). Il n'existe pas physiquement.</li>
                <li>L'<strong>OBJET</strong> (ou Instance) c'est le robot construit d'après le plan. Tu peux en faire 1000 différents.</li>
            </ul>

            <div class="laser-separator-container"><div class="laser-line"></div></div>

            <h3>1. LE SELF (C'est "Moi")</h3>
            <p>Dans une classe, le mot <code>self</code> désigne le robot actuel. Si R2D2 parle, <code>self</code> c'est R2D2. Si C3PO parle, <code>self</code> c'est C3PO.</p>

            <pre><code class="lang-python">class Robot:
    # Le Constructeur (La Naissance)
    def __init__(self, nom_donne):
        self.nom = nom_donne  # Je colle une étiquette sur MOI
        self.batterie = 100   # Je commence à fond

    def action(self):
        self.batterie -= 10
        return f"{self.nom} dit : Bip Boup. Batterie: {self.batterie}%"

# Fabrication
r1 = Robot("Terminator")
r2 = Robot("Wall-E")

print(r1.action()) # Terminator perd de la batterie
print(r2.action()) # Wall-E aussi, mais c'est SES variables à LUI</code></pre>

            <div class="feature-card" style="margin:20px 0; border:1px solid #3498db; background:rgba(0,0,50,0.3);">
                 <h4 style="color:#3498db;">POURQUOI FAIRE ?</h4>
                 <p>Pour organiser ton code. Au lieu d'avoir des variables <code>nom1</code>, <code>nom2</code>, <code>bat1</code>, <code>bat2</code> qui traînent partout, tout est rangé dans des objets.</p>
            </div>
            `,
            exercises: [
                {
                    instruction: "L'Usine : Crée une classe `Voiture`. Dans le `__init__`, elle prend une `marque`. Elle a aussi une variable `vitesse` à 0.",
                    baseCode: "class Voiture:\n    # Code ici\n    pass",
                    solution: "class Voiture:\n    def __init__(self, marque):\n        self.marque = marque\n        self.vitesse = 0"
                },
                {
                    instruction: "Accélération : Ajoute une méthode `accelerer()` qui augmente la vitesse de 10. Instancie une 'Ferrari' et fais-la accélérer 3 fois.",
                    baseCode: "",
                    solution: "class Voiture:\n    # ... (init) ...\n    def accelerer(self):\n        self.vitesse += 10\n\nf = Voiture('Ferrari')\nf.accelerer()\nf.accelerer()\nf.accelerer()"
                },
                {
                    instruction: "La Course : Crée deux voitures. Affiche la marque de celle qui va le plus vite (modifie leur vitesse manuellement).",
                    baseCode: "",
                    solution: "v1 = Voiture('Peugeot')\nv2 = Voiture('Bugatti')\nv2.vitesse = 400\nif v2.vitesse > v1.vitesse: print(v2.marque)"
                }
            ]
        },

        // --- JAVA (Enterprise/Strong Types) ---
        {
            id: 'java_class', lang: 'java', title: "Classes & Objets (L'Usine)",
            content: `
            <h3>BIENVENUE DANS LA CORPORATE LIFE</h3>
            <p>Java, c'est pas le marché noir. C'est l'industrie lourde. Tout est carré, sécurisé, et vérifié trois fois.</p>
            <p>Ici, une variable ne traîne pas dans la rue. Elle vit dans une <strong>CLASSE</strong>.</p>

            <div class="laser-separator-container"><div class="laser-line"></div></div>

            <h3>1. LE MOULE (La Classe)</h3>
            <p>Une Classe, c'est un plan d'usine. Ça ne fait rien tant que tu ne lances pas la prod.</p>
            <p>Un <strong>Objet</strong>, c'est le produit fini qui sort de l'usine.</p>

            <div class="features-grid" style="gap:20px; margin:20px 0;">
                <div class="feature-card" style="background:rgba(50,0,0,0.3); border:1px solid #e74c3c;">
                    <h4 style="color:#e74c3c;">private (Secret Défense)</h4>
                    <p>Personne ne touche. C'est les mécanismes internes de ta machine.</p>
                </div>
                <div class="feature-card" style="background:rgba(0,50,0,0.3); border:1px solid #2ecc71;">
                    <h4 style="color:#2ecc71;">public (La Vitrine)</h4>
                    <p>Tout le monde peut voir et utiliser. C'est les boutons de la machine.</p>
                </div>
            </div>

            <pre><code class="lang-java">public class CoffreFort {
    // Secret : Personne ne voit le code direct
    private int codeSecret; 

    // Constructeur : Lancé à la fabrication
    public CoffreFort(int code) {
        this.codeSecret = code;
    }

    // Méthode publique : Seule façon d'interagir
    public boolean ouvrir(int tentative) {
        return tentative == this.codeSecret;
    }
}</code></pre>

            <div class="laser-separator-container"><div class="laser-line"></div></div>

            <h3>2. L'ENCAPSULATION (La Sécurité)</h3>
            <p>En Java, on ne laisse pas les variables à l'air libre. On met des <strong>Getters</strong> (pour voir) et des <strong>Setters</strong> (pour modifier avec contrôle).</p>
            <p><em>Règle d'or :</em> Tes données sont privées. Tes méthodes sont publiques.</p>
            `,
            exercises: [
                {
                    instruction: "L'Usine : Crée une classe `CompteBancaire` avec un solde `private double solde`.",
                    baseCode: "public class CompteBancaire {\n    // Code ici\n}",
                    solution: "public class CompteBancaire {\n    private double solde;\n}"
                },
                {
                    instruction: "Le Guichet : Ajoute une méthode `public void depot(double montant)` qui ajoute l'argent au solde.",
                    baseCode: "",
                    solution: "public void depot(double m) {\n    this.solde += m;\n}"
                },
                {
                    instruction: "Le Client : Dans le `main`, crée un compte, dépose 100€, et essaie (si tu as fait un getter) d'afficher le solde.",
                    baseCode: "",
                    solution: "public static void main(String[] args) {\n    CompteBancaire c = new CompteBancaire();\n    c.depot(100);\n    // System.out.println(c.solde); // ERREUR (Private)\n}"
                }
            ]
        },
        {
            id: 'java_inherit', lang: 'java', title: "Héritage (La Dynastie)",
            content: `
            <h3>RESPECTE LA HIÉRARCHIE</h3>
            <p>Pourquoi réécrire le code ? Si le père a déjà bâti l'empire, le fils hérite de tout.</p>
            <p>C'est ça l'héritage : <code>extends</code>. Tu prends tout ce qu'a fait la classe parente, et tu ajoutes tes trucs en plus.</p>

            <div class="laser-separator-container"><div class="laser-line"></div></div>

            <h3>1. EXTENDS (L'Héritier)</h3>
            <p>Quand <code>Boss extends Enemy</code>, le Boss sait déjà tout faire ce que l'Enemy fait (attaquer, mourir...).</p>

            <pre><code class="lang-java">class Employe {
    void bosser() { System.out.println("Je tape au clavier..."); }
}

// Le Manager sait bosser, MAIS il sait aussi virer les gens
class Manager extends Employe {
    void virer() { System.out.println("T'es viré."); }
}</code></pre>

            <h3>2. OVERRIDE (La Rébellion)</h3>
            <p>Parfois, le fils veut faire différemment du père. On utilise <code>@Override</code>.</p>

            <pre><code class="lang-java">class Stagiaire extends Employe {
    @Override
    void bosser() {
        System.out.println("Je fais le café..."); // Il change le comportement
    }
}</code></pre>

            <div class="feature-card" style="margin:20px 0; border:1px solid #f1c40f; background:rgba(50,50,0,0.3);">
                 <h4 style="color:#f1c40f;">LE POLYMORPHISME (Le Caméléon)</h4>
                 <p>C'est magique : Un <code>Manager</code> EST un <code>Employe</code>. Tu peux le ranger dans une boîte "Employe", mais quand tu lui dis "bosse", il bossera comme un Manager.</p>
            </div>
            `,
            exercises: [
                {
                    instruction: "La Famille : Crée une classe `Vehicule` avec une méthode `bouger()` qui affiche 'Vroum'.",
                    baseCode: "class Vehicule {}",
                    solution: "class Vehicule {\n    void bouger() { System.out.println(\"Vroum\"); }\n}"
                },
                {
                    instruction: "L'Enfant : Crée une classe `Avion` qui extends `Vehicule`. Surcharge `bouger()` pour afficher 'Fioouuuu'.",
                    baseCode: "",
                    solution: "class Avion extends Vehicule {\n    @Override\n    void bouger() { System.out.println(\"Fioouuuu\"); }\n}"
                },
                {
                    instruction: "Le Test : Crée un `Avion`, mais stocke-le dans une variable de type `Vehicule`. Appelle `bouger()`. Que se passe-t-il ?",
                    baseCode: "Vehicule v = new Avion();\n// ...",
                    solution: "Vehicule v = new Avion();\nv.bouger(); // Affiche 'Fioouuuu' (Polymorphisme)"
                }
            ]
        },
        {
            id: 'java_streams', lang: 'java', title: "Streams (La Chaîne de Prod)",
            content: `
            <h3>L'INDUSTRIE 4.0</h3>
            <p>Avant Java 8, traiter des listes c'était l'enfer (boucles for, if, variables temporaires...).</p>
            <p>Maintenant, on a les <strong>STREAMS</strong>. C'est une chaîne de production automatisée.</p>
            
            <p style="text-align:center; font-weight:bold; color:#3498db;">SOURCE -> FILTRE -> TRANSFORMATION -> EMBALLAGE</p>

            <div class="laser-separator-container"><div class="laser-line"></div></div>

            <h3>1. LE PIPELINE</h3>
            <p>Tu branches les tuyaux et tu regardes les données couler.</p>

            <ul style="margin-left:20px; color:#8ab095;">
                <li style="margin-bottom:10px;"><code>.stream()</code> : Ouvre la vanne.</li>
                <li style="margin-bottom:10px;"><code>.filter(x -> condition)</code> : Le tri sélectif (Garde ce qui est True).</li>
                <li style="margin-bottom:10px;"><code>.map(x -> y)</code> : L'usine de transformation (Transforme x en y).</li>
                <li style="margin-bottom:10px;"><code>.collect(...)</code> : La mise en carton finale.</li>
            </ul>

            <pre><code class="lang-java">List<String> produits = Arrays.asList("Iphone", "Samsung", "Ipad", "Nokia");

// Je veux juste les produits Apple (Commence par 'I') en MAJUSCULES
produits.stream()
    .filter(p -> p.startsWith("I"))   // Garde Iphone, Ipad
    .map(p -> p.toUpperCase())        // IPHONE, IPAD
    .forEach(System.out::println);    // Affiche</code></pre>

            <div class="feature-card" style="margin:20px 0; border:1px solid #3498db; background:rgba(0,0,50,0.3);">
                 <h4 style="color:#3498db;">LAMBDA (La Flèche ->)</h4>
                 <p><code>p -> p.toUpperCase()</code> c'est une mini-fonction anonyme. "Pour chaque p, donne-moi le p majuscule". Rapide. Efficace.</p>
            </div>
            `,
            exercises: [
                {
                    instruction: "L'Inventaire : Crée une liste d'entiers : 10, 5, 20, 3, 100.",
                    baseCode: "List<Integer> prix = Arrays.asList(10, 5, 20, 3, 100);",
                    solution: "List<Integer> prix = Arrays.asList(10, 5, 20, 3, 100);"
                },
                {
                    instruction: "Le Tri : Utilise un stream pour garder uniquement les prix supérieurs à 10.",
                    baseCode: "",
                    solution: "prix.stream().filter(p -> p > 10).forEach(System.out::println);"
                },
                {
                    instruction: "La Solde : Applique une réduction de 50% sur le reste (.map) et affiche tout.",
                    baseCode: "",
                    solution: "prix.stream()\n    .filter(p -> p > 10)\n    .map(p -> p / 2)\n    .forEach(System.out::println);"
                }
            ]
        },


    ];

    // ROBUST DATABASE: HARDCODED QUESTIONS (FALLBACK OR PRIMARY)
    const QUIZ_DB = {
        'c': [
            // BASICS
            { q: "En C, comment déclare-t-on un pointeur ?", opts: ["int *ptr;", "int &ptr;", "pointer int;", "ptr -> int;"], a: 0, explanation: "L'étoile (*) désigne le pointeur. Le '&' c'est pour l'adresse." },
            { q: "Quelle est la taille d'un 'int' sur une architecture moderne standard ?", opts: ["2 octets", "4 octets", "8 octets", "Ça dépend de la météo"], a: 1, explanation: "Généralement 4 octets (32 bits), mais ça peut varier selon le CPU." },
            { q: "Que fait 'malloc(100)' ?", opts: ["Alloue 100 entiers", "Alloue 100 octets", "Libère 100 octets", "Plante le PC"], a: 1, explanation: "Malloc prend une taille en OCTETS. Pas en éléments." },
            { q: "Si t'oublies le ';', il se passe quoi ?", opts: ["Rien, le compilateur est sympa", "Le PC explose", "Erreur de compilation", "Warning uniquement"], a: 2, explanation: "En C, le point-virgule est non-négociable. C'est pas du Python ici." },
            { q: "Quel format pour afficher un entier décimal avec printf ?", opts: ["%f", "%s", "%d", "%x"], a: 2, explanation: "%d pour Decimal (ou %i)." },

            // POINTERS & ARRAYS
            { q: "int t[3] = {1, 2, 3}; Que vaut t[3] ?", opts: ["3", "0", "N'importe quoi (Undefined)", "Erreur Ségmentation"], a: 2, explanation: "C'est un débordement (Buffer Overflow). Les indices vont de 0 à 2. t[3] est hors limite." },
            { q: "Laquelle de ces boucles est infinie ?", opts: ["for(int i=0; i<10; i++)", "while(1)", "do {} while(0)", "if(1)"], a: 1, explanation: "while(1) est la boucle infinie canonique en C." },
            { q: "Comment libérer la mémoire allouée par malloc ?", opts: ["delete", "remove", "free", "oubli"], a: 2, explanation: "free() est la seule façon de rendre la RAM." },
            { q: "C'est quoi un 'SegFault' (Segmentation Fault) ?", opts: ["Un bug graphique", "Accès mémoire interdit", "Disque dur plein", "Erreur réseau"], a: 1, explanation: "Tu as essayé de toucher à une case mémoire qui ne t'appartient pas." },
            { q: "Quelle bibliothèque pour utiliser printf ?", opts: ["stdio.h", "stdlib.h", "string.h", "math.h"], a: 0, explanation: "Standard Input Output (stdio)." },

            // ADVANCED/FUN
            { q: "void *ptr; C'est quoi ?", opts: ["Un pointeur nul", "Un pointeur générique (sans type)", "Une erreur", "Un pointeur vers le vide"], a: 1, explanation: "C'est un pointeur universel. Il peut pointer vers n'importe quoi, mais faut le caster pour l'utiliser." },
            { q: "Que renvoie strcmp('a', 'a') ?", opts: ["1", "0", "-1", "True"], a: 1, explanation: "0 signifie 'aucune différence'. C'est contre-intuitif mais c'est comme ça." },
            { q: "Le C est un langage...", opts: ["Interprété", "Compilé", "JIT", "Scripté"], a: 1, explanation: "Tu écris, tu compiles (gcc), tu exécutes." },
            { q: "NULL, ça vaut combien en général ?", opts: ["0", "1", "-1", "NaN"], a: 0, explanation: "C'est juste un zéro déguisé en pointeur." },
            { q: "Dans 'char *s = \"Salut\";', où est stocké \"Salut\" ?", opts: ["Stack", "Heap", "Zone lecture seule (RO)", "Sur le disque"], a: 2, explanation: "C'est une littorale de chaîne. Si tu essaies de la modifier (s[0]='X'), ça crashe." },

            // CODE SNIPPETS
            { q: "int i=0; printf(\"%d\", i++); Affiche quoi ?", opts: ["0", "1", "Erreur", "Rien"], a: 0, explanation: "Post-incrément : on utilise la valeur (0) PUIS on incrémente." },
            { q: "int i=0; printf(\"%d\", ++i); Affiche quoi ?", opts: ["0", "1", "Erreur", "Rien"], a: 1, explanation: "Pré-incrément : on incrémente d'abord, PUIS on utilise." },
            { q: "char t[]=\"AB\"; printf(\"%d\", sizeof(t));", opts: ["2", "3", "4", "8"], a: 1, explanation: "A, B et \\0 (le fin de chaîne caché). Total = 3 octets." },
            { q: "if(a = 5) { printf(\"X\"); } else { printf(\"Y\"); }", opts: ["Affiche X", "Affiche Y", "Erreur Compil", "Crash"], a: 0, explanation: "Piège classique ! '=' est une affectation, pas une comparaison '=='. 5 est vrai, donc X." },
            { q: "#define CARRE(x) x*x \n printf(\"%d\", CARRE(2+2));", opts: ["16", "8", "6", "4"], a: 2, explanation: "Attention aux macros ! Ça fait 2+2*2+2 = 2+4+2 = 8. Il fallait des parenthèses." }
        ],

        'python': [
            { q: "Comment afficher 'Bonjour' ?", opts: ["echo 'Bonjour'", "printf('Bonjour')", "print('Bonjour')", "log('Bonjour')"], a: 2, explanation: "Simple. Basique." },
            { q: "Quelle structure utilise des paires Clé:Valeur ?", opts: ["Liste", "Tuple", "Dictionnaire", "Set"], a: 2, explanation: "Le dico (hashtable). {'clé': 'valeur'}." },
            { q: "Le dernier élément de liste L ?", opts: ["L[size]", "L[-1]", "L.last()", "L[end]"], a: 1, explanation: "L'index négatif -1 part de la fin." },
            { q: "Python est...", opts: ["Typé statiquement", "Typé dynamiquement", "Pas typé", "Typé par le Saint-Esprit"], a: 1, explanation: "Les types sont déterminés à l'exécution." },
            { q: "Pour définir une fonction ?", opts: ["func maFonction()", "function maFonction()", "def maFonction():", "void maFonction()"], a: 2, explanation: "def pour définition." },

            { q: "len([1,2,3]) renvoie ?", opts: ["2", "3", "4", "Error"], a: 1, explanation: "La longueur est 3." },
            { q: "Comment ajouter 'X' à la liste L ?", opts: ["L.add('X')", "L.push('X')", "L.append('X')", "L += 'X'"], a: 2, explanation: ".append() est la méthode standard." },
            { q: "Range(3) génère ?", opts: ["1, 2, 3", "0, 1, 2", "1, 2", "0, 1, 2, 3"], a: 1, explanation: "Ça part de 0 et ça s'arrête AVANT 3." },
            { q: "Les chaînes (str) sont...", opts: ["Modifiables (Mutable)", "Immuables (Immutable)", "Volatiles", "Liquides"], a: 1, explanation: "Tu ne peux pas changer un caractère d'une string existante. Faut en créer une nouvelle." },
            { q: "Quel mot-clé pour importer une lib ?", opts: ["include", "using", "import", "require"], a: 2, explanation: "import math, import random..." },

            { q: "C'est quoi un tuple ?", opts: ["Une liste immuable", "Une liste rapide", "Une erreur", "Un dictionnaire"], a: 0, explanation: "(1, 2) est un tuple. Tu ne peux pas le modifier après création." },
            { q: "Qui est le créateur de Python ?", opts: ["Guido van Rossum", "Linus Torvalds", "Bill Gates", "Le serpent Kaa"], a: 0, explanation: "Notre bienveillant dictateur à vie (BDFL)." },
            { q: "__init__ c'est quoi ?", opts: ["Une variable", "Le constructeur de classe", "Un module", "Une erreur"], a: 1, explanation: "La méthode lancée à la création d'un objet." },
            { q: "True + True ça fait ?", opts: ["True", "2", "Error", "False"], a: 1, explanation: "En Python, les booléens sont des sous-entiers. 1 + 1 = 2." },
            { q: "Pour commenter une ligne ?", opts: ["//", "/* */", "#", "--"], a: 2, explanation: "Le dièse #." },

            // CODE SNIPPETS
            { q: "L = [1, 2, 3]; L[10] = 5;", opts: ["L devient [1,2,3, ..., 5]", "L ne change pas", "IndexError", "L devient [5,2,3]"], a: 2, explanation: "Tu ne peux pas assigner un index qui n'existe pas. Faut utiliser .append()." },
            { q: "def f(x=[]): ...; C'est dangereux pourquoi ?", opts: ["Performance", "x est partagé entre les appels", "Crash système", "Syntax Error"], a: 1, explanation: "L'argument par défaut est créé UNE seule fois. Si tu modifies x, ça reste modifié pour le prochain appel." },
            { q: "print('A' * 3)", opts: ["AAA", "A3", "Error", "['A', 'A', 'A']"], a: 0, explanation: "Python permet de multiplier les chaînes. Pratique." },
            { q: "x = lambda a : a + 10; print(x(5))", opts: ["15", "5", "10", "Error"], a: 0, explanation: "Lambda est une fonction anonyme. 5 + 10 = 15." },
            { q: "[i for i in range(3)] donne ?", opts: ["[0, 1, 2]", "[1, 2, 3]", "(0, 1, 2)", "0 1 2"], a: 0, explanation: "C'est une List Comprehension. Très pythonique." }
        ],

        'java': [
            { q: "Point d'entrée d'un programme Java ?", opts: ["start()", "main()", "public static void main(String[] args)", "init()"], a: 2, explanation: "Faut la totale. Java ne rigole pas avec la signature." },
            { q: "Héritage : quel mot clé ?", opts: ["inherits", "extends", "implements", "super"], a: 1, explanation: "extends pour les classes, implements pour les interfaces." },
            { q: "int x = 5 / 2; Ça vaut ?", opts: ["2.5", "2", "3", "Erreur"], a: 1, explanation: "Division entière ! Les décimales passent à la trappe." },
            { q: "ArrayList vs Array ?", opts: ["Pareil", "ArrayList est redimensionnable", "Array est plus lent", "ArrayList n'existe pas"], a: 1, explanation: "L'array a une taille fixe. L'ArrayList grandit toute seule." },
            { q: "Le 'Garbage Collector' sert à...", opts: ["Ramasser les poubelles (Mémoire)", "Trier les fichiers", "Compter les points", "Nettoyer l'écran"], a: 0, explanation: "Il libère la RAM des objets orphelins automatiquement." },

            { q: "String s = 'A'; String t = 'A'; s == t ?", opts: ["Toujours Vrai", "Toujours Faux", "Ça dépend (Pool de String)", "Erreur"], a: 2, explanation: "Attention ! == compare les adresses mémoire. Utilise .equals() pour comparer le contenu." },
            { q: "private signifie...", opts: ["Visible par tout le monde", "Visible que dans la classe", "Visible par les héritiers", "Secret d'état"], a: 1, explanation: "Accès restreint à l'intérieur de la classe uniquement." },
            { q: "Comment convertir String '123' en int ?", opts: ["(int)'123'", "Integer.parseInt('123')", "Int('123')", "Cast('123')"], a: 1, explanation: "La classe Integer a des méthodes statiques pour ça." },
            { q: "Une Interface peut avoir des variables ?", opts: ["Oui", "Non", "Seulement des constantes (static final)", "Seulement private"], a: 2, explanation: "En Java, les variables d'interface sont forcément des constantes publiques." },
            { q: "NullPointerException, c'est quoi ?", opts: ["Une variable vaut null et tu l'utilises", "Un pointeur fou", "Une erreur système", "Un virus"], a: 0, explanation: "L'erreur la plus classique. T'essaies d'appeler une méthode sur un fantôme." },

            { q: "Le mot clé 'final' sur une variable ?", opts: ["Elle va mourir", "Elle est constante (immuable)", "C'est la dernière", "C'est privé"], a: 1, explanation: "On ne peut l'assigner qu'une seule fois." },
            { q: "Override signifie...", opts: ["Surcharger", "Écraser/Redéfinir", "Supprimer", "Ignorer"], a: 1, explanation: "On remplace la méthode du parent par la nôtre." },
            { q: "System.out.println() imprime où ?", opts: ["Imprimante", "Console (Sortie Standard)", "Fichier log", "Écran bleu"], a: 1, explanation: "Dans la console standard (stdout)." },
            { q: "Un 'boolean' peut valoir null ?", opts: ["Oui", "Non (C'est un type primitif)", "Seulement Boolean (Objet)", "Peut-être"], a: 1, explanation: "Le type primitif boolean est true ou false. Le wrapper Boolean peut être null." },
            { q: "Java est compilé en...", opts: ["Code Machine", "Bytecode", "Python", "Assembleur"], a: 1, explanation: "Bytecode, qui tourne ensuite dans la JVM." },

            // CODE SNIPPETS
            { q: "try { return 1; } finally { return 2; }", opts: ["Renvoie 1", "Renvoie 2", "Erreur Compil", "Renvoie 3"], a: 1, explanation: "Le bloc 'finally' gagne TOUJOURS. Il écrase le return du try." },
            { q: "String s = \"Java\"; s.concat(\"Script\"); System.out.println(s);", opts: ["JavaScript", "Java", "Script", "Erreur"], a: 1, explanation: "Les Strings sont IMMUABLES. s.concat() renvoie une NOUVELLE string mais ne modifie pas 's'." },
            { q: "int[] a = {1, 2}; int[] b = a; b[0] = 99; Que vaut a[0] ?", opts: ["1", "99", "2", "Erreur"], a: 1, explanation: "Les tableaux sont des OBJETS. a et b pointent vers le MÊME tableau en mémoire." },
            { q: "System.out.println(1 + 2 + \"A\");", opts: ["3A", "12A", "12", "Erreur"], a: 0, explanation: "De gauche à droite : 1+2 = 3, puis 3 + \"A\" = \"3A\"." },
            { q: "System.out.println(\"A\" + 1 + 2);", opts: ["A3", "A12", "Error", "12A"], a: 1, explanation: "De gauche à droite : \"A\" + 1 = \"A1\", puis \"A1\" + 2 = \"A12\". Concaténation l'emporte." }
        ]
    };

    // 2. NAVIGATION HELPER & HISTORY ENGINE

    // Fix: Ensure History logic exists and is user-scoped
    function addToHistory(type, title) {
        if (!currentUser) return;
        if (!currentUser.data) currentUser.data = {};
        if (!currentUser.data.history) currentUser.data.history = [];

        // Add new (Limit 5)
        currentUser.data.history.unshift({ type, title, date: new Date().toISOString() });
        if (currentUser.data.history.length > 5) currentUser.data.history.pop();

        // Sync
        if (typeof syncData === 'function') syncData('history', currentUser.data.history);
    }

    function renderHistory() {
        if (!currentUser) return;
        const hQ = document.getElementById('hist-quiz');
        const hC = document.getElementById('hist-cours');
        if (hQ) hQ.innerHTML = '';
        if (hC) hC.innerHTML = '';

        if (!currentUser.data) return;

        // CRITICAL FIX: Ensure history is an ARRAY. 
        if (!Array.isArray(currentUser.data.history)) {
            console.warn("History format mismatch (Expected Array). Resetting or migrating.");
            // Reset to empty array to prevent crash
            currentUser.data.history = [];
            syncData('history', currentUser.data.history);
        }

        if (currentUser.data.history.length === 0) {
            if (hQ) hQ.innerHTML = '<em style="color:#666;">Rien à signaler.</em>';
            if (hC) hC.innerHTML = '<em style="color:#666;">Rien à signaler.</em>';
            return;
        }

        currentUser.data.history.forEach(h => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.style.marginBottom = '8px';
            div.style.fontSize = '0.85rem';
            div.style.borderBottom = '1px dashed #333';
            div.style.paddingBottom = '4px';
            div.style.display = 'flex';
            div.style.alignItems = 'center';
            div.style.gap = '10px';

            let icon = h.type === 'quizzes' ? '<i class="fas fa-fist-raised" style="color:#e74c3c;"></i>' : '<i class="fas fa-book" style="color:#3498db;"></i>';
            div.innerHTML = `${icon} <span style="color:#ccc;">${h.title}</span>`;

            if (h.type === 'quizzes' && hQ) hQ.appendChild(div);
            if (h.type === 'courses' && hC) hC.appendChild(div);
        });
    }

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
            if (viewId === 'muscu-menu') {
                if (currentUser) {
                    renderHistory();
                } else {
                    // Clear if guest
                    const hQ = document.getElementById('hist-quiz');
                    const hC = document.getElementById('hist-cours');
                    if (hQ) hQ.innerHTML = '<em style="color:#444;">Connexion requise pour l\'historique.</em>';
                    if (hC) hC.innerHTML = '<em style="color:#444;">Connexion requise pour l\'historique.</em>';
                }
            }
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

            const type = e.target.dataset.type;
            const paramsStd = document.getElementById('quiz-params-std');
            const paramsAi = document.getElementById('quiz-params-ai');
            const warningMsg = document.getElementById('ai-quiz-warning');
            const btnStart = document.getElementById('btn-start-quiz');

            // Reset Warning
            if (warningMsg) warningMsg.style.display = 'none';

            if (type === 'ai') {
                // HIDE STD, SHOW AI
                if (paramsStd) paramsStd.style.display = 'none';
                if (paramsAi) paramsAi.style.display = 'block';

                if (!currentUser) {
                    // Not connected: BLOCKING WARNING
                    if (warningMsg) {
                        warningMsg.style.display = 'block';
                        warningMsg.innerHTML = '<i class="fas fa-times-circle"></i> STOP ! Connexion requise pour l\'IA.';
                        warningMsg.style.color = '#e74c3c';
                    }
                    if (btnStart) {
                        btnStart.disabled = true;
                        btnStart.style.opacity = "0.5";
                        btnStart.style.cursor = "not-allowed"; // Visual cue
                    }

                    // Clear selector to be sure
                    const convSelector = document.getElementById('quiz-conv-selector');
                    if (convSelector) convSelector.innerHTML = '<div style="color:#666; text-align:center; padding:10px;">(Données inaccessibles)</div>';

                } else {
                    // Connected: NO WARNING, JUST RENDER SELECTOR
                    if (btnStart) {
                        btnStart.disabled = false; // Will be re-evaluated by selector update
                        btnStart.style.opacity = "1";
                        btnStart.style.cursor = "pointer";
                    }
                    renderQuizConversationSelector();
                }
            } else {
                // SHOW STD, HIDE AI
                if (paramsStd) paramsStd.style.display = 'block';
                if (paramsAi) paramsAi.style.display = 'none';

                // Re-enable start
                if (btnStart) btnStart.disabled = false;
                if (btnStart) btnStart.style.opacity = "1";
            }
        });
    });

    function renderQuizConversationSelector() {
        const container = document.getElementById('quiz-conv-selector');
        const countSpan = document.getElementById('selected-conv-count');
        if (!container) return;

        container.innerHTML = '';
        if (countSpan) countSpan.textContent = '0';

        if (!currentUser || !currentUser.data.conversations || currentUser.data.conversations.length === 0) {
            container.innerHTML = `
                <div style="text-align:center; padding:20px; color:#e74c3c;">
                    <i class="fas fa-search-minus" style="font-size:2rem; margin-bottom:10px;"></i><br>
                    Aucune conversation trouvée.<br>
                    <span style="font-size:0.8rem; color:#888;">Va discuter dans le Bureau du Chef d'abord.</span>
                </div>`;
            // Disable start
            const btnStart = document.getElementById('btn-start-quiz');
            if (btnStart) { btnStart.disabled = true; btnStart.style.opacity = "0.5"; }
            return;
        }

        // Render List
        currentUser.data.conversations.forEach(conv => {
            const row = document.createElement('div');
            row.style.display = 'flex';
            row.style.alignItems = 'center';
            row.style.padding = '8px';
            row.style.borderBottom = '1px solid #333';
            row.style.cursor = 'pointer';
            row.style.transition = 'background 0.2s';

            // Hover effect logic handled by CSS usually, but inline for now
            row.onmouseover = () => row.style.background = 'rgba(255,255,255,0.05)';
            row.onmouseout = () => row.style.background = 'transparent';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'matrix-checkbox';
            checkbox.value = conv.id;
            checkbox.style.marginRight = '10px';

            // Click on row toggles checkbox
            row.addEventListener('click', (e) => {
                if (e.target !== checkbox) checkbox.checked = !checkbox.checked;
                updateSelectedCount();
            });
            checkbox.addEventListener('change', updateSelectedCount);

            const info = document.createElement('div');
            info.innerHTML = `
                <div style="color:#e0fff0; font-weight:bold; font-size:0.9rem;">${conv.title || 'Sans titre'}</div>
                <div style="color:#666; font-size:0.75rem;">${new Date(conv.date).toLocaleDateString()} - ${conv.messages.length} msgs</div>
            `;

            row.appendChild(checkbox);
            row.appendChild(info);
            container.appendChild(row);
        });
    }

    function updateSelectedCount() {
        const checkboxes = document.querySelectorAll('#quiz-conv-selector input[type="checkbox"]:checked');
        const countSpan = document.getElementById('selected-conv-count');
        const btnStart = document.getElementById('btn-start-quiz');

        if (countSpan) countSpan.textContent = checkboxes.length;

        // Disable start if 0 selected
        if (btnStart) {
            if (checkboxes.length === 0) {
                btnStart.disabled = true;
                btnStart.style.opacity = "0.5";
            } else {
                btnStart.disabled = false;
                btnStart.style.opacity = "1";
            }
        }
    }

    document.getElementById('btn-start-quiz')?.addEventListener('click', async () => {
        const type = document.querySelector('#muscu-quiz-setup .btn-option.active')?.dataset.type;

        // Block start if AI selected and not connected
        if (type === 'ai' && !currentUser) return;

        let lang = 'c';
        let themeId = 'all';
        let diff = 'all';
        let length = 20;
        let selectedConvIds = [];

        if (type === 'standard') {
            lang = document.getElementById('quiz-lang-select').value;
            themeId = document.getElementById('quiz-theme-select').value;
            diff = document.getElementById('quiz-diff-select').value;
            length = parseInt(document.getElementById('quiz-length-select').value);
        } else {
            // AI MODE
            lang = document.getElementById('quiz-ai-lang-select').value;
            // Get Selected Convs
            const checkboxes = document.querySelectorAll('#quiz-conv-selector input[type="checkbox"]:checked');
            checkboxes.forEach(cb => selectedConvIds.push(cb.value));
            length = 5; // Fixed for AI to avoid long generation times
        }

        startQuiz(type, lang, themeId, diff, length, selectedConvIds);
    });

    async function startQuiz(type, lang, themeId, diff, length, selectedConvIds = []) {
        addToHistory('quizzes', `Quiz ${lang.toUpperCase()} ${type === 'ai' ? '(MIJOTÉ)' : ''}`);
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
            }

            // FALLBACK / MERGE: If JSON failed or yielded 0 questions (or strangely few), USE HARDCODED DB
            // This ensures we NEVER show empty quizzes
            if (!questions || questions.length < 5) {
                console.warn("JSON Data missing or empty. Using HARDCODED DB for robustness.");
                const dbQuestions = QUIZ_DB[lang] || QUIZ_DB['c'];
                questions = questions.concat(dbQuestions);
            }

            // CLEANUP: Filter out bad objects
            questions = questions.filter(item => item && (item.q || item.question));

            if (questions.length === 0) {
                alert("ERREUR CRITIQUE: Aucune question disponible pour ce mode. Contacte le dev.");
                openMuscuView('muscu-menu');
                return;
            }

            // Shuffle
            questions = shuffleArray([...questions]);

            // Slice by Length
            // Slice by Length
            if (questions.length > length) questions = questions.slice(0, length);

            // INITIALIZE QUIZ STATE CRITICAL FIX
            currentQuizState = { questions: questions, idx: 0, score: 0 };
            console.log("Quiz Initialized with:", questions.length, "questions");

            // Render First Question Immediately
            renderQuestion();

        } else {
            // IA QUIZ (MIJOTÉ SUR MESURE)
            // 1. SETUP UI
            const qTextEl = document.getElementById('quiz-question-text');
            const qOptsEl = document.getElementById('quiz-options-list');
            let qCodeEl = document.getElementById('quiz-code-container');
            const qActions = document.getElementById('quiz-actions');

            // CRITICAL FIX: Create quiz-code-container if missing
            if (!qCodeEl) {
                qCodeEl = document.createElement('div');
                qCodeEl.id = 'quiz-code-container';
                qTextEl.after(qCodeEl);
            }

            qTextEl.textContent = "1/3 Extraction des dossiers suspects...";
            qTextEl.style.color = "#e0fff0";
            qOptsEl.innerHTML = '<div style="padding:20px; text-align:center; color:#888;"><i class="fas fa-circle-notch fa-spin fa-2x"></i></div>';
            if (qCodeEl) qCodeEl.innerHTML = "";
            if (qActions) qActions.style.display = "none"; // Hide buttons during loading

            try {
                // 2. EXTRACT DATA
                let fullChatContext = "";
                let fullCodeContext = "";

                if (currentUser && currentUser.data && currentUser.data.conversations) {
                    const targetConvs = currentUser.data.conversations.filter(c => selectedConvIds.includes(c.id));

                    if (targetConvs.length === 0) throw new Error("Aucun dossier sélectionné (Coche une case !)");

                    targetConvs.forEach(c => {
                        // Code Snapshot
                        if (c.codeSnapshot && c.codeSnapshot.length > 10) {
                            fullCodeContext += `\n[PREUVE CODE - DOSSIER "${c.title}"]:\n${c.codeSnapshot.substring(0, 800)}\n`;
                        }
                        // Chat Messages
                        if (c.messages && Array.isArray(c.messages)) {
                            c.messages.forEach(m => {
                                fullChatContext += `${m.isUser ? "Suspect" : "Inspecteur"}: ${m.content.substring(0, 150)}\n`;
                            });
                        }
                    });
                } else {
                    // Robustness: If data is missing/malformed but we somehow got here
                    throw new Error("Données de conversation corrompues ou inaccessibles. Rafraîchis la page.");
                }

                if (fullChatContext.length < 10) fullChatContext = "(Le suspect est resté muet)";
                if (fullCodeContext.length < 10) fullCodeContext = "(Aucune preuve trouvée sur la scène de crime)";

                // 3. BUILD PROMPT
                qTextEl.textContent = "2/3 Interrogatoire du Chef (Génération)...";

                const prompt = `
                Rôle : Tu es un examinateur impitoyable de code (Style 'Street/Strict').
                Tâche : Génère 5 questions de QCM (Quiz) sur le langage ${lang.toUpperCase()}.
                Niveau : AVANCÉ.
                
                [PIÈCES A CONVICTION (CODE)]
                ${fullCodeContext}
                
                [TRANSCRIPTIONS (CHAT)]
                "${fullChatContext.substring(0, 3000)}"
                
                CONSIGNE ULTIME : 
                1. Analyse le code fourni ci-dessus. Trouve les failles, les erreurs ou les concepts utilisés.
                2. Base tes questions DESSUS. Si le code utilise des pointeurs, pose des questions sur les pointeurs.
                3. Une question doit contenir un petit bout de code en exemple.

                [FORMAT JSON OBLIGATOIRE]
                [
                  {
                    "q": "L'intitulé de la question",
                    "code": "int preuve = 0; // code optionnel",
                    "opts": ["Réponse A", "Réponse B", "Réponse C", "Réponse D"],
                    "correct": 0,
                    "explanation": "Pourquoi t'es nul."
                  }
                ]
                `;

                // 4. CALL API (Timeout 60s for analysis)
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 60000);

                const r = await fetch(MISTRAL_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        model: "mistral-small-latest",
                        messages: [{ role: "user", content: prompt }]
                    }),
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                // 5. PARSE RESPONSE
                qTextEl.textContent = "3/3 Analyse des aveux (Validation)...";

                if (!r.ok) throw new Error("Erreur Mistral: " + r.status);
                const d = await r.json();
                if (!d.choices || !d.choices[0] || !d.choices[0].message) throw new Error("Réponse vide du QG.");

                let txt = d.choices[0].message.content;

                // Cleanup JSON
                const firstBracket = txt.indexOf('[');
                const lastBracket = txt.lastIndexOf(']');
                if (firstBracket !== -1 && lastBracket !== -1 && lastBracket > firstBracket) {
                    txt = txt.substring(firstBracket, lastBracket + 1);
                } else if (txt.includes('```')) {
                    txt = txt.split('```')[1].replace('json', '');
                }

                let generatedQuestions;
                try {
                    generatedQuestions = JSON.parse(txt);
                } catch (e) { throw new Error("Rapport illisible (JSON cassé)."); }

                if (!Array.isArray(generatedQuestions)) throw new Error("Format de rapport invalide.");

                // SUCCESS -> RENDER
                qActions.style.display = "block"; // Show buttons back
                currentQuizState = { questions: generatedQuestions, idx: 0, score: 0 };
                renderQuestion();

            } catch (e) {
                console.error(e);
                let msg = e.message;
                if (e.name === 'AbortError') msg = "Le Chef ne répond pas (Timeout 20s).";

                // ERROR STATE UI (NO FALLBACK)
                qTextEl.style.color = "#e74c3c";
                qTextEl.innerHTML = `<i class="fas fa-exclamation-triangle"></i> ÉCHEC DE LA MISSION`;

                // CRITICAL FIX: Ensure qCodeEl exists before writing to it
                let container = qCodeEl;
                if (!container) {
                    container = document.createElement('div');
                    container.id = 'quiz-code-container'; // Create it so we can show error
                    qTextEl.after(container);
                }

                container.innerHTML = `
                    <div style="color:#e74c3c; border:1px solid #e74c3c; padding:15px; margin-top:20px; background:rgba(231,76,60,0.1);">
                        <strong>RAISON :</strong> ${msg}<br><br>
                        Le suspect a gardé le silence, le QG est surchargé, ou vos données sont corrompues.
                    </div>
                `;
                qOptsEl.innerHTML = `<div style="text-align:center; margin-top:20px;"><button onclick="openMuscuView('muscu-quiz-setup')" class="btn-hero" style="width:100%;">RETOURNER AU PLANNING</button></div>`;
            }
        }
    }



    // UTILITY: Simple Formatter for One-Liner Code
    function quickCodeFormatter(code) {
        if (!code) return "";
        if (code.includes('\n') && code.split('\n').length > 1) return code; // Already multiline

        let res = "";
        let indent = 0;
        let inParen = 0;
        code = code.trim();

        for (let i = 0; i < code.length; i++) {
            const c = code[i];

            if (c === '(') inParen++;
            if (c === ')') inParen--;

            if (c === '}') {
                indent = Math.max(0, indent - 1);
                // Check if previous char was newline to avoid double
                if (res.endsWith('\n  ' + '  '.repeat(indent))) {
                    // Already indented for next line, just put }
                    res += '}';
                } else {
                    res += '\n' + '  '.repeat(indent) + '}';
                }
                continue;
            }

            res += c;

            if (c === '{') {
                indent++;
                res += '\n' + '  '.repeat(indent);
            } else if (c === ';' && inParen === 0) {
                res += '\n' + '  '.repeat(indent);
                // Skip next space if exists
                if (code[i + 1] === ' ') i++;
            }
        }
        return res.trim();
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
                lineWrapping: true, // FIX: Wrap long lines so it doesn't look ugly
                viewportMargin: Infinity
            });

            const formattedCode = quickCodeFormatter(qData.code);
            cm.setValue(formattedCode);

            // Height Auto
            // FIX: Giving it a bit more breathing room
            const height = formattedCode.split('\n').length * 20 + 40;
            cm.setSize("100%", Math.min(height, 400) + "px");

            // UI FIX: Spacing between code and options
            container.style.marginBottom = "30px";
            container.style.marginTop = "15px";

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
        // UI FIX: More space at bottom
        const container = document.getElementById('muscu-active-quiz');
        if (container) container.style.paddingBottom = "50px";

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

        const langs = ['c', 'python', 'java'];
        const langNames = {
            'c': 'C (Guerrier)',
            'python': 'Py (Data)',
            'java': 'Java (Corpo)'
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
        // 1. Escape HTML special chars (EXCEPT if we already used HTML tags manually, which we did. 
        //    So we must be careful. Actually, since we use template literals with explicit HTML, 
        //    we should probably SKIP auto-escaping < > or it will break our manual HTML.)
        //    => We remove the generic .replace(/</g, "&lt;") because we inject valid HTML now.

        // 2. Handle Code Blocks (Triple backticks)
        let htmlContent = courseData.content
            .replace(/```(\w+)([\s\S]*?)```/g, '<div class="code-block-wrapper"><pre><code class="lang-$1">$2</code></pre></div>')
            .replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

        // 3. Handle Newlines -> BR (But only if not inside HTML tags ideally, but simple replace is okay for now)
        // We avoid replacing newlines that are just formatting in the JS code string.
        // Actually, since we used HTML, we don't need auto-newline replacement as much if we use <p>.
        // But for mixed content, let's keep it but be gentle.
        // htmlContent = htmlContent.replace(/\n\n/g, '<br><br>'); 
        // ^ Removed auto-br because we use <p> tags now.

        // 4. Simple Markdown Headers (Legacy support if needed)
        htmlContent = htmlContent
            .replace(/### (.*)/g, '<h3>$1</h3>')
            .replace(/## (.*)/g, '<h2>$1</h2>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

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
                        <div style="display:flex; gap:10px; margin-top:10px;">
                            <button class="btn-hero btn-submit-ex" data-exid="${exId}" style="flex:1;">SOUMETTRE</button>
                            <button class="btn-box btn-show-solution" data-exid="${exId}" style="flex:1; border-color:#f1c40f; color:#f1c40f;">CORRECTION</button>
                        </div>
                        <div id="feedback-${exId}" class="terminal-box" style="display:none;"></div>
                        <div id="solution-${exId}" class="terminal-box" style="display:none; border-color:#f1c40f; color:#f1c40f; margin-top:10px;">
                            <strong>SOLUTION DU CHEF :</strong><br>
                            <pre style="background:rgba(0,0,0,0.5); padding:10px; margin-top:5px; white-space:pre-wrap;">${ex.solution || "// Pas de solution officielle pour l'instant.\n// Débrouille-toi avec l'IA."}</pre>
                        </div>
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

            // Listener for Solution Buttons
            document.querySelectorAll('.btn-show-solution').forEach(btn => {
                btn.onclick = (e) => {
                    const exId = e.target.dataset.exid;
                    const solDiv = document.getElementById(`solution-${exId}`);
                    if (solDiv) {
                        const isHidden = solDiv.style.display === 'none';
                        solDiv.style.display = isHidden ? 'block' : 'none';
                        e.target.textContent = isHidden ? 'CACHER CORRECTION' : 'CORRECTION';
                    }
                };
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
        
        Style : Sarcasme, tutoiement, argot.
        INTERDICTION FORMELLE D'UTILISER DES EMOJIS. JE TE TUE SI TU EN METS.
        `;

        try {
            const r = await fetch(MISTRAL_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
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

