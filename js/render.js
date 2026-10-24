// render.js — 全部绘制。
// 所有颜色/尺寸/贴图路径都来自 config.js（THEME/MINER_LOOK）与 config_shop.js（SHOP_UI）。
// 贴图切换逻辑：config 里填了 sprite 路径且图片加载成功后自动用贴图，
// 否则回退到矢量占位 —— 素材可以逐步替换，不影响运行。
// 贴图混合：全局不设 globalCompositeOperation，走 Canvas 默认 source-over ——
// 透明 PNG 的 alpha 通道自动与背景混合，drawImage 前不铺底色，透明区域直接透出。
import { ASSET, CANVAS, MINER_LOOK, THEME, WORLD } from './config.js';
import { OBJ_TYPES } from './config_level.js';
import { SHOP_ITEMS, SHOP_UI } from './config_shop.js';

/** 背景：天空渐变 + 地面（游戏场景与各界面共用） */
export function drawBackground(ctx) {
  const sky = ctx.createLinearGradient(0, 0, 0, CANVAS.height);
  sky.addColorStop(0, THEME.sky.top);
  sky.addColorStop(1, THEME.sky.bottom);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);

  const gy = WORLD.groundY;
  ctx.fillStyle = THEME.ground.color;
  ctx.fillRect(0, gy, CANVAS.width, CANVAS.height - gy);
  ctx.fillStyle = THEME.ground.edge;
  ctx.fillRect(0, gy, CANVAS.width, THEME.ground.edgeHeight);
}

/** 资源加载占位画面：背景 + Loading 动画点 + 进度条（纯矢量，不依赖任何贴图） */
export function drawLoading(ctx, state, t) {
  drawBackground(ctx);
  const m = THEME.menu;
  const ui = THEME.ui;
  const done = state.done + state.failed;
  const total = state.total;
  const dots = '.'.repeat(1 + (Math.floor(t * 2) % 3));

  ctx.textAlign = 'center';
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillStyle = m.title;
  ctx.fillText(`Loading${dots}`, CANVAS.width / 2, CANVAS.height / 2 - 24);

  ctx.font = m.subtitleFont;
  ctx.fillStyle = m.subtitle;
  ctx.fillText(`素材加载中 ${done} / ${total}`, CANVAS.width / 2, CANVAS.height / 2 + 14);

  // 进度条（矢量）
  const bw = 220;
  const bx = CANVAS.width / 2 - bw / 2;
  const by = CANVAS.height / 2 + 34;
  ctx.fillStyle = ui.buttonBorder;
  ctx.beginPath();
  ctx.roundRect(bx, by, bw, 6, 3);
  ctx.fill();
  if (done > 0) {
    ctx.fillStyle = m.title;
    ctx.beginPath();
    ctx.roundRect(bx, by, (bw * done) / total, 6, 3);
    ctx.fill();
  }
  ctx.textAlign = 'left';
}

/** 整个游戏场景：背景 + 抓取物 + 矿工/绳/钩 */
export function drawScene(ctx, game) {
  drawBackground(ctx);
  const { miner, entities } = game;

  // 抓取物（被钩住的跟着钩子画）
  for (const e of entities) {
    if (e.dead || e.caught) continue;
    drawEntity(ctx, e);
  }

  drawMiner(ctx, miner);
  if (miner.caught) drawEntity(ctx, miner.caught);
}

// ———— 图片缓存：同一路径只加载一次 ————
const imgCache = new Map();

function getImage(src) {
  if (!src) return null;
  let img = imgCache.get(src);
  if (!img) {
    img = new Image();
    img.src = ASSET.root + src;
    imgCache.set(src, img);
  }
  return img;
}

/** 贴图已加载成功才返回图片，否则 null（调用方回退到矢量占位） */
function readyImage(src) {
  const img = getImage(src);
  return img && img.complete && img.naturalWidth > 0 ? img : null;
}

// ———— 资源预载（非阻塞 barrier）————
// 数据驱动收集全部贴图路径：MINER_LOOK（body/hook）+ OBJ_TYPES + SHOP_ITEMS；
// 加新类型/换图/商品图标到位都不需要改这里。

function collectSpritePaths() {
  const paths = [MINER_LOOK.body.src, MINER_LOOK.hook.src];
  for (const t of Object.values(OBJ_TYPES)) paths.push(t.sprite);
  for (const it of Object.values(SHOP_ITEMS)) paths.push(it.sprite);
  return [...new Set(paths.filter(Boolean))];
}

