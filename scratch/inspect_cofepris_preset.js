const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\jesus.martinez\\Downloads\\rh-system-master\\rh-system-master\\rh-system-master\\utils\\cofeprisRecetaConfig.ts', 'utf8');
const lines = content.split('\n');
console.log(lines.slice(160, 220).join('\n'));
