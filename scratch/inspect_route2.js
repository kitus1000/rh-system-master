const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\jesus.martinez\\Downloads\\rh-system-master\\rh-system-master\\rh-system-master\\app\\api\\movimientos\\autorizar-etapa\\route.ts', 'utf8');
const lines = content.split('\n');
console.log('Total lines route:', lines.length);
console.log(lines.slice(250, 360).join('\n'));
