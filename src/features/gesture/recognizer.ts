// src/features/gesture/recognizer.ts

export type TrailPoint = {
  rawX: number;
  rawY: number;
  t: number;
};

export type GestureResult =
  | { type: "V"; confidence: number }
  | { type: "M"; confidence: number }
  | { type: "L"; confidence: number }
  | { type: "Z"; confidence: number }
  | { type: "InvV"; confidence: number }
  | { type: "W"; confidence: number }
  | { type: "unknown" };

/**
 * 軌跡の Y 座標を移動平均でスムージングする
 * ノイズで余計な方向転換が検出されるのを防ぐ
 */
function smoothY(trail: TrailPoint[], windowSize: number): number[] {
  return trail.map((_, i) => {
    const start = Math.max(0, i - windowSize);
    const end = Math.min(trail.length, i + windowSize + 1);
    const slice = trail.slice(start, end);
    return slice.reduce((sum, p) => sum + p.rawY, 0) / slice.length;
  });
}

/**
 * 軌跡の X 座標を移動平均でスムージングする
 */
function smoothX(trail: TrailPoint[], windowSize: number): number[] {
  return trail.map((_, i) => {
    const start = Math.max(0, i - windowSize);
    const end = Math.min(trail.length, i + windowSize + 1);
    const slice = trail.slice(start, end);
    return slice.reduce((sum, p) => sum + p.rawX, 0) / slice.length;
  });
}

/**
 * スムージング済みの Y 座標列から「方向転換の回数」を数える
 * 例: 下→上 で 1回、上→下→上→下 で 3回
 * @param minChange  この変化量より小さい動きは転換とみなさない（ノイズ除去）
 */
function countDirectionChanges(smoothedY: number[], minChange: number): number {
  let changes = 0;
  let direction = 0; // 0=未定, 1=増加(下向き), -1=減少(上向き)
  let lastExtreme = smoothedY[0];

  for (let i = 1; i < smoothedY.length; i++) {
    const dy = smoothedY[i] - lastExtreme;

    if (Math.abs(dy) < minChange) continue; // 変化が小さすぎる場合は無視

    const newDirection = dy > 0 ? 1 : -1;

    if (direction !== 0 && newDirection !== direction) {
      // 方向が逆になった → 転換1回
      changes++;
      lastExtreme = smoothedY[i];
    } else {
      // 同方向に進行中または開始直後: 極値を常に最新に更新する
      lastExtreme = smoothedY[i];
    }

    direction = newDirection;
  }

  return changes;
}

/**
 * 軌跡の全体的な Y 幅（高さのスパン）を計算する
 * 幅が狭すぎる場合は「ほぼ水平」なので形の判定をスキップする
 */
function calcYSpan(trail: TrailPoint[]): number {
  const ys = trail.map((p) => p.rawY);
  return Math.max(...ys) - Math.min(...ys);
}

/**
 * 軌跡の全体的な X 幅（横方向のスパン）を計算する
 */
