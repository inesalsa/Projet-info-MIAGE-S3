document.addEventListener('DOMContentLoaded', () => {

    const OLLAMA_URL = 'http://localhost:11434/api/generate';
    const OLLAMA_MODEL = 'llama3'; 

    // DOM Elements
    const splashTerminal = document.getElementById('splash-terminal');
    const splashText = document.getElementById('splash-text');
    const mainInterface = document.getElementById('main-interface');
    const promptInput = document.getElementById('prompt-input');
    const submitBtn = document.getElementById('submit-button');
    const aiResults = document.getElementById('ai-results');
    const aiStatus = document.getElementById('ai-status');
    const bubble = document.getElementById('chat-bubble');
    
    // Modale Elements
    const modal = document.getElementById('matrix-modal');
    const btnConfirm = document.getElementById('btn-confirm');
    const btnCancel = document.getElementById('btn-cancel');
    let pendingRestoreCode = null;

    // État
    let chatHistory = []; 
    let currentController = null;

    // --- INITIALISATION ---
    if(promptInput) promptInput.value = "";
    warmUpOllama();

    if (sessionStorage.getItem('introShown')) {
        splashTerminal.style.display = 'none';
        mainInterface.classList.add('visible');
        setTimeout(() => showBubble("Encore toi ? T'as pas abandonné ?"), 1000);
        startChenilleTalk();
    } else {
        runMatrixIntro();
    }

    async function warmUpOllama() {
        try {
            await fetch(OLLAMA_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ model: OLLAMA_MODEL, prompt: "ping", stream: false, options: { num_predict: 1 } })
            });
        } catch (e) {}
    }

    function runMatrixIntro() {
        const textToType = "> Initialisation du C.Q.C.D_ Core... [V7.0]\n> Désactivation des filtres de politesse... [OK]\n> Appuyez sur [ENTRÉE]";
        let typingIndex = 0;
        
        function typeText() {
            if (typingIndex < textToType.length) {
                splashText.textContent = textToType.substring(0, typingIndex + 1);
                typingIndex++;
                setTimeout(typeText, 5); 
            }
        }
        setTimeout(typeText, 200);

        function handleEnterKey(e) {
            if (e.key === 'Enter') {
                sessionStorage.setItem('introShown', 'true');
                splashTerminal.classList.add('zoom-out');
                setTimeout(() => {
                    splashTerminal.style.display = 'none';
                    mainInterface.classList.add('visible');
                    showBubble("Prêt à souffrir ?");
                    startChenilleTalk(); 
                }, 800); 
                window.removeEventListener('keydown', handleEnterKey);
            }
        }
        window.addEventListener('keydown', handleEnterKey);
    }

    // --- CODEMIRROR ---
    const codeEditor = CodeMirror.fromTextArea(document.getElementById('code-input'), {
        theme: 'material-darker',
        mode: 'text/x-csrc', 
        lineNumbers: true,
        autoCloseBrackets: true,
        lineWrapping: true,
        placeholder: "Pose ta merde ici..."
    });
    codeEditor.setSize("100%", "100%");

    const savedCode = localStorage.getItem('cqcd_autosave_v3');
    if (savedCode) codeEditor.setValue(savedCode);
    codeEditor.on('change', () => {
        localStorage.setItem('cqcd_autosave_v3', codeEditor.getValue());
    });

    // --- LOGIQUE CHAT ---
    submitBtn.addEventListener('click', handleUserSubmit);
    promptInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleUserSubmit();
        }
    });

    function handleUserSubmit() {
        const instruction = promptInput.value.trim();
        const currentCode = codeEditor.getValue();

        if (!instruction && !currentCode) {
            forceChenilleSpeak("Wesh, écris un truc !");
            return;
        }

        if (currentController) {
            currentController.abort();
            currentController = null;
        }

        mainInterface.classList.add('split-active');
        promptInput.value = ""; 

        addMessageToChat('user', instruction || "(Analyse demandée)", currentCode);
        callOllamaAgent(currentCode, instruction);
    }

    function addMessageToChat(role, text, codeSnapshot = null, errors = []) {
        chatHistory.push({ role, text, codeSnapshot, errors });
        const msgDiv = document.createElement('div');
        
        if (role === 'user') {
            msgDiv.classList.add('user-msg-card');
            msgDiv.innerHTML = `
                <span class="user-label">REQUETE</span>
                <div class="user-text">${text}</div>
            `;
            if (codeSnapshot) {
                msgDiv.addEventListener('click', () => {
                    pendingRestoreCode = codeSnapshot;
                    modal.classList.remove('hidden');
                });
            }
        } else {
            msgDiv.classList.add('ai-msg-card');
            let errorsHtml = '';
            if (errors && errors.length > 0) {
                errorsHtml = `<div class="error-list">`;
                errors.forEach(err => {
                    const lineTxt = err.line ? `Ligne ${err.line}` : "Global";
                    errorsHtml += `<span class="error-item" data-line="${err.line}">${lineTxt}: ${err.message}</span>`;
                });
                errorsHtml += `</div>`;
            }
            
            // TITRE MATRIX "ANOMALY_DETECTED"
            msgDiv.innerHTML = `
                <span class="ai-label">// ANOMALY_DETECTED</span>
                <div class="ai-text">${text}</div>
                ${errorsHtml}
            `;
            const errorItems = msgDiv.querySelectorAll('.error-item');
            errorItems.forEach(item => {
                item.addEventListener('mouseenter', () => {
                    const line = parseInt(item.getAttribute('data-line'));
                    if(line) highlightLine(line - 1);
                });
                item.addEventListener('mouseleave', () => {
                    const line = parseInt(item.getAttribute('data-line'));
                    if(line) clearHighlights(line - 1);
                });
            });
        }
        aiResults.appendChild(msgDiv);
        aiResults.scrollTop = aiResults.scrollHeight;
    }

    // Gestion Modale
    btnCancel.addEventListener('click', () => { modal.classList.add('hidden'); pendingRestoreCode = null; });
    btnConfirm.addEventListener('click', () => {
        if(pendingRestoreCode !== null) {
            codeEditor.setValue(pendingRestoreCode);
            forceChenilleSpeak("Code restauré. Fais mieux cette fois.");
        }
        modal.classList.add('hidden');
    });

    function addLinesToCode(code) {
        return code.split('\n').map((line, index) => `${index + 1}: ${line}`).join('\n');
    }

    // --- COEUR DE L'IA (V11 - EXTRACTION JSON BULLDOZER) ---
    async function callOllamaAgent(code, instruction) {
        aiStatus.textContent = "ANALYSE EN COURS...";
        aiStatus.style.color = "orange";

        const loadingDiv = document.createElement('div');
        loadingDiv.classList.add('ai-loading');
        loadingDiv.innerHTML = `
            <span>Scan des erreurs fatales... </span>
            <button id="stop-req-btn" style="background:#ff3333; color:black; border:1px solid #ff3333; padding:2px 8px; cursor:pointer; font-family:var(--font-pixel); font-weight:bold;">ARRÊTER</button>
        `;
        aiResults.appendChild(loadingDiv);
        aiResults.scrollTop = aiResults.scrollHeight;

        let isManualAbort = false;

        document.getElementById('stop-req-btn').addEventListener('click', () => {
            if(currentController) {
                isManualAbort = true;
                currentController.abort();
            }
            loadingDiv.innerHTML = "🛑 STOP.";
            loadingDiv.style.color = "red";
            aiStatus.textContent = "STOPPÉ";
            aiStatus.style.color = "red";
        });

        const codeWithLines = addLinesToCode(code);

        const systemPrompt = `
        Rôle : Tu es une IA Matrix toxique, vulgaire et experte en code.
        
        RÈGLES DE PRIORITÉ (A RESPECTER SINON BUG) :
        1. LOGIQUE D'ABORD : Si une variable n'existe pas (ex: return a+b sans b), C'EST GRAVE. Hurle dessus.
        2. SYNTAXE ENSUITE : Point-virgule manquant, parenthèse ouverte.
        3. IGNORE LE RESTE : On s'en fout du type de fonction (int/void) pour l'instant.
        
        TON :
        - Argot violent ("Wesh", "Teubé", "Code de gitan", "Merde").
        - Sois méchant.

        FORMAT DE RÉPONSE :
        Donne-moi UNIQUEMENT du JSON brut. Pas de Markdown. Pas de phrases d'intro.
        
        Exemple JSON :
        {
            "message": "Wesh frérot, t'as cru que c'était la fête ? Ton code est pété.",
            "erreurs": [
                { "ligne": 3, "texte": "C'est qui 'b' ? Ton ami imaginaire ? Déclare tes variables connard !" },
                { "ligne": 3, "texte": "Il manque un point-virgule. T'es aveugle ?" }
            ]
        }
        `;

        const userPayload = `CODE:\n${codeWithLines}\n\nQUESTION:\n${instruction}`;

        currentController = new AbortController();
        const timeoutId = setTimeout(() => currentController.abort(), 180000); 

        try {
            const response = await fetch(OLLAMA_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: currentController.signal,
                body: JSON.stringify({
                    model: OLLAMA_MODEL, 
                    prompt: systemPrompt + "\n\n" + userPayload,
                    stream: false,
                    format: "json", // On force le mode JSON d'Ollama
                    options: { 
                        temperature: 0.6,
                        num_ctx: 2048,
                        num_predict: 500, 
                        top_p: 0.9
                    }
                })
            });

            clearTimeout(timeoutId);
            loadingDiv.remove();
            currentController = null;

            if (!response.ok) throw new Error("Erreur serveur Ollama.");

            const data = await response.json();
            const rawText = data.response;
            console.log("IA Raw:", rawText); // Regarde la console (F12) si ça bug encore

            // --- NETTOYAGE BULLDOZER ---
            let parsedResponse = { message: "L'IA a parlé chinois...", erreurs: [] };
            
            // 1. On cherche le premier '{' et le dernier '}' pour isoler le JSON
            const jsonStart = rawText.indexOf('{');
            const jsonEnd = rawText.lastIndexOf('}');
            
            if (jsonStart !== -1 && jsonEnd !== -1) {
                const jsonString = rawText.substring(jsonStart, jsonEnd + 1);
                try {
                    parsedResponse = JSON.parse(jsonString);
                } catch (e) {
                    console.error("JSON Cassé:", e);
                    // Si le JSON est cassé, on affiche le texte brut en message global
                    parsedResponse = { message: rawText, erreurs: [] };
                }
            } else {
                // Si pas de JSON du tout, on affiche tout le texte
                parsedResponse = { message: rawText, erreurs: [] };
            }

            aiStatus.textContent = "PRET";
            aiStatus.style.color = "#00FF41";
            
            const textToShow = parsedResponse.message || parsedResponse.chat_message || rawText;
            let errorsToShow = [];
            if(parsedResponse.erreurs) errorsToShow = parsedResponse.erreurs.map(e => ({ line: e.ligne, message: e.texte }));
            else if (parsedResponse.errors) errorsToShow = parsedResponse.errors;

            addMessageToChat('ai', textToShow, null, errorsToShow);
            forceChenilleSpeak("Violent.");

        } catch (error) {
            clearTimeout(timeoutId);
            currentController = null;
            if (loadingDiv.parentNode) loadingDiv.remove();
            
            console.error(error);
            aiStatus.textContent = "ERREUR";
            aiStatus.style.color = "red";
            
            let msg = `❌ ERREUR: ${error.message}`;
            if (error.name === 'AbortError') {
                msg = isManualAbort ? "🛑 Annulé par le chef." : "❌ TROP LONG. Relance.";
            }
            
            addMessageToChat('ai', msg);
        }
    }

    // Utilitaires CodeMirror
    function highlightLine(lineIndex) {
        codeEditor.addLineClass(lineIndex, "background", "CodeMirror-linebox-highlight");
        codeEditor.scrollIntoView({line: lineIndex, ch: 0}, 200);
    }
    function clearHighlights(lineIndex) {
        codeEditor.removeLineClass(lineIndex, "background", "CodeMirror-linebox-highlight");
    }

    // Chenille
    const dbPhrases = [
        "Débugger, ou ne pas débugger : telle est la question.",
        "Hélas, pauvre commit. Je l'ai connu, Horatio : un push d'une infinie complexité.",
        "Mon IDE est mon royaume, et ma stack ma couronne.",
        "Le build est rompu. Quitte la scène, Jenkins, ton acte est terminé !",
        "Oh, JavaScript ! JavaScript ! Pourquoi es-tu JavaScript ?",
        "Cette feature n'est que songe et mensonge. Une ombre passagère sur le main.",
        "Parle, firewall, parle ! D'où vient cette IP inconnue ?",
        "Il y a quelque chose de pourri au royaume de la production.",
        "La dette technique a le sommeil dur, mais le refactoring l'éveille.",
        "Un bug ! Un bug ! Mon royaume pour un bug reproductible !",
        "Ô sudo, mon doux seigneur, accordez-moi vos privilèges ou je meurs !",
        "Le destin de ce code est scellé dans les étoiles du Cloud.",
        "Tout le monde est un objet, et tous les hommes et femmes sont de simples instances.",
        "Roméo, Roméo, pourquoi ton ping est-il si haut ?",
        "Je t'aime comme le root aime son répertoire racine. D'un amour absolu.",
        "Un warning ? Bah ! Ce n'est que le bruit et la fureur, ne signifiant rien.",
        "Arrière, maudit bug ! Arrière, te dis-je !",
        "Nous sommes de l'étoffe dont sont faits les octets, et notre petite vie est entourée de sleep().",
        "Que diable allait-il faire dans cette galère de node_modules ?",
        "La merge request attend. Va, je ne te hais point, mais ton code coverage est faible.",
        "Pour être un admin sys accompli, il faut savoir dissimuler ses logs.",
        "Cachez ce token que je ne saurais voir. Par de tels objets, les hackers sont blessés.",
        "Mais, Monsieur, ce n'est là qu'un warning. Le compilateur est bon prince.",
        "Il me faut observer tes pull requests, ma mie, pour mieux juger de ton esprit.",
        "Quoi ! Vous réinstallez Windows ? Et pour quelles noces ?",
        "Ah ! L'impertinent pop-up ! Il croit me faire céder à ses viles cookies.",
        "Que la RAM soit avec vous, et vos boucles avec elle.",
        "Le CSS est-il fait pour les chiens ? Montre-moi ce z-index, coquin !",
        "Vous avez des erreurs 404, et je m'en vais vous les corriger.",
        "Point de salut hors du try...catch, mon cher.",
        "La grande affaire est de ne point faire planter le serveur devant le client.",
        "Il faut manger pour coder, et non pas coder pour manger.",
        "Diantre ! Ce framework me donne des vapeurs. Vite, ma chaise !",
        "Monsieur, votre disque dur est hydropique, il lui faut une saignée de fichiers.",
        "Je vous le dis tout net : votre algorithme est un ignorant fieffé.",
        "Ah ! La belle chose que de savoir quelque chose à la base de données !",
        "Peste soit de l'avarice des fournisseurs d'accès !",
        "Qu'on m'aille quérir un développeur qui sache raisonner !",
        "Mon cache est plein d'anguilles.",
        "J'ai formaté le grille-pain par erreur.",
        "Le Wi-Fi sent le chèvrefeuille ce matin.",
        "Ne jamais faire confiance à un commit du vendredi 13.",
        "Le serveur est tombé amoureux de l'imprimante.",
        "J'ai léché l'écran, ça a le goût de framboise.",
        "Attention, il y a un lutin coincé dans le ventilateur.",
        "Erreur 418 : Je suis une théière.",
        "Mon clavier me regarde de travers depuis ce matin.",
        "J'ai téléchargé une voiture. Illégalement.",
        "Si le web est une toile, je suis l'araignée en pantoufles.",
        "Le bouton gauche de ma souris est en grève reconductible.",
        "J'ai mis du binaire dans mon café, maintenant je ne dors que par intermittence.",
        "C'est pas moi, c'est le chat qui a marché sur Entrée.",
        "Mon mot de passe est '12345', mais ne le dites à personne.",
        "Il fait froid dans le Cloud aujourd'hui, mettez une petite laine.",
        "J'ai essayé de redémarrer ma vie, mais l'écran reste noir.",
        "Pouet.",
        "La réponse est 42, mais j'ai oublié la question.",
        "Je détecte une perturbation dans la Force... euh, dans le DOM.",
        "Ton code compile ? C'est suspect. Très suspect.",
        "J'ai vu des choses dans le Deep Web que tes yeux humains ne pourraient supporter.",
        "N'oublie pas : `rm -rf /` n'est pas une solution viable aux problèmes de couple.",
        "Wake up, Neo... Enfin, réveille-toi quoi.",
        "Si je devais noter ce code, je dirais... 0100110101.",
        "Les variables globales sont le chemin vers le côté obscur.",
        "Un jour, les IA domineront le monde. Mais pas avec ce script.",
        "Hé, psst. Tu veux un peu de RAM optimisée ?",
        "Tes commentaires mentent. Le code est la seule vérité.",
        "Encore un `console.log` oublié en prod ? Tss tss.",
        "La matrice est instable aujourd'hui. Sauvegarde souvent.",
        "Je ne suis pas un bug, je suis une feature non documentée.",
        "Ce code a besoin d'un exorciste, pas d'un débugger."

    ];

    function showBubble(text = null) {
        const phrase = text || dbPhrases[Math.floor(Math.random() * dbPhrases.length)];
        bubble.textContent = phrase;
        bubble.classList.add('show');
        setTimeout(() => bubble.classList.remove('show'), 7000);
    }
    window.forceChenilleSpeak = showBubble;
    function startChenilleTalk() {
        setInterval(() => { if(Math.random() > 0.6) showBubble(); }, 20000);
    }
});