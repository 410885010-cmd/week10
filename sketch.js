// ============================================================
// 第 10 週：精靈動畫橫向捲軸「雷雨草原」
// 方向鍵控制洛奇亞跑步、背景左右捲動，走到最右邊會打雷閃電
// ============================================================

// ---------- 素材規格：file 路徑、frames 影格數、w 總寬、h 高（單格寬 = 總寬 ÷ 影格數） ----------
const STOP = { file: '1/stop/stop.png', frames: 3, w: 72, h: 30 };          // 洛奇亞：靜止 3 張
const RUN = { file: '1/run/run.png', frames: 6, w: 156, h: 30 };            // 洛奇亞：跑步 6 張
const PUSH = { file: '1/push/push.png', frames: 3, w: 96, h: 30 };          // 洛奇亞：發功 3 張
const FIRE = { file: '1/to/to.png', frames: 2, w: 32, h: 6 };               // 魔法火球 2 張
const BOLT = { file: 'effect/1/effect_1.png', frames: 14, w: 672, h: 140 }; // 閃電 14 張
const BLAST = { file: 'effect/2/effect_2.png', frames: 10, w: 640, h: 40 }; // 藍色爆炸 10 張
const BG_FILE = 'bg/0.png';                                                 // 無縫背景圖（640×180）
const THUNDER_FILE = 'audio/thunder.mp3';                                   // 打雷音效
const BOLT_TIP_X = 16;                                                      // 閃電落地點在單格裡的 x 位置（用來對準爆炸）

// ---------- 圖片與聲音 ----------
let stopSheet, runSheet, pushSheet, fireSheet, boltSheet, blastSheet;       // 各精靈圖
let backgroundImage;                                                        // 背景圖
let thunderSound = null;                                                    // 打雷音效（讀不到就維持 null，遊戲照常進行）

// ---------- 動畫狀態 ----------
let action = 'stop';                  // 目前動作：stop 或 run
let direction = 0;                    // 按鍵方向：1 往右、-1 往左、0 沒按
let facing = 1;                       // 角色面向：1 向右、-1 向左（放開按鍵後維持朝向）
let stopFrame = 0;                    // 靜止動畫目前影格
let runFrameCount = 0;                // 跑步的「播放位置」（不是圖片索引）
let lastFrameTime = 0;                // 上次換格的時間
const frameDuration = 100;            // 每格 100 毫秒
const RUN_LOOP_START = 2;             // 起步動作播完後，從第 3 張（索引 2）開始重複
const RUN_PLAY_END = RUN.frames + (RUN.frames - RUN_LOOP_START) - 1;   // 播放位置最大值（6 張：先播 0–5，再循環 2–5）

// ---------- 位置與鏡頭 ----------
let characterX = 0;                   // 角色在畫面上的 x（水平中心）
let backgroundCameraX = 0;            // 鏡頭在「3 張背景接成的長圖」上的位置
let tileWidth = 0;                    // 一張背景放大後的寬
let maxCameraX = 0;                   // 鏡頭最右位置

// ---------- 閃電與爆炸 ----------
let lightningActive = false;          // 閃電特效是否進行中
let lightningStartedAt = 0;           // 特效開始時間
let lightningWorldX = 0;              // 閃電在「背景長圖」上的位置（世界座標）
let lastThunderStrike = -1;           // 上一次響過雷聲的閃電編號
const STRIKE_MS = 1000;               // 每次閃電 1 秒
const STRIKES = 3;                    // 連續閃電 3 次
const CYCLE_MS = STRIKE_MS * (STRIKES + 1);   // 一個循環：3 秒閃電 + 1 秒爆炸 = 4 秒

// ---------- 空白鍵魔法（我自己加的創意） ----------
let pushUntil = 0;                    // 發功動作到什麼時間結束
let pushStartedAt = 0;                // 發功開始時間
let firePending = false;              // 這次發功的火球還沒射出
let fireballs = [];                   // 飛行中的火球

