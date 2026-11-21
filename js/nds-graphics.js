// NDS Mario Kart (MKDS) 風格畫質升級模組
// 採用非侵入式模組化掛載：不破壞原有遊戲物理、連線與題庫邏輯，並支援即時切換「NDS 強化 / NDS 像素 / 原版」三種畫質模式。
import * as THREE from '../vendor/three/three.module.js';

const STORAGE_KEY = 'cwsj_mk_gfx_mode_v1';
const MODES = ['nds-hd', 'nds-retro', 'classic'];
const MODE_META = {
  'nds-hd': {
    shortLabel: '✨ 畫質: NDS強化',
    garageLabel: '✨ NDS 街機強化 (推薦)',
    toast: '✨ 已切換至「NDS 街機強化」：鮮明卡通階調光影＋方格像素草地＋立體描邊！'
  },
  'nds-retro': {
    shortLabel: '🕹️ 畫質: NDS像素',
    garageLabel: '🕹️ NDS 掌機像素 (240p)',
    toast: '🕹️ 已切換至「NDS 掌機像素」：240p 原生像素渲染＋RGB666 網點抖動（題目保持高清）！'
  },
  classic: {
    shortLabel: '🎨 畫質: 原版',
    garageLabel: '🎨 原版標準畫質',
    toast: '🎨 已切換至「原版標準畫質」'
  }
};

const THEME_PALETTES = {
  meadow: {
    checkA: '#46c93a', checkB: '#35b22b', accent: '#7be85e', detail: '#fef08a',
    hemiSky: 0x9be7ff, hemiGround: 0x3b9e2b, hemiInt: 0.92,
    sunCol: 0xfff8dc, sunInt: 1.55,
    hillA: '#2ea829', hillB: '#238920', hillStripe: '#56d646', cloudTint: '#ffffff', cloudRim: '#bae6fd'
  },
  beach: {
    checkA: '#fde68a', checkB: '#fcd34d', accent: '#fef3c7', detail: '#fb7185',
    hemiSky: 0xffedd5, hemiGround: 0xd97706, hemiInt: 0.95,
    sunCol: 0xffedd5, sunInt: 1.62,
    hillA: '#0284c7', hillB: '#0369a1', hillStripe: '#38bdf8', cloudTint: '#fff7ed', cloudRim: '#fed7aa'
  },
  snow: {
    checkA: '#f8fafc', checkB: '#dbeafe', accent: '#ffffff', detail: '#7dd3fc',
    hemiSky: 0xe0f2fe, hemiGround: 0x93c5fd, hemiInt: 1.02,
    sunCol: 0xffffff, sunInt: 1.48,
    hillA: '#cbd5e1', hillB: '#94a3b8', hillStripe: '#f8fafc', cloudTint: '#f8fafc', cloudRim: '#bfdbfe'
  },
  lava: {
    checkA: '#292524', checkB: '#1c1917', accent: '#ea580c', detail: '#facc15',
    hemiSky: 0xfdba74, hemiGround: 0x7c2d12, hemiInt: 0.78,
    sunCol: 0xffedd5, sunInt: 1.42,
    hillA: '#451a03', hillB: '#292524', hillStripe: '#ea580c', cloudTint: '#fed7aa', cloudRim: '#fb923c'
  },
  candy: {
    checkA: '#fce7f3', checkB: '#fbcfe8', accent: '#fff1f2', detail: '#34d399',
    hemiSky: 0xfdf2f8, hemiGround: 0xf472b6, hemiInt: 0.96,
    sunCol: 0xfffbeb, sunInt: 1.52,
    hillA: '#f472b6', hillB: '#ec4899', hillStripe: '#fde047', cloudTint: '#fff1f2', cloudRim: '#fbcfe8'
  },
  rainbow: {
    checkA: '#0b1026', checkB: '#111936', accent: '#38bdf8', detail: '#f472b6',
    hemiSky: 0xc084fc, hemiGround: 0x1e1b4b, hemiInt: 0.92,
    sunCol: 0xffffff, sunInt: 1.50,
    hillA: '#312e81', hillB: '#1e1b4b', hillStripe: '#22d3ee', cloudTint: '#e0e7ff', cloudRim: '#c084fc'
  }
};

function readInitialMode() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && MODES.includes(saved)) return saved;
  } catch (_) {}
  return 'nds-hd';
}

function saveMode(mode) {
  try { window.localStorage.setItem(STORAGE_KEY, mode); } catch (_) {}
}

function protectSharedTexture(tex) {
  tex.userData = tex.userData || {};
  tex.userData.__ndsProtected = true;
  tex.dispose = () => {};
  return tex;
}

