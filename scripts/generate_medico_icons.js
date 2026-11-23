/**
 * Generador determinista de íconos PNG (RGBA con antialiasing 4x) y Splash Screens
 * para la App Android APK & PWA "Médico Bacís" (Grupo Minero Bacís).
 * Paleta oficial: Azul Rey Bacís (#0b2559 -> #1d4ed8), Cian Médico (#0ea5e9 / #14b8a6), Blanco (#ffffff) y Negro (#020617).
 */
const fs = require('fs')
const path = require('path')
const zlib = require('zlib')

const N3 = 'C:\\Users\\jesus.martinez\\Downloads\\rh-system-master\\rh-system-master\\rh-system-master'

// CRC32 table for PNG chunks
const crcTable = new Uint32Array(256)
for (let n = 0; n < 256; n++) {
  let c = n
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1)
  }
  crcTable[n] = c >>> 0
}

function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  }
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function encodePNG(width, height, rgba) {
  const raw = Buffer.alloc(height * (1 + width * 4))
  for (let y = 0; y < height; y++) {
    const rowOff = y * (1 + width * 4)
    raw[rowOff] = 0 // filter None
    rgba.copy(raw, rowOff + 1, y * width * 4, (y + 1) * width * 4)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const idat = zlib.deflateSync(raw, { level: 9 })
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return Buffer.concat([sig, pngChunk('IHDR', ihdr), pngChunk('IDAT', idat), pngChunk('IEND', Buffer.alloc(0))])
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v
}

function mix(a, b, t) {
  return a + (b - a) * t
}

function blendPixel(dst, r, g, b, a) {
  const alpha = clamp(a, 0, 1)
  const inv = 1 - alpha
  return [
    dst[0] * inv + r * alpha,
    dst[1] * inv + g * alpha,
    dst[2] * inv + b * alpha,
    clamp(dst[3] + alpha * (1 - dst[3]), 0, 1),
  ]
}

// Signed distance to rounded box centered at (cx, cy) with half-extents (hx, hy) and radius rad
function sdfRoundedBox(x, y, cx, cy, hx, hy, rad) {
  const dx = Math.abs(x - cx) - (hx - rad)
  const dy = Math.abs(y - cy) - (hy - rad)
  const out = Math.hypot(Math.max(dx, 0), Math.max(dy, 0))
  const inn = Math.min(Math.max(dx, dy), 0)
  return out + inn - rad
}

// Signed distance to line segment AB
function distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax
  const aby = by - ay
  const apx = px - ax
  const apy = py - ay
  const len2 = abx * abx + aby * aby
  const t = len2 > 0 ? clamp((apx * abx + apy * aby) / len2, 0, 1) : 0
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t))
}

// Minimal crisp stroke font for "GB" emblem at top crest (normalized coordinates in [0,1])
function distToGBBadge(nx, ny) {
  // Badge sits around y in [0.145, 0.255], x in [0.36, 0.64]
  let d = 999
  // Letter G centered around x=0.445, y=0.20
  const gx = 0.445, gy = 0.20, gr = 0.044
  const gd = Math.hypot(nx - gx, ny - gy)
  const ang = Math.atan2(ny - gy, nx - gx) // -PI..PI
  // Arc for G: skip right opening between -0.35 and +0.05 rad
  if (!(ang > -0.45 && ang < 0.05)) {
    d = Math.min(d, Math.abs(gd - gr))
  }
  // G horizontal bar
  d = Math.min(d, distToSegment(nx, ny, gx + 0.002, gy + 0.004, gx + gr, gy + 0.004))
  d = Math.min(d, distToSegment(nx, ny, gx + gr, gy + 0.004, gx + gr, gy + gr * 0.85))

  // Letter B around x=0.555, y=0.20
  const bx = 0.525, byTop = 0.156, byMid = 0.20, byBot = 0.244
  d = Math.min(d, distToSegment(nx, ny, bx, byTop, bx, byBot))
  d = Math.min(d, distToSegment(nx, ny, bx, byTop, bx + 0.036, byTop))
  d = Math.min(d, distToSegment(nx, ny, bx, byMid, bx + 0.038, byMid))
  d = Math.min(d, distToSegment(nx, ny, bx, byBot, bx + 0.040, byBot))
  // Upper bowl
  const bTopC = Math.hypot(nx - (bx + 0.036), ny - 0.178)
  if (nx >= bx + 0.036) d = Math.min(d, Math.abs(bTopC - 0.022))
  // Lower bowl
  const bBotC = Math.hypot(nx - (bx + 0.040), ny - 0.222)
  if (nx >= bx + 0.040) d = Math.min(d, Math.abs(bBotC - 0.022))
  return d
}