// ============================================================
// 載入素材
// ============================================================
function showLoadError(file) {        // 圖片讀不到時，在畫面上顯示原因
  if (document.getElementById('loadErr')) return;   // 已經顯示過就不再重複
  document.body.insertAdjacentHTML('beforeend', '<p id="loadErr" style="position:fixed;top:8px;left:8px;margin:0;padding:10px;background:#fff;font:16px sans-serif">讀不到圖片：' + file + '<br>請用 VS Code 的 Live Server 或 GitHub Pages 開啟，並確認資料夾 1、bg、effect、audio 和 index.html 在同一層</p>');
}
function pick(path) {                 // 直接雙擊開啟（file://）時，改用 images_data.js 內嵌的備用檔
  return (location.protocol === 'file:' && typeof IMG_DATA !== 'undefined') ? IMG_DATA[path] : path;
}
function loadSheet(file) {            // 載入一張精靈圖，失敗就顯示提醒
  return loadImage(pick(file), null, () => showLoadError(file));
}
function preload() {                  // p5 會等 preload 裡的圖片都載入完才進入 setup
  stopSheet = loadSheet(STOP.file);   // 載入靜止精靈圖
  runSheet = loadSheet(RUN.file);     // 載入跑步精靈圖
  pushSheet = loadSheet(PUSH.file);   // 載入發功精靈圖
  fireSheet = loadSheet(FIRE.file);   // 載入火球精靈圖
  boltSheet = loadSheet(BOLT.file);   // 載入閃電精靈圖
  blastSheet = loadSheet(BLAST.file); // 載入爆炸精靈圖
  backgroundImage = loadSheet(BG_FILE);   // 載入背景圖
}

function loadThunder() {              // 音效放在 setup 之後才載入，讀不到也不會卡住畫面
  if (typeof loadSound !== 'function') return;   // 沒有載入 p5.sound 就維持靜音
  try {                               // 任何錯誤都只是靜音，不影響遊戲
    loadSound(pick(THUNDER_FILE), (snd) => { thunderSound = snd; }, () => { thunderSound = null; });   // 載入成功才放進變數
  } catch (e) { thunderSound = null; }           // 例外時維持靜音
}

// ============================================================
// 初始化
// ============================================================
function setup() {
  createCanvas(windowWidth, windowHeight);      // 建立全視窗畫布
  noSmooth();                                   // 像素圖放大時不要變模糊
  textFont('"Microsoft JhengHei", "PingFang TC", "Noto Sans TC", sans-serif');   // 中文字型
  updateLayout();                               // 計算背景尺寸
  backgroundCameraX = maxCameraX / 2;           // 開場鏡頭放在 3 張背景的正中間
  characterX = width / 2;                       // 角色放在視窗中央
  lastFrameTime = millis();                     // 記下起始時間
  loadThunder();                                // 背景載入雷聲音效
}

function updateLayout() {                       // 依視窗大小算背景寬度與鏡頭範圍
  tileWidth = (backgroundImage.width / backgroundImage.height) * height;   // 背景依原圖比例放大到跟視窗一樣高
  maxCameraX = max(0, tileWidth * 3 - width);   // 3 張接起來的總寬減掉視窗寬
}

function windowResized() {
  const cameraRatio = maxCameraX > 0 ? backgroundCameraX / maxCameraX : 0.5;   // 記住鏡頭在長圖的相對位置
  const lightningRatio = tileWidth > 0 ? lightningWorldX / tileWidth : 0;      // 記住閃電在長圖的相對位置
  const oldWidth = width;                       // 記住舊的視窗寬
  resizeCanvas(windowWidth, windowHeight);      // 畫布跟著視窗改變大小
  noSmooth();                                   // 重設畫布後要再關一次平滑
  updateLayout();                               // 重新計算背景尺寸
  backgroundCameraX = cameraRatio * maxCameraX; // 鏡頭維持原本的相對位置
  lightningWorldX = lightningRatio * tileWidth; // 閃電位置也依背景縮放比例調整
  characterX = characterX * (width / oldWidth); // 角色位置依視窗寬比例調整
}

// ============================================================
// 主迴圈
// ============================================================
function draw() {
  background(0);                                // 先清成黑色
  updateAnimationFrame();                       // 依時間換動畫影格
  updateMovement();                             // 依按鍵移動角色或背景
  updateFireballs();                            // 更新火球位置
  drawBackground();                             // 畫 3 張串接的背景
  updateLightning();                            // 更新並畫閃電與爆炸
  drawCharacter();                              // 畫角色
  drawFireballs();                              // 畫火球
  drawHint();                                   // 畫操作提示
}