let preloadState = null;

/**
 * 启动/进游戏前调用（幂等）：加载全部贴图，成功与失败都计数，全部结束即 ready。
 * onerror 放行（该图回退矢量占位）+ 10s 超时保险 → Loading 永远不会卡死。
 */
export function preloadAssets() {
  if (preloadState) return preloadState;
  const paths = collectSpritePaths();
  const state = { total: paths.length, done: 0, failed: 0, ready: false };
  const timer = setTimeout(() => {
    state.ready = true; // 超时保险：极端情况下强制放行（个别图可能晚到，走已有回退）
  }, 10000);
  Promise.all(
    paths.map(
      (p) =>
        new Promise((resolve) => {
          const img = getImage(p);
          if (img.complete) {
            // 事件已发生完（成功或已失败），不能再等 onload/onerror
            if (img.naturalWidth > 0) state.done++;
            else state.failed++;
            resolve();
            return;
          }
          img.onload = () => {
            state.done++;
            resolve();
          };
          img.onerror = () => {
            state.failed++;
            resolve();
          };
        })
    )
  ).then(() => {
    clearTimeout(timer);
    state.ready = true;
  });
  preloadState = state;
  return state;
}

/** 全部贴图（含失败回退的）已就绪：此时进游戏首帧即贴图版，不再闪烁 */
export function assetsReady() {
  return preloadState?.ready === true;
}

function drawMiner(ctx, miner) {
  const tip = miner.hookTip();
  const look = MINER_LOOK;

  // 绳
  ctx.strokeStyle = look.rope.color;
  ctx.lineWidth = look.rope.width;
  ctx.beginPath();
  ctx.moveTo(miner.x, miner.y);
  ctx.lineTo(tip.x, tip.y);
  ctx.stroke();

  // 矿工本体：优先贴图，否则矢量占位
  const bodyImg = readyImage(look.body.src);
  if (bodyImg) {
    const w = look.body.size;
    const h = w * (bodyImg.naturalHeight / bodyImg.naturalWidth);
    ctx.drawImage(
      bodyImg,
      miner.x - w * look.body.anchor.x,
      miner.y - h * look.body.anchor.y,
      w,
      h
    );
  } else {
    const p = look.placeholder;
    ctx.fillStyle = p.skin;
    ctx.beginPath();
    ctx.arc(miner.x, miner.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = p.cloth;
    ctx.fillRect(miner.x - p.radius * 0.9, miner.y + 2, p.radius * 1.8, p.radius * 0.75);
  }

  // 钩子：优先贴图，否则矢量十字钩。
  // 绕钩尖旋转 -miner.angle（canvas 逆时针为正，绳方向随 angle 顺时针摆，取负对齐）：
  // 钩子图的尖端（图内 +Y 方向）始终与绳子朝向一致（指向矿工外侧），
  // 连接端（图内 -Y）始终朝向矿工（绳起始点）；
  // 旋转枢轴在钩尖，而钩尖本身就在以矿工为中心的圆周上，轨道不受旋转影响。
  ctx.save();
  ctx.translate(tip.x, tip.y);
  ctx.rotate(-miner.angle);
  const hookImg = readyImage(look.hook.src);
  if (hookImg) {
    const s = look.hook.size;
    ctx.drawImage(hookImg, -s / 2, -s / 2, s, s);
  } else {
    ctx.strokeStyle = look.hook.color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-5, -5);
    ctx.lineTo(5, 5);
    ctx.moveTo(-5, 5);
    ctx.lineTo(5, -5);
    ctx.stroke();
  }
  ctx.restore();
}

function drawEntity(ctx, e) {
  // 贴图优先（素材逐步替换），否则走下面的矢量分支
  const img = readyImage(e.sprite);
  if (img) {
    const d = e.r * 2.6; // 显示直径略大于碰撞半径
    ctx.drawImage(img, e.x - d / 2, e.y - d / 2, d, d);
    return;
  }

  switch (e.type) {
    case 'goldSmall':
    case 'goldBig': {
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 3;
      ctx.stroke();
      // 高光
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.beginPath();
      ctx.arc(e.x - e.r * 0.3, e.y - e.r * 0.3, e.r * 0.22, 0, Math.PI * 2);
      ctx.fill();
      break;
    }
    case 'diamond': {
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y - e.r * 1.6);
      ctx.lineTo(e.x + e.r * 1.1, e.y);
      ctx.lineTo(e.x, e.y + e.r * 1.6);
      ctx.lineTo(e.x - e.r * 1.1, e.y);
      ctx.closePath();
      ctx.fill();
      // 棱面
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y - e.r * 1.6);
      ctx.lineTo(e.x, e.y);
      ctx.lineTo(e.x + e.r * 1.1, e.y);
      ctx.stroke();
      break;
    }
    case 'stoneSmall':
    case 'stoneBig': {
      ctx.fillStyle = e.color;
      ctx.beginPath();
      const n = 8;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        const rr = e.r * (0.8 + ((i * 37) % 5) * 0.09); // 不规则轮廓
        const px = e.x + Math.cos(a) * rr;
        const py = e.y + Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();
      break;
    }
    case 'bag': {
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.roundRect(e.x - e.r, e.y - e.r * 0.6, e.r * 2, e.r * 1.6, 6);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.lineWidth = 2;
      ctx.stroke();
      // 扎口
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(e.x - 3, e.y - e.r * 0.6 - 5, 6, 8);
      break;
    }
  }
}

/** HUD：第一行 分数/目标/难度 + 倒计时；第二行 金币 + 背包道具（遍历展示） */
export function drawHud(ctx, game) {
  const { level, save, backpack } = game;
  const hud = THEME.hud;
  ctx.fillStyle = hud.color;

  ctx.font = hud.font;
  ctx.textAlign = 'left';
  ctx.fillText(`分数 ${level.score} / 目标 ${level.target} · ${level.tag}`, hud.pad, hud.lineY);
  ctx.textAlign = 'right';
  const secs = Math.max(0, level.timeLeft).toFixed(1);
  ctx.fillText(`时间 ${secs}s`, CANVAS.width - hud.pad, hud.lineY);

  ctx.font = hud.subFont;
  ctx.textAlign = 'left';
  const items = backpack.list();
  const itemsText = items.length
    ? items.map((it) => `${it.def.label}${it.def.key ? `(${it.def.key})` : ''}×${it.count}`).join(' ')
    : '空';
  ctx.fillText(`金币 ${save.coins} · 背包 ${itemsText}`, hud.pad, hud.subLineY);
  ctx.textAlign = 'left';
}

