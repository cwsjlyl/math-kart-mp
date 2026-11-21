// NDS Mario Kart 風格高清畫質與《頭文字D》AE86／拓海擴充模組
// 修復：
// 1. 徹底移除 WebGLRenderer setSize <-> setPixelRatio 遞迴錯誤，確保所有 3D 賽道與車庫預覽 100% 正常載入。
// 2. 修復左上角 HUD 與車庫畫質切換按鈕（同時支援 iPad / 手提電話觸控與滑鼠點擊，即時回應）。
// 3. 全面改為最少 720p HD 以上解析度（提供「NDS 超清 1080p+ / NDS 流暢 720p / 原版高清」三段切換，絕不低於 720p）。
// 4. 補齊「極速方程式、閃電超跑 GT、霸氣大腳越野、星際噴射戰車」選車縮圖與預覽圖。
// 5. 新增《頭文字D》致敬車款「AE86」（白黑熊貓配色、翻燈、黑頭冚、黃霧燈、藤原豆腐字樣、八爪輪圈）與車手「拓海」2D 圖像及 3D 立體模型。
// 6. 將比賽時賽車與 AI 行駛速度調整為現時的 0.8 倍，讓學生有充足時間心算乘數題。

import * as THREE from '../vendor/three/three.module.js';

const STORAGE_KEY = 'cwsj_mk_gfx_mode_720p_v2';
const SPEED_MULTIPLIER = 0.8; // 將比賽車速調慢至現時的 0.8 倍

const MODES = ['nds-ultra', 'nds-720p', 'classic-hd'];
const MODE_META = {
  'nds-ultra': {
    shortLabel: '✨ 畫質: NDS超清',
    garageLabel: '✨ 畫質: NDS超清 (1080p+)',
    toast: '✨ 已切換至「NDS 超清 (1080p+/Retina)」：鮮明卡通光影＋方格賽道＋立體描邊！'
  },
  'nds-720p': {
    shortLabel: '⚡ 畫質: NDS 720p',
    garageLabel: '⚡ 畫質: NDS流暢 (720p)',
    toast: '⚡ 已切換至「NDS 流暢 (720p HD)」：鎖定 720p 高清省電模式，iPad／電話長玩不發熱！'
  },
  'classic-hd': {
    shortLabel: '🎨 畫質: 原版高清',
    garageLabel: '🎨 畫質: 原版高清 (720p+)',
    toast: '🎨 已切換至「原版標準光影 (720p+ 高清)」'
  }
};

const EXTRA_KART_ARTS = {
  formula: './assets/karts/formula.svg',
  gt: './assets/karts/gt.svg',
  monster: './assets/karts/monster.svg',
  star: './assets/karts/star.svg',
  ae86: './assets/karts/ae86.svg'
};

const AE86_META = {
  name: 'AE86 藤原豆腐號',
  sub: '高靈活・中速度・秋名山飄移',
  flavor: '白黑熊貓配色・經典跳燈・藤原とうふ店塗裝',
  img: './assets/karts/ae86.svg',
  traits: { speed: 74, agility: 98, strength: 62 }
};

const TAKUMI_META = {
  name: '拓海',
  sub: '白T牛仔褲・水杯不灑傳說',
  flavor: '秋名山天才車手・冷靜專注・彎道極限飄移',
  img: './assets/drivers/takumi.svg'
};

const THEME_PALETTES = {
  meadow: {
    checkA: '#46c93a', checkB: '#35b22b', accent: '#7be85e', detail: '#fef08a',
    hemiSky: 0x9be7ff, hemiGround: 0x3b9e2b, hemiInt: 0.92,
    sunCol: 0xfff8dc, sunInt: 1.52,
    hillA: '#2ea829', hillB: '#238920', hillStripe: '#56d646', cloudTint: '#ffffff', cloudRim: '#bae6fd'
  },
  beach: {
    checkA: '#fde68a', checkB: '#fcd34d', accent: '#fef3c7', detail: '#fb7185',
    hemiSky: 0xffedd5, hemiGround: 0xd97706, hemiInt: 0.95,
    sunCol: 0xffedd5, sunInt: 1.58,
    hillA: '#0284c7', hillB: '#0369a1', hillStripe: '#38bdf8', cloudTint: '#fff7ed', cloudRim: '#fed7aa'
  },
  snow: {
    checkA: '#f8fafc', checkB: '#dbeafe', accent: '#ffffff', detail: '#7dd3fc',
    hemiSky: 0xe0f2fe, hemiGround: 0x93c5fd, hemiInt: 1.02,
    sunCol: 0xffffff, sunInt: 1.45,
    hillA: '#cbd5e1', hillB: '#94a3b8', hillStripe: '#f8fafc', cloudTint: '#f8fafc', cloudRim: '#bfdbfe'
  },
  lava: {
    checkA: '#292524', checkB: '#1c1917', accent: '#ea580c', detail: '#facc15',
    hemiSky: 0xfdba74, hemiGround: 0x7c2d12, hemiInt: 0.78,
    sunCol: 0xffedd5, sunInt: 1.40,
    hillA: '#451a03', hillB: '#292524', hillStripe: '#ea580c', cloudTint: '#fed7aa', cloudRim: '#fb923c'
  },
  candy: {
    checkA: '#fce7f3', checkB: '#fbcfe8', accent: '#fff1f2', detail: '#34d399',
    hemiSky: 0xfdf2f8, hemiGround: 0xf472b6, hemiInt: 0.96,
    sunCol: 0xfffbeb, sunInt: 1.48,
    hillA: '#f472b6', hillB: '#ec4899', hillStripe: '#fde047', cloudTint: '#fff1f2', cloudRim: '#fbcfe8'
  },
  rainbow: {
    checkA: '#0b1026', checkB: '#111917', accent: '#38bdf8', detail: '#f472b6',
    hemiSky: 0xc084fc, hemiGround: 0x1e1b4b, hemiInt: 0.92,
    sunCol: 0xffffff, sunInt: 1.48,
    hillA: '#312e81', hillB: '#1e1b4b', hillStripe: '#22d3ee', cloudTint: '#e0e7ff', cloudRim: '#c084fc'
  }
};

function readInitialMode() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved && MODES.includes(saved)) return saved;
  } catch (_) {}
  return 'nds-ultra';
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

function getSelectedStyleId() {
  const el = document.querySelector('#style-selector .choice-card.selected');
  return (el && el.dataset && el.dataset.style) || 'formula';
}

function getSelectedDriverId() {
  const el = document.querySelector('#driver-selector .choice-card.selected');
  return (el && el.dataset && el.dataset.driver) || 'wan';
}

function isRacingStateActive() {
  const hud = document.getElementById('hud');
  if (!hud || hud.style.display === 'none') return false;
  const cd = document.getElementById('countdown-overlay');
  if (cd && cd.style.display !== 'none') return false;
  const fin = document.getElementById('finish-modal');
  if (fin && fin.style.display === 'flex') return false;
  const qz = document.getElementById('quiz-modal');
  if (qz && qz.style.display === 'flex') return false;
  return true;
}

