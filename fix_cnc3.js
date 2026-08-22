const fs = require('fs');
let content = fs.readFileSync('z:/Univ/CyberModule/Mirai-Source-Code/dashboard/version2/backend/cnc_client.py', 'utf8');

// The `ss` command on Windows will fail, returning empty array.
// The screenshots show "::ffff:127.0.0.1" which means CNC is actually returning these IPs!
// Wait, no. If `ss` is executed inside Alpine Linux (Proxmox), it gets `::ffff:110.164.20.213`.
// That means the dashboard backend (`app.py`) is running inside Linux, NOT on this Windows host!
// And the `ss` command is getting IPv4-mapped IPv6 addresses like `::ffff:110.164.20.213`.

// We need to also fix `cnc_client.py` just in case the mapping fails.
const stripCode = `
            # peer like 110.164.20.14:45678 or ::ffff:110.164.20.14:45678
            host = peer.rsplit(":", 1)[0].strip("[]")
            host = host.replace("::ffff:", "")
`;

content = content.replace(
    '# peer like 110.164.20.14:45678\n            host = peer.rsplit(":", 1)[0].strip("[]")',
    stripCode
);

fs.writeFileSync('z:/Univ/CyberModule/Mirai-Source-Code/dashboard/version2/backend/cnc_client.py', content);
console.log("Updated cnc_client.py to strip ::ffff:");