function initNdsGraphicsEngine() {
  if (window.__cwsjNdsGfxLoaded) return;
  window.__cwsjNdsGfxLoaded = true;

  let currentMode = readInitialMode();
  const sharedUniforms = {
    uNdsCel: { value: currentMode === 'classic' ? 0.0 : 1.0 },
    uNdsRetro: { value: currentMode === 'nds-retro' ? 1.0 : 0.0 }
  };

  let mainRenderer = null;
  let mainScene = null;
  let mainCamera = null;
  let origSetPixelRatio = null;
  let origSetSize = null;
  let lastRequestedDpr = Math.min(window.devicePixelRatio || 1, 1.75);
  let lastLogicalW = window.innerWidth || 800;
  let lastLogicalH = window.innerHeight || 600;
  let maxAnisotropy = 4;

  let previewRenderer = null;
  let previewScene = null;

  const groundTexCache = new Map();
  let ndsItemBoxTex = null;
  let cloudHeroTex = null;
  let cloudSoftTex = null;
  let puffSmokeTex = null;
  let puffSparkTex = null;

  const outlineMeshes = new Set();
  const upgradedGroundMeshes = new Set();
  const upgradedItemMeshes = new Set();

  let ndsSkyGroup = null;
  let ndsParticleGroup = null;
  const puffPool = [];
  let puffCursor = 0;
  let lastPlayerPos = new THREE.Vector3();
  let hasLastPlayerPos = false;
  let puffSpawnAccum = 0;
  let lastFrameTime = performance.now() * 0.001;
  let lastTrackSignature = '';
  let activeTheme = 'meadow';

  // 1. 建立 NDS 視界頂層微掃描線（只喺 nds-retro 顯示，且位於 HUD 下方唔遮擋乘數題）
  function ensureRetroOverlayCss() {
    if (document.getElementById('nds-gfx-style')) return;
    const style = document.createElement('style');
    style.id = 'nds-gfx-style';
    style.textContent = `
      html.nds-retro-mode #game-canvas {
        image-rendering: pixelated;
        image-rendering: crisp-edges;
      }
      #nds-lcd-overlay {
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 3;
        display: none;
        background:
          repeating-linear-gradient(
            0deg,
            rgba(0, 0, 0, 0.0) 0px,
            rgba(0, 0, 0, 0.0) 2px,
            rgba(15, 23, 42, 0.11) 3px
          ),
          radial-gradient(circle at center, transparent 68%, rgba(2, 6, 23, 0.22) 100%);
      }
      html.nds-retro-mode #nds-lcd-overlay {
        display: block;
      }
      .nds-garage-btn {
        background: linear-gradient(180deg, #fde047, #f59e0b);
        color: #0f172a;
        border: 2px solid #b45309;
        border-radius: 10px;
        padding: 5px 10px;
        font-size: 12px;
        font-weight: 900;
        cursor: pointer;
        box-shadow: 0 2px 0 #92400e;
        white-space: nowrap;
      }
      .nds-garage-btn:active {
        transform: translateY(1px);
      }
    `;
    document.head.appendChild(style);

    const root = document.getElementById('game-root') || document.body;
    if (root && !document.getElementById('nds-lcd-overlay')) {
      const lcd = document.createElement('div');
      lcd.id = 'nds-lcd-overlay';
      const canvas = document.getElementById('game-canvas');
      if (canvas && canvas.nextSibling) root.insertBefore(lcd, canvas.nextSibling);
      else root.appendChild(lcd);
    }
    document.documentElement.classList.toggle('nds-retro-mode', currentMode === 'nds-retro');
  }

  // 2. 生成 NDS 風格 128x128 雙色方格像素地面貼圖（NearestFilter 呈現鮮明掌機紋理）
  function getGroundTexture(theme) {
    const key = THEME_PALETTES[theme] ? theme : 'meadow';
    if (groundTexCache.has(key)) return groundTexCache.get(key);
    const pal = THEME_PALETTES[key];
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    // 2x2 經典 Mario Kart DS 方格底色
    for (let gy = 0; gy < 2; gy++) {
      for (let gx = 0; gx < 2; gx++) {
        ctx.fillStyle = (gx + gy) % 2 === 0 ? pal.checkA : pal.checkB;
        ctx.fillRect(gx * 32, gy * 32, 32, 32);
      }
    }

    // 像素細節點綴（小草葉、貝殼紋、冰晶、熔岩裂縫、糖針或星塵）
    const rng = (seed) => {
      const x = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
      return x - Math.floor(x);
    };

    if (key === 'meadow') {
      for (let i = 0; i < 28; i++) {
        const px = Math.floor(rng(i + 1) * 60) + 2;
        const py = Math.floor(rng(i + 51) * 60) + 2;
        ctx.fillStyle = i % 5 === 0 ? pal.detail : pal.accent;
        ctx.fillRect(px, py, 2, 2);
        if (i % 3 === 0) ctx.fillRect(px + 1, py - 1, 1, 2);
      }
    } else if (key === 'beach') {
      ctx.fillStyle = pal.accent;
      for (let y = 6; y < 64; y += 16) {
        for (let x = 0; x < 64; x += 8) {
          ctx.fillRect(x, y + ((x >> 3) % 2), 5, 1);
        }
      }
      ctx.fillStyle = pal.detail;
      ctx.fillRect(14, 18, 3, 2);
      ctx.fillRect(46, 48, 3, 2);
    } else if (key === 'snow') {
      for (let i = 0; i < 24; i++) {
        const px = Math.floor(rng(i + 7) * 60) + 2;
        const py = Math.floor(rng(i + 83) * 60) + 2;
        ctx.fillStyle = i % 2 === 0 ? pal.accent : pal.detail;
        ctx.fillRect(px, py, 2, 1);
        ctx.fillRect(px + 1, py - 1, 1, 3);
      }
    } else if (key === 'lava') {
      // 庫巴城堡黑曜石磚縫＋發光熔岩裂紋
      ctx.fillStyle = '#0c0a09';
      for (let y = 0; y < 64; y += 16) ctx.fillRect(0, y, 64, 1);
      for (let x = 0; x < 64; x += 16) ctx.fillRect(x, 0, 1, 64);
      ctx.fillStyle = pal.accent;
      for (let i = 0; i < 12; i++) {
        const px = Math.floor(rng(i + 9) * 56) + 4;
        const py = Math.floor(rng(i + 37) * 56) + 4;
        ctx.fillRect(px, py, 4, 2);
        ctx.fillStyle = pal.detail;
        ctx.fillRect(px + 1, py, 2, 1);
        ctx.fillStyle = pal.accent;
      }
    } else if (key === 'candy') {
      const sprinkles = ['#34d399', '#60a5fa', '#facc15', '#fb7185', '#a78bfa'];
      for (let i = 0; i < 26; i++) {
        const px = Math.floor(rng(i + 3) * 58) + 3;
        const py = Math.floor(rng(i + 67) * 58) + 3;
        ctx.fillStyle = sprinkles[i % sprinkles.length];
        ctx.fillRect(px, py, 3, 1);
      }
    } else if (key === 'rainbow') {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(0, 0, 64, 1);
      ctx.fillRect(0, 0, 1, 64);
      ctx.fillRect(32, 0, 1, 64);
      ctx.fillRect(0, 32, 64, 1);
      const stars = ['#38bdf8', '#f472b6', '#facc15', '#a855f7', '#ffffff'];
      for (let i = 0; i < 22; i++) {
        const px = Math.floor(rng(i + 13) * 60) + 2;
        const py = Math.floor(rng(i + 91) * 60) + 2;
        ctx.fillStyle = stars[i % stars.length];
        ctx.fillRect(px, py, i % 4 === 0 ? 2 : 1, i % 4 === 0 ? 2 : 1);
      }
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.anisotropy = maxAnisotropy;
    protectSharedTexture(tex);
    groundTexCache.set(key, tex);
    return tex;
  }

  // 3. 生成 MKDS 經典彩虹稜鏡「?」道具箱像素貼圖
  function getNdsItemBoxTexture() {
    if (ndsItemBoxTex) return ndsItemBoxTex;
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const bands = ['#ef4444', '#f97316', '#facc15', '#22c55e', '#06b6d4', '#3b82f6', '#a855f7'];
    for (let y = 0; y < 64; y += 2) {
      for (let x = 0; x < 64; x += 2) {
        const idx = Math.floor(((x + y) / 10)) % bands.length;
        ctx.fillStyle = bands[idx];
        ctx.fillRect(x, y, 2, 2);
      }
    }
    // 亮白外框與稜鏡高光
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = 4;
    ctx.strokeRect(3, 3, 58, 58);
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(6, 6, 52, 22);

    // 經典像素粗體問號「?」
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 44px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', 34, 36);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('?', 32, 34);

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    protectSharedTexture(tex);
    ndsItemBoxTex = tex;
    return tex;
  }

  // 4. 生成任天堂掌機風格立體像素白雲貼圖（原創像素繪製）
  function getCloudTexture(withEyes, tintHex, rimHex) {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 32;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    const blobs = [
      [18, 20, 9],
      [29, 14, 11],
      [42, 17, 10],
      [50, 21, 7],
      [32, 21, 13]
    ];
    // 深色像素外框
    ctx.fillStyle = '#1e293b';
    for (const [bx, by, br] of blobs) {
      ctx.beginPath();
      ctx.arc(bx, by, br + 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillRect(14, 19, 38, 10);

    // 底部淺藍立體陰影層
    ctx.fillStyle = rimHex || '#bae6fd';
    for (const [bx, by, br] of blobs) {
      ctx.beginPath();
      ctx.arc(bx, by + 1, br, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillRect(15, 20, 36, 7);

    // 頂部亮白受光層
    ctx.fillStyle = tintHex || '#ffffff';
    for (const [bx, by, br] of blobs) {
      ctx.beginPath();
      ctx.arc(bx, by - 1, br * 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillRect(16, 17, 34, 7);

    if (withEyes) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(27, 15, 2, 6);
      ctx.fillRect(35, 15, 2, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(27, 15, 1, 2);
      ctx.fillRect(35, 15, 1, 2);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    protectSharedTexture(tex);
    return tex;
  }

  // 5. 生成像素排氣煙霧與擦地火花貼圖
  function ensurePuffTextures() {
    if (!puffSmokeTex) {
      const c = document.createElement('canvas');
      c.width = 16;
      c.height = 16;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#475569';
      ctx.fillRect(4, 4, 8, 8);
      ctx.fillRect(3, 6, 10, 5);
      ctx.fillStyle = '#e2e8f0';
      ctx.fillRect(4, 4, 7, 7);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(5, 4, 5, 4);
      puffSmokeTex = new THREE.CanvasTexture(c);
      puffSmokeTex.colorSpace = THREE.SRGBColorSpace;
      puffSmokeTex.magFilter = THREE.NearestFilter;
      puffSmokeTex.minFilter = THREE.NearestFilter;
      protectSharedTexture(puffSmokeTex);
    }
    if (!puffSparkTex) {
      const c = document.createElement('canvas');
      c.width = 16;
      c.height = 16;
      const ctx = c.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.fillStyle = '#38bdf8';
      ctx.fillRect(7, 1, 2, 14);
      ctx.fillRect(1, 7, 14, 2);
      ctx.fillStyle = '#fef08a';
      ctx.fillRect(5, 5, 6, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(6, 6, 4, 4);
      puffSparkTex = new THREE.CanvasTexture(c);
      puffSparkTex.colorSpace = THREE.SRGBColorSpace;
      puffSparkTex.magFilter = THREE.NearestFilter;
      puffSparkTex.minFilter = THREE.NearestFilter;
      protectSharedTexture(puffSparkTex);
    }
  }

  // 6. NDS 3-階卡通光影與 RGB666 抖動 Shader 注入（保留原有顏色與彩虹星動態材質）
  function applyNdsCelShaderToMaterial(mat) {
    if (!mat || mat.userData?.__ndsCelHooked) return;
    if (!(mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial)) return;
    if (!mat.userData) mat.userData = {};
    mat.userData.__ndsCelHooked = true;
    mat.userData.__origRoughness = mat.roughness;
    mat.userData.__origMetalness = mat.metalness;

    // 減低過度金屬暗部反射，令色彩更貼近 NDS 鮮明色塊
    if (mat.metalness > 0.45 && mat.metalness < 0.88) {
      mat.metalness = 0.25;
    }
    mat.roughness = Math.max(0.28, Math.min(0.75, mat.roughness));

    mat.customProgramCacheKey = function () {
      return 'cwsj-nds-cel-v1';
    };

    mat.onBeforeCompile = function (shader) {
      shader.uniforms.uNdsCel = sharedUniforms.uNdsCel;
      shader.uniforms.uNdsRetro = sharedUniforms.uNdsRetro;
      shader.fragmentShader = 'uniform float uNdsCel;\nuniform float uNdsRetro;\n' + shader.fragmentShader;

      if (shader.fragmentShader.includes('#include <lights_fragment_end>')) {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <lights_fragment_end>',
          `#include <lights_fragment_end>
          if (uNdsCel > 0.5) {
            float ndsBase = max(max(diffuseColor.r, diffuseColor.g), max(diffuseColor.b, 0.06));
            float ndsDir = max(max(reflectedLight.directDiffuse.r, reflectedLight.directDiffuse.g), reflectedLight.directDiffuse.b) / ndsBase;
            if (ndsDir > 0.0005) {
              float ndsStep = smoothstep(0.05, 0.14, ndsDir) * 0.56
                            + smoothstep(0.42, 0.54, ndsDir) * 0.36
                            + smoothstep(0.86, 1.00, ndsDir) * 0.22;
              reflectedLight.directDiffuse *= (ndsStep / ndsDir);
            }
            float ndsSpec = max(max(reflectedLight.directSpecular.r, reflectedLight.directSpecular.g), reflectedLight.directSpecular.b);
            if (ndsSpec > 0.005) {
              float ndsSpecStep = smoothstep(0.08, 0.18, ndsSpec) * 0.45 + smoothstep(0.48, 0.62, ndsSpec) * 0.65;
              reflectedLight.directSpecular *= (ndsSpecStep / ndsSpec);
            }
          }`
        );
      }

      if (shader.fragmentShader.includes('#include <dithering_fragment>')) {
        shader.fragmentShader = shader.fragmentShader.replace(
          '#include <dithering_fragment>',
          `#include <dithering_fragment>
          if (uNdsRetro > 0.5) {
            vec2 bayerCoord = floor(mod(gl_FragCoord.xy, 4.0));
            int bx = int(bayerCoord.x);
            int by = int(bayerCoord.y);
            int bi = by * 4 + bx;
            float bayerVal = 0.0;
            if (bi == 0) bayerVal = 0.0; else if (bi == 1) bayerVal = 8.0; else if (bi == 2) bayerVal = 2.0; else if (bi == 3) bayerVal = 10.0;
            else if (bi == 4) bayerVal = 12.0; else if (bi == 5) bayerVal = 4.0; else if (bi == 6) bayerVal = 14.0; else if (bi == 7) bayerVal = 6.0;
            else if (bi == 8) bayerVal = 3.0; else if (bi == 9) bayerVal = 11.0; else if (bi == 10) bayerVal = 1.0; else if (bi == 11) bayerVal = 9.0;
            else if (bi == 12) bayerVal = 15.0; else if (bi == 13) bayerVal = 7.0; else if (bi == 14) bayerVal = 13.0; else bayerVal = 5.0;
            float dShift = (bayerVal / 16.0 - 0.5) / 48.0;
            gl_FragColor.rgb = clamp(floor((gl_FragColor.rgb + dShift) * 63.0 + 0.5) / 63.0, 0.0, 1.0);
          }`
        );
      }
    };
    mat.needsUpdate = true;
  }

  // 7. 螢幕空間自適應車身背面描邊（不受 GLB 縮放或閃電縮小影響，零幾何複製開銷）
  let sharedOutlineMat = null;
  function getOutlineMaterial() {
    if (sharedOutlineMat) return sharedOutlineMat;
    sharedOutlineMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: true,
      transparent: false,
      vertexShader: `
        void main() {
          vec3 viewNormal = normalize(normalMatrix * normal);
          vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
          float w = clamp(-mvPos.z * 0.0024, 0.007, 0.028);
          mvPos.xyz += viewNormal * w;
          mvPos.z -= 0.014;
          gl_Position = projectionMatrix * mvPos;
        }
      `,
      fragmentShader: `
        void main() {
          gl_FragColor = vec4(0.06, 0.09, 0.16, 1.0);
        }
      `
    });
    sharedOutlineMat.dispose = () => {};
    return sharedOutlineMat;
  }

  function isKartGroup(obj) {
    if (!obj || !obj.isGroup || !obj.children || obj.children.length < 2) return false;
    for (const ch of obj.children) {
      if (
        ch.isMesh &&
        Math.abs(ch.position.y - 0.05) < 0.02 &&
        Math.abs(ch.rotation.x + Math.PI / 2) < 0.05 &&
        ch.material &&
        ch.material.transparent &&
        ch.material.depthWrite === false
      ) {
        return true;
      }
    }
    return false;
  }

  function enhanceKartHierarchy(kartRoot) {
    if (!kartRoot || kartRoot.userData?.__ndsKartEnhanced) return;
    kartRoot.userData = kartRoot.userData || {};
    kartRoot.userData.__ndsKartEnhanced = true;

    const toOutline = [];
    kartRoot.traverse((mesh) => {
      if (!mesh.isMesh || mesh.userData?.__ndsIsOutline) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      let skipOutline = false;
      for (const m of mats) {
        if (!m) continue;
        if (m.map && m.map.anisotropy < maxAnisotropy) {
          m.map.anisotropy = maxAnisotropy;
        }
        applyNdsCelShaderToMaterial(m);
        if (m.transparent || m.opacity < 0.95 || m.depthWrite === false || m.isMeshBasicMaterial) {
          skipOutline = true;
        }
      }
      if (skipOutline || !mesh.geometry || !mesh.geometry.attributes?.position || !mesh.geometry.attributes?.normal) {
        return;
      }
      if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
      const bs = mesh.geometry.boundingSphere;
      const maxScale = Math.max(Math.abs(mesh.scale.x), Math.abs(mesh.scale.y), Math.abs(mesh.scale.z)) || 1;
      if (!bs || bs.radius * maxScale < 0.14) return;
      toOutline.push(mesh);
    });

    const outlineMat = getOutlineMaterial();
    for (const mesh of toOutline) {
      const outline = new THREE.Mesh(mesh.geometry, outlineMat);
      outline.name = '__nds_outline';
      outline.userData.__ndsIsOutline = true;
      outline.castShadow = false;
      outline.receiveShadow = false;
      outline.visible = currentMode !== 'classic';
      mesh.add(outline);
      outlineMeshes.add(outline);
    }
  }

  // 8. 偵測目前賽道主題（同時兼容車庫預覽、單人賽與多人連線房主指定賽道）
  function detectActiveTheme(trackWorldGroup) {
    const labelEl = document.getElementById('minimap-track-label');
    const labelText = (labelEl && labelEl.textContent) || '';
    const byName = {
      陽光蘑菇賽車場: 'meadow',
      黃金海岸日落灣: 'beach',
      極地冰晶雪山道: 'snow',
      烈焰熔岩城堡道: 'lava',
      繽紛糖果甜點島: 'candy',
      星光霓虹彩虹道: 'rainbow'
    };
    const selCard = document.querySelector('#track-selector .choice-card.selected');
    const menuVisible = (() => {
      const sm = document.getElementById('start-modal');
      return !sm || sm.style.display !== 'none';
    })();
    if (menuVisible && selCard && selCard.dataset.track && THEME_PALETTES[selCard.dataset.track]) {
      return selCard.dataset.track;
    }
    for (const [k, v] of Object.entries(byName)) {
      if (labelText.includes(k)) return v;
    }
    if (trackWorldGroup) {
      for (const ch of trackWorldGroup.children) {
        if (ch.isMesh && ch.userData?.__origGroundHex != null) {
          const hex = ch.userData.__origGroundHex;
          if (hex === 0x3cb831) return 'meadow';
          if (hex === 0xfde68a) return 'beach';
          if (hex === 0xf1f5f9) return 'snow';
          if (hex === 0x1c1917) return 'lava';
          if (hex === 0xfdf2f8) return 'candy';
          if (hex === 0x050814) return 'rainbow';
        }
      }
    }
    return selCard?.dataset?.track || 'meadow';
  }

  // 9. 建立 NDS 天際線立體像素白雲環景與遠山剪影
  function rebuildNdsSky(theme) {
    if (!mainScene) return;
    const pal = THEME_PALETTES[theme] || THEME_PALETTES.meadow;
    if (!ndsSkyGroup) {
      ndsSkyGroup = new THREE.Group();
      ndsSkyGroup.name = '__nds_sky_dome';
      mainScene.add(ndsSkyGroup);
    }
    while (ndsSkyGroup.children.length > 0) {
      const c = ndsSkyGroup.children.pop();
      if (c.geometry) c.geometry.dispose();
      if (c.material && !c.material.map?.userData?.__ndsProtected) c.material.dispose();
    }

    cloudHeroTex = getCloudTexture(true, pal.cloudTint, pal.cloudRim);
    cloudSoftTex = getCloudTexture(false, pal.cloudTint, pal.cloudRim);

    const cloudCount = 18;
    for (let i = 0; i < cloudCount; i++) {
      const angle = (i / cloudCount) * Math.PI * 2 + (i % 2) * 0.14;
      const dist = 340 + (i % 3) * 45;
      const y = 52 + (i % 4) * 16;
      const tex = i % 3 === 0 ? cloudHeroTex : cloudSoftTex;
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        fog: false,
        depthWrite: false
      });
      const sp = new THREE.Sprite(mat);
      const scaleW = 46 + (i % 3) * 14;
      sp.scale.set(scaleW, scaleW * 0.5, 1);
      sp.position.set(Math.cos(angle) * dist, y, Math.sin(angle) * dist);
      sp.userData = { baseAngle: angle, dist, baseY: y, speed: 0.008 + (i % 3) * 0.003 };
      ndsSkyGroup.add(sp);
    }

    // 遠景 MKDS 低多邊形山丘環
    if (theme !== 'rainbow') {
      const hillCount = 14;
      const hillMatA = new THREE.MeshBasicMaterial({ color: pal.hillA, fog: true });
      const hillMatB = new THREE.MeshBasicMaterial({ color: pal.hillB, fog: true });
      const stripeMat = new THREE.MeshBasicMaterial({ color: pal.hillStripe, fog: true });
      for (let i = 0; i < hillCount; i++) {
        const a = (i / hillCount) * Math.PI * 2 + 0.2;
        const rDist = 420 + (i % 2) * 35;
        const h = theme === 'snow' || theme === 'lava' ? 68 + (i % 3) * 22 : 42 + (i % 3) * 14;
        const rad = 42 + (i % 2) * 14;
        const geo = theme === 'snow' || theme === 'lava'
          ? new THREE.ConeGeometry(rad, h, 7)
          : new THREE.SphereGeometry(rad, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.52);
        const hill = new THREE.Mesh(geo, i % 2 === 0 ? hillMatA : hillMatB);
        hill.position.set(Math.cos(a) * rDist, theme === 'snow' || theme === 'lava' ? h * 0.42 : -2, Math.sin(a) * rDist);
        hill.castShadow = false;
        hill.receiveShadow = false;
        ndsSkyGroup.add(hill);

        if (i % 2 === 0) {
          const ringGeo = new THREE.CylinderGeometry(rad * 0.68, rad * 0.76, 3.2, 10, 1, true);
          const band = new THREE.Mesh(ringGeo, stripeMat);
          band.position.set(hill.position.x, 14, hill.position.z);
          ndsSkyGroup.add(band);
        }
      }
    }

    ndsSkyGroup.visible = currentMode !== 'classic';
  }

  // 10. 升級賽道地面、路肩、道具箱與場景立體模型
  function enhanceTrackWorld(trackWorldGroup, theme) {
    if (!trackWorldGroup) return;
    upgradedGroundMeshes.clear();
    upgradedItemMeshes.clear();

    const groundTex = getGroundTexture(theme);
    const itemTex = getNdsItemBoxTexture();

    trackWorldGroup.traverse((obj) => {
      if (!obj.isMesh || obj.userData?.__ndsIsOutline) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];

      for (const m of mats) {
        if (!m) continue;
        if (m.map) {
          m.map.anisotropy = maxAnisotropy;
          m.map.needsUpdate = true;
        }
        applyNdsCelShaderToMaterial(m);
      }

      // 偵測大型水平地面 Mesh，套用 NDS 雙色方格像素貼圖
      const mat = Array.isArray(obj.material) ? null : obj.material;
      if (mat && (!mat.map || obj.userData?.__ndsGroundUpgraded) && obj.geometry && obj.geometry.attributes?.uv) {
        if (!obj.geometry.boundingBox) obj.geometry.computeBoundingBox();
        const bb = obj.geometry.boundingBox;
        if (bb) {
          const spanA = bb.max.x - bb.min.x;
          const spanB = Math.max(bb.max.y - bb.min.y, bb.max.z - bb.min.z);
          if (spanA > 350 && spanB > 350 && obj.position.y <= 0.25) {
            if (obj.userData.__origGroundHex == null && mat.color) {
              obj.userData.__origGroundHex = mat.color.getHex();
            }
            obj.userData.__ndsGroundUpgraded = true;
            const rep = Math.max(24, Math.round(spanA / 15));
            groundTex.repeat.set(rep, rep);
            if (currentMode !== 'classic') {
              mat.map = groundTex;
              if (mat.color) mat.color.setHex(0xffffff);
            } else {
              mat.map = null;
              if (mat.color && obj.userData.__origGroundHex != null) {
                mat.color.setHex(obj.userData.__origGroundHex);
              }
            }
            mat.needsUpdate = true;
            upgradedGroundMeshes.add(obj);
          }
        }
      }

      // 偵測賽道上旋轉道具箱方塊，換上鮮明彩虹「?」像素貼圖
      if (mat && mat.map && obj.geometry && obj.geometry.type === 'BoxGeometry') {
        const p = obj.geometry.parameters;
        if (p && Math.abs(p.width - p.height) < 0.05 && p.width >= 0.85 && p.width <= 2.3) {
          if (!obj.userData.__origItemMap) obj.userData.__origItemMap = mat.map;
          mat.map = currentMode === 'classic' ? obj.userData.__origItemMap : itemTex;
          if (mat.emissive && currentMode !== 'classic') {
            mat.emissive.setHex(0xffffff);
            mat.emissiveMap = itemTex;
            mat.emissiveIntensity = 0.28;
          } else if (mat.emissive && currentMode === 'classic') {
            mat.emissiveMap = null;
            mat.emissiveIntensity = 0;
          }
          mat.needsUpdate = true;
          upgradedItemMeshes.add(obj);
        }
      }
    });
  }

  // 11. 調整場景燈光與緊貼玩家的銳利即時陰影（消除大範圍模糊鋸齒陰影）
  function tuneSceneLightsAndRenderer(theme) {
    if (!mainScene || !mainRenderer) return;
    const pal = THEME_PALETTES[theme] || THEME_PALETTES.meadow;

    if (currentMode === 'classic') {
      mainRenderer.toneMapping = THREE.ACESFilmicToneMapping;
      mainRenderer.toneMappingExposure = 1.0;
    } else {
      mainRenderer.toneMapping = THREE.NoToneMapping;
      mainRenderer.toneMappingExposure = 1.05;
      mainRenderer.shadowMap.enabled = true;
      mainRenderer.shadowMap.type = currentMode === 'nds-retro' ? THREE.BasicShadowMap : THREE.PCFShadowMap;
    }

    for (const ch of mainScene.children) {
      if (ch.isHemisphereLight && currentMode !== 'classic') {
        ch.color.setHex(pal.hemiSky);
        ch.groundColor.setHex(pal.hemiGround);
        ch.intensity = pal.hemiInt;
      } else if (ch.isDirectionalLight && currentMode !== 'classic') {
        ch.color.setHex(pal.sunCol);
        ch.intensity = pal.sunInt;
        if (ch.castShadow && ch.shadow) {
          ch.shadow.mapSize.width = 1024;
          ch.shadow.mapSize.height = 1024;
          ch.shadow.bias = -0.0005;
          ch.shadow.normalBias = 0.02;
          const sc = ch.shadow.camera;
          if (sc && sc.isOrthographicCamera) {
            sc.left = -46;
            sc.right = 46;
            sc.top = 46;
            sc.bottom = -46;
            sc.near = 2;
            sc.far = 160;
            sc.updateProjectionMatrix();
          }
        }
      }
    }
  }

  // 12. 零 GC 物件池：NDS 像素排氣與轉彎擦地煙塵特效
  function ensureParticlePool() {
    if (!mainScene || ndsParticleGroup) return;
    ensurePuffTextures();
    ndsParticleGroup = new THREE.Group();
    ndsParticleGroup.name = '__nds_puff_pool';
    mainScene.add(ndsParticleGroup);

    for (let i = 0; i < 28; i++) {
      const mat = new THREE.SpriteMaterial({
        map: puffSmokeTex,
        transparent: true,
        opacity: 0,
        depthWrite: false
      });
      const sp = new THREE.Sprite(mat);
      sp.visible = false;
      ndsParticleGroup.add(sp);
      puffPool.push({
        sprite: sp,
        vel: new THREE.Vector3(),
        age: 0,
        life: 0,
        baseScale: 0.6
      });
    }
  }

  function spawnNdsPuff(x, y, z, vx, vy, vz, isSpark) {
    if (!puffPool.length || currentMode === 'classic') return;
    const item = puffPool[puffCursor];
    puffCursor = (puffCursor + 1) % puffPool.length;
    item.sprite.material.map = isSpark ? puffSparkTex : puffSmokeTex;
    item.sprite.material.color.setHex(isSpark ? 0x38bdf8 : 0xffffff);
    item.sprite.material.opacity = isSpark ? 0.95 : 0.78;
    item.sprite.position.set(x, y, z);
    item.vel.set(vx, vy, vz);
    item.age = 0;
    item.life = isSpark ? 0.28 : 0.42;
    item.baseScale = isSpark ? 0.52 : 0.65;
    item.sprite.scale.setScalar(item.baseScale);
    item.sprite.visible = true;
  }

  function updatePuffParticles(dt, playerKartGroup) {
    ensureParticlePool();
    if (!ndsParticleGroup) return;

    for (const p of puffPool) {
      if (!p.sprite.visible) continue;
      p.age += dt;
      if (p.age >= p.life) {
        p.sprite.visible = false;
        continue;
      }
      const t = p.age / p.life;
      p.sprite.position.addScaledVector(p.vel, dt);
      p.vel.y += 1.4 * dt;
      const sc = p.baseScale * (1 + t * 1.15);
      p.sprite.scale.setScalar(sc);
      p.sprite.material.opacity = (1 - t) * 0.78;
    }

    if (!playerKartGroup || currentMode === 'classic') return;
    const pos = playerKartGroup.position;
    if (!hasLastPlayerPos) {
      lastPlayerPos.copy(pos);
      hasLastPlayerPos = true;
      return;
    }
    const moveDist = pos.distanceTo(lastPlayerPos);
    const estSpeed = dt > 0.001 ? moveDist / dt : 0;
    lastPlayerPos.copy(pos);

    if (estSpeed > 8.0) {
      const bodyGrp = playerKartGroup.children[0];
      const roll = bodyGrp ? Math.abs(bodyGrp.rotation.z) : 0;
      const rate = roll > 0.06 ? 0.042 : 0.095;
      puffSpawnAccum += dt;
      if (puffSpawnAccum >= rate) {
        puffSpawnAccum = 0;
        const backX = -Math.sin(playerKartGroup.rotation.y || 0);
        const backZ = -Math.cos(playerKartGroup.rotation.y || 0);
        const jitter = (Math.random() - 0.5) * 0.85;
        spawnNdsPuff(
          pos.x + backX * 1.25 + jitter,
          pos.y + 0.28,
          pos.z + backZ * 1.25 + jitter,
          (Math.random() - 0.5) * 1.8,
          1.1 + Math.random() * 0.9,
          (Math.random() - 0.5) * 1.8,
          roll > 0.09 && Math.random() < 0.45
        );
      }
    }
  }

  // 13. 解析度與 DPR 計算（NDS 像素模式自動鎖定約 236p 垂直高度並保持銳利像素邊緣）
  function computeEffectiveDpr(requestedDpr) {
    if (currentMode === 'nds-retro') {
      const h = Math.max(200, lastLogicalH || window.innerHeight || 600);
      return Math.max(0.26, Math.min(0.62, 236 / h));
    }
    return requestedDpr || Math.min(window.devicePixelRatio || 1, 1.75);
  }

  function applyCurrentModeAll() {
    sharedUniforms.uNdsCel.value = currentMode === 'classic' ? 0.0 : 1.0;
    sharedUniforms.uNdsRetro.value = currentMode === 'nds-retro' ? 1.0 : 0.0;
    document.documentElement.classList.toggle('nds-retro-mode', currentMode === 'nds-retro');

    for (const ol of outlineMeshes) {
      ol.visible = currentMode !== 'classic';
    }
    if (ndsSkyGroup) {
      ndsSkyGroup.visible = currentMode !== 'classic';
    }
    if (ndsParticleGroup && currentMode === 'classic') {
      for (const p of puffPool) p.sprite.visible = false;
    }

    const trackGrp = findTrackWorldGroup();
    if (trackGrp) {
      activeTheme = detectActiveTheme(trackGrp);
      enhanceTrackWorld(trackGrp, activeTheme);
    }
    tuneSceneLightsAndRenderer(activeTheme);

    if (mainRenderer && origSetPixelRatio && origSetSize) {
      origSetPixelRatio(computeEffectiveDpr(lastRequestedDpr));
      origSetSize(lastLogicalW, lastLogicalH, false);
      const cv = mainRenderer.domElement;
      if (cv) {
        cv.style.width = '100%';
        cv.style.height = '100%';
      }
    }
    if (previewRenderer) {
      previewRenderer.toneMapping = currentMode === 'classic' ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
      previewRenderer.toneMappingExposure = currentMode === 'classic' ? 1.18 : 1.06;
    }

    syncModeButtonsText();
  }

  function cycleMode() {
    const idx = MODES.indexOf(currentMode);
    currentMode = MODES[(idx + 1) % MODES.length];
    saveMode(currentMode);
    applyCurrentModeAll();

    const toastEl = document.getElementById('feedback-toast');
    if (toastEl) {
      toastEl.textContent = MODE_META[currentMode].toast;
      toastEl.style.background = 'linear-gradient(135deg, #1d4ed8, #0f172a)';
      toastEl.classList.add('show');
      setTimeout(() => toastEl.classList.remove('show'), 1900);
    }
  }

  // 14. 車庫與比賽 HUD 畫質切換按鈕注入
  function syncModeButtonsText() {
    const meta = MODE_META[currentMode] || MODE_META['nds-hd'];
    const hudBtn = document.getElementById('nds-gfx-hud-btn');
    if (hudBtn) hudBtn.textContent = meta.shortLabel;
    const garBtn = document.getElementById('nds-gfx-garage-btn');
    if (garBtn) garBtn.textContent = meta.garageLabel;
  }

  function injectModeButtons() {
    ensureRetroOverlayCss();
    const hudActions = document.querySelector('#hud .top-mini-actions');
    if (hudActions && !document.getElementById('nds-gfx-hud-btn')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'nds-gfx-hud-btn';
      btn.className = 'menu-mini-btn';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        cycleMode();
      });
      hudActions.appendChild(btn);
    }

    const cfgControls = document.querySelector('#start-modal .config-controls');
    if (cfgControls && !document.getElementById('nds-gfx-garage-btn')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'nds-gfx-garage-btn';
      btn.className = 'nds-garage-btn';
      btn.title = '點擊切換 NDS 街機強化 / NDS 掌機像素 / 原版畫質';
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        cycleMode();
      });
      cfgControls.appendChild(btn);
    }
    syncModeButtonsText();
  }

  function findTrackWorldGroup() {
    if (!mainScene) return null;
    for (const ch of mainScene.children) {
      if (
        ch.isGroup &&
        ch !== ndsSkyGroup &&
        ch !== ndsParticleGroup &&
        !isKartGroup(ch) &&
        ch.children.length >= 6
      ) {
        return ch;
      }
    }
    return null;
  }

  // 15. 每幀渲染前掛鉤：同步玩家陰影視錐、立體雲層飄動、新生成賽車自動卡通描邊
  function onBeforeMainRender(renderer, scene, camera) {
    const now = performance.now() * 0.001;
    const dt = Math.min(0.05, Math.max(0.001, now - lastFrameTime));
    lastFrameTime = now;

    if (!mainRenderer) {
      mainRenderer = renderer;
      mainScene = scene;
      mainCamera = camera;
      maxAnisotropy = Math.min(8, renderer.capabilities?.getMaxAnisotropy?.() || 4);

      origSetPixelRatio = renderer.setPixelRatio.bind(renderer);
      origSetSize = renderer.setSize.bind(renderer);
      const sz = renderer.getSize(new THREE.Vector2());
      lastLogicalW = sz.x || window.innerWidth;
      lastLogicalH = sz.y || window.innerHeight;
      lastRequestedDpr = renderer.getPixelRatio();

      renderer.setPixelRatio = function (dpr) {
        lastRequestedDpr = dpr;
        origSetPixelRatio(computeEffectiveDpr(dpr));
      };
      renderer.setSize = function (w, h, updateStyle) {
        lastLogicalW = w;
        lastLogicalH = h;
        origSetPixelRatio(computeEffectiveDpr(lastRequestedDpr));
        origSetSize(w, h, updateStyle);
      };

      injectModeButtons();
      applyCurrentModeAll();
    }

    mainCamera = camera;

    // 偵測賽道切換或重建
    const trackGrp = findTrackWorldGroup();
    if (trackGrp) {
      const firstId = trackGrp.children[0] ? trackGrp.children[0].uuid : '';
      const detected = detectActiveTheme(trackGrp);
      const sig = `${detected}:${firstId}:${trackGrp.children.length}`;
      if (sig !== lastTrackSignature) {
        lastTrackSignature = sig;
        activeTheme = detected;
        enhanceTrackWorld(trackGrp, activeTheme);
        rebuildNdsSky(activeTheme);
        tuneSceneLightsAndRenderer(activeTheme);
      }
    }

    // 自動為場上所有賽車（含 GLB 載入完成後重建嘅玩家車與連線遠端車）加上 NDS 描邊與階調光影
    let nearestKart = null;
    let nearestDistSq = Infinity;
    for (const ch of scene.children) {
      if (isKartGroup(ch)) {
        if (!ch.userData?.__ndsKartEnhanced) enhanceKartHierarchy(ch);
        if (camera) {
          const dSq = ch.position.distanceToSquared(camera.position);
          if (dSq < nearestDistSq) {
            nearestDistSq = dSq;
            nearestKart = ch;
          }
        }
      }
    }

    // 讓主太陽陰影相機緊跟鏡頭前方並對齊像素格，實現 NDS/MK7 級銳利不閃爍車底陰影
    if (currentMode !== 'classic' && camera) {
      for (const ch of scene.children) {
        if (ch.isDirectionalLight && ch.castShadow && ch.target) {
          const snap = 1.5;
          const focusX = Math.round(camera.position.x / snap) * snap;
          const focusZ = Math.round(camera.position.z / snap) * snap;
          ch.target.position.set(focusX, 0, focusZ);
          ch.target.updateMatrixWorld();
          ch.position.set(focusX + 36, 62, focusZ + 28);
          break;
        }
      }
    }

    // 雲層環繞鏡頭緩緩飄動
    if (ndsSkyGroup && ndsSkyGroup.visible && camera) {
      ndsSkyGroup.position.set(camera.position.x, 0, camera.position.z);
      for (const sp of ndsSkyGroup.children) {
        if (sp.isSprite && sp.userData?.dist) {
          const a = sp.userData.baseAngle + now * sp.userData.speed;
          sp.position.x = Math.cos(a) * sp.userData.dist;
          sp.position.z = Math.sin(a) * sp.userData.dist;
          sp.position.y = sp.userData.baseY + Math.sin(now * 0.8 + sp.userData.baseAngle * 3) * 1.4;
        }
      }
    }

    updatePuffParticles(dt, nearestKart);
  }

  function onBeforePreviewRender(renderer, scene) {
    if (!previewRenderer) {
      previewRenderer = renderer;
      previewScene = scene;
      previewRenderer.toneMapping = currentMode === 'classic' ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
      previewRenderer.toneMappingExposure = currentMode === 'classic' ? 1.18 : 1.06;
    }
    for (const ch of scene.children) {
      if (isKartGroup(ch) && !ch.userData?.__ndsKartEnhanced) {
        enhanceKartHierarchy(ch);
      }
    }
  }

  // 16. 附加隱形零像素探針至每個 Three.js Scene，零侵入攔截主場景與車庫預覽場景
  function attachRenderProbe(scene) {
    if (!scene || scene.userData?.__ndsProbeAttached) return;
    scene.userData = scene.userData || {};
    scene.userData.__ndsProbeAttached = true;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, -9999, 0, 0, -9999, 0, 0, -9999, 0], 3));
    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      colorWrite: false
    });
    mat.dispose = () => {};
    geo.dispose = () => {};

    const probe = new THREE.Mesh(geo, mat);
    probe.name = '__nds_render_probe';
    probe.frustumCulled = false;
    probe.castShadow = false;
    probe.receiveShadow = false;
    probe.onBeforeRender = function (renderer, sc, cam) {
      try {
        const id = renderer?.domElement?.id || '';
        if (id === 'game-canvas') onBeforeMainRender(renderer, sc, cam);
        else if (id === 'preview-kart-canvas') onBeforePreviewRender(renderer, sc, cam);
      } catch (err) {
        console.warn('[NDS Graphics] Frame hook warning:', err);
      }
    };
    origSceneAdd.call(scene, probe);
  }

  const origSceneAdd = THREE.Object3D.prototype.add;
  THREE.Object3D.prototype.add = function (...objects) {
    const result = origSceneAdd.apply(this, objects);
    if (this && this.isScene) {
      attachRenderProbe(this);
    }
    return result;
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectModeButtons, { once: true });
  } else {
    setTimeout(injectModeButtons, 0);
  }
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  try {
    initNdsGraphicsEngine();
  } catch (err) {
    console.warn('[NDS Graphics] Init skipped:', err);
  }
}
