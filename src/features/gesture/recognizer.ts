// src/features/gesture/recognizer.ts

export type TrailPoint = {
  rawX: number;
  rawY: number;
  t: number;
};

export type GestureResult =
  | { type: "V"; confidence: number }
  | { type: "M"; confidence: number }
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
 * 軌跡が V字 か M字 かを判定する
 * @param trail 軌跡の座標列
 * @returns 判定結果
 */
export function recognizeGesture(trail: TrailPoint[]): GestureResult {
  // 点が少なすぎる場合は判定不能
  if (trail.length < 20) return { type: "unknown" };

  // Y 方向の移動量が小さすぎる場合は判定しない
  const ySpan = calcYSpan(trail);
  if (ySpan < 2) return { type: "unknown" };

  // スムージング（ウィンドウサイズ: 全体の約 10%）
  const windowSize = Math.max(3, Math.floor(trail.length * 0.1));
  const smoothedY = smoothY(trail, windowSize);

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
