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
                if(err.code == 'ENOENT') {
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
                
                // Temp file
                const tmpDir = os.tmpdir();
                const sourceFile = path.join(tmpDir, 'cqcd_temp.c');
                const exeFile = path.join(tmpDir, 'cqcd_temp.exe');

                fs.writeFileSync(sourceFile, code);

                // Run GCC
                // -x c : force language to C
                // -o : output file
                exec(`gcc "${sourceFile}" -o "${exeFile}"`, (error, stdout, stderr) => {
                    let output = "";
                    let success = false;

                    if (error) {
                        // Compilation Error
                        output = stderr || error.message;
                    } else {
                        // Compilation Success, now Run it (if simple program)
                        success = true;
                        // For safety, we just say it compiled. Running arbitrary code is dangerous, 
                        // but if user wants we can add it. For now let's just show compilation result.
                        // Actually typically users want to see the RUN output. Let's try running it with timeout.
                        
                        exec(`"${exeFile}"`, { timeout: 2000 }, (runErr, runStdout, runStderr) => {
                           if (runErr) {
                               output = `[COMPILATION: OK]\n[RUNTIME ERROR]\n${runStderr || runErr.message}`;
                           } else {
                               output = `[COMPILATION: OK]\n[OUTPUT]\n${runStdout}`;
                           }
                           res.writeHead(200, { 'Content-Type': 'application/json' });
                           res.end(JSON.stringify({ success: true, output: output }));
                        });
                        return; // Async return
                    }

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
