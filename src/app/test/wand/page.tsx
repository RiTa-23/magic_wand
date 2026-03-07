"use client";

import { useEffect, useRef } from "react";
import { useJoyCon } from "@/features/device/api/useJoyCon";

// キャンバスの表示サイズ
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;
const PADDING = 40; // 描画領域のパディング

export default function WandTrackingPage() {
  const { status, irFrame, isSwitching, joyconState, connect, disconnect } =
    useJoyCon();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  // 軌跡を保存するバッファ（最大200点、生の座標を保持）
  const trailRef = useRef<{ rawX: number; rawY: number; t: number }[]>([]);
  const animFrameRef = useRef<number>(0);

  // 生の座標をキャンバス上の座標に変換
  const toCanvasCoords = (
    rawX: number,
    rawY: number,
    minX: number,
    maxX: number,
    minY: number,
    maxY: number,
  ) => {
    const spanX = Math.max(maxX - minX, 1);
    const spanY = Math.max(maxY - minY, 1);
    const drawW = CANVAS_WIDTH - PADDING * 2;
    const drawH = CANVAS_HEIGHT - PADDING * 2;
    const cx = PADDING + ((rawX - minX) / spanX) * drawW;
    const cy = PADDING + ((rawY - minY) / spanY) * drawH;
    return { cx, cy };
  };

  // クラスタリングデータからcanvasに描画
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const draw = () => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // ── 背景グリッド ──
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      for (let x = 0; x <= CANVAS_WIDTH; x += 40) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, CANVAS_HEIGHT);
        ctx.stroke();
      }
      for (let y = 0; y <= CANVAS_HEIGHT; y += 40) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(CANVAS_WIDTH, y);
        ctx.stroke();
      }

      // ── 描画領域の枠 ──
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1;
      ctx.strokeRect(
        PADDING,
        PADDING,
        CANVAS_WIDTH - PADDING * 2,
        CANVAS_HEIGHT - PADDING * 2,
      );

      // ── 十字線（中央） ──
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(CANVAS_WIDTH / 2, PADDING);
      ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT - PADDING);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(PADDING, CANVAS_HEIGHT / 2);
      ctx.lineTo(CANVAS_WIDTH - PADDING, CANVAS_HEIGHT / 2);
      ctx.stroke();
      ctx.setLineDash([]);

      const now = performance.now();
      const trail = trailRef.current;

      // 古い軌跡を削除（3秒以上前）
      while (trail.length > 0 && now - trail[0].t > 3000) {
        trail.shift();
      }

      // ── 現在の全データポイントからmin/maxを毎フレーム計算 ──
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;

      // 軌跡からレンジを計算
      for (const pt of trail) {
        if (pt.rawX < minX) minX = pt.rawX;
        if (pt.rawX > maxX) maxX = pt.rawX;
        if (pt.rawY < minY) minY = pt.rawY;
        if (pt.rawY > maxY) maxY = pt.rawY;
      }

      // 現在のクラスタからレンジを計算
      if (irFrame && irFrame.type === "CLUSTERING") {
        for (const cluster of irFrame.clusters) {
          if (cluster.cx < minX) minX = cluster.cx;
          if (cluster.cx > maxX) maxX = cluster.cx;
          if (cluster.cy < minY) minY = cluster.cy;
          if (cluster.cy > maxY) maxY = cluster.cy;
        }
      }

      // レンジが狭すぎる場合は最低幅を確保（小さい動きも見えるように）
      const MIN_SPAN = 200;
      if (isFinite(minX)) {
        const spanX = maxX - minX;
        const spanY = maxY - minY;
        if (spanX < MIN_SPAN) {
          const centerX = (minX + maxX) / 2;
          minX = centerX - MIN_SPAN / 2;
          maxX = centerX + MIN_SPAN / 2;
        }
        if (spanY < MIN_SPAN) {
          const centerY = (minY + maxY) / 2;
          minY = centerY - MIN_SPAN / 2;
          maxY = centerY + MIN_SPAN / 2;
        }
        // 10%マージンを追加（レンダリング時のみ、累積しない）
        const mx = (maxX - minX) * 0.1;
        const my = (maxY - minY) * 0.1;
        minX -= mx;
        maxX += mx;
        minY -= my;
        maxY += my;
      }

      // ── 軌跡を描画 ──
      if (trail.length > 1) {
        for (let i = 1; i < trail.length; i++) {
          const age = (now - trail[i].t) / 3000;
          const alpha = Math.max(0, 1 - age);
          const p0 = toCanvasCoords(
            trail[i - 1].rawX,
            trail[i - 1].rawY,
            minX,
            maxX,
            minY,
            maxY,
          );
          const p1 = toCanvasCoords(
            trail[i].rawX,
            trail[i].rawY,
            minX,
            maxX,
            minY,
            maxY,
          );
          ctx.strokeStyle = `rgba(59, 130, 246, ${alpha * 0.7})`;
          ctx.lineWidth = Math.max(1, (1 - age) * 3);
          ctx.beginPath();
          ctx.moveTo(p0.cx, p0.cy);
          ctx.lineTo(p1.cx, p1.cy);
          ctx.stroke();
        }
      }

      // ── 杖先（最大面積のクラスタ）のみ描画 ──
      if (
        irFrame &&
        irFrame.type === "CLUSTERING" &&
        irFrame.clusters.length > 0
      ) {
        const primary = irFrame.clusters.reduce((a, b) =>
          a.pixelCount > b.pixelCount ? a : b,
        );
        const { cx, cy } = toCanvasCoords(
          primary.cx,
          primary.cy,
          minX,
          maxX,
          minY,
          maxY,
        );

        // 外側のグロー
        const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 28);
        gradient.addColorStop(0, "rgba(59, 130, 246, 0.5)");
        gradient.addColorStop(1, "rgba(59, 130, 246, 0)");
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(cx, cy, 28, 0, Math.PI * 2);
        ctx.fill();

        // ドット本体
        const dotRadius = Math.min(10, Math.max(4, primary.pixelCount / 30));
        ctx.fillStyle = "#3b82f6";
        ctx.beginPath();
        ctx.arc(cx, cy, dotRadius, 0, Math.PI * 2);
        ctx.fill();

        // 白い芯
        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
        ctx.fill();

        // 座標ラベル
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.font = "11px monospace";
        ctx.fillText(`(${primary.cx}, ${primary.cy})`, cx + 14, cy - 8);

        // 軌跡を追加
        trail.push({
          rawX: primary.cx,
          rawY: primary.cy,
          t: now,
        });
        if (trail.length > 200) trail.shift();
      }

      // ── 範囲情報をキャンバスに表示 ──
      if (isFinite(minX)) {
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.font = "10px monospace";
        ctx.fillText(
          `X: ${Math.round(minX)}〜${Math.round(maxX)}  Y: ${Math.round(minY)}〜${Math.round(maxY)}`,
          PADDING,
          CANVAS_HEIGHT - 10,
        );
      }

      animFrameRef.current = requestAnimationFrame(draw);
    };

    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [irFrame]);

  // 一番大きいクラスタ情報（テキスト表示用）
  const primaryCluster =
    irFrame && irFrame.type === "CLUSTERING" && irFrame.clusters.length > 0
      ? irFrame.clusters.reduce((a, b) => (a.pixelCount > b.pixelCount ? a : b))
      : null;

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-4">🪄 杖トラッキングテスト</h1>

        {/* 接続セクション */}
        <div className="flex items-center gap-4 mb-6">
          {status === "DISCONNECTED" || status === "ERROR" ? (
            <button
              onClick={connect}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Joy-Con (R) を接続
            </button>
          ) : (
            <button
              onClick={disconnect}
              className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              切断
            </button>
          )}
          <span
            className={`px-3 py-1 rounded-full text-xs font-semibold ${
              status === "CONNECTED"
                ? "bg-green-900/50 text-green-400"
                : status === "CONNECTING"
                  ? "bg-yellow-900/50 text-yellow-400"
                  : status === "ERROR"
                    ? "bg-red-900/50 text-red-400"
                    : "bg-gray-800 text-gray-400"
            }`}
          >
            {status}
          </span>
          {isSwitching && (
            <span className="text-blue-400 text-sm animate-pulse">
              IRカメラ初期化中...
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          {/* メインキャンバス */}
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={CANVAS_WIDTH}
              height={CANVAS_HEIGHT}
              className="w-full rounded-xl border border-gray-800 bg-gray-900"
              style={{ aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}` }}
            />
            {/* オーバーレイ: 未接続 or データなし */}
            {(status !== "CONNECTED" ||
              !irFrame ||
              irFrame.type !== "CLUSTERING") && (
              <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-gray-900/80">
                <p className="text-gray-500 text-sm">
                  {status !== "CONNECTED"
                    ? "Joy-Con (R) を接続してください"
                    : isSwitching
                      ? "IRカメラ初期化中..."
                      : "クラスタリングデータ受信待ち..."}
                </p>
              </div>
            )}
          </div>

          {/* サイドパネル */}
          <div className="space-y-4">
            {/* 杖先座標 */}
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
              <h2 className="text-sm font-semibold text-gray-400 mb-3">
                杖先の座標
              </h2>
              {primaryCluster ? (
                <div className="space-y-2 font-mono">
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div className="bg-gray-800 rounded p-2">
                      <span className="text-gray-500 text-xs">X</span>
                      <p className="text-blue-400 text-lg font-bold">
                        {primaryCluster.cx}
                      </p>
                    </div>
                    <div className="bg-gray-800 rounded p-2">
                      <span className="text-gray-500 text-xs">Y</span>
                      <p className="text-blue-400 text-lg font-bold">
                        {primaryCluster.cy}
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-gray-800/50 rounded p-2">
                      <span className="text-gray-500">輝度</span>
                      <p className="text-gray-300">
                        {primaryCluster.averageIntensity}
                      </p>
                    </div>
                    <div className="bg-gray-800/50 rounded p-2">
                      <span className="text-gray-500">面積</span>
                      <p className="text-gray-300">
                        {primaryCluster.pixelCount}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-gray-600 text-sm italic">未検出</p>
              )}
            </div>

            {/* 検出数 */}
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
              <h2 className="text-sm font-semibold text-gray-400 mb-2">
                検出光点数
              </h2>
              <p className="text-3xl font-bold text-white font-mono">
                {irFrame && irFrame.type === "CLUSTERING"
                  ? irFrame.clusters.length
                  : "—"}
              </p>
            </div>

            {/* IMU */}
            {joyconState && (
              <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
                <h2 className="text-sm font-semibold text-gray-400 mb-2">
                  IMU
                </h2>
                <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                  <div>
                    <p className="text-gray-500 mb-1">Accel</p>
                    <p>X: {joyconState.imu.accel.x}</p>
                    <p>Y: {joyconState.imu.accel.y}</p>
                    <p>Z: {joyconState.imu.accel.z}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">Gyro</p>
                    <p>X: {joyconState.imu.gyro.x}</p>
                    <p>Y: {joyconState.imu.gyro.y}</p>
                    <p>Z: {joyconState.imu.gyro.z}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 軌跡クリア */}
            <button
              onClick={() => {
                trailRef.current = [];
              }}
              className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
            >
              軌跡をクリア
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