// 每 100 毫秒換一格：靜止循環播放；跑步先播完起步動作，之後重複循環段
function updateAnimationFrame() {
  if (millis() - lastFrameTime >= frameDuration) {       // 時間到了才換格（不是每個 draw 都換）
    lastFrameTime = millis();                            // 重設計時
    if (action === 'stop') {                             // 靜止狀態
      stopFrame = (stopFrame + 1) % STOP.frames;         // 到最後一張後回到 0
    } else if (runFrameCount < RUN_PLAY_END) {           // 跑步還沒播到最後位置
      runFrameCount += 1;                                // 播放位置往下一格
    } else {                                             // 播到最後位置
      runFrameCount = RUN.frames;                        // 回到循環段的開頭（避免每次都重播起步動作）
    }
  }
}

// 播放位置換算成圖片索引：前 RUN.frames 格照順序，之後只循環 RUN_LOOP_START 之後的張數
function runIndexOf(count) {
  return count < RUN.frames ? count : RUN_LOOP_START + ((count - RUN.frames) % (RUN.frames - RUN_LOOP_START));
}

// ============================================================
// 移動：角色在中央時背景捲動；背景到盡頭或角色不在中央時，由角色自己走
// ============================================================
function updateMovement() {
  const dh = height / 3;                                  // 角色顯示高度 = 畫布高的 1/3
  const runW = (RUN.w / RUN.frames) * (dh / RUN.h);       // 跑步角色的顯示寬度
  if (millis() < pushUntil) return;                       // 發功時角色不移動
  if (direction === 0) return;                            // 沒按方向鍵就不用移動
  let remainingMovement = width * 0.32 * (deltaTime / 1000);   // 這一幀可以移動的距離（每秒約視窗寬的 0.32 倍）
  const center = width / 2;                               // 視窗中央
  if (direction === 1) {                                  // ---------- 按右鍵 ----------
    if (characterX < center) {                            // 角色還在中央左邊
      const toCenter = min(remainingMovement, center - characterX);   // 先走回中央
      characterX += toCenter;                             // 角色往中央走
      remainingMovement -= toCenter;                      // 扣掉已經用掉的距離
    }
    if (remainingMovement > 0) {                          // 還有剩下的距離
      const scrollDistance = min(remainingMovement, maxCameraX - backgroundCameraX);   // 背景最多只能捲到盡頭
      backgroundCameraX += scrollDistance;                // 鏡頭往右＝背景往左移
      remainingMovement -= scrollDistance;                // 扣掉背景捲動的距離
    }
    if (remainingMovement > 0) {                          // 背景到盡頭了還有剩
      characterX = min(width - runW / 2, characterX + remainingMovement);   // 改由角色往右走，停在視窗右邊緣
    }
  } else {                                                // ---------- 按左鍵 ----------
    if (characterX > center) {                            // 角色在中央右邊
      const toCenter = min(remainingMovement, characterX - center);   // 先走回中央
      characterX -= toCenter;                             // 角色往中央走
      remainingMovement -= toCenter;                      // 扣掉已經用掉的距離
    }
    if (remainingMovement > 0) {                          // 還有剩下的距離
      const scrollDistance = min(remainingMovement, backgroundCameraX);   // 背景最多捲回最左邊（0）
      backgroundCameraX -= scrollDistance;                // 鏡頭往左＝背景往右移
      remainingMovement -= scrollDistance;                // 扣掉背景捲動的距離
    }
    if (remainingMovement > 0) {                          // 背景到最左邊了還有剩
      characterX = max(runW / 2, characterX - remainingMovement);   // 改由角色往左走，停在視窗左邊緣
    }
  }
}

// ============================================================
// 畫背景：3 張同一張圖左右串接，鏡頭決定看到哪一段
// ============================================================
function drawBackground() {
  for (let i = 0; i < 3; i++) {                           // 3 張背景
    const x = i * tileWidth - backgroundCameraX;          // 每張在畫面上的 x（鏡頭右移，背景就往左）
    if (x + tileWidth < 0 || x > width) continue;         // 完全在畫面外就不用畫
    image(backgroundImage, floor(x), 0, ceil(tileWidth) + 1, height);   // 多畫 1 像素避免接縫露出縫隙
  }
}

