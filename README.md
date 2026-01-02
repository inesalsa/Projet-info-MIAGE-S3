# Projet-info-MIAGE-S3
C.Q.C.D_ (C'est Quoi Ce Code)
C.Q.C.D est une plateforme d'apprentissage interactive nouvelle génération pour les étudiants en informatique. Elle combine un éditeur de code multi-langage, un système de tutorat par Intelligence Artificielle (Mistral AI) et des modules de formation ludiques.
L'application se distingue par la personnalité de son IA, "Le Chef", qui prodigue des conseils et analyse vos erreurs avec un ton direct, humoristique et sans filtre.
I/Installation et Démarrage rapide
a. Prérequis
Pour faire fonctionner le moteur de compilation et l'IA, assurez-vous d'avoir installé :
Node.js (v14 ou supérieur) : Pour faire tourner le serveur backend.
Compilateurs & Interpréteurs (selon les langages que vous souhaitez tester) :
gcc ou g++ pour le C/C++.
python pour le Python.
javac pour le Java.
php pour le PHP.
node pour le JavaScript.
b. Configuration de l'IA (Mistral)
Le projet utilise l'API de Mistral AI. Pour des raisons de sécurité, la clé est gérée uniquement côté serveur.
Ouvrez le fichier server.js.
Repérez la ligne const API_KEY = "...".
Remplacez la valeur par votre propre clé API Mistral (disponible sur console.mistral.ai).
c. Lancement du système
Sous Windows, vous pouvez utiliser le script d'automatisation fourni :
Double-cliquez sur start.bat.
Le script va démarrer le serveur Node.js et ouvrir automatiquement votre navigateur sur http://localhost:3000.
Lancement manuel :
node server.js
# Puis ouvrez http://localhost:3000 dans votre navigateur

II/ Guide d'utilisation
a. L'Éditeur & Compilation
Édition : Écrivez votre code dans l'éditeur central (propulsé par CodeMirror). La coloration syntaxique s'adapte automatiquement au langage choisi.
Exécution : Cliquez sur "Compile". Le code est envoyé au serveur, exécuté dans un environnement temporaire, et le résultat (ou l'erreur) s'affiche dans le terminal en bas de page.
b. Le Bureau du Chef (Tutorat IA)
L'IA "Le Chef" est votre mentor personnel.
Analyse de code : Si vous bloquez, demandez-lui son avis. Il analysera votre code et les erreurs de compilation pour vous expliquer comment corriger vos fautes.
Archives : Toutes vos discussions sont sauvegardées dans des dossiers. Vous pouvez les renommer pour organiser vos sessions de révision.
c. Muscu Savoir (Cours & Quiz)
Cours : Accédez à des leçons structurées sur le C, Python ou Java, accompagnées d'exercices pratiques corrigés par l'IA.
Quiz Mijoté : Sélectionnez vos anciennes discussions avec l'IA. Le système générera un quiz sur-mesure basé spécifiquement sur vos erreurs passées.
d. Système GOGS (Sauvegardes)
Utilisez le bouton "Commit" pour sauvegarder une version précise de votre code avec un message descriptif.
Retrouvez et restaurez vos anciens codes dans l'onglet GOGS (Gestionnaire d'Objets Grave Stylé).
e. Structure du Projet
app.js : Moteur principal du front-end et gestion de l'interface utilisateur.
server.js : Serveur Node.js (Compilation, Proxy IA, API de données).
users.db.json : Base de données locale (format JSON) pour les profils et historiques.
mascot.js : Gestion de la mascotte animée et de ses interventions aléatoires.
matrix.js : Script de l'arrière-plan animé "Digital Rain".
f. Technologies & Bibliothèques
Frontend : HTML5, CSS3, JavaScript (Vanilla).
Éditeur : CodeMirror 5.
Backend : Node.js.
IA : API Mistral AI (Modèle mistral-small-latest).
Design : FontAwesome (Icons), Google Fonts (Share Tech Mono).
🐛 Un dernier mot...
Si une petite chenille vient vous raconter une blague ou une citation de Shakespeare entre deux bugs, c'est normal : c'est l'esprit de C.Q.C.D.
Bon code, et n'écoutez pas trop les insultes du Chef !
