document.addEventListener('DOMContentLoaded', () => {

    // --- 1. Splash Screen & Animation ---
    const splashTerminal = document.getElementById('splash-terminal');
    const splashText = document.getElementById('splash-text');
    const mainInterface = document.getElementById('main-interface');
    
    const textToType = "> Connexion au C.Q.C.D. Core... [ACCÈS AUTORISÉ]\n> Appuyez sur [ENTRÉE]";
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
            splashTerminal.classList.add('zoom-out');
            setTimeout(() => {
                splashTerminal.style.display = 'none';
                mainInterface.classList.add('visible');
                // On lance le cycle de parole une fois l'intro finie
                startChenilleTalk(); 
            }, 800); 
            window.removeEventListener('keydown', handleEnterKey);
        }
    }
    window.addEventListener('keydown', handleEnterKey);


    // --- 2. CodeMirror ---
    const codeEditor = CodeMirror.fromTextArea(document.getElementById('code-input'), {
        theme: 'material-darker',
        mode: 'text/x-csrc', 
        lineNumbers: true,
        autoCloseBrackets: true,
        lineWrapping: true,
        placeholder: "Collez ou saisissez votre code ici"
    });
    codeEditor.setSize("100%", "100%");


    // --- 3. Prompt Dynamique ---
    const promptInput = document.getElementById('prompt-input');
    const maxInputHeight = 150; 

    promptInput.addEventListener('input', () => {
        promptInput.style.height = 'auto';
        let newHeight = promptInput.scrollHeight;
        if (newHeight > maxInputHeight) {
            newHeight = maxInputHeight;
            promptInput.style.overflowY = 'auto'; 
        } else {
            promptInput.style.overflowY = 'hidden'; 
        }
        promptInput.style.height = newHeight + 'px';
    });


    // --- 4. La Chenille Bavarde (V3 - Timing Long) 🐛 ---
    const bubble = document.getElementById('chat-bubble');
    
    // Ta base de données SQL convertie en JS
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
        "La réponse est 42, mais j'ai oublié la question."
    ];

    function showBubble() {
        const randomPhrase = dbPhrases[Math.floor(Math.random() * dbPhrases.length)];
        bubble.textContent = randomPhrase;
        bubble.classList.add('show');
        
        // La bulle reste affichée 7 secondes (un peu plus longtemps pour lire)
        setTimeout(() => {
            bubble.classList.remove('show');
        }, 7000);
    }

    // Gestion du Timing Aléatoire (1 à 2 minutes)
    function scheduleNextTalk() {
        // Calcule un temps aléatoire entre 60000ms (1min) et 120000ms (2min)
        const minTime = 60000; 
        const maxTime = 120000;
        const randomDelay = Math.floor(Math.random() * (maxTime - minTime + 1) + minTime);

        console.log(`Prochaine phrase dans : ${Math.round(randomDelay/1000)} secondes`);

        setTimeout(() => {
            showBubble();
            // Une fois qu'elle a parlé, on relance le dé pour la prochaine fois
            scheduleNextTalk(); 
        }, randomDelay);
    }

    function startChenilleTalk() {
        // Une première phrase rapide pour l'ambiance (au bout de 5 sec)
        setTimeout(() => {
            showBubble();
            // Ensuite on lance la boucle longue
            scheduleNextTalk();
        }, 5000); 
    }
});