// ============================================================================
// A. 同步擴充車庫 DOM（必須喺 index.html 執行綁定事件前完成，令原生選車邏輯自動接管 AE86 與拓海）
// ============================================================================
function upgradeGarageDomBeforeMainScript() {
  if (!document.getElementById('nds-garage-upgrade-css')) {
    const st = document.createElement('style');
    st.id = 'nds-garage-upgrade-css';
    st.textContent = `
      /* 9 架賽車與 6 位車手響應式整齊網格（支援 iPad 與手提電話橫直向） */
      .kart-style-grid { grid-template-columns: repeat(3, 1fr) !important; }
      .driver-grid { grid-template-columns: repeat(6, 1fr) !important; }
      @media (max-width: 900px) {
        .driver-grid { grid-template-columns: repeat(3, 1fr) !important; }
      }
      @media (max-width: 640px) {
        .kart-style-grid { grid-template-columns: repeat(2, 1fr) !important; }
        .driver-grid { grid-template-columns: repeat(3, 1fr) !important; }
      }
      @media (orientation: landscape) and (max-height: 500px) {
        .kart-style-grid { grid-template-columns: repeat(3, 1fr) !important; }
        .driver-grid { grid-template-columns: repeat(6, 1fr) !important; }
      }
      .choice-card .choice-thumb {
        width: 100%;
        height: 58px;
        object-fit: cover;
        object-position: center;
        border-radius: 8px;
        display: block;
        background: #0f172a;
        margin: 0 auto 3px;
      }
      .nds-garage-btn {
        pointer-events: auto;
        background: linear-gradient(180deg, #fde047, #f59e0b);
        color: #0f172a;
        border: 2px solid #b45309;
        border-radius: 12px;
        padding: 6px 12px;
        font-size: 13px;
        font-weight: 900;
        cursor: pointer;
        box-shadow: 0 2px 0 #92400e;
        white-space: nowrap;
        touch-action: manipulation;
      }
      .nds-garage-btn:active { transform: scale(0.95); }
      #nds-gfx-hud-btn {
        pointer-events: auto !important;
        touch-action: manipulation;
        border-color: #fde047;
        color: #fef08a;
      }
    `;
    document.head.appendChild(st);
  }

  // 1. 為頭四架原有賽車（formula, gt, monster, star）換上精美圖片，取代單調 Emoji
  const styleSelector = document.getElementById('style-selector');
  if (styleSelector) {
    ['formula', 'gt', 'monster', 'star'].forEach((styleKey) => {
      const card = styleSelector.querySelector(`.choice-card[data-style="${styleKey}"]`);
      if (!card) return;
      const nameEl = card.querySelector('.name');
      const label = (nameEl && nameEl.textContent) || styleKey;
      const iconEl = card.querySelector('.icon');
      if (iconEl && !card.querySelector('img.choice-thumb')) {
        const img = document.createElement('img');
        img.className = 'choice-thumb';
        img.src = EXTRA_KART_ARTS[styleKey];
        img.alt = label;
        iconEl.replaceWith(img);
      }
    });

    // 2. 新增第 9 架賽車：「AE86」
    if (!styleSelector.querySelector('.choice-card[data-style="ae86"]')) {
      const ae86Card = document.createElement('div');
      ae86Card.className = 'choice-card';
      ae86Card.dataset.style = 'ae86';
      ae86Card.innerHTML = `
        <img class="choice-thumb" src="${AE86_META.img}" alt="AE86">
        <div class="name">AE86</div>
        <div class="sub">${AE86_META.sub}</div>
        <div class="trait-bars">
          <div class="trait-row"><span>速度</span><div class="trait-track"><div class="trait-fill speed" style="width:${AE86_META.traits.speed}%"></div></div></div>
          <div class="trait-row"><span>靈活</span><div class="trait-track"><div class="trait-fill agility" style="width:${AE86_META.traits.agility}%"></div></div></div>
          <div class="trait-row"><span>強壯</span><div class="trait-track"><div class="trait-fill strength" style="width:${AE86_META.traits.strength}%"></div></div></div>
        </div>
      `;
      styleSelector.appendChild(ae86Card);
    }
  }

  // 3. 新增第 6 位車手：「拓海」
  const driverSelector = document.getElementById('driver-selector');
  if (driverSelector && !driverSelector.querySelector('.choice-card[data-driver="takumi"]')) {
    const takumiCard = document.createElement('div');
    takumiCard.className = 'choice-card';
    takumiCard.dataset.driver = 'takumi';
    takumiCard.innerHTML = `
      <img class="choice-thumb" src="${TAKUMI_META.img}" alt="拓海">
      <div class="name">${TAKUMI_META.name}</div>
      <div class="sub">${TAKUMI_META.sub}</div>
    `;
    driverSelector.appendChild(takumiCard);
  }
}

// 同步車庫右方預覽面板嘅圖片同介紹文字（補齊 formula/gt/monster/star/ae86 圖片，以及 AE86 / 拓海專屬文字）
function syncCustomGaragePreviewDom() {
  const styleId = getSelectedStyleId();
  const driverId = getSelectedDriverId();

  const kimg = document.getElementById('preview-kart-img');
  if (kimg && EXTRA_KART_ARTS[styleId]) {
    const targetSrc = EXTRA_KART_ARTS[styleId];
    if (kimg.getAttribute('src') !== targetSrc) {
      kimg.src = targetSrc;
    }
    kimg.alt = styleId === 'ae86' ? AE86_META.name : styleId;
    kimg.classList.add('has-art');
  }

  if (styleId === 'ae86') {
    const kn = document.getElementById('preview-kart-name');
    if (kn) kn.textContent = AE86_META.name;
    const pn = document.getElementById('preview-kart-plate-name');
    if (pn) pn.textContent = AE86_META.name;
    const kf = document.getElementById('preview-kart-flavor');
    if (kf) kf.textContent = AE86_META.flavor;
    const kt = document.getElementById('preview-kart-traits');
    if (kt) {
      kt.innerHTML = `
        <div class="trait-bars">
          <div class="trait-row"><span>速度</span><div class="trait-track"><div class="trait-fill speed" style="width:${AE86_META.traits.speed}%"></div></div></div>
          <div class="trait-row"><span>靈活</span><div class="trait-track"><div class="trait-fill agility" style="width:${AE86_META.traits.agility}%"></div></div></div>
          <div class="trait-row"><span>強壯</span><div class="trait-track"><div class="trait-fill strength" style="width:${AE86_META.traits.strength}%"></div></div></div>
        </div>
      `;
    }
  }

  if (driverId === 'takumi') {
    const dimg = document.getElementById('preview-driver-img');
    if (dimg && dimg.getAttribute('src') !== TAKUMI_META.img) {
      dimg.src = TAKUMI_META.img;
      dimg.alt = TAKUMI_META.name;
    }
    const dn = document.getElementById('preview-driver-name');
    if (dn) dn.textContent = TAKUMI_META.name;
    const df = document.getElementById('preview-driver-flavor');
    if (df) df.textContent = TAKUMI_META.flavor;
  }
}

// ============================================================================
// B. 《頭文字D》3D 藤原拓海角色與 3D AE86 Sprinter Trueno 模型建構器
// ============================================================================
let tofuDoorTex = null;
let plate86Tex = null;