function calcXSpan(trail: TrailPoint[]): number {
  const xs = trail.map((p) => p.rawX);
  return Math.max(...xs) - Math.min(...xs);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

/**
 * L字判定
 * 上から下へ伸びる縦線 + 下端で横に払う線 を検出する
 */
function recognizeLGesture(
  smoothedX: number[],
  smoothedY: number[],
  xSpan: number,
  ySpan: number,
): GestureResult | null {
  const n = smoothedY.length;
  if (n < 20) return null;

  const cornerIdx = smoothedY.reduce(
    (best, y, idx) => (y > smoothedY[best] ? idx : best),
    0,
  );

  // 角は序盤すぎず終盤すぎない位置にあること
  const cornerPos = cornerIdx / Math.max(1, n - 1);
  if (cornerPos < 0.2 || cornerPos > 0.95) return null;

  const startX = smoothedX[0];
  const startY = smoothedY[0];
  const cornerX = smoothedX[cornerIdx];
  const cornerY = smoothedY[cornerIdx];
  const endX = smoothedX[n - 1];
  const endY = smoothedY[n - 1];

  const verticalDy = cornerY - startY;
  const verticalDx = Math.abs(cornerX - startX);
  const horizontalDx = Math.abs(endX - cornerX);
  const horizontalDy = Math.abs(endY - cornerY);

  const hasStrongVertical = verticalDy > ySpan * 0.35;
  const hasStrongHorizontal = horizontalDx > xSpan * 0.3;
  if (!hasStrongVertical || !hasStrongHorizontal) return null;

  const verticalStraight = verticalDx <= xSpan * 0.65;
  const horizontalStraight = horizontalDy <= ySpan * 0.5;
  if (!verticalStraight || !horizontalStraight) return null;

  const verticalityScore = clamp01(1 - verticalDx / Math.max(1, verticalDy));
  const horizontalityScore = clamp01(
    1 - horizontalDy / Math.max(1, horizontalDx),
  );
  const cornerScore = clamp01(1 - Math.abs(cornerPos - 0.65) / 0.65);
  const confidence = clamp01(
    verticalityScore * 0.45 + horizontalityScore * 0.45 + cornerScore * 0.1,
  );

  // L字判定まで通った場合は、IntentGate閾値(0.45)を越えやすいよう最低値を底上げする
  return { type: "L", confidence: Math.max(0.52, confidence) };
}

/**
 * Z字判定
 * 左から右へ → 右下へ → 右から左へ のジグザグパターンを検出する（雷マーク⚡）
 */
function recognizeZGesture(
  smoothedX: number[],
  smoothedY: number[],
  xSpan: number,
  ySpan: number,
): GestureResult | null {
  const n = smoothedX.length;
  if (n < 20) return null;

  // X方向で方向転換が1-2回起こることを確認（Z字の特徴）
  const minChange = xSpan * 0.15; // X変化の最小値
  const xChanges = countDirectionChanges(smoothedX, minChange);
  if (xChanges < 1 || xChanges > 2) return null;

  // Y方向での変化量がある程度ある（完全に水平ではない）
  if (ySpan < xSpan * 0.3) return null;

  // 軌跡全体でX方向の変化が大きい
  const startX = smoothedX[0];
  const endX = smoothedX[n - 1];
  const xTotal = Math.abs(endX - startX);
  if (xTotal < xSpan * 0.5) return null;

  // ジグザグが起こっているか確認： 全体では左から右（または右から左）、その中で反転がある
  // confidenceの計算
  const xChangeFrequency = xChanges / 2; // 1-2回なら 0.5-1.0
  const xCoverage = clamp01(xTotal / xSpan); // X全体をどれだけ使っているか
  const yCoverage = clamp01(ySpan / xSpan); // Y方向の広さ（0.3以上が必須）
  const confidence = clamp01(
    xChangeFrequency * 0.4 + xCoverage * 0.35 + yCoverage * 0.25,
  );

  return confidence > 0.3 ? { type: "Z", confidence } : null;
}

/**
 * W判定（横一直線）
 * 横方向へまっすぐ進む軌跡を検出する
 */
function recognizeWaveGesture(
  smoothedX: number[],
  smoothedY: number[],
  xSpan: number,
  ySpan: number,
): GestureResult | null {
  const n = smoothedX.length;
  if (n < 20) return null;

  // 横幅が十分あり、縦ブレは小さいこと
  if (xSpan < 8) return null;
  if (ySpan > xSpan * 0.28) return null;

  // X方向は概ね単調に進む（大きな折り返しがない）
  let forward = 0;
  let backward = 0;
  for (let i = 1; i < n; i++) {
    const dx = smoothedX[i] - smoothedX[i - 1];
    if (Math.abs(dx) < xSpan * 0.01) continue;
    if (dx > 0) forward++;
    else backward++;
  }

  const total = forward + backward;
  if (total === 0) return null;
  const monotonicity = Math.max(forward, backward) / total;
  if (monotonicity < 0.82) return null;

  // Y方向の微小ノイズでの蛇行を抑える
  const yChanges = countDirectionChanges(smoothedY, Math.max(1, ySpan * 0.18));
  if (yChanges > 2) return null;

  const straightness = clamp01(1 - ySpan / Math.max(1, xSpan * 0.28));
  const horizontalScore = clamp01(xSpan / Math.max(8, ySpan * 2.2));
  const monotonicScore = clamp01((monotonicity - 0.82) / 0.18);
  const confidence = clamp01(
    straightness * 0.45 + horizontalScore * 0.25 + monotonicScore * 0.3,
  );

  return confidence > 0.45 ? { type: "W", confidence } : null;
}

/**
 * 逆V字判定（∧の形、頂点が上）
 * 中央付近で上方向の頂点を作り、始点/終点が下側にある形を検出する
 */
function recognizeInvVGesture(
  smoothedY: number[],
  ySpan: number,
): GestureResult | null {
  const n = smoothedY.length;
  if (n < 20) return null;

  // Y方向の移動量がある程度ないと判定不可
  if (ySpan < 5) return null;

  // 逆Vは Y方向の方向転換が1〜2回で、頂点が中央付近に来るのが基本
  const minChange = ySpan * 0.15;
  const changes = countDirectionChanges(smoothedY, minChange);
  if (changes !== 1 && changes !== 2) return null;

  const apexIdx = smoothedY.reduce(
    (best, y, idx) => (y < smoothedY[best] ? idx : best),
    0,
  );
  const apexPos = apexIdx / Math.max(1, n - 1);
  if (apexPos < 0.2 || apexPos > 0.8) return null;

  const apexY = smoothedY[apexIdx];
  const maxY = Math.max(...smoothedY);

  // 頂点の左右で十分に下方向へ降りていること（両脚がある）
  const leftLeg = smoothedY.slice(0, apexIdx + 1);
  const rightLeg = smoothedY.slice(apexIdx);
  if (!leftLeg.length || !rightLeg.length) return null;

  const leftLowY = Math.max(...leftLeg);
  const rightLowY = Math.max(...rightLeg);
  const leftDrop = leftLowY - apexY;
  const rightDrop = rightLowY - apexY;
  const hasClearApex = apexY < maxY - ySpan * 0.5;
  const hasBothLegs = leftDrop > ySpan * 0.35 && rightDrop > ySpan * 0.35;
  if (!hasClearApex || !hasBothLegs) return null;

  const apexCenteredness = clamp01(1 - Math.abs(apexPos - 0.5) * 2);
  const symmetry = clamp01(
    1 - Math.abs(leftDrop - rightDrop) / Math.max(1, leftDrop + rightDrop),
  );
  const depthScore = clamp01(Math.min(leftDrop, rightDrop) / Math.max(1, ySpan));
  const turnScore = changes === 1 ? 1 : 0.85;
  const confidence = clamp01(
    apexCenteredness * 0.4 + symmetry * 0.22 + depthScore * 0.28 + turnScore * 0.1,
  );

  return confidence > 0.4 ? { type: "InvV", confidence } : null;
}

/**
 * 軌跡が V字 か M字 かを判定する
 * @param trail 軌跡の座標列
 * @returns 判定結果
 */
export function recognizeGesture(trail: TrailPoint[]): GestureResult {
  // 点が少なすぎる場合は判定不能
  if (trail.length < 20) return { type: "unknown" };

  // Y 方向の移動量が小さすぎる場合は判定しない
  const ySpan = calcYSpan(trail);
  const xSpan = calcXSpan(trail);
  if (ySpan < 2) return { type: "unknown" };

  // スムージング（ウィンドウサイズ: 全体の約 10%）
  const windowSize = Math.max(3, Math.floor(trail.length * 0.1));
  const smoothedX = smoothX(trail, windowSize);
  const smoothedY = smoothY(trail, windowSize);

  // --- L字判定を先に実施（V字との誤分類を減らす） ---
  if (xSpan >= 2) {
    const lResult = recognizeLGesture(smoothedX, smoothedY, xSpan, ySpan);
    if (lResult) return lResult;
  }

  // --- 逆V字判定を実施（炎🔥） ---
  const invVResult = recognizeInvVGesture(smoothedY, ySpan);
  if (invVResult) return invVResult;

  // --- 横一直線判定を実施（ウェーブ🌊） ---
  if (xSpan >= 2) {
    const waveResult = recognizeWaveGesture(smoothedX, smoothedY, xSpan, ySpan);
    if (waveResult) return waveResult;
  }

  // --- Z字判定を実施（雷マーク⚡） ---
  if (xSpan >= 2) {
    const zResult = recognizeZGesture(smoothedX, smoothedY, xSpan, ySpan);
    if (zResult) return zResult;
  }

  // 転換の最小変化量（Y スパンの 15% 以下の変化はノイズとみなす）
  const minChange = ySpan * 0.15;
  const changes = countDirectionChanges(smoothedY, minChange);

  // --- V字判定: 方向転換が1回 ---
  if (changes === 1) {
    // 信頼度: 転換点が端すぎず中間にあるほど高い
    const turningIdx = findTurningIndex(smoothedY);
    const relPos = turningIdx / trail.length;
    const centeredness = 1 - Math.abs(relPos - 0.5) * 2; // 0.5 が中央なら 1.0
    const confidence = Math.max(0, centeredness);
    return { type: "V", confidence };
  }

  // --- M字判定: 方向転換が3回 ---
  if (changes === 3) {
    // M字は起点と終点が「底」付近にあることを確認する
    const startY = smoothedY[0];
    const endY = smoothedY[smoothedY.length - 1];
    const maxY = Math.max(...smoothedY);
    const minY = Math.min(...smoothedY);
    const midY = (maxY + minY) / 2;

    // 始点と終点が中央より下（rawY が大きい = 下方向）にあればM字らしい
    const startsAtBottom = startY > midY;
    const endsAtBottom = endY > midY;
    const confidence = startsAtBottom && endsAtBottom ? 0.8 : 0.4;
    return { type: "M", confidence };
  }

  return { type: "unknown" };
}

/**
 * スムージング済みY列の中で「最初の転換点」のインデックスを探す（V字の頂点検出用）
 */
function findTurningIndex(smoothedY: number[]): number {
  // 全体の最小値または最大値のうち、より中央に近い方を返す
  let minIdx = 0;
  let maxIdx = 0;
  for (let i = 1; i < smoothedY.length; i++) {
    if (smoothedY[i] < smoothedY[minIdx]) minIdx = i;
    if (smoothedY[i] > smoothedY[maxIdx]) maxIdx = i;
  }
  const center = smoothedY.length / 2;
  const minDist = Math.abs(minIdx - center);
  const maxDist = Math.abs(maxIdx - center);
  return minDist < maxDist ? minIdx : maxIdx;
}
