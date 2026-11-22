const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\jesus.martinez\\Downloads\\rh-system-master\\rh-system-master\\rh-system-master\\app\\(dashboard)\\mi-perfil\\page.tsx', 'utf8');
const lines = content.split('\n');
console.log('Lines in mi-perfil:', lines.length);
console.log(lines.slice(350, 480).join('\n'));
