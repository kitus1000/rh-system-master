const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\jesus.martinez\\Downloads\\rh-system-master\\rh-system-master\\rh-system-master\\app\\api\\movimientos\\autorizar-etapa\\route.ts', 'utf8');
const lines = content.split('\n');
console.log(lines.slice(450, 560).join('\n'));