function sampleIconPixel(nx, ny, mode) {
  // mode: 'square' | 'round' | 'foreground'
  let col = [0, 0, 0, 0]

  // Scale slightly inwards for Android adaptive foreground safe zone
  let x = nx
  let y = ny
  if (mode === 'foreground') {
    x = (nx - 0.5) / 0.68 + 0.5
    y = (ny - 0.5) / 0.68 + 0.5
  }

  // 1. Background shape (not drawn for transparent foreground)
  if (mode !== 'foreground') {
    let shapeDist
    if (mode === 'round') {
      shapeDist = Math.hypot(nx - 0.5, ny - 0.5) - 0.485
    } else {
      shapeDist = sdfRoundedBox(nx, ny, 0.5, 0.5, 0.485, 0.485, 0.19)
    }

    if (shapeDist > 0.008) {
      return [0, 0, 0, 0]
    }
    const bgAlpha = clamp(0.5 - shapeDist / 0.008, 0, 1)

    // Deep Bacís Navy -> Royal Cobalt diagonal gradient
    const t = clamp(nx * 0.45 + ny * 0.55, 0, 1)
    let br = mix(11, 29, t)   // #0b -> #1d
    let bg = mix(24, 78, t)   // #18 -> #4e
    let bb = mix(58, 216, t)  // #3a -> #d8

    // Subtle dark obsidian bottom vignette
    const vig = clamp((ny - 0.65) / 0.35, 0, 1)
    br = mix(br, 2, vig * 0.55)
    bg = mix(bg, 6, vig * 0.55)
    bb = mix(bb, 23, vig * 0.55)

    // Subtle clinical cyan glow near center-top
    const glowD = Math.hypot(nx - 0.5, ny - 0.48)
    const glow = Math.exp(-glowD * glowD * 6.5)
    br = mix(br, 56, glow * 0.25)
    bg = mix(bg, 189, glow * 0.28)
    bb = mix(bb, 248, glow * 0.32)

    col = [br, bg, bb, bgAlpha]

    // Metallic crisp inner border ring
    const ringDist = Math.abs(shapeDist + 0.022)
    if (ringDist < 0.009) {
      const ra = clamp(1 - ringDist / 0.009, 0, 1) * 0.42 * bgAlpha
      col = blendPixel(col, 147, 197, 253, ra)
    }
  }

  // Only draw emblem within normalized emblem bounds
  if (x >= -0.05 && x <= 1.05 && y >= -0.05 && y <= 1.05) {
    // 2. Medical Shield halo behind cross (subtle translucent navy/white shield)
    const shieldD = sdfRoundedBox(x, y, 0.5, 0.56, 0.33, 0.30, 0.12)
    if (shieldD < 0.008) {
      const sa = clamp(0.5 - shieldD / 0.008, 0, 1)
      col = blendPixel(col, 2, 12, 34, sa * 0.48)
    }
    const shieldStroke = Math.abs(shieldD)
    if (shieldStroke < 0.011) {
      const ssa = clamp(1 - shieldStroke / 0.011, 0, 1) * 0.65
      col = blendPixel(col, 56, 189, 248, ssa)
    }

    // 3. Top Crest Pill with "GB" Bacís monogram
    const pillD = sdfRoundedBox(x, y, 0.5, 0.20, 0.18, 0.075, 0.065)
    if (pillD < 0.006) {
      const pa = clamp(0.5 - pillD / 0.006, 0, 1)
      col = blendPixel(col, 255, 255, 255, pa * 0.96)
    }
    const gbD = distToGBBadge(x, y)
    if (gbD < 0.0135) {
      const ga = clamp(1 - (gbD - 0.0065) / 0.007, 0, 1)
      col = blendPixel(col, 15, 43, 120, ga)
    }

    // 4. Crisp Pure White Medical Cross (centered at x=0.5, y=0.56)
    const crossV = sdfRoundedBox(x, y, 0.5, 0.56, 0.088, 0.235, 0.032)
    const crossH = sdfRoundedBox(x, y, 0.5, 0.56, 0.235, 0.088, 0.032)
    const crossD = Math.min(crossV, crossH)

    // Soft drop shadow for cross
    const crossShV = sdfRoundedBox(x, y - 0.015, 0.5, 0.56, 0.095, 0.242, 0.036)
    const crossShH = sdfRoundedBox(x, y - 0.015, 0.5, 0.56, 0.242, 0.095, 0.036)
    const crossShD = Math.min(crossShV, crossShH)
    if (crossShD < 0.025 && crossD > 0) {
      const sha = clamp(1 - crossShD / 0.025, 0, 1) * 0.38
      col = blendPixel(col, 2, 6, 23, sha)
    }

    if (crossD < 0.006) {
      const ca = clamp(0.5 - crossD / 0.006, 0, 1)
      // Subtle top-to-bottom pearl white gradient
      const wt = clamp((y - 0.32) / 0.48, 0, 1)
      col = blendPixel(col, mix(255, 235, wt), mix(255, 244, wt), mix(255, 255, wt), ca)
    }

    // 5. Vivid Medical Teal / Cobalt ECG Heartbeat Pulse Line across the Medical Cross
    const pts = [
      [0.24, 0.565],
      [0.37, 0.565],
      [0.415, 0.565],
      [0.45, 0.445],
      [0.505, 0.675],
      [0.555, 0.515],
      [0.59, 0.565],
      [0.76, 0.565],
    ]
    let pulseD = 999
    for (let i = 0; i < pts.length - 1; i++) {
      pulseD = Math.min(pulseD, distToSegment(x, y, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]))
    }
    if (pulseD < 0.022) {
      const pa = clamp(1 - (pulseD - 0.013) / 0.009, 0, 1)
      // Gradient along pulse: Royal Blue -> Medical Teal
      const pt = clamp((x - 0.24) / 0.52, 0, 1)
      col = blendPixel(col, mix(29, 13, pt), mix(78, 148, pt), mix(216, 136, pt), pa)
    }
  }

  return col
}

