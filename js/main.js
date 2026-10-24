// main.js — 入口：创建游戏共享状态 + 界面 + 游戏循环。
// 每帧顺序：输入事件队列 → screen.update → screen.render
import { CANVAS } from './config.js';
import { ACTIVE_DIFFICULTY } from './config_level.js';
import { Input } from './input.js';
import { Miner } from './miner.js';
import {
  ScreenManager, MainMenuScreen, PlayingScreen, ShopScreen, BackpackScreen,
} from './screens.js';
import { SaveManager } from './savegame.js';
import { Backpack } from './backpack.js';
import { Shop } from './shop.js';
import { Buffs } from './buffs.js';
import { preloadAssets } from './render.js';

const canvas = document.getElementById('game-canvas');
canvas.width = CANVAS.width;
canvas.height = CANVAS.height;
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = true;
ctx.imageSmoothingQuality = 'high'; // 贴图都是透明 PNG：大图缩小时边缘更干净（混合仍走默认 source-over）
const input = new Input(canvas);

// ———— 存档/背包/商店：按依赖顺序 save → backpack → shop（页面打开即建，理由见决策记录） ————
const save = new SaveManager();        // 本地存档（启动读档，无档自动新建）
const backpack = new Backpack(save);   // 背包：数量持久化在存档里
const shop = new Shop(save, backpack); // 商店：扣金币 + 入背包

// ———— 游戏共享状态（界面切换后仍保留） ————
const game = {
  miner: new Miner(),
  entities: [],                  // Playing.enter() 按所选难度生成
  level: null,                   // 同上
  difficulty: ACTIVE_DIFFICULTY, // 当前所选难度 tag（主菜单难度选择写入）
  save,
  backpack,
  shop,
  buffs: new Buffs(), // 道具 buff（运行时态，不存档）：useItem 挂载、Buffs 持有数据结构
};

// ———— 界面 ————
const screens = new ScreenManager(ctx);
screens
  .register('menu', new MainMenuScreen(game, screens))
  .register('playing', new PlayingScreen(game, screens))
  .register('shop', new ShopScreen(game, screens))
  .register('backpack', new BackpackScreen(game, screens));
screens.switchTo('menu'); // 启动先进主菜单
preloadAssets(); // 启动即预载全部贴图：菜单浏览期间加载完，进游戏免 Loading

// ———— 主循环：requestAnimationFrame + delta time ————
let last = performance.now();
function loop(now) {
  const dt = Math.min((now - last) / 1000, 0.05); // 钳制 dt，切后台回来不跳帧
  last = now;
  const events = input.poll();
  screens.update(dt, events);
  screens.render();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
