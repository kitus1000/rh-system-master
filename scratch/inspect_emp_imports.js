const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\jesus.martinez\\Downloads\\rh-system-master\\rh-system-master\\rh-system-master\\app\\(dashboard)\\empleados\\[id]\\page.tsx', 'utf8');
const lines = content.split('\n');
console.log(lines.slice(0, 25).join('\n'));