function renderIconPNG(size, mode) {
  const buf = Buffer.alloc(size * size * 4)
  const samples = size <= 96 ? 3 : 2
  const invN = 1 / (samples * samples)
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < samples; sy++) {
        for (let sx = 0; sx < samples; sx++) {
          const nx = (px + (sx + 0.5) / samples) / size
          const ny = (py + (sy + 0.5) / samples) / size
          const c = sampleIconPixel(nx, ny, mode)
          r += c[0] * c[3]
          g += c[1] * c[3]
          b += c[2] * c[3]
          a += c[3]
        }
      }
      a *= invN
      const off = (py * size + px) * 4
      if (a > 0.001) {
        buf[off] = clamp(Math.round((r * invN) / a), 0, 255)
        buf[off + 1] = clamp(Math.round((g * invN) / a), 0, 255)
        buf[off + 2] = clamp(Math.round((b * invN) / a), 0, 255)
        buf[off + 3] = clamp(Math.round(a * 255), 0, 255)
      }
    }
  }
  return encodePNG(size, size, buf)
}

function renderSplashPNG(width, height) {
  const buf = Buffer.alloc(width * height * 4)
  const iconSize = Math.round(Math.min(width, height) * 0.34)
  const ix0 = Math.round((width - iconSize) / 2)
  const iy0 = Math.round((height - iconSize) / 2)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const nx = x / width
      const ny = y / height
      const t = clamp(nx * 0.35 + ny * 0.65, 0, 1)
      let col = [mix(7, 17, t), mix(18, 44, t), mix(44, 118, t), 1]

      const glowD = Math.hypot((x - width * 0.5) / Math.min(width, height), (y - height * 0.5) / Math.min(width, height))
      const glow = Math.exp(-glowD * glowD * 5.0)
      col = blendPixel(col, 37, 99, 235, glow * 0.38)

      if (x >= ix0 && x < ix0 + iconSize && y >= iy0 && y < iy0 + iconSize) {
        const ic = sampleIconPixel((x - ix0 + 0.5) / iconSize, (y - iy0 + 0.5) / iconSize, 'square')
        col = blendPixel(col, ic[0], ic[1], ic[2], ic[3])
      }

      const off = (y * width + x) * 4
      buf[off] = clamp(Math.round(col[0]), 0, 255)
      buf[off + 1] = clamp(Math.round(col[1]), 0, 255)
      buf[off + 2] = clamp(Math.round(col[2]), 0, 255)
      buf[off + 3] = 255
    }
  }
  return encodePNG(width, height, buf)
}

