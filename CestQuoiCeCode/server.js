const http = require('http');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

const PORT = 3000;
const MIME_TYPES = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.gif': 'image/gif',
    '.png': 'image/png',
    '.svg': 'image/svg+xml'
};

const server = http.createServer((req, res) => {
    // --- CORS ---
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(204);
        res.end();
        return;
    }

    // --- STATIC FILES ---
    if (req.method === 'GET') {
        console.log(`[REQUEST] ${req.url}`);
        let filePath = '.' + req.url;
        if (filePath === './') filePath = './index.html';

        const extname = path.extname(filePath);
        const contentType = MIME_TYPES[extname] || 'application/octet-stream';

        fs.readFile(filePath, (err, content) => {
            if (err) {
                if (err.code == 'ENOENT') {
                    res.writeHead(404);
                    res.end('404 Not Found');
                } else {
                    res.writeHead(500);
                    res.end('Server Error: ' + err.code);
                }
            } else {
                res.writeHead(200, { 'Content-Type': contentType });
                res.end(content, 'utf-8');
            }
        });
        return;
    }

    // --- COMPILATION ENDPOINT ---
    if (req.method === 'POST' && req.url === '/compile') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const data = JSON.parse(body);
                const code = data.code;
                const lang = data.language || 'c';

                // Temp directory
                const tmpDir = os.tmpdir();
                // Randomize filename to avoid collisions
                const id = Math.random().toString(36).substring(7);

                let cmd = "";
                let sourceFile = "";
                let exeFile = "";

                // --- LANGUAGE SWITCH ---
                if (lang === 'c') {
                    sourceFile = path.join(tmpDir, `code_${id}.c`);
                    exeFile = path.join(tmpDir, `code_${id}.exe`);
                    cmd = `gcc "${sourceFile}" -o "${exeFile}" && "${exeFile}"`;
                }
                else if (lang === 'cpp') {
                    sourceFile = path.join(tmpDir, `code_${id}.cpp`);
                    exeFile = path.join(tmpDir, `code_${id}.exe`);
                    cmd = `g++ "${sourceFile}" -o "${exeFile}" && "${exeFile}"`;
                }
                else if (lang === 'python') {
                    sourceFile = path.join(tmpDir, `code_${id}.py`);
                    cmd = `python "${sourceFile}"`;
                }
                else if (lang === 'javascript') {
                    sourceFile = path.join(tmpDir, `code_${id}.js`);
                    cmd = `node "${sourceFile}"`;
                }
                else if (lang === 'php') {
                    sourceFile = path.join(tmpDir, `code_${id}.php`);
                    cmd = `php "${sourceFile}"`;
                }
                else if (lang === 'java') {
                    // Java is tricky because class name must match filename.
                    // We'll trust the user used "Main" or try to regex it, 
                    // OR we just save as Main.java
                    sourceFile = path.join(tmpDir, 'Main.java');
                    // We must delete generic Main.class/java first to avoid issues
                    if (fs.existsSync(sourceFile)) fs.unlinkSync(sourceFile);

                    cmd = `javac "${sourceFile}" && java -cp "${tmpDir}" Main`;
                }
                else {
                    sourceFile = path.join(tmpDir, `code_${id}.txt`);
                    cmd = `echo "Langage ${lang} non supporté par le serveur."`;
                }

                fs.writeFileSync(sourceFile, code);

                // Execution
                exec(cmd, { timeout: 5000 }, (error, stdout, stderr) => {
                    let output = "";
                    let success = false;

                    if (error) {
                        // If it's a timeout
                        if (error.signal === 'SIGTERM') {
                            output = "Temps d'exécution dépassé (Timeout).";
                        } else {
                            // If it's a compilation/execution error
                            output = stderr || error.message;
                            // Some commands output to stdout even on error
                            if (stdout) output += "\n" + stdout;
                        }
                    } else {
                        success = true;
                        output = stdout;
                        if (stderr) output += "\n[STDERR] " + stderr;
                    }

                    // Cleanup (Optional / Best Effort)
                    // try { fs.unlinkSync(sourceFile); if(exeFile) fs.unlinkSync(exeFile); } catch(e){}

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: success, output: output }));
                });

            } catch (e) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: "Invalid JSON" }));
            }
        });
        return;
    }

    // --- AUTH & DB ENDPOINTS ---

    // DB HELPERS
    const DB_FILE = path.join(__dirname, 'users.db.json');

    function getDB() {
        if (!fs.existsSync(DB_FILE)) {
            // Init DB
            try {
                fs.writeFileSync(DB_FILE, JSON.stringify({ users: [] }, null, 2));
            } catch (e) {
                console.error("Error creating DB file:", e);
                return { users: [] }; // Return empty in memory if write fails, but this is critical
            }
        }
        try {
            const content = fs.readFileSync(DB_FILE, 'utf8');
            return content ? JSON.parse(content) : { users: [] };
        } catch (e) {
            console.error("Error reading DB:", e);
            return { users: [] };
        }
    }

    function saveDB(data) {
        fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
    }

    // 1. REGISTER
    if (req.method === 'POST' && req.url === '/register') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const { username, email, password } = JSON.parse(body);
                const db = getDB();

                // Check duplicate
                if (db.users.find(u => u.email === email)) {
                    res.writeHead(409, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: "EMAIL DÉJÀ PRIS. T'INSCRIS PAS DEUX FOIS." }));
                    return;
                }

                const newUser = {
                    id: Math.random().toString(36).substring(2),
                    username: username,
                    email: email,
                    password: password, // In prod: HASH THIS!
                    data: {
                        commits: [],
                        quizHistory: []
                    }
                };

                db.users.push(newUser);
                saveDB(db);

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: true, user: { username: newUser.username, email: newUser.email, data: newUser.data } }));

            } catch (e) {
                res.writeHead(500);
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    // 2. LOGIN
    if (req.method === 'POST' && req.url === '/login') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const { email, password } = JSON.parse(body);
                const db = getDB();

                const user = db.users.find(u => u.email === email && u.password === password);

                if (user) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({
                        success: true,
                        user: { username: user.username, email: user.email, data: user.data }
                    }));
                } else {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: "IDENTIFIANTS INCORRECTS. ESPION ?" }));
                }

            } catch (e) {
                res.writeHead(500);
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    // 3. SYNC DATA (SAVE)
    if (req.method === 'POST' && req.url === '/save-data') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const { email, key, value } = JSON.parse(body);
                const db = getDB();
                const userIndex = db.users.findIndex(u => u.email === email);

                if (userIndex !== -1) {
                    // Update specific data key
                    db.users[userIndex].data[key] = value;
                    saveDB(db);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true }));
                } else {
                    res.writeHead(404);
                    res.end(JSON.stringify({ success: false, error: "USER NOT FOUND" }));
                }

            } catch (e) {
                res.writeHead(500);
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    // 4. COMMIT CODE (GOGS SIMULATION)
    if (req.method === 'POST' && req.url === '/commit') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            try {
                const { email, code, lang, message } = JSON.parse(body);
                const db = getDB();
                const userIndex = db.users.findIndex(u => u.email === email);

                if (userIndex !== -1) {
                    const newCommit = {
                        id: Math.random().toString(36).substring(7),
                        timestamp: Date.now(),
                        code: code,
                        lang: lang,
                        message: message || "Update " + new Date().toLocaleTimeString()
                    };

                    if (!db.users[userIndex].data.commits) db.users[userIndex].data.commits = [];
                    db.users[userIndex].data.commits.unshift(newCommit); // Add to top

                    // Limit history to 50 commits to save space
                    if (db.users[userIndex].data.commits.length > 50) db.users[userIndex].data.commits.pop();

                    saveDB(db);

                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: true, commit: newCommit }));
                } else {
                    res.writeHead(404);
                    res.end(JSON.stringify({ success: false, error: "USER NOT FOUND" }));
                }

            } catch (e) {
                res.writeHead(500);
                res.end(JSON.stringify({ success: false, error: e.message }));
            }
        });
        return;
    }

    // 5. AI PROXY (MISTRAL)
    if (req.method === 'POST' && req.url === '/ai-completion') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
            const https = require('https');
            const API_KEY = "pfbO4KFP7TriMY3iZYm6mzRlfhFCmsQw";

            const options = {
                hostname: 'api.mistral.ai',
                path: '/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${API_KEY}`
                }
            };

            const proxyReq = https.request(options, (proxyRes) => {
                let data = '';
                proxyRes.on('data', (chunk) => { data += chunk; });
                proxyRes.on('end', () => {
                    res.writeHead(proxyRes.statusCode, { 'Content-Type': 'application/json' });
                    res.end(data);
                });
            });

            proxyReq.on('error', (e) => {
                console.error("Mistral Proxy Error:", e);
                res.writeHead(500);
                res.end(JSON.stringify({ error: "Proxy Error: " + e.message }));
            });

            proxyReq.write(body);
            proxyReq.end();
        });
        return;
    }

    res.writeHead(404);
    res.end();
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});
