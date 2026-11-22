const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\jesus.martinez\\Downloads\\rh-system-master\\rh-system-master\\rh-system-master\\utils\\cofeprisRecetaConfig.ts', 'utf8');
const lines = content.split('\n');
const idx = lines.findIndex(l => l.includes('applyCofeprisPreset'));
console.log(lines.slice(idx - 2, idx + 25).join('\n'));
