DROP DATABASE IF EXISTS phrases_ambiance;
CREATE DATABASE phrases_ambiance;
USE phrases_ambiance;

CREATE TABLE phrases_ambiance (
    id INT AUTO_INCREMENT PRIMARY KEY,
    phrase TEXT NOT NULL,
    categorie VARCHAR(100) NOT NULL  
);

INSERT INTO phrases_ambiance (phrase, categorie)
VALUES
('Débugger, ou ne pas débugger : telle est la question.', 'shakespeare_it'),
('Que diable allait-il faire dans cette galère de `node_modules` ?', 'moliere_it'),
('Hélas, pauvre `commit`. Je l''ai connu, Horatio : un `push` d''une infinie complexité.', 'shakespeare_it'),
('Mon `IDE` est mon royaume, et ma `stack` ma couronne.', 'shakespeare_it'),
('Le `build` est rompu. Quitte la scène, `Jenkins`, ton acte est terminé !', 'shakespeare_it'),
('Oh, `JavaScript` ! `JavaScript` ! Pourquoi es-tu `JavaScript` ?', 'shakespeare_it'),
('Cette `feature` n''est que songe et mensonge. Une ombre passagère sur le `main`.', 'shakespeare_it'),
('La `merge request` attend. Va, je ne te hais point, mais ton `code coverage` est faible.', 'moliere_it'),
('Parle, `firewall`, parle ! D''où vient cette `IP` inconnue ?', 'shakespeare_it'),
('Il y a quelque chose de pourri au royaume de la `production`.', 'shakespeare_it'),
('La `dette technique` a le sommeil dur, mais le `refactoring` l''éveille.', 'shakespeare_it'),
('Un `bug` ! Un `bug` ! Mon royaume pour un `bug` reproductible !', 'shakespeare_it'),
('Pour être un `admin sys` accompli, il faut savoir dissimuler ses `logs`.', 'moliere_it'),
('Cachez ce `token` que je ne saurais voir. Par de tels objets, les `hackers` sont blessés.', 'moliere_it'),
('Mais, Monsieur, ce n''est là qu''un `warning`. Le `compilateur` est bon prince.', 'moliere_it'),
('Il me faut observer tes `pull requests`, ma mie, pour mieux juger de ton esprit.', 'moliere_it'),
('Quoi ! Vous réinstallez `Windows` ? Et pour quelles noces ?', 'moliere_it'),
('Ah ! L''impertinent `pop-up` ! Il croit me faire céder à ses viles `cookies`.', 'moliere_it'),
('Que la `RAM` soit avec vous, et vos `boucles` avec elle.', 'moliere_it'),
('Le `CSS` est-il fait pour les chiens ? Montre-moi ce `z-index`, coquin !', 'moliere_it'),
('Vous avez des `erreurs 404`, et je m''en vais vous les corriger.', 'moliere_it'),
('Point de salut hors du `try...catch`, mon cher.', 'moliere_it'),
('Mon `cache` est plein d''anguilles.', 'absurde'),
('J''ai formaté le grille-pain par erreur.', 'absurde'),
('Le `Wi-Fi` sent le chèvrefeuille ce matin.', 'absurde'),
('Ne jamais faire confiance à un `commit` du vendredi 13.', 'absurde'),
('Le `serveur` est tombé amoureux de l''imprimante.', 'absurde'),
('Ô `sudo`, mon doux seigneur, accordez-moi vos privilèges ou je meurs !', 'shakespeare_it'),
('Le destin de ce `code` est scellé dans les étoiles du `Cloud`.', 'shakespeare_it'),
('Tout le monde est un `objet`, et tous les hommes et femmes sont de simples `instances`.', 'shakespeare_it'),
('Roméo, Roméo, pourquoi ton `ping` est-il si haut ?', 'shakespeare_it'),
('Je t''aime comme le `root` aime son répertoire racine. D''un amour absolu.', 'shakespeare_it'),
('Un `warning` ? Bah ! Ce n''est que le bruit et la fureur, ne signifiant rien.', 'shakespeare_it'),
('Arrière, maudit `bug` ! Arrière, te dis-je !', 'shakespeare_it'),
('Nous sommes de l''étoffe dont sont faits les `octets`, et notre petite vie est entourée de `sleep()`.', 'shakespeare_it'),
('La grande affaire est de ne point faire planter le `serveur` devant le client.', 'moliere_it'),
('Il faut manger pour coder, et non pas coder pour manger.', 'moliere_it'),
('Diantre ! Ce `framework` me donne des vapeurs. Vite, ma chaise !', 'moliere_it'),
('Monsieur, votre `disque dur` est hydropique, il lui faut une saignée de fichiers.', 'moliere_it'),
('Je vous le dis tout net : votre `algorithme` est un ignorant fieffé.', 'moliere_it'),
('Ah ! La belle chose que de savoir quelque chose à la `base de données` !', 'moliere_it'),
('Peste soit de l''avarice des fournisseurs d''accès !', 'moliere_it'),
('Qu''on m''aille quérir un `développeur` qui sache raisonner !', 'moliere_it'),
('J''ai léché l''écran, ça a le goût de framboise.', 'absurde'),
('Attention, il y a un lutin coincé dans le ventilateur.', 'absurde'),
('Erreur 418 : Je suis une théière.', 'absurde'),
('Mon clavier me regarde de travers depuis ce matin.', 'absurde'),
('J''ai téléchargé une voiture. Illégalement.', 'absurde'),
('Si le web est une toile, je suis l''araignée en pantoufles.', 'absurde'),
('Le bouton gauche de ma souris est en grève reconductible.', 'absurde'),
('J''ai mis du binaire dans mon café, maintenant je ne dors que par intermittence.', 'absurde'),
('C''est pas moi, c''est le chat qui a marché sur `Entrée`.', 'absurde'),
('Mon mot de passe est "12345", mais ne le dites à personne.', 'absurde'),
('Il fait froid dans le `Cloud` aujourd''hui, mettez une petite laine.', 'absurde'),
('J''ai essayé de redémarrer ma vie, mais l''écran reste noir.', 'absurde'),
('Pouet.', 'absurde'),
('La réponse est 42, mais j''ai oublié la question.', 'absurde');

SELECT phrase FROM phrases_ambiance
ORDER BY RAND()
LIMIT 1;