// ============================================================
// 畫角色：靜止、跑步、發功三種動作；面向左邊時左右翻轉
// ============================================================
function drawCharacter() {
  const k = height / 3 / 30;                              // 放大倍率：角色顯示高度（畫布高 1/3）÷ 原圖高 30
  const baseY = height - height * 0.02;                   // 角色腳底的位置（貼近畫面底部）
  let sheet, spec, index;                                 // 要用的精靈圖、規格、影格
  if (millis() < pushUntil) {                             // 發功中
    sheet = pushSheet; spec = PUSH;                       // 使用發功精靈圖
    index = min(floor((millis() - pushStartedAt) / 150), PUSH.frames - 1);   // 每 150 毫秒一格，播到最後一格
  } else if (action === 'run') {                          // 跑步中
    sheet = runSheet; spec = RUN;                         // 使用跑步精靈圖
    index = runIndexOf(runFrameCount);                    // 播放位置換成圖片索引
  } else {                                                // 靜止
    sheet = stopSheet; spec = STOP;                       // 使用靜止精靈圖
    index = stopFrame;                                    // 靜止影格
  }
  const frameW = spec.w / spec.frames;                    // 單格寬 = 總寬 ÷ 影格數
  const displayWidth = frameW * k;                        // 顯示寬度依原圖比例縮放
  const displayHeight = spec.h * k;                       // 顯示高度
  push();                                                 // 保存繪圖設定
  translate(characterX, baseY);                           // 原點移到角色腳底中央
  if (facing === -1) scale(-1, 1);                        // 面向左邊就左右翻轉
  image(sheet, -displayWidth / 2, -displayHeight, displayWidth, displayHeight,
        index * frameW, 0, frameW, spec.h);               // 從精靈圖切出這一格畫上去
  pop();                                                  // 還原繪圖設定
}

// ============================================================
// 閃電與爆炸：背景到最右端時，在距離視窗右邊 1/4 的位置，由上往下打 3 次閃電，再在底端爆炸一次，不斷重複
// ============================================================
function updateLightning() {
  const atRightEnd = backgroundCameraX >= maxCameraX - 1; // 背景是否捲到最右端
  if (!lightningActive && atRightEnd) {                   // 剛到最右端而且特效還沒開始
    lightningActive = true;                               // 開始特效
    lightningStartedAt = millis();                        // 記下開始時間
    lightningWorldX = backgroundCameraX + width * 0.75;   // 記下「在背景上」的位置（距離視窗右邊 1/4）
    lastThunderStrike = -1;                               // 重設雷聲記錄
  }
  if (!lightningActive) return;                           // 沒有特效就不用畫
  const boltH = height;                                   // 閃電高度 = 整個視窗高
  const boltW = (BOLT.w / BOLT.frames) * (boltH / BOLT.h);// 閃電寬度依比例縮放
  const effectX = lightningWorldX - backgroundCameraX;    // 把背景座標換算回畫面座標（背景移動，特效跟著移動）
  const effectHasExited = effectX - boltW / 2 > width;    // 特效是否已完全離開畫面右側
  if (effectHasExited) {                                  // 離開了就停止特效與音效
    lightningActive = false;                              // 結束特效
    if (thunderSound && thunderSound.isPlaying()) thunderSound.stop();   // 停止雷聲
    return;                                               // 不用畫了
  }
  const elapsed = millis() - lightningStartedAt;          // 從開始到現在經過的時間
  const cycleElapsed = elapsed % CYCLE_MS;                // 在這個 4 秒循環裡的時間
  const strikeNumber = floor(cycleElapsed / STRIKE_MS);   // 現在是第幾次（0、1、2 是閃電，3 是爆炸）
  if (strikeNumber < STRIKES && strikeNumber !== lastThunderStrike) {   // 每次閃電只響一次
    if (thunderSound) thunderSound.play();                // 播放打雷音效
  }
  lastThunderStrike = strikeNumber;                       // 記住這次的編號（爆炸階段是 3，下個循環回到 0 又會再響）
  if (cycleElapsed < STRIKE_MS * STRIKES) {               // ---------- 閃電階段 ----------
    const frame = min(BOLT.frames - 1, floor((cycleElapsed % STRIKE_MS) / STRIKE_MS * BOLT.frames));   // 1 秒播完 14 張
    const frameW = BOLT.w / BOLT.frames;                  // 閃電單格寬
    const scaleK = boltH / BOLT.h;                        // 閃電放大倍率
    image(boltSheet, effectX - BOLT_TIP_X * scaleK, 0, boltW, boltH,
          frame * frameW, 0, frameW, BOLT.h);             // 從視窗最上面（y = 0）畫到最底下
  } else {                                                // ---------- 爆炸階段 ----------
    const t = cycleElapsed - STRIKE_MS * STRIKES;         // 爆炸開始後經過的時間
    const frame = min(BLAST.frames - 1, floor(t / STRIKE_MS * BLAST.frames));   // 1 秒播完 10 張，只播 1 次
    const blastH = height * 0.2;                          // 爆炸高度 = 視窗高的 0.2
    const blastW = (BLAST.w / BLAST.frames) * (blastH / BLAST.h);   // 爆炸寬度依比例縮放
    const frameW = BLAST.w / BLAST.frames;                // 爆炸單格寬
    image(blastSheet, effectX - blastW / 2, height - blastH, blastW, blastH,
          frame * frameW, 0, frameW, BLAST.h);            // 在視窗底端畫爆炸
  }
}

