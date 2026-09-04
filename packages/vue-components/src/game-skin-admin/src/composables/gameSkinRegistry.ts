// gameSkinRegistry.ts — 单一事实源：游戏维度皮肤管线注册表
//
// 与 fr 侧 lib/core/game_kit/skin/game_skin_spec.dart 派生规则一一对应：
//   KV key   = <game>_skin:index
//   tagPrefix= <game>-skin
// fileTags 三级：[tagPrefix, `${tagPrefix}:${skinId}`, `${tagPrefix}:${skinId}:${assetKey}`]
// fr 侧 GameSkinSpec.cacheDirName / prefsKey 仅影响 Flutter 客户端，本表不重复。
//
// 视图层：gridColumns 决定 .csa-grid 列数（chess 12 枚 → 6 列×2 行；gomoku 3 枚 → 3 列×1 行）

export interface AiPromptArgs {
  skinId: string;
  displayName: string;
  colorStyle: 'vivid' | 'warm' | 'cool' | 'muted';
  artDirection?: string;
}

export interface GameSkinRegistryEntry {
  /** 与 fr GameDefinition.slug / kGameMeta 字符级一致 */
  gameId: string;
  /** 展示名（游戏切换器标签） */
  displayName: string;
  /** KV 索引 key：`<game>_skin:index` */
  kvIndexKey: string;
  /** 文件/KV 公共 tag 前缀：`<game>-skin` */
  tagPrefix: string;
  /** KV public 共享组（全游戏 190） */
  groupId: number;
  /** 该游戏所需的资产 key 集合 */
  assetKeys: readonly string[];
  /** assetKey → 期望文件名（用于 AI prompt 占位与上传回填提示） */
  fileNames: Record<string, string>;
  /** 预览网格列数（chess 6 / gomoku 3） */
  gridColumns: number;
  /** 该游戏资产的人类可读标签（用于 tile 下方 key 行的补充说明，可空） */
  labels: Record<string, string>;
  /** AI prompt 渲染器：由 registry 条目闭包生成，拿到 skinId/displayName/colorStyle/artDirection */
  aiPrompt: (args: AiPromptArgs) => string;
}

const SHARED_GROUP_ID = 190;

// ── chess：12 枚棋子（保留 fr 侧 00_* 历史命名，与 tool/upload_chess_skins 归档一致） ──
const CHESS_ASSET_KEYS = [
  'wK', 'wQ', 'wR', 'wB', 'wN', 'wp',
  'bK', 'bQ', 'bR', 'bB', 'bN', 'bp',
] as const;

const CHESS_FILE_NAMES: Record<string, string> = {
  wK: '00_white_king.webp', wQ: '01_white_queen.webp', wR: '02_white_rook.webp',
  wB: '03_white_bishop.webp', wN: '04_white_knight.webp', wp: '05_white_pawn.webp',
  bK: '06_black_king.webp', bQ: '07_black_queen.webp', bR: '08_black_rook.webp',
  bB: '09_black_bishop.webp', bN: '10_black_knight.webp', bp: '11_black_pawn.webp',
};

const CHESS_LABELS: Record<string, string> = {
  wK: '白王', wQ: '白后', wR: '白车', wB: '白象', wN: '白马', wp: '白兵',
  bK: '黑王', bQ: '黑后', bR: '黑车', bB: '黑象', bN: '黑马', bp: '黑兵',
};

function chessAiPrompt(args: AiPromptArgs): string {
  const art = args.artDirection?.trim() || '保持统一视觉风格，边缘干净，适合在棋盘上缩放至 32×32 显示';
  const pieceExample = (k: string) =>
    `    "${k}": { "fileId": "TBD", "fileName": "${CHESS_FILE_NAMES[k]}", "sizeBytes": 0, "contentType": "image/webp" }`;
  const piecesJson = CHESS_ASSET_KEYS.map(pieceExample).join(',\n');
  return [
    '请输出一个国际象棋皮肤 meta JSON（只输出 JSON，不要任何解释/代码块/前后缀文字）。',
    '',
    `皮肤主题：${art}`,
    '',
    'JSON schema:',
    '{',
    `  "id": "${args.skinId}",`,
    `  "displayName": "${args.displayName}",`,
    '  "version": 1,',
    `  "colorStyle": "${args.colorStyle}",`,
    '  "createdAt": "<ISO 8601 时间戳，例如 2026-09-01T00:00:00Z>",',
    '  "updatedAt": "<ISO 8601 时间戳>",',
    '  "pieces": {',
    piecesJson,
    '  }',
    '}',
    '',
    '硬约束：',
    '- id 必须匹配 ^[a-z0-9][a-z0-9-]{0,31}$（你已经拿到 skinId，直接填）',
    '- 12 个 piece key 必须齐全：wK wQ wR wB wN wp / bK bQ bR bB bN bp',
    '- 所有 fileId 先填 "TBD" 占位 —— 用户拿到 JSON 后会用批量上传脚本回填',
    '- createdAt / updatedAt 都填当前时间（ISO 8601）',
    '- colorStyle 必须是 vivid / warm / cool / muted 之一',
  ].join('\n');
}