/** 结算飘字（+50 之类） */
export function drawPopups(ctx, popups) {
  const pop = THEME.popup;
  ctx.font = pop.font;
  ctx.textAlign = 'center';
  for (const p of popups) {
    ctx.globalAlpha = 1 - p.t;
    ctx.fillStyle = pop.color;
    ctx.fillText(p.text, p.x, p.y - p.t * pop.floatSpeed);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

/** 关卡结果画面（正式 Result 界面接入前的占位） */
export function drawResult(ctx, level) {
  const r = THEME.result;
  ctx.fillStyle = r.overlay;
  ctx.fillRect(0, 0, CANVAS.width, CANVAS.height);
  ctx.fillStyle = r.titleColor;
  ctx.textAlign = 'center';
  ctx.font = r.titleFont;
  ctx.fillText(level.result === 'clear' ? '过关！' : '时间到…', CANVAS.width / 2, CANVAS.height / 2 - 10);
  ctx.font = r.textFont;
  ctx.fillText(`最终分数 ${level.score}`, CANVAS.width / 2, CANVAS.height / 2 + 34);
  ctx.textAlign = 'left';
}

/** 界面大标题（主菜单/商店/背包共用）：金色标题 + 阴影 + 副标题行 */
export function drawTitle(ctx, title, sub = '') {
  const m = THEME.menu;
  ctx.textAlign = 'center';
  ctx.font = 'bold 56px system-ui, sans-serif';
  ctx.fillStyle = m.titleShadow;
  ctx.fillText(title, CANVAS.width / 2 + 3, 153);
  ctx.fillStyle = m.title;
  ctx.fillText(title, CANVAS.width / 2, 150);
  ctx.font = m.subtitleFont;
  ctx.fillStyle = m.subtitle;
  ctx.fillText(sub, CANVAS.width / 2, 188);
  ctx.textAlign = 'left';
}

/** 难度选择页：每个难度按钮下方的一行战绩文字 */
export function drawDifficultyRecords(ctx, items) {
  const m = THEME.menu;
  ctx.font = m.subtitleFont;
  ctx.fillStyle = m.subtitle;
  ctx.textAlign = 'center';
  for (const it of items) {
    ctx.fillText(it.text, it.x, it.y);
  }
  ctx.textAlign = 'left';
}

/** 单个按钮（圆角矩形 + 居中文字），被 drawButtons / drawItemGrid 复用 */
function drawButtonRect(ctx, b) {
  const ui = THEME.ui;
  ctx.fillStyle = ui.button;
  ctx.beginPath();
  ctx.roundRect(b.x, b.y, b.w, b.h, 8);
  ctx.fill();
  ctx.strokeStyle = ui.buttonBorder;
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = ui.buttonText;
  ctx.font = ui.buttonFont;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2);
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
}

/** 通用按钮绘制（主菜单 / 游戏内 / 商店购买共用） */
export function drawButtons(ctx, buttons) {
  for (const b of buttons) drawButtonRect(ctx, b);
}

/**
 * 商店/背包共用的物品格子：图标 + 名字 + 右下角数量角标；
 * 商店卡片另带价格与购买按钮，背包卡片另带使用按钮（同一套 SHOP_UI 参数）。
 * cards: [{ x, y, color, sprite, label, badge?, price?, buy?, use? }]
 */
export function drawItemGrid(ctx, cards) {
  const ui = SHOP_UI;
  for (const c of cards) {
    // 图标：优先贴图，否则圆 + 商品占位色
    const img = readyImage(c.sprite);
    if (img) {
      const d = ui.iconR * 2;
      ctx.drawImage(img, c.x - d / 2, c.y - d / 2, d, d);
    } else {
      ctx.fillStyle = c.color;
      ctx.beginPath();
      ctx.arc(c.x, c.y, ui.iconR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // 数量角标：图标右下角
    if (c.badge != null) {
      const bx = c.x + ui.iconR * 0.7;
      const by = c.y + ui.iconR * 0.7;
      ctx.fillStyle = ui.badgeBg;
      ctx.beginPath();
      ctx.arc(bx, by, ui.badgeR, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = ui.badgeText;
      ctx.font = ui.countFont;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(c.badge), bx, by + 1);
      ctx.textBaseline = 'alphabetic';
      ctx.textAlign = 'left';
    }

    // 名字
    ctx.fillStyle = THEME.hud.color;
    ctx.font = ui.nameFont;
    ctx.textAlign = 'center';
    ctx.fillText(c.label, c.x, c.y + ui.nameDy);

    // 价格 + 购买/使用按钮（商店=购买、背包=使用）
    if (c.price != null) {
      ctx.fillStyle = THEME.popup.color;
      ctx.font = ui.priceFont;
      ctx.fillText(`${c.price} 金币`, c.x, c.y + ui.priceDy);
    }
    if (c.buy) drawButtonRect(ctx, c.buy);
    if (c.use) drawButtonRect(ctx, c.use);
    ctx.textAlign = 'left';
  }
}

/** 屏幕中央上方的短暂提示（如购买结果） */
export function drawToast(ctx, toast) {
  if (!toast || !toast.text) return;
  ctx.font = THEME.menu.subtitleFont;
  ctx.fillStyle = THEME.popup.color;
  ctx.textAlign = 'center';
  ctx.fillText(toast.text, CANVAS.width / 2, 218);
  ctx.textAlign = 'left';
}

/** 界面中央提示行（主菜单快捷键说明等），y 指定文字基线 */
export function drawHint(ctx, text, y) {
  ctx.font = THEME.menu.subtitleFont;
  ctx.fillStyle = THEME.menu.subtitle;
  ctx.textAlign = 'center';
  ctx.fillText(text, CANVAS.width / 2, y);
  ctx.textAlign = 'left';
}

/** 界面空态提示（如背包为空） */
export function drawEmptyHint(ctx, text) {
  drawHint(ctx, text, SHOP_UI.gridY);
}

/** 调试信息：当前状态 / 绳长 / 角度（已停用：需要时在 PlayingScreen.render 里调用） */
export function drawDebug(ctx, miner) {
  const d = THEME.debug;
  ctx.fillStyle = d.color;
  ctx.font = d.font;
  ctx.fillText(
    `state: ${miner.state}  rope: ${miner.ropeLen.toFixed(1)}  angle: ${miner.angle.toFixed(2)}`,
    12,
    CANVAS.height - 10
  );
}