// ============================================================
// 空白鍵魔法：發功後射出火球（我自己加的創意）
// ============================================================
function updateFireballs() {
  if (firePending && millis() - pushStartedAt >= 220) {   // 發功到一半才射出火球
    firePending = false;                                  // 這次火球已射出
    const k = height / 3 / 30;                            // 與角色相同的放大倍率
    fireballs.push({ x: characterX + facing * 22 * k, y: height - height * 0.02 - 15 * k, dir: facing, born: millis() });   // 從角色嘴前射出
  }
  for (const f of fireballs) f.x += f.dir * width * 0.7 * (deltaTime / 1000);   // 火球往面對方向飛
  fireballs = fireballs.filter(f => f.x > -100 && f.x < width + 100);           // 飛出畫面就移除
}
function drawFireballs() {
  const k = height / 3 / 30;                              // 放大倍率
  const frameW = FIRE.w / FIRE.frames;                    // 火球單格寬
  for (const f of fireballs) {                            // 每一顆火球
    const index = floor((millis() - f.born) / 100) % FIRE.frames;   // 每 100 毫秒換一格
    push();                                               // 保存繪圖設定
    translate(f.x, f.y);                                  // 原點移到火球位置
    if (f.dir === -1) scale(-1, 1);                       // 往左飛要翻轉
    image(fireSheet, -frameW * k / 2, -FIRE.h * k / 2, frameW * k, FIRE.h * k, index * frameW, 0, frameW, FIRE.h);   // 畫火球
    pop();                                                // 還原繪圖設定
  }
}

// ============================================================
// 操作提示
// ============================================================
function drawHint() {
  noStroke();                                             // 不畫邊框
  fill(0, 0, 0, 110);                                     // 半透明黑底
  const w = min(width - 20, 460);                         // 提示框寬度
  rect(10, 10, w, 34, 10);                                // 提示框
  fill(255);                                              // 白色文字
  textAlign(LEFT, CENTER);                                // 文字靠左、垂直置中
  textSize(constrain(width / 45, 13, 18));                // 依視窗寬調整字級
  text('← → 跑步　空白鍵 發功　走到最右邊會打雷', 20, 27);   // 提示文字
}

// ============================================================
// 鍵盤
// ============================================================
function keyPressed(event) {
  if (typeof userStartAudio === 'function') userStartAudio();   // 瀏覽器規定要使用者操作後才能出聲，所以在這裡啟用音訊
  if (keyCode === RIGHT_ARROW || keyCode === LEFT_ARROW) {      // 按下左右方向鍵
    direction = keyCode === RIGHT_ARROW ? 1 : -1;               // 記下方向
    facing = direction;                                         // 面向跟著方向
    if (action !== 'run' || !(event && event.repeat)) {         // 不是「長按重複觸發」才重新起跑
      if (action !== 'run') runFrameCount = 0;                  // 每次起跑都從第 1 張開始
      action = 'run';                                           // 切換成跑步動作
    }
    return false;                                               // 避免網頁跟著捲動
  }
  if (keyCode === 32 && millis() >= pushUntil) {                // 按空白鍵而且沒有在發功
    pushStartedAt = millis();                                   // 記下發功開始時間
    pushUntil = pushStartedAt + 450;                            // 發功持續 450 毫秒
    firePending = true;                                         // 等一下射出火球
    return false;                                               // 避免網頁跟著捲動
  }
}

function keyReleased() {
  if (keyIsDown(RIGHT_ARROW)) { direction = 1; facing = 1; return false; }    // 右鍵還按著就繼續往右
  if (keyIsDown(LEFT_ARROW)) { direction = -1; facing = -1; return false; }  // 左鍵還按著就繼續往左
  if (keyCode === RIGHT_ARROW || keyCode === LEFT_ARROW) {      // 放開的是方向鍵而且沒有其他方向鍵按著
    action = 'stop';                                            // 回到靜止動畫
    direction = 0;                                              // 方向歸零
    stopFrame = 0;                                              // 靜止動畫從第 1 張開始
  }
  return false;                                                 // 避免網頁跟著捲動
}