function getTofuDoorTexture() {
  if (tofuDoorTex) return tofuDoorTex;
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 512, 96);
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 44px "PingFang HK", "Hiragino Kaku Gothic ProN", "Microsoft JhengHei", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('藤原とうふ店 (自家用)', 256, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  protectSharedTexture(tex);
  tofuDoorTex = tex;
  return tex;
}

function getPlate86Texture() {
  if (plate86Tex) return plate86Tex;
  const c = document.createElement('canvas');
  c.width = 192;
  c.height = 96;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, 192, 96);
  ctx.strokeStyle = '#166534';
  ctx.lineWidth = 6;
  ctx.strokeRect(4, 4, 184, 88);
  ctx.fillStyle = '#14532d';
  ctx.font = '900 42px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('13-954', 96, 56);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  protectSharedTexture(tex);
  plate86Tex = tex;
  return tex;
}

function findDriverGroupInBody(bodyGroup) {
  if (!bodyGroup || !bodyGroup.children) return null;
  for (const ch of bodyGroup.children) {
    if (!ch.isGroup) continue;
    const hasHeadSphere = ch.children.some(
      (m) => m.isMesh && m.geometry && m.geometry.type === 'SphereGeometry' && Math.abs(m.position.y - 0.70) < 0.06
    );
    if (hasHeadSphere) return ch;
  }
  return null;
}

function rebuildDriverAsTakumi(driverGroup) {
  if (!driverGroup || driverGroup.userData?.__isTakumi3D) return;
  while (driverGroup.children.length > 0) {
    const old = driverGroup.children.pop();
    if (old.geometry) old.geometry.dispose();
  }
  driverGroup.userData = driverGroup.userData || {};
  driverGroup.userData.__isTakumi3D = true;
  driverGroup.visible = true;

  const whiteTeeMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.48 });
  const darkCollarMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.55 });
  const jeansMat = new THREE.MeshStandardMaterial({ color: 0x1d4ed8, roughness: 0.65 });
  const skinMat = new THREE.MeshStandardMaterial({ color: 0xf3c69f, roughness: 0.52 });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x5c3a24, roughness: 0.62 });
  const hairDarkMat = new THREE.MeshStandardMaterial({ color: 0x3f2617, roughness: 0.68 });
  const eyeWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.25 });
  const irisMat = new THREE.MeshStandardMaterial({ color: 0x29170e, roughness: 0.22 });
  const browMat = new THREE.MeshStandardMaterial({ color: 0x27170e, roughness: 0.7 });

  // 白 T-shirt 軀幹與牛仔褲下擺
  const jeansBase = new THREE.Mesh(new THREE.BoxGeometry(0.54, 0.16, 0.38), jeansMat);
  jeansBase.position.set(0, 0.08, 0);
  driverGroup.add(jeansBase);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.64, 0.40, 0.42), whiteTeeMat);
  torso.position.set(0, 0.30, 0.01);
  torso.castShadow = true;
  driverGroup.add(torso);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.032, 8, 16), darkCollarMat);
  collar.rotation.x = Math.PI / 2.2;
  collar.position.set(0, 0.50, 0.05);
  driverGroup.add(collar);

  // 雙手握持三幅式賽車方向盤
  for (const s of [-1, 1]) {
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.085, 0.20, 10), whiteTeeMat);
    sleeve.position.set(s * 0.35, 0.38, 0.08);
    sleeve.rotation.z = s * 0.35;
    sleeve.rotation.x = 0.55;
    driverGroup.add(sleeve);

    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.06, 0.28, 10), skinMat);
    arm.position.set(s * 0.28, 0.34, 0.25);
    arm.rotation.x = 1.15;
    arm.rotation.z = -s * 0.28;
    driverGroup.add(arm);
  }

  const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.026, 8, 20), darkCollarMat);
  wheelRim.position.set(0, 0.36, 0.40);
  wheelRim.rotation.x = -0.35;
  driverGroup.add(wheelRim);

  // 頭部
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.34, 18, 16), skinMat);
  head.position.set(0, 0.70, 0);
  head.castShadow = true;
  driverGroup.add(head);

  // 《頭文字D》拓海標誌性灰啡色中分層次感髮型
  const crown = new THREE.Mesh(new THREE.SphereGeometry(0.365, 16, 14, 0, Math.PI * 2, 0, Math.PI * 0.58), hairMat);
  crown.position.set(0, 0.74, -0.02);
  crown.castShadow = true;
  driverGroup.add(crown);

  const backHair = new THREE.Mesh(new THREE.SphereGeometry(0.34, 14, 12), hairDarkMat);
  backHair.scale.set(1.02, 0.95, 0.85);
  backHair.position.set(0, 0.66, -0.10);
  driverGroup.add(backHair);

  // 左右中分瀏海與鬢角
  for (const s of [-1, 1]) {
    const bang = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 8), hairMat);
    bang.position.set(s * 0.14, 0.86, 0.25);
    bang.rotation.z = s * 0.52;
    bang.rotation.x = 2.55;
    driverGroup.add(bang);

    const sideLock = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.36, 8), hairDarkMat);
    sideLock.position.set(s * 0.29, 0.72, 0.14);
    sideLock.rotation.z = s * 0.18;
    sideLock.rotation.x = 2.85;
    driverGroup.add(sideLock);
  }

  // 專注冷靜雙眼（半垂眼簾＋銳利平眉）
  for (const s of [-1, 1]) {
    const white = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), eyeWhiteMat);
    white.scale.set(0.068, 0.044, 0.026);
    white.position.set(s * 0.13, 0.73, 0.305);
    driverGroup.add(white);

    const iris = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 8), irisMat);
    iris.scale.set(0.040, 0.036, 0.022);
    iris.position.set(s * 0.13, 0.728, 0.322);
    driverGroup.add(iris);

    const lid = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.022, 0.035), browMat);
    lid.position.set(s * 0.13, 0.758, 0.312);
    lid.rotation.z = s * -0.06;
    driverGroup.add(lid);

    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.018, 0.03), browMat);
    brow.position.set(s * 0.13, 0.795, 0.305);
    brow.rotation.z = s * -0.14;
    driverGroup.add(brow);
  }

  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.085, 0.015, 0.02), browMat);
  mouth.position.set(0, 0.59, 0.315);
  driverGroup.add(mouth);
}

function buildWatanabeWheelIntoAxle(axleGroup, radius, width) {
  while (axleGroup.children.length > 0) {
    const old = axleGroup.children.pop();
    if (old.geometry) old.geometry.dispose();
  }
  const tireMat = new THREE.MeshStandardMaterial({ color: 0x0b0f17, roughness: 0.82 });
  const rimLipMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.75, roughness: 0.24 });
  const gunmetalMat = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.45, roughness: 0.42 });

  const wheelGrp = new THREE.Group();
  const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 24), tireMat);
  tire.castShadow = true;
  tire.receiveShadow = true;
  wheelGrp.add(tire);

  const lip = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.66, radius * 0.66, width + 0.015, 20), rimLipMat);
  wheelGrp.add(lip);

  const core = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.56, radius * 0.56, width + 0.025, 18), gunmetalMat);
  wheelGrp.add(core);

  // 經典 RS Watanabe 八爪深灰輪圈
  for (let i = 0; i < 8; i++) {
    const sp = new THREE.Mesh(new THREE.BoxGeometry(radius * 0.11, width + 0.035, radius * 0.54), gunmetalMat);
    const ang = (i / 8) * Math.PI * 2;
    sp.rotation.y = ang;
    sp.position.set(Math.sin(ang) * radius * 0.24, 0, Math.cos(ang) * radius * 0.24);
    wheelGrp.add(sp);
  }

  wheelGrp.rotation.z = Math.PI / 2;
  axleGroup.add(wheelGrp);
}