function writeBin(filePath, buf) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, buf)
}

const icon512 = renderIconPNG(512, 'square')
const icon192 = renderIconPNG(192, 'square')

// 1. Public PWA & Web assets
writeBin(path.join(N3, 'public', 'medico-icon-512.png'), icon512)
writeBin(path.join(N3, 'public', 'medico-icon-192.png'), icon192)
writeBin(path.join(N3, 'public', 'medico-app', 'medico-icon-512.png'), icon512)
writeBin(path.join(N3, 'public', 'medico-app', 'medico-icon-192.png'), icon192)

// Also crisp SVG icon for UI headers
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" fill="none">
  <defs>
    <linearGradient id="mbBg" x1="10" y1="6" x2="110" y2="114" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0b2559"/>
      <stop offset="55%" stop-color="#1d4ed8"/>
      <stop offset="100%" stop-color="#020617"/>
    </linearGradient>
    <linearGradient id="mbPulse" x1="28" y1="68" x2="92" y2="68" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#1d4ed8"/>
      <stop offset="100%" stop-color="#0d9488"/>
    </linearGradient>
  </defs>
  <rect x="4" y="4" width="112" height="112" rx="28" fill="url(#mbBg)" stroke="#60a5fa" stroke-width="2.5" stroke-opacity="0.55"/>
  <rect x="20" y="34" width="80" height="68" rx="18" fill="#020c22" fill-opacity="0.48" stroke="#38bdf8" stroke-width="2" stroke-opacity="0.7"/>
  <rect x="38" y="14" width="44" height="18" rx="9" fill="#ffffff"/>
  <text x="60" y="27" text-anchor="middle" font-family="Arial,sans-serif" font-weight="900" font-size="12" fill="#0f2b78" letter-spacing="1">GB</text>
  <rect x="49.5" y="40" width="21" height="56" rx="5.5" fill="#ffffff"/>
  <rect x="32" y="57.5" width="56" height="21" rx="5.5" fill="#ffffff"/>
  <polyline points="28,68 45,68 50,68 54,53 60.5,82 66.5,62 71,68 92,68" fill="none" stroke="url(#mbPulse)" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`
fs.writeFileSync(path.join(N3, 'public', 'medico-icon.svg'), svgIcon, 'utf8')
fs.writeFileSync(path.join(N3, 'public', 'medico-app', 'medico-icon.svg'), svgIcon, 'utf8')

// 2. Android Mipmap Densities inside android-medico/app/src/main/res
const resBase = path.join(N3, 'android-medico', 'app', 'src', 'main', 'res')
const densities = [
  { name: 'mdpi', icon: 48, fg: 108 },
  { name: 'hdpi', icon: 72, fg: 162 },
  { name: 'xhdpi', icon: 96, fg: 216 },
  { name: 'xxhdpi', icon: 144, fg: 324 },
  { name: 'xxxhdpi', icon: 192, fg: 432 },
]

for (const d of densities) {
  const dir = path.join(resBase, `mipmap-${d.name}`)
  writeBin(path.join(dir, 'ic_launcher.png'), renderIconPNG(d.icon, 'square'))
  writeBin(path.join(dir, 'ic_launcher_round.png'), renderIconPNG(d.icon, 'round'))
  writeBin(path.join(dir, 'ic_launcher_foreground.png'), renderIconPNG(d.fg, 'foreground'))
}

// 3. Android Splash Screens
const splashMain = renderSplashPNG(480, 800)
const splashLand = renderSplashPNG(800, 480)
writeBin(path.join(resBase, 'drawable', 'splash.png'), splashMain)
for (const d of ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']) {
  writeBin(path.join(resBase, `drawable-port-${d}`, 'splash.png'), splashMain)
  writeBin(path.join(resBase, `drawable-land-${d}`, 'splash.png'), splashLand)
}

console.log('Generated Bacis Medical PNG/SVG icons & Android mipmaps + splash screens successfully.')
