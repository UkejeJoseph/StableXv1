import fs from 'fs';
import path from 'path';

const rootDir = process.cwd();
const serverDir = path.join(rootDir, 'server');
const srcDir = path.join(rootDir, 'src');

// 1. DISCOVER BACKEND ENDPOINTS
function getBackendEndpoints() {
    const endpoints = [];
    const routeFiles = [];

    function walkDir(dir) {
        if (!fs.existsSync(dir)) return;
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                walkDir(fullPath);
            } else if (fullPath.endsWith('Routes.js') || fullPath.endsWith('.js')) {
                const content = fs.readFileSync(fullPath, 'utf-8');
                const routeRegex = /router\.(get|post|put|patch|delete)\(['"`](.*?)['"`]/g;
                let match;
                let found = false;
                while ((match = routeRegex.exec(content)) !== null) {
                    found = true;
                    endpoints.push({
                        method: match[1].toUpperCase(),
                        path: match[2],
                        file: fullPath.replace(serverDir, 'server').replace(/\\/g, '/')
                    });
                }
                if (found) {
                    routeFiles.push(fullPath.replace(serverDir, 'server').replace(/\\/g, '/'));
                }
            }
        }
    }

    walkDir(path.join(serverDir, 'routes'));
    if (fs.existsSync(path.join(serverDir, 'index.js'))) {
        const content = fs.readFileSync(path.join(serverDir, 'index.js'), 'utf-8');
        const appRouteRegex = /app\.(get|post|put|patch|delete)\(['"`](.*?)['"`]/g;
        let match;
        while ((match = appRouteRegex.exec(content)) !== null) {
            endpoints.push({
                method: match[1].toUpperCase(),
                path: match[2],
                file: 'server/index.js'
            });
        }
    }

    return { endpoints, routeFiles };
}

// 2. DISCOVER ALL FRONTEND FILES
function getFrontendFiles() {
    const webFiles = [];
    const mobileFiles = [];

    function walkDir(dir) {
        if (!fs.existsSync(dir)) return;
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const fullPath = path.join(dir, file);
            if (fs.statSync(fullPath).isDirectory()) {
                walkDir(fullPath);
            } else if (/\.(js|jsx|ts|tsx|vue|svelte)$/.test(file)) {
                const relPath = fullPath.replace(srcDir, 'src').replace(/\\/g, '/');
                // The APP / MOBILE views are directly in src/pages/ (e.g. Deposit.tsx)
                // The WEB views are in src/pages/web/ (e.g. WebDeposit.tsx) and src/pages/admin
                // Components and Hooks are shared, we will put them in webFiles but they might be consumed by both.
                if (relPath.startsWith('src/pages/') && !relPath.startsWith('src/pages/web/') && !relPath.startsWith('src/pages/admin/')) {
                    mobileFiles.push(relPath);
                } else {
                    webFiles.push(relPath);
                }
            }
        }
    }
    walkDir(srcDir);
    return { webFiles, mobileFiles };
}

// 3, 4, 6
function analyzeFrontend(webFiles, mobileFiles) {
    const apiCalls = { web: [], mobile: [] };
    const buttons = { web: [], mobile: [] };
    const uiIssues = { web: [], mobile: [] };

    const fetchRegex = /fetch\(['"`](.*?)['"`]/g;
    const axiosRegex = /axios\.(get|post|put|patch|delete)\(['"`](.*?)['"`]/g;
    const hookRegex = /(useQuery|useMutation)\(.*,.*['"`](.*?)['"`]/g;

    function scanFiles(files, type) {
        for (const file of files) {
            const fullPath = path.join(rootDir, file);
            const content = fs.readFileSync(fullPath, 'utf-8');
            const lines = content.split('\n');

            let hasLoading = /isLoading|loading|setLoading/i.test(content);
            let hasError = /error|setError|toast\.error|Alert\./i.test(content);
            let hasEmpty = /length === 0|!.*?data|empty/i.test(content);
            let hasBalance = /balance|amount/i.test(content);
            let hasConfirm = /confirm|Dialog|Modal/i.test(content);

            if (file.includes('pages/') || file.includes('screens/') || file.includes('views/')) {
                uiIssues[type].push({
                    screen: file,
                    missingLoading: !hasLoading ? 'YES' : 'NO',
                    missingError: !hasError ? 'YES' : 'NO',
                    missingEmpty: !hasEmpty ? 'YES' : 'NO',
                    missingConfirm: !hasConfirm ? 'YES' : 'NO',
                    balanceRefs: hasBalance ? 'YES' : 'NO'
                });
            }

            lines.forEach((line, i) => {
                const lineNum = i + 1;

                let m;
                // Check fetch/axios
                while ((m = fetchRegex.exec(line)) !== null || (m = axiosRegex.exec(line)) !== null) {
                    let endpoint = m[1] || m[2];
                    if (m[0].startsWith('axios')) endpoint = m[2];
                    apiCalls[type].push({ file, line: lineNum, endpoint, raw: line.trim() });
                }

                while ((m = hookRegex.exec(line)) !== null) {
                    apiCalls[type].push({ file, line: lineNum, endpoint: m[2], raw: line.trim() });
                }

                if (line.includes('<Button') || line.includes('<button')) {
                    buttons[type].push({ element: line.trim(), file, line: lineNum });
                }
            });
        }
    }

    scanFiles(webFiles, 'web');
    scanFiles(mobileFiles, 'mobile');

    return { apiCalls, buttons, uiIssues };
}

function runAudit() {
    const { endpoints, routeFiles } = getBackendEndpoints();
    const { webFiles, mobileFiles } = getFrontendFiles();
    const { apiCalls, buttons, uiIssues } = analyzeFrontend(webFiles, mobileFiles);

    let report = `════════════════════\nBACKEND ENDPOINTS DISCOVERED: \n════════════════════\n`;
    const groupedEndpoints = {};
    for (const ep of endpoints) {
        if (!groupedEndpoints[ep.file]) groupedEndpoints[ep.file] = [];
        groupedEndpoints[ep.file].push(`${ep.method} ${ep.path}`);
    }

    for (const [file, eps] of Object.entries(groupedEndpoints)) {
        report += `${file} endpoints:\n`;
        for (const ep of eps) {
            report += `- ${ep}\n`;
        }
        report += '\n';
    }

    report += `════════════════════\nFRONTEND FILES DISCOVERED:\n════════════════════\nWEB:\n`;
    webFiles.forEach(f => report += `- ${f}\n`);
    report += `\nAPP/MOBILE TSX:\n`;
    mobileFiles.forEach(f => report += `- ${f}\n`);

    report += `\n════════════════════\nAPI CONSUMPTION REPORT:\n════════════════════\n`;

    const uncalledEndpoints = [];

    endpoints.forEach(ep => {
        const epPath = ep.path.replace(/^\//, ''); // remove leading slash

        let calledWeb = false, calledMob = false;
        let webCallDet = null, mobCallDet = null;

        for (const call of apiCalls.web) {
            if (call.endpoint && call.endpoint.includes(epPath) && epPath.length > 1) {
                calledWeb = true; webCallDet = call; break;
            }
        }
        for (const call of apiCalls.mobile) {
            if (call.endpoint && call.endpoint.includes(epPath) && epPath.length > 1) {
                calledMob = true; mobCallDet = call; break;
            }
        }

        const fullGuess = ep.file.includes('auth') ? '/api/auth' + ep.path :
            ep.file.includes('user') ? '/api/users' + ep.path :
                ep.file.includes('wallet') ? '/api/wallet' + ep.path :
                    ep.file.includes('deposit') ? '/api/deposits' + ep.path :
                        ep.path;

        report += 'ENDPOINT: ' + ep.method + ' ' + fullGuess + ' -> ' + ep.file + '\n';

        if (calledWeb) {
            report += 'WEB: ✅ CALLED\n  File: ' + webCallDet.file + ' + Line ' + webCallDet.line + '\n';
        } else {
            report += 'WEB: ❌ NOT CALLED\n';
        }

        if (calledMob) {
            report += 'MOBILE: ✅ CALLED\n  File: ' + mobCallDet.file + ' + Line ' + mobCallDet.line + '\n';
        } else {
            report += 'MOBILE: ❌ NOT CALLED\n';
        }

        if (!calledWeb && !calledMob) {
            uncalledEndpoints.push(ep.method + ' ' + fullGuess + ' -> ' + ep.file);
        }
        report += '\n';
    });

    report += '════════════════════\nBUTTONS WITHOUT BACKEND:\n════════════════════\n';
    buttons.web.concat(buttons.mobile).forEach(btn => {
        if (!btn.element.includes('onClick') && !btn.element.includes('type="submit"')) {
            report += '- Button: ' + btn.element.substring(0, 50) + '... | File: ' + btn.file + ' | Line: ' + btn.line + ' | Issue: No clear click handler found\n';
        }
    });

    report += '\n════════════════════\nENDPOINTS WITHOUT ANY UI:\n════════════════════\n';
    uncalledEndpoints.forEach(ep => {
        report += '- ' + ep + ' | Impact: May be unused or admin-only\n';
    });

    report += '\n════════════════════\nUI ISSUES PER SCREEN:\n════════════════════\n';
    uiIssues.web.concat(uiIssues.mobile).forEach(ui => {
        report += '- Screen name: ' + ui.screen + '\n';
        report += '  Missing loading state: ' + ui.missingLoading + '\n';
        report += '  Missing error state: ' + ui.missingError + '\n';
        report += '  Missing empty state: ' + ui.missingEmpty + '\n';
        report += '  Missing confirmation dialog: ' + ui.missingConfirm + '\n\n';
    });

    fs.writeFileSync(path.join(rootDir, 'frontend_audit_report.txt'), report);
}

runAudit();
