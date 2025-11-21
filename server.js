const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// On pointe vers ton modèle personnalisé
const MODEL_NAME = 'critique-simple'; 
const LLM_API_URL = 'http://localhost:11434/api/generate'; 

app.post('/roast', async (req, res) => {
    const userCode = req.body.code;
    const userPrompt = req.body.prompt || "Massacre ce code stp.";

    // On envoie juste le code et la demande. 
    // La personnalité (sarcasme, références pop-culture) est gérée par le Modelfile !
    const finalPrompt = `
    Voici le code de l'utilisateur :
    ${userCode}
    
    Sa question/remarque : ${userPrompt}
    `;

    try {
        // On crée un contrôleur pour dire "Attends 10 minutes avant de planter"
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 600000); // 600 000 ms = 10 minutes

        const response = await fetch(LLM_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODEL_NAME,
                prompt: finalPrompt,
                stream: false 
            }),
            signal: controller.signal // On attache le timeout ici
        });

        clearTimeout(timeoutId); // Si ça répond, on annule le compte à rebours

        const data = await response.json();
        
        if (data.response) {
            res.json({ reply: data.response });
        } else {
            res.json({ reply: "Erreur : Ollama a répondu vide..." });
        }

    } catch (error) {
        console.error("Erreur détaillée :", error); // Affiche plus de détails
        if (error.name === 'AbortError') {
            res.json({ reply: "Ollama est trop lent... Essayez un modèle plus léger ou patientez." });
        } else {
            res.status(500).json({ reply: "Erreur critique de connexion au cerveau." });
        }
    } 
});

app.listen(PORT, () => {
    console.log(`\n--- SERVEUR C.Q.C.D EN LIGNE ---`);
    console.log(`Connecté au modèle : ${MODEL_NAME}`);
    console.log(`En attente de code à insulter sur http://localhost:${PORT}\n`);
});