const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\jesus.martinez\\Downloads\\rh-system-master\\rh-system-master\\rh-system-master\\app\\(dashboard)\\empleados\\[id]\\page.tsx', 'utf8');
const lines = content.split('\n');
console.log('--- Tabs declaration ---');
console.log(lines.slice(565, 595).join('\n'));
console.log('--- Historial tab content ---');
console.log(lines.slice(735, 755).join('\n'));
