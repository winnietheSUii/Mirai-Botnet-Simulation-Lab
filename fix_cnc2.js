const fs = require('fs');
let content = fs.readFileSync('z:/Univ/CyberModule/Mirai-Source-Code/dashboard/version2/backend/cnc_client.py', 'utf8');

// The default client tries 127.0.0.1:23, but we should make sure it points to LAB_C2_IP if defined
content = content.replace(
    'host=os.environ.get("CNC_HOST", "127.0.0.1")',
    'host=os.environ.get("CNC_HOST", os.environ.get("LAB_C2_IP", "185.10.20.100"))'
);

fs.writeFileSync('z:/Univ/CyberModule/Mirai-Source-Code/dashboard/version2/backend/cnc_client.py', content);
console.log("Updated default CNC host in cnc_client.py");