function rebuildKartAsAe86(kartRoot) {
  if (!kartRoot || kartRoot.userData?.__isAe863D) return;
  const bodyGroup = kartRoot.children[0];
  if (!bodyGroup || !bodyGroup.isGroup) return;

  kartRoot.userData = kartRoot.userData || {};
  kartRoot.userData.__isAe863D = true;

  const driverGroup = findDriverGroupInBody(bodyGroup);
  const wheelPivots = [];
  const flameGroups = [];
  let sharedPaintMat = null;

  for (const ch of bodyGroup.children) {
    if (ch.isMesh && !sharedPaintMat && ch.material && (ch.material.isMeshPhysicalMaterial || ch.material.isMeshStandardMaterial)) {
      sharedPaintMat = ch.material;
    }
    if (ch.isGroup && ch !== driverGroup) {
      if (Math.abs(ch.position.x) > 0.65 && Math.abs(ch.position.z) > 0.5) {
        wheelPivots.push(ch);
      } else if (ch.position.z < -1.1 || ch.position.z > 1.1) {
        flameGroups.push(ch);
      }
    }
  }

  const keepSet = new Set([driverGroup, ...wheelPivots, ...flameGroups].filter(Boolean));
  for (let i = bodyGroup.children.length - 1; i >= 0; i--) {
    const ch = bodyGroup.children[i];
    if (!keepSet.has(ch)) {
      bodyGroup.remove(ch);
      if (ch.geometry) ch.geometry.dispose();
    }
  }

  // 預設設定為經典白黑熊貓色（同時保留 paintMat 引用，令無敵彩虹星同黃金蘑菇正常變色）
  const pandaWhiteMat = sharedPaintMat || new THREE.MeshPhysicalMaterial({
    color: 0xf8fafc, roughness: 0.24, metalness: 0.12, clearcoat: 0.85
  });
  pandaWhiteMat.color.setHex(0xf8fafc);

  const pandaBlackMat = new THREE.MeshStandardMaterial({ color: 0x141821, roughness: 0.58, metalness: 0.18 });
  const carbonHoodMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.36, metalness: 0.24 });
  const glassTintMat = new THREE.MeshPhysicalMaterial({
    color: 0x38bdf8, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.32, side: THREE.DoubleSide
  });
  const popLampMat = new THREE.MeshStandardMaterial({ color: 0xfffbeb, emissive: 0xfef08a, emissiveIntensity: 1.2, roughness: 0.15 });
  const yellowFogMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xeab308, emissiveIntensity: 0.95, roughness: 0.2 });
  const amberSignalMat = new THREE.MeshStandardMaterial({ color: 0xf97316, emissive: 0xea580c, emissiveIntensity: 0.75, roughness: 0.25 });
  const tailRedMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xdc2626, emissiveIntensity: 0.85, roughness: 0.25 });
  const chromePipeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.9, roughness: 0.16 });

  const addBox = (w, h, d, x, y, z, mat, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    if (rx || ry || rz) m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    m.receiveShadow = true;
    bodyGroup.add(m);
    return m;
  };

  // 1. 下半身熊貓黑車身裙腳與前後防撞泵把
  addBox(1.58, 0.26, 2.86, 0, 0.31, 0.01, pandaBlackMat);
  addBox(1.62, 0.22, 0.26, 0, 0.28, 1.44, pandaBlackMat);  // 前泵把
  addBox(1.60, 0.22, 0.24, 0, 0.30, -1.44, pandaBlackMat); // 後泵把

  // 2. 上半身熊貓白楔形車體與腰線黑邊
  addBox(1.56, 0.30, 2.74, 0, 0.58, -0.02, pandaWhiteMat);
  addBox(1.52, 0.18, 0.72, 0, 0.62, 1.04, pandaWhiteMat, 0.14, 0, 0); // 楔形車頭葉子板
  for (const s of [-1, 1]) {
    addBox(0.03, 0.045, 2.66, s * 0.785, 0.46, -0.01, pandaBlackMat); // 經典車側黑防擦條
    addBox(0.12, 0.09, 0.09, s * 0.83, 0.78, 0.34, pandaBlackMat);   // JDM 黑後視鏡
  }

  // 3. 《頭文字D》後期型黑頭冚（Carbon Black Hood）
  addBox(1.38, 0.05, 0.96, 0, 0.74, 0.88, carbonHoodMat, 0.10, 0, 0);

  // 4. AE86 靈魂造型：開啟狀態立體翻燈（Pop-up Headlights）＋ 黃色霧燈 ＋ 琥珀指揮燈
  for (const s of [-1, 1]) {
    addBox(0.30, 0.16, 0.24, s * 0.50, 0.76, 1.30, pandaBlackMat, -0.08, 0, 0);
    addBox(0.24, 0.11, 0.04, s * 0.50, 0.75, 1.425, popLampMat);
    addBox(0.24, 0.06, 0.05, s * 0.54, 0.32, 1.575, amberSignalMat);
    const fog = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, 0.05, 14), yellowFogMat);
    fog.rotation.x = Math.PI / 2;
    fog.position.set(s * 0.28, 0.28, 1.565);
    bodyGroup.add(fog);
  }
  addBox(0.76, 0.08, 0.05, 0, 0.44, 1.42, pandaBlackMat); // TRUENO 前鬼面罩

  // 5. 三門掀背車頂、ABC 柱與斜背尾門玻璃（Fastback Hatch）
  addBox(1.30, 0.07, 0.98, 0, 1.18, -0.22, pandaWhiteMat); // 車頂
  for (const s of [-1, 1]) {
    addBox(0.06, 0.48, 0.07, s * 0.64, 0.95, 0.36, pandaWhiteMat, -0.58, 0, s * 0.08); // A 柱
    addBox(0.05, 0.44, 0.07, s * 0.65, 0.96, -0.18, pandaBlackMat, 0, 0, s * 0.06);    // B 柱
    addBox(0.08, 0.48, 0.14, s * 0.63, 0.95, -0.92, pandaWhiteMat, 0.62, 0, s * 0.08); // C 柱斜背

    const sideWin = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 0.36), glassTintMat);
    sideWin.position.set(s * 0.68, 0.95, -0.26);
    sideWin.rotation.y = s * Math.PI / 2;
    bodyGroup.add(sideWin);
  }

  const frontWindshield = new THREE.Mesh(new THREE.PlaneGeometry(1.26, 0.52), glassTintMat);
  frontWindshield.position.set(0, 0.96, 0.38);
  frontWindshield.rotation.x = -0.58;
  bodyGroup.add(frontWindshield);

  const rearHatchGlass = new THREE.Mesh(new THREE.PlaneGeometry(1.22, 0.58), glassTintMat);
  rearHatchGlass.position.set(0, 0.94, -0.96);
  rearHatchGlass.rotation.x = 0.62;
  bodyGroup.add(rearHatchGlass);

  // 6. 黑色鴨尾尾翼（Ducktail Spoiler）＋ AE86 橫條紅黃尾燈 ＋ 排氣喉 ＋ 車牌
  addBox(1.48, 0.11, 0.18, 0, 0.79, -1.36, pandaBlackMat, -0.18, 0, 0);
  for (const s of [-1, 1]) {
    addBox(0.42, 0.11, 0.05, s * 0.48, 0.58, -1.40, tailRedMat);
    addBox(0.38, 0.055, 0.055, s * 0.48, 0.645, -1.40, amberSignalMat);
  }
  addBox(0.50, 0.16, 0.04, 0, 0.58, -1.40, pandaBlackMat);

  const plateMat = new THREE.MeshBasicMaterial({ map: getPlate86Texture() });
  const fPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.16), plateMat);
  fPlate.position.set(0, 0.25, 1.58);
  bodyGroup.add(fPlate);
  const rPlate = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.16), plateMat);
  rPlate.position.set(0, 0.56, -1.43);
  rPlate.rotation.y = Math.PI;
  bodyGroup.add(rPlate);

  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.36, 12), chromePipeMat);
  exhaust.rotation.x = Math.PI / 2;
  exhaust.position.set(-0.46, 0.21, -1.52);
  bodyGroup.add(exhaust);

  // 7. 車門「藤原とうふ店 (自家用)」字樣貼紙
  const doorDecalMat = new THREE.MeshBasicMaterial({
    map: getTofuDoorTexture(),
    transparent: true,
    depthWrite: false
  });
  for (const s of [-1, 1]) {
    const decal = new THREE.Mesh(new THREE.PlaneGeometry(1.18, 0.22), doorDecalMat);
    decal.position.set(s * 0.792, 0.60, -0.02);
    decal.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2;
    bodyGroup.add(decal);
  }

  // 8. 調整車手坐姿於 AE86 駕駛艙內
  if (driverGroup) {
    driverGroup.position.set(0, 0.48, -0.06);
    driverGroup.scale.setScalar(0.70);
    driverGroup.visible = true;
  }

  // 9. 將既有四個車輪樞軸升級為八爪 Watanabe 深灰飄移輪圈（保留轉向與滾動動畫引用）
  for (const piv of wheelPivots) {
    const isFront = piv.position.z > 0;
    const side = Math.sign(piv.position.x) || 1;
    piv.position.set(side * 0.80, 0.32, isFront ? 0.92 : -0.90);
    const axle = piv.children[0];
    if (axle && axle.isGroup) {
      buildWatanabeWheelIntoAxle(axle, 0.32, 0.26);
    }
  }

  // 10. 對齊渦輪加速火焰位置至 AE86 車尾
  flameGroups.forEach((fg, idx) => {
    fg.position.set(idx === 0 ? -0.46 : 0.46, 0.26, -1.62);
  });
}