// ── gomoku：黑/白子 + 棋盘底图（board 可选，UI 走主题棋盘色回退） ──
const GOMOKU_ASSET_KEYS = ['black', 'white', 'board'] as const;

const GOMOKU_FILE_NAMES: Record<string, string> = {
  black: 'black.webp',
  white: 'white.webp',
  board: 'board.webp',
};

const GOMOKU_LABELS: Record<string, string> = {
  black: '黑子', white: '白子', board: '棋盘底图',
};

function gomokuAiPrompt(args: AiPromptArgs): string {
  const art = args.artDirection?.trim() || '保持黑白两子视觉统一，棋子为正圆、边缘干净，适合在 15×15 棋盘交点上显示；棋盘底图可选，木纹或极简底色均可';
  const pieceExample = (k: string) =>
    `    "${k}": { "fileId": "TBD", "fileName": "${GOMOKU_FILE_NAMES[k]}", "sizeBytes": 0, "contentType": "image/webp" }`;
  const piecesJson = GOMOKU_ASSET_KEYS.map(pieceExample).join(',\n');
  return [
    '请输出一个五子棋皮肤 meta JSON（只输出 JSON，不要任何解释/代码块/前后缀文字）。',
    '',
    `皮肤主题：${art}`,
    '',
    'JSON schema:',
    '{',
    `  "id": "${args.skinId}",`,
    `  "displayName": "${args.displayName}",`,
    '  "version": 1,',
    '  "createdAt": "<ISO 8601 时间戳，例如 2026-09-01T00:00:00Z>",',
    '  "updatedAt": "<ISO 8601 时间戳>",',
    '  "pieces": {',
    piecesJson,
    '  }',
    '}',
    '',
    '硬约束：',
    '- id 必须匹配 ^[a-z0-9][a-z0-9-]{0,31}$（你已经拿到 skinId，直接填）',
    '- 至少包含 black + white 两枚棋子；board（棋盘底图）可选，缺省时客户端走主题棋盘色',
    '- 所有 fileId 先填 "TBD" 占位 —— 用户拿到 JSON 后会用批量上传脚本回填',
    '- createdAt / updatedAt 都填当前时间（ISO 8601）',
    '- 棋子建议正方形 webp，透明底，视觉密度统一',
  ].join('\n');
}

export const GAME_SKIN_REGISTRY: Record<string, GameSkinRegistryEntry> = {
  chess: {
    gameId: 'chess',
    displayName: '国际象棋',
    kvIndexKey: 'chess_skin:index',
    tagPrefix: 'chess-skin',
    groupId: SHARED_GROUP_ID,
    assetKeys: CHESS_ASSET_KEYS,
    fileNames: CHESS_FILE_NAMES,
    gridColumns: 6,
    labels: CHESS_LABELS,
    aiPrompt: chessAiPrompt,
  },
  gomoku: {
    gameId: 'gomoku',
    displayName: '五子棋',
    kvIndexKey: 'gomoku_skin:index',
    tagPrefix: 'gomoku-skin',
    groupId: SHARED_GROUP_ID,
    assetKeys: GOMOKU_ASSET_KEYS,
    fileNames: GOMOKU_FILE_NAMES,
    gridColumns: 3,
    labels: GOMOKU_LABELS,
    aiPrompt: gomokuAiPrompt,
  },
};

export const SUPPORTED_GAME_IDS = Object.keys(GAME_SKIN_REGISTRY);

export function resolveGameSkinEntry(gameId: string): GameSkinRegistryEntry {
  return GAME_SKIN_REGISTRY[gameId] ?? GAME_SKIN_REGISTRY.chess;
}

export function isSupportedGameId(gameId: string): boolean {
  return gameId in GAME_SKIN_REGISTRY;
}
