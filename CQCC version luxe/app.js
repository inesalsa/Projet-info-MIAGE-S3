document.addEventListener('DOMContentLoaded', () => {

    // --- CONFIGURATION ---
    const API_KEY = "pfbO4KFP7TriMY3iZYm6mzRlfhFCmsQw";
    const MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions";
    const SERVER_URL = "http://localhost:3000";

    // --- STATE ---
    let currentUser = localStorage.getItem('cqcd_user') || null;
    let currentLang = 'c';

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
    document.getElementById('btn-learn-more')?.addEventListener('click', () => switchView('view-courses'));
    document.getElementById('card-hack')?.addEventListener('click', () => switchView('view-editor'));
    document.getElementById('card-neo')?.addEventListener('click', () => switchView('view-gogs'));
    document.getElementById('card-rabbit')?.addEventListener('click', () => switchView('view-courses'));

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
        const btn = document.getElementById('btn-login');
        if (btn && currentUser) btn.textContent = currentUser.toUpperCase();
    }
    updateUserUI();

    // --- EDITOR LOGIC ---
    const codeEditor = CodeMirror.fromTextArea(document.getElementById('code-input'), {
        theme: 'matrix',
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
        if (currentLang === 'javascript') codeEditor.setOption('mode', 'javascript');
        if (currentLang === 'python') codeEditor.setOption('mode', 'python');
    });

    const terminalOutput = document.getElementById('terminal-output');
    document.getElementById('btn-compile')?.addEventListener('click', async () => {
        const code = codeEditor.getValue();
        terminalOutput.textContent = "> Analyse du code en cours...";
        terminalOutput.style.color = '#8ab095';

        // Fake local execution for JS (or warning)
        if (currentLang === 'javascript') {
            try {
                // Dangerous in prod, safeish local simulation
                let output = "";
                const log = console.log;
                console.log = (t) => output += t + "\n";
                eval(code);
                console.log = log;
                terminalOutput.textContent = output || "Code exécuté (pas de sortie).";
                terminalOutput.style.color = '#e0fff0';
                askAiJudge(code, output, null);
            } catch (e) {
                terminalOutput.textContent = `Erreur Runtime: ${e.message}`;
                terminalOutput.style.color = '#ff8080';
                askAiJudge(code, null, e.message);
            }
            return;
        }

        // Backend Compilation (GCC)
        try {
            const response = await fetch(`${SERVER_URL}/compile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: code })
            });
            const data = await response.json();
            terminalOutput.textContent = data.output;
            terminalOutput.style.color = data.success ? '#e0fff0' : '#ff8080';

            // Trigger AI Judgement
            askAiJudge(code, data.output, data.success ? null : "Erreur de compilation");

        } catch (e) {
            terminalOutput.textContent = "Serveur hors ligne. Lance 'node server.js'.";
        }
    });

    async function askAiJudge(code, output, error) {
        // Automatically ask AI to judge the code
        const overlay = document.getElementById('ai-overlay');
        overlay.classList.remove('hidden');

        const aiContent = document.getElementById('ai-chat-content');
        aiContent.innerHTML += `<div class="msg msg-ai">Attends, je regarde ton code de ${currentLang}...</div>`;

        const prompt = `
        Rôle: Tu es un "grand frère de la cité" expert en programmation (C, JS, Python). 
        Ton style : Argot de cité (wesh, frérot, t'es sérieux ?), tutoiement, légèrement agressif/moqueur si c'est nul, mais bienveillant sur le fond.
        Tâche : Analyse le code suivant et son résultat.
        Code : \n${code}\n
        Sortie/Erreur : \n${output || error}\n
        
        Détecte les erreurs, insulte gentiment l'utilisateur si c'est une erreur bête, et explique comment corriger sans donner la solution toute cuite. Donne une note sur 10 (genre "3/10 retourne au charbon").
        `;

        try {
            const response = await fetch(MISTRAL_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
                body: JSON.stringify({
                    model: "mistral-small-latest",
                    messages: [{ role: "user", content: prompt }]
                })
            });
            const data = await response.json();
            const aiText = data.choices[0].message.content;
            addAiMessage(aiText);
        } catch (e) {
            addAiMessage("Wesh, mon cerveau a buggé. (Erreur API)");
        }
    }

    // --- GOGS LOGIC ---
    const gogsTimeline = document.getElementById('gogs-timeline-list');
    function renderGogs() {
        if (!gogsTimeline) return;
        gogsTimeline.innerHTML = '';
        const allCommits = JSON.parse(localStorage.getItem('cqcd_commits_v7') || '[]');

        // Filter by user if needed? For now show all.
        if (allCommits.length === 0) {
            gogsTimeline.innerHTML = '<div style="text-align:center; padding:20px; color:#666;">Aucune version. Pousse du code !</div>';
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
                    <span style="color:#66cca0;">USER: ${commit.user || 'Anon'}</span> | 
                    ${new Date(commit.date).toLocaleString()} | ${commit.hash}
                </p>
            `;
            div.addEventListener('click', () => {
                if (confirm("Revenir à cette version frérot ?")) {
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

    // --- AI OVERLAY & VOTING ---
    const aiTrigger = document.getElementById('ai-trigger');
    const aiOverlay = document.getElementById('ai-overlay');
    const closeAi = document.getElementById('close-ai');

    aiTrigger?.addEventListener('click', () => aiOverlay.classList.remove('hidden'));
    closeAi?.addEventListener('click', () => aiOverlay.classList.add('hidden'));

    const promptInput = document.getElementById('prompt-input');
    const aiContent = document.getElementById('ai-chat-content');

    function addAiMessage(text) {
        const msgId = Date.now();
        const div = document.createElement('div');
        div.className = 'msg msg-ai';
        div.innerHTML = `
            <div style="margin-bottom:5px;">${marked.parse(text)}</div>
            <div class="vote-area">
                <button class="btn-vote" onclick="vote(this, 1)">👍</button>
                <button class="btn-vote" onclick="vote(this, -1)">👎</button>
            </div>
        `;
        aiContent.appendChild(div);
        aiContent.scrollTop = aiContent.scrollHeight;
    }
    // Simple markdown parser mock if library not present
    const marked = window.marked || { parse: (t) => t };

    window.vote = function (btn, val) {
        btn.parentElement.innerHTML = `<span style="font-size:0.8rem; color:#66cca0;">Voté ! Merci le sang.</span>`;
    };

    promptInput?.addEventListener('keypress', async (e) => {
        if (e.key === 'Enter') {
            const txt = promptInput.value.trim();
            if (!txt) return;

            aiContent.innerHTML += `<div class="msg msg-user">${txt}</div>`;
            promptInput.value = '';

            try {
                const response = await fetch(MISTRAL_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
                    body: JSON.stringify({
                        model: "mistral-small-latest",
                        messages: [
                            { role: "system", content: "Tu es un assistant codeur 'grand frère de la cité'. Tu parles argot, tu es cash, tu insultes un peu mais tu aides." },
                            { role: "user", content: txt }
                        ]
                    })
                });
                const data = await response.json();
                addAiMessage(data.choices[0].message.content);
            } catch (e) {
                addAiMessage("Wesh, erreur réseau.");
            }
        }
    });

    // --- QUIZ GENERATION ---
    document.getElementById('btn-gen-quiz')?.addEventListener('click', async () => {
        const quizContainer = document.getElementById('quiz-container');
        quizContainer.style.display = 'block';
        quizContainer.innerHTML = 'Génération du quiz par le boss...';

        const prompt = `Génère une question QCM sur le langage ${currentLang} pour un débutant. Format JSON: {question: "", options: ["",""], answer: 0}. Parle normalement pour la question.`;

        try {
            const response = await fetch(MISTRAL_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
                body: JSON.stringify({
                    model: "mistral-small-latest",
                    messages: [{ role: "user", content: prompt }]
                })
            });
            const data = await response.json();
            // Basic parsing attempt (LLM might wrap in markdown)
            let txt = data.choices[0].message.content;
            const jsonMatch = txt.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const quiz = JSON.parse(jsonMatch[0]);
                renderQuiz(quiz);
            } else {
                quizContainer.innerHTML = txt; // Fallback
            }
        } catch (e) {
            quizContainer.innerHTML = "Erreur quiz.";
        }
    });

    function renderQuiz(quiz) {
        const c = document.getElementById('quiz-container');
        c.innerHTML = `
            <h3 style="color:#e0fff0; margin-bottom:15px;">${quiz.question}</h3>
            <div style="display:flex; flex-direction:column; gap:10px;">
                ${quiz.options.map((opt, i) => `
                    <button class="btn-box" onclick="checkQuiz(this, ${i}, ${quiz.answer})">${opt}</button>
                `).join('')}
            </div>
        `;
    }

    window.checkQuiz = function (btn, index, correction) {
        if (index === correction) {
            btn.style.background = '#66cca0';
            btn.style.color = '#000';
            alert("C'est carré ! T'es un bon.");
        } else {
            btn.style.background = '#ff8080';
            alert("T'es nul frérot... recommence.");
        }
    };
});