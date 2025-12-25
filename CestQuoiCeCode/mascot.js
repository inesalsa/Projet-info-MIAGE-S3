
const phrases = [
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

function initMascot() {
    const container = document.getElementById('mascot-container');
    const restoreBtn = document.getElementById('mascot-restore-btn');

    // Safety check if elements exist
    if (!container) return;

    const bubble = container.querySelector('.mascot-bubble');
    const textElement = container.querySelector('.mascot-text');
    const closeBtn = container.querySelector('.mascot-close-btn');

    let isHidden = false;

    function showPhrase() {
        if (isHidden) return; // Silent if hidden

        if (!textElement || !bubble) return;

        const randomIndex = Math.floor(Math.random() * phrases.length);
        const phrase = phrases[randomIndex];
        textElement.textContent = phrase;

        // Show bubble
        bubble.classList.add('visible');

        // Hide after 8 seconds
        setTimeout(() => {
            if (!isHidden) { // Only manipulate if still visible context
                bubble.classList.remove('visible');
            }
        }, 8000);
    }

    // CLOSE ACTION
    if (closeBtn) {
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation(); // Prevent bubbling
            container.style.display = 'none';
            if (restoreBtn) restoreBtn.style.display = 'flex';
            isHidden = true;
            bubble.classList.remove('visible'); // Hide bubble immediately
        });
    }

    // RESTORE ACTION
    if (restoreBtn) {
        restoreBtn.addEventListener('click', () => {
            container.style.display = 'flex';
            restoreBtn.style.display = 'none';
            isHidden = false;
            // Optional: Speak immediately upon return
            setTimeout(showPhrase, 500);
        });
    }

    // Initial delay
    setTimeout(showPhrase, 2000);

    // Loop every 50 seconds
    setInterval(showPhrase, 50000);
}

document.addEventListener('DOMContentLoaded', initMascot);
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    initMascot(); // Run immediately if already loaded
}
