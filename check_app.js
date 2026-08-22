const fs = require('fs');
let content = fs.readFileSync('z:/Univ/CyberModule/Mirai-Source-Code/dashboard/version2/backend/app.py', 'utf8');

if (content.includes("botcount_dist")) {
    console.log("Already updated");
} else {
    // We need to parse botcount to get the IPs
    console.log("Need to update app.py to get exact IPs");
}
