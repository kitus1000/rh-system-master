const fs = require('fs');
const path = require('path');

function searchInFile(filePath) {
  try {
    const text = fs.readFileSync(filePath, 'utf8');
    if (text.includes("from('empleados')") || text.includes('from("empleados")')) {
      const lines = text.split('\n');
      lines.forEach((line, idx) => {
        if (line.includes('user?.id') || line.includes('profile?.id') || line.includes('email') || line.includes('id_usuario')) {
          console.log(`${filePath}:${idx + 1} -> ${line.trim()}`);
        }
      });
    }
  } catch (e) {}
}

function walk(dir) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    if (item.includes('node_modules') || item.includes('.next') || item.includes('.git')) continue;
    const full = path.join(dir, item);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      walk(full);
    } else if (item.endsWith('.tsx') || item.endsWith('.ts')) {
      searchInFile(full);
    }
  }
}

walk('C:\\Users\\jesus.martinez\\Downloads\\rh-system-master\\rh-system-master\\rh-system-master\\app');
