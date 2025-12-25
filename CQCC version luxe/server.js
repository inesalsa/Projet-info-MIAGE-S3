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

    res.writeHead(404);
    res.end();
});

server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}/`);
});
