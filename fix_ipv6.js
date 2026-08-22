const fs = require('fs');
let content = fs.readFileSync('z:/Univ/CyberModule/Mirai-Source-Code/dashboard/version2/frontend/app.js', 'utf8');

// The IP is coming in as "::ffff:110.164.20.213" because it's an IPv4-mapped IPv6 address.
// We need to strip "::ffff:" in frontend so it parses the first octet correctly.
const stripIpCode = `
      // Clean IPv4-mapped IPv6 addresses (e.g. ::ffff:110.164.20.213 -> 110.164.20.213)
      let cleanIp = ip.replace(/^::ffff:/, '');
      const firstOctet = parseInt(cleanIp.split('.')[0] || "10");
`;

content = content.replace(
    'const firstOctet = parseInt(ip.split(\'.\')[0] || "10");',
    stripIpCode
);

content = content.replace(
    'ip: ip,',
    'ip: cleanIp,'
);

fs.writeFileSync('z:/Univ/CyberModule/Mirai-Source-Code/dashboard/version2/frontend/app.js', content);
console.log("Updated frontend to handle IPv6 mapped addresses.");
