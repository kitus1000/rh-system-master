const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const baseSrc = 'C:\\Users\\jesus.martinez\\Downloads\\rh-system-master\\rh-system-master\\rh-system-master';
const baseDst = 'C:\\Users\\jesus.martinez\\Downloads\\rh-system-master\\rh-system-master';

const files = [
  'components/TrayectoriaMinaHistorial.tsx',
  'app/(dashboard)/mi-perfil/page.tsx',
  'app/(dashboard)/empleados/[id]/page.tsx',
  'app/(dashboard)/movimientos-sindicato/page.tsx',
  'app/globals.css',
];

for (const rel of files) {
  const src = path.join(baseSrc, rel);
  const dst = path.join(baseDst, rel);

  const dstDir = path.dirname(dst);
  if (!fs.existsSync(dstDir)) {
    fs.mkdirSync(dstDir, { recursive: true });
  }

  const content = fs.readFileSync(src);
  fs.writeFileSync(dst, content);

  const hSrc = crypto.createHash('sha256').update(content).digest('hex');
  const hDst = crypto.createHash('sha256').update(fs.readFileSync(dst)).digest('hex');

  console.log(`Sync ${rel}: ${hSrc === hDst ? 'SUCCESS (MATCH)' : 'FAILED'}`);
}