// ============================================================================
// C. NDS 風格高清渲染管線（最少 720p HD＋卡通階調光影＋雙色方格賽道＋0.8 倍車速）
// ============================================================================
function initNdsGraphicsEngine() {
  if (window.__cwsjNdsGfxLoaded) return;
  window.__cwsjNdsGfxLoaded = true;

  upgradeGarageDomBeforeMainScript();

  // 比賽車速改為現時的 0.8 倍（讓學生有充足時間計算乘數題，倒數同車庫維持原速）
  const origClockGetDelta = THREE.Clock.prototype.getDelta;
  THREE.Clock.prototype.getDelta = function () {
    const raw = origClockGetDelta.call(this);
    return isRacingStateActive() ? raw * SPEED_MULTIPLIER : raw;
  };

  let currentMode = readInitialMode();
  const sharedUniforms = {
    uNdsCel: { value: currentMode === 'classic-hd' ? 0.0 : 1.0 }
  };

  let mainRenderer = null;
  let mainScene = null;
  let previewRenderer = null;
  let origSetPixelRatio = null;
  let isApplyingDpr = false;
  let maxAnisotropy = 4;

  const groundTexCache = new Map();
  let ndsItemBoxTex = null;
  let cloudHeroTex = null;
  let cloudSoftTex = null;
  let puffSmokeTex = null;
  let puffSparkTex = null;

  const outlineMeshes = new Set();
  let ndsSkyGroup = null;
  let ndsParticleGroup = null;
  const puffPool = [];
  let puffCursor = 0;
  const lastPlayerPos = new THREE.Vector3();
  let hasLastPlayerPos = false;
  let puffSpawnAccum = 0;
  let lastFrameSec = performance.now() * 0.001;
  let lastTrackSignature = '';
  let activeTheme = 'meadow';
  let lastToggleAt = 0;

  // 確保任何 iPad / 手提電話視窗最少達到 720p (1280x720) 物理像素解析度
  function computeTargetDpr() {
    const vv = window.visualViewport;
    const cssW = Math.max(1, (vv && vv.width) || window.innerWidth || 800);
    const cssH = Math.max(1, (vv && vv.height) || window.innerHeight || 600);
    const shortSide = Math.min(cssW, cssH);
    const longSide = Math.max(cssW, cssH);
    const min720pDpr = Math.max(720 / shortSide, 1280 / longSide, 1.0);
    const nativeDpr = window.devicePixelRatio || 2;

    if (currentMode === 'nds-720p') {
      // 流暢高清模式：精準鎖定最少 720p HD，兼顧清晰度與 iPad 省電流暢
      return Math.min(Math.max(nativeDpr, min720pDpr), Math.max(min720pDpr, 1.35));
    }
    // NDS 超清 / 原版高清模式：支援 Retina 1080p+ 超清，且保底絕不低於 720p
    return Math.min(Math.max(nativeDpr, min720pDpr), 2.25);
  }

  function applySafeRendererDpr() {
    if (!mainRenderer || !origSetPixelRatio || isApplyingDpr) return;
    isApplyingDpr = true;
    try {
      origSetPixelRatio(computeTargetDpr());
      const cv = mainRenderer.domElement;
      if (cv) {
        cv.style.width = '100%';
        cv.style.height = '100%';
      }
    } finally {
      isApplyingDpr = false;
    }
  }

  function getGroundTexture(theme) {
    const key = THEME_PALETTES[theme] ? theme : 'meadow';
    if (groundTexCache.has(key)) return groundTexCache.get(key);
    const pal = THEME_PALETTES[key];
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;

    for (let gy = 0; gy < 2; gy++) {
      for (let gx = 0; gx < 2; gx++) {
        ctx.fillStyle = (gx + gy) % 2 === 0 ? pal.checkA : pal.checkB;
        ctx.fillRect(gx * 32, gy * 32, 32, 32);
      }
    }

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
      }
    } else if (key === 'beach') {
      ctx.fillStyle = pal.accent;
      for (let y = 6; y < 64; y += 16) {
        for (let x = 0; x < 64; x += 8) ctx.fillRect(x, y + ((x >> 3) % 2), 5, 1);
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
      ctx.fillStyle = '#0c0a09';
      for (let y = 0; y < 64; y += 16) ctx.fillRect(0, y, 64, 1);
      for (let x = 0; x < 64; x += 16) ctx.fillRect(x, 0, 1, 64);
      ctx.fillStyle = pal.accent;
      for (let i = 0; i < 12; i++) {
        const px = Math.floor(rng(i + 9) * 56) + 4;
        const py = Math.floor(rng(i + 37) * 56) + 4;
        ctx.fillRect(px, py, 4, 2);
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
        ctx.fillRect(px, py, 2, 2);
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
        ctx.fillStyle = bands[Math.floor((x + y) / 10) % bands.length];
        ctx.fillRect(x, y, 2, 2);
      }
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = 4;
    ctx.strokeRect(3, 3, 58, 58);
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

  function getCloudTexture(withEyes, tintHex, rimHex) {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 32;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    const blobs = [[18, 20, 9], [29, 14, 11], [42, 17, 10], [50, 21, 7], [32, 21, 13]];

    ctx.fillStyle = '#1e293b';
    for (const [bx, by, br] of blobs) { ctx.beginPath(); ctx.arc(bx, by, br + 1.8, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillRect(14, 19, 38, 10);

    ctx.fillStyle = rimHex || '#bae6fd';
    for (const [bx, by, br] of blobs) { ctx.beginPath(); ctx.arc(bx, by + 1, br, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillRect(15, 20, 36, 7);

    ctx.fillStyle = tintHex || '#ffffff';
    for (const [bx, by, br] of blobs) { ctx.beginPath(); ctx.arc(bx, by - 1, br * 0.9, 0, Math.PI * 2); ctx.fill(); }
    ctx.fillRect(16, 17, 34, 7);

    if (withEyes) {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(27, 15, 2, 6);
      ctx.fillRect(35, 15, 2, 6);
    }

    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    protectSharedTexture(tex);
    return tex;
  }

  function ensurePuffTextures() {
    if (!puffSmokeTex) {
      const c = document.createElement('canvas');
      c.width = 16; c.height = 16;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#cbd5e1'; ctx.fillRect(3, 5, 10, 7);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(4, 4, 8, 6);
      puffSmokeTex = new THREE.CanvasTexture(c);
      puffSmokeTex.colorSpace = THREE.SRGBColorSpace;
      puffSmokeTex.magFilter = THREE.NearestFilter;
      puffSmokeTex.minFilter = THREE.NearestFilter;
      protectSharedTexture(puffSmokeTex);
    }
    if (!puffSparkTex) {
      const c = document.createElement('canvas');
      c.width = 16; c.height = 16;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#38bdf8'; ctx.fillRect(7, 1, 2, 14); ctx.fillRect(1, 7, 14, 2);
      ctx.fillStyle = '#fef08a'; ctx.fillRect(5, 5, 6, 6);
      puffSparkTex = new THREE.CanvasTexture(c);
      puffSparkTex.colorSpace = THREE.SRGBColorSpace;
      puffSparkTex.magFilter = THREE.NearestFilter;
      puffSparkTex.minFilter = THREE.NearestFilter;
      protectSharedTexture(puffSparkTex);
    }
  }

  function applyNdsCelShaderToMaterial(mat) {
    if (!mat || mat.userData?.__ndsCelHooked) return;
    if (!(mat.isMeshStandardMaterial || mat.isMeshPhysicalMaterial)) return;
    if (!mat.userData) mat.userData = {};
    mat.userData.__ndsCelHooked = true;

    if (mat.metalness > 0.45 && mat.metalness < 0.88) mat.metalness = 0.25;
    mat.roughness = Math.max(0.26, Math.min(0.75, mat.roughness));
    mat.customProgramCacheKey = () => 'cwsj-nds-cel-hd-v2';

    mat.onBeforeCompile = function (shader) {
      shader.uniforms.uNdsCel = sharedUniforms.uNdsCel;
      shader.fragmentShader = 'uniform float uNdsCel;\n' + shader.fragmentShader;
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
    };
    mat.needsUpdate = true;
  }

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
          float w = clamp(-mvPos.z * 0.0022, 0.006, 0.025);
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

  function hasAiItemBadge(kartRoot) {
    for (const ch of kartRoot.children) {
      if (ch.isSprite && Math.abs(ch.position.y - 2.55) < 0.1) return true;
    }
    return false;
  }

  function enhanceKartHierarchy(kartRoot, isPreviewScene) {
    if (!kartRoot) return;

    // 若為玩家或車庫預覽賽車，檢查是否選用「AE86」車款或「拓海」車手並即時套用 3D 模型
    const isLocalPlayerOrPreview = isPreviewScene || !hasAiItemBadge(kartRoot);
    if (isLocalPlayerOrPreview) {
      const selStyle = getSelectedStyleId();
      const selDriver = getSelectedDriverId();
      if (selStyle === 'ae86' && !kartRoot.userData?.__isAe863D) {
        rebuildKartAsAe86(kartRoot);
        kartRoot.userData.__ndsKartEnhanced = false;
      }
      if (selDriver === 'takumi') {
        const bodyGroup = kartRoot.children[0];
        const drvGrp = findDriverGroupInBody(bodyGroup);
        if (drvGrp && !drvGrp.userData?.__isTakumi3D) {
          rebuildDriverAsTakumi(drvGrp);
          if (selStyle === 'bolt') drvGrp.visible = false;
          kartRoot.userData.__ndsKartEnhanced = false;
        }
      }
    }

    if (kartRoot.userData?.__ndsKartEnhanced) return;
    kartRoot.userData = kartRoot.userData || {};
    kartRoot.userData.__ndsKartEnhanced = true;

    const toOutline = [];
    kartRoot.traverse((mesh) => {
      if (!mesh.isMesh || mesh.userData?.__ndsIsOutline) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      let skipOutline = false;
      for (const m of mats) {
        if (!m) continue;
        if (m.map && m.map.anisotropy < maxAnisotropy) m.map.anisotropy = maxAnisotropy;
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
      if (mesh.children.some((c) => c.userData?.__ndsIsOutline)) continue;
      const outline = new THREE.Mesh(mesh.geometry, outlineMat);
      outline.name = '__nds_outline';
      outline.userData.__ndsIsOutline = true;
      outline.castShadow = false;
      outline.receiveShadow = false;
      outline.visible = currentMode !== 'classic-hd';
      mesh.add(outline);
      outlineMeshes.add(outline);
    }
  }

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
    const sm = document.getElementById('start-modal');
    const menuVisible = !sm || sm.style.display !== 'none';
    if (menuVisible && selCard?.dataset?.track && THEME_PALETTES[selCard.dataset.track]) {
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

  function rebuildNdsSky(theme) {
    if (!mainScene) return;
    const pal = THEME_PALETTES[theme] || THEME_PALETTES.meadow;
    if (!ndsSkyGroup) {
      ndsSkyGroup = new THREE.Group();
      ndsSkyGroup.name = '__nds_sky_dome';
      origSceneAdd.call(mainScene, ndsSkyGroup);
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
      const mat = new THREE.SpriteMaterial({
        map: i % 3 === 0 ? cloudHeroTex : cloudSoftTex,
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
        ndsSkyGroup.add(hill);

        if (i % 2 === 0) {
          const band = new THREE.Mesh(new THREE.CylinderGeometry(rad * 0.68, rad * 0.76, 3.2, 10, 1, true), stripeMat);
          band.position.set(hill.position.x, 14, hill.position.z);
          ndsSkyGroup.add(band);
        }
      }
    }

    ndsSkyGroup.visible = currentMode !== 'classic-hd';
  }

  function enhanceTrackWorld(trackWorldGroup, theme) {
    if (!trackWorldGroup) return;
    const groundTex = getGroundTexture(theme);
    const itemTex = getNdsItemBoxTexture();
    const isClassic = currentMode === 'classic-hd';

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
            if (!isClassic) {
              mat.map = groundTex;
              if (mat.color) mat.color.setHex(0xffffff);
            } else {
              mat.map = null;
              if (mat.color && obj.userData.__origGroundHex != null) {
                mat.color.setHex(obj.userData.__origGroundHex);
              }
            }
            mat.needsUpdate = true;
          }
        }
      }

      if (mat && mat.map && obj.geometry && obj.geometry.type === 'BoxGeometry') {
        const p = obj.geometry.parameters;
        if (p && Math.abs(p.width - p.height) < 0.05 && p.width >= 0.85 && p.width <= 2.3) {
          if (!obj.userData.__origItemMap) obj.userData.__origItemMap = mat.map;
          mat.map = isClassic ? obj.userData.__origItemMap : itemTex;
          if (mat.emissive) {
            if (!isClassic) {
              mat.emissive.setHex(0xffffff);
              mat.emissiveMap = itemTex;
              mat.emissiveIntensity = 0.26;
            } else {
              mat.emissiveMap = null;
              mat.emissiveIntensity = 0;
            }
          }
          mat.needsUpdate = true;
        }
      }
    });
  }

  function tuneSceneLightsAndRenderer(theme) {
    if (!mainScene || !mainRenderer) return;
    const pal = THEME_PALETTES[theme] || THEME_PALETTES.meadow;
    const isClassic = currentMode === 'classic-hd';

    mainRenderer.toneMapping = isClassic ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    mainRenderer.toneMappingExposure = isClassic ? 1.0 : 1.05;
    mainRenderer.shadowMap.enabled = true;
    mainRenderer.shadowMap.type = THREE.PCFShadowMap;

    for (const ch of mainScene.children) {
      if (ch.isHemisphereLight && !isClassic) {
        ch.color.setHex(pal.hemiSky);
        ch.groundColor.setHex(pal.hemiGround);
        ch.intensity = pal.hemiInt;
      } else if (ch.isDirectionalLight && !isClassic) {
        ch.color.setHex(pal.sunCol);
        ch.intensity = pal.sunInt;
        if (ch.castShadow && ch.shadow) {
          ch.shadow.mapSize.width = 1024;
          ch.shadow.mapSize.height = 1024;
          ch.shadow.bias = -0.0005;
          ch.shadow.normalBias = 0.02;
          const sc = ch.shadow.camera;
          if (sc && sc.isOrthographicCamera) {
            sc.left = -46; sc.right = 46; sc.top = 46; sc.bottom = -46;
            sc.near = 2; sc.far = 160;
            sc.updateProjectionMatrix();
          }
        }
      }
    }
  }

  function ensureParticlePool() {
    if (!mainScene || ndsParticleGroup) return;
    ensurePuffTextures();
    ndsParticleGroup = new THREE.Group();
    ndsParticleGroup.name = '__nds_puff_pool';
    origSceneAdd.call(mainScene, ndsParticleGroup);
    for (let i = 0; i < 24; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({
        map: puffSmokeTex, transparent: true, opacity: 0, depthWrite: false
      }));
      sp.visible = false;
      ndsParticleGroup.add(sp);
      puffPool.push({ sprite: sp, vel: new THREE.Vector3(), age: 0, life: 0, baseScale: 0.6 });
    }
  }

  function updatePuffParticles(dt, playerKartGroup) {
    ensureParticlePool();
    if (!ndsParticleGroup) return;
    for (const p of puffPool) {
      if (!p.sprite.visible) continue;
      p.age += dt;
      if (p.age >= p.life) { p.sprite.visible = false; continue; }
      const t = p.age / p.life;
      p.sprite.position.addScaledVector(p.vel, dt);
      p.vel.y += 1.3 * dt;
      p.sprite.scale.setScalar(p.baseScale * (1 + t * 1.1));
      p.sprite.material.opacity = (1 - t) * 0.72;
    }

    if (!playerKartGroup || currentMode === 'classic-hd' || !isRacingStateActive()) return;
    const pos = playerKartGroup.position;
    if (!hasLastPlayerPos) { lastPlayerPos.copy(pos); hasLastPlayerPos = true; return; }
    const moveDist = pos.distanceTo(lastPlayerPos);
    const estSpeed = dt > 0.001 ? moveDist / dt : 0;
    lastPlayerPos.copy(pos);

    if (estSpeed > 6.0) {
      const bodyGrp = playerKartGroup.children[0];
      const roll = bodyGrp ? Math.abs(bodyGrp.rotation.z) : 0;
      const rate = roll > 0.06 ? 0.045 : 0.11;
      puffSpawnAccum += dt;
      if (puffSpawnAccum >= rate) {
        puffSpawnAccum = 0;
        const item = puffPool[puffCursor];
        puffCursor = (puffCursor + 1) % puffPool.length;
        const isSpark = roll > 0.09 && Math.random() < 0.45;
        const backX = -Math.sin(playerKartGroup.rotation.y || 0);
        const backZ = -Math.cos(playerKartGroup.rotation.y || 0);
        const jitter = (Math.random() - 0.5) * 0.8;
        item.sprite.material.map = isSpark ? puffSparkTex : puffSmokeTex;
        item.sprite.material.color.setHex(isSpark ? 0x38bdf8 : 0xffffff);
        item.sprite.material.opacity = 0.8;
        item.sprite.position.set(pos.x + backX * 1.25 + jitter, pos.y + 0.26, pos.z + backZ * 1.25 + jitter);
        item.vel.set((Math.random() - 0.5) * 1.6, 1.0 + Math.random() * 0.8, (Math.random() - 0.5) * 1.6);
        item.age = 0;
        item.life = isSpark ? 0.26 : 0.40;
        item.baseScale = isSpark ? 0.48 : 0.62;
        item.sprite.scale.setScalar(item.baseScale);
        item.sprite.visible = true;
      }
    }
  }

  function findTrackWorldGroup() {
    if (!mainScene) return null;
    for (const ch of mainScene.children) {
      if (ch.isGroup && ch !== ndsSkyGroup && ch !== ndsParticleGroup && !isKartGroup(ch) && ch.children.length >= 6) {
        return ch;
      }
    }
    return null;
  }

  function syncModeButtonsText() {
    const meta = MODE_META[currentMode] || MODE_META['nds-ultra'];
    const hudBtn = document.getElementById('nds-gfx-hud-btn');
    if (hudBtn) hudBtn.textContent = meta.shortLabel;
    const garBtn = document.getElementById('nds-gfx-garage-btn');
    if (garBtn) garBtn.textContent = meta.garageLabel;
  }

  function applyCurrentModeAll() {
    const isClassic = currentMode === 'classic-hd';
    sharedUniforms.uNdsCel.value = isClassic ? 0.0 : 1.0;

    for (const ol of outlineMeshes) ol.visible = !isClassic;
    if (ndsSkyGroup) ndsSkyGroup.visible = !isClassic;
    if (ndsParticleGroup && isClassic) {
      for (const p of puffPool) p.sprite.visible = false;
    }

    const trackGrp = findTrackWorldGroup();
    if (trackGrp) {
      activeTheme = detectActiveTheme(trackGrp);
      enhanceTrackWorld(trackGrp, activeTheme);
    }
    tuneSceneLightsAndRenderer(activeTheme);
    applySafeRendererDpr();

    if (previewRenderer) {
      previewRenderer.toneMapping = isClassic ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
      previewRenderer.toneMappingExposure = isClassic ? 1.18 : 1.06;
    }
    syncModeButtonsText();
  }

  function cycleMode(ev) {
    if (ev) {
      ev.preventDefault();
      ev.stopPropagation();
    }
    const now = performance.now();
    if (now - lastToggleAt < 240) return;
    lastToggleAt = now;

    const idx = MODES.indexOf(currentMode);
    currentMode = MODES[(idx + 1) % MODES.length];
    saveMode(currentMode);
    applyCurrentModeAll();

    const toastEl = document.getElementById('feedback-toast');
    if (toastEl) {
      toastEl.textContent = MODE_META[currentMode].toast;
      toastEl.style.background = 'linear-gradient(135deg, #1d4ed8, #0f172a)';
      toastEl.classList.add('show');
      setTimeout(() => toastEl.classList.remove('show'), 2100);
    }
  }

  function injectModeButtons() {
    const hudActions = document.querySelector('#hud .top-mini-actions');
    if (hudActions && !document.getElementById('nds-gfx-hud-btn')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'nds-gfx-hud-btn';
      btn.className = 'menu-mini-btn';
      btn.addEventListener('click', cycleMode);
      btn.addEventListener('touchend', cycleMode, { passive: false });
      hudActions.appendChild(btn);
    }

    const cfgControls = document.querySelector('#start-modal .config-controls');
    if (cfgControls && !document.getElementById('nds-gfx-garage-btn')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.id = 'nds-gfx-garage-btn';
      btn.className = 'nds-garage-btn';
      btn.addEventListener('click', cycleMode);
      btn.addEventListener('touchend', cycleMode, { passive: false });
      cfgControls.appendChild(btn);
    }

    syncModeButtonsText();
  }

  function bindGaragePreviewSyncListeners() {
    const syncSoon = () => {
      syncCustomGaragePreviewDom();
      setTimeout(syncCustomGaragePreviewDom, 0);
      setTimeout(syncCustomGaragePreviewDom, 180);
    };
    ['style-selector', 'driver-selector', 'color-selector', 'garage-next-btn', 'back-garage-hud-btn'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('click', syncSoon);
    });
    syncSoon();
  }

  function onBeforeMainRender(renderer, scene, camera) {
    const nowSec = performance.now() * 0.001;
    const dt = Math.min(0.05, Math.max(0.001, nowSec - lastFrameSec));
    lastFrameSec = nowSec;

    if (!mainRenderer) {
      mainRenderer = renderer;
      mainScene = scene;
      maxAnisotropy = Math.min(8, renderer.capabilities?.getMaxAnisotropy?.() || 4);

      origSetPixelRatio = renderer.setPixelRatio.bind(renderer);
      renderer.setPixelRatio = function () {
        applySafeRendererDpr();
      };

      injectModeButtons();
      applyCurrentModeAll();
    }

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

    let nearestKart = null;
    let nearestDistSq = Infinity;
    for (const ch of scene.children) {
      if (isKartGroup(ch)) {
        enhanceKartHierarchy(ch, false);
        if (camera) {
          const dSq = ch.position.distanceToSquared(camera.position);
          if (dSq < nearestDistSq) {
            nearestDistSq = dSq;
            nearestKart = ch;
          }
        }
      }
    }

    if (currentMode !== 'classic-hd' && camera) {
      for (const ch of scene.children) {
        if (ch.isDirectionalLight && ch.castShadow && ch.target) {
          const snap = 1.5;
          const fx = Math.round(camera.position.x / snap) * snap;
          const fz = Math.round(camera.position.z / snap) * snap;
          ch.target.position.set(fx, 0, fz);
          ch.target.updateMatrixWorld();
          ch.position.set(fx + 36, 62, fz + 28);
          break;
        }
      }
    }

    if (ndsSkyGroup && ndsSkyGroup.visible && camera) {
      ndsSkyGroup.position.set(camera.position.x, 0, camera.position.z);
      for (const sp of ndsSkyGroup.children) {
        if (sp.isSprite && sp.userData?.dist) {
          const a = sp.userData.baseAngle + nowSec * sp.userData.speed;
          sp.position.x = Math.cos(a) * sp.userData.dist;
          sp.position.z = Math.sin(a) * sp.userData.dist;
          sp.position.y = sp.userData.baseY + Math.sin(nowSec * 0.8 + sp.userData.baseAngle * 3) * 1.4;
        }
      }
    }

    // 同步時速表顯示為 0.8 倍實際體感車速
    if (isRacingStateActive()) {
      const spEl = document.getElementById('speed-num');
      if (spEl) {
        const rawNum = Number(spEl.textContent);
        if (Number.isFinite(rawNum) && rawNum > 0) {
          spEl.textContent = String(Math.round(rawNum * SPEED_MULTIPLIER));
        }
      }
    }

    updatePuffParticles(dt, nearestKart);
  }

  function onBeforePreviewRender(renderer, scene) {
    if (!previewRenderer) {
      previewRenderer = renderer;
      const isClassic = currentMode === 'classic-hd';
      previewRenderer.toneMapping = isClassic ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
      previewRenderer.toneMappingExposure = isClassic ? 1.18 : 1.06;
    }
    for (const ch of scene.children) {
      if (isKartGroup(ch)) enhanceKartHierarchy(ch, true);
    }
    syncCustomGaragePreviewDom();
  }

  function attachRenderProbe(scene) {
    if (!scene || scene.userData?.__ndsProbeAttached) return;
    scene.userData = scene.userData || {};
    scene.userData.__ndsProbeAttached = true;

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([0, -9999, 0, 0, -9999, 0, 0, -9999, 0], 3));
    const mat = new THREE.MeshBasicMaterial({
      transparent: true, opacity: 0, depthWrite: false, depthTest: false, colorWrite: false
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
    if (this && this.isScene) attachRenderProbe(this);
    return result;
  };

  setTimeout(() => {
    injectModeButtons();
    bindGaragePreviewSyncListeners();
  }, 0);
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
  try {
    initNdsGraphicsEngine();
  } catch (err) {
    console.warn('[NDS Graphics] Init error:', err);
  }
}
