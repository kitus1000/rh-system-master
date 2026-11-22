const fs = require('fs');
const content = fs.readFileSync('C:\\Users\\jesus.martinez\\Downloads\\rh-system-master\\rh-system-master\\rh-system-master\\app\\globals.css', 'utf8');
const lines = content.split('\n');
console.log(lines.slice(198, 250).join('\n'));
