"use client";

import { ChevronLeft } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useWandDetector } from "@/features/camera/api/useWandDetector";
import { useCameraGesture } from "@/features/camera/api/useCameraGesture";

const CONNECTION_CHECK_ROUTE: Route = "/connection-check";

// キャンバスの表示サイズ
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;
const PADDING = 40;

// トレイルの持続時間（ミリ秒）
const TRAIL_DURATION = 3000;

// ── ビューポートの計算とスムージングヘルパー ──
function adjustViewBounds(
  trail: { rawX: number; rawY: number }[],
  extraPoints: { rawX: number; rawY: number }[],
  viewBoundsRef: React.MutableRefObject<{
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } | null>,
  minSpan: number,
  lerp: number,
) {
  let minX = Infinity,
    maxX = -Infinity,
    minY = Infinity,
    maxY = -Infinity;

  for (const pt of trail) {
    if (pt.rawX < minX) minX = pt.rawX;
    if (pt.rawX > maxX) maxX = pt.rawX;
    if (pt.rawY < minY) minY = pt.rawY;
    if (pt.rawY > maxY) maxY = pt.rawY;
  }
  for (const pt of extraPoints) {
    if (pt.rawX < minX) minX = pt.rawX;
    if (pt.rawX > maxX) maxX = pt.rawX;
    if (pt.rawY < minY) minY = pt.rawY;
    if (pt.rawY > maxY) maxY = pt.rawY;
  }

  if (isFinite(minX)) {
    if (maxX - minX < minSpan) {
      const c = (minX + maxX) / 2;
      minX = c - minSpan / 2;
      maxX = c + minSpan / 2;
    }
    if (maxY - minY < minSpan) {
      const c = (minY + maxY) / 2;
      minY = c - minSpan / 2;
      maxY = c + minSpan / 2;
    }
    const mx = (maxX - minX) * 0.1,
      my = (maxY - minY) * 0.1;
    minX -= mx;
    maxX += mx;
    minY -= my;
    maxY += my;

    // アスペクト比をキャンバスの描画領域に固定
    const spanX = Math.max(maxX - minX, 1);
    const spanY = Math.max(maxY - minY, 1);
    const drawW = CANVAS_WIDTH - PADDING * 2;
    const drawH = CANVAS_HEIGHT - PADDING * 2;
    const targetRatio = drawW / drawH;
    const currentRatio = spanX / spanY;

    if (currentRatio > targetRatio) {
      const newSpanY = spanX / targetRatio;
      const cy = (minY + maxY) / 2;
      minY = cy - newSpanY / 2;
      maxY = cy + newSpanY / 2;
    } else {
      const newSpanX = spanY * targetRatio;
      const cx = (minX + maxX) / 2;
      minX = cx - newSpanX / 2;
      maxX = cx + newSpanX / 2;
    }

    if (!viewBoundsRef.current) {
      viewBoundsRef.current = { minX, maxX, minY, maxY };
    } else {
      viewBoundsRef.current.minX += (minX - viewBoundsRef.current.minX) * lerp;
      viewBoundsRef.current.maxX += (maxX - viewBoundsRef.current.maxX) * lerp;
      viewBoundsRef.current.minY += (minY - viewBoundsRef.current.minY) * lerp;
      viewBoundsRef.current.maxY += (maxY - viewBoundsRef.current.maxY) * lerp;
    }
    return {
      minX: viewBoundsRef.current.minX,
      maxX: viewBoundsRef.current.maxX,
      minY: viewBoundsRef.current.minY,
      maxY: viewBoundsRef.current.maxY,
    };
  }

  return { minX: 0, maxX: CANVAS_WIDTH, minY: 0, maxY: CANVAS_HEIGHT };
}

// ── ドット描画ヘルパー ──
function drawDot(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rgb: string,
) {
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 28);
  gradient.addColorStop(0, `rgba(${rgb}, 0.5)`);
  gradient.addColorStop(1, `rgba(${rgb}, 0)`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(cx, cy, 28, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgb(${rgb})`;
  ctx.beginPath();
  ctx.arc(cx, cy, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
  ctx.fill();
}

export default function CameraWandTestPage() {
  const { status, wandPoint, videoRef, connect, disconnect } =
    useWandDetector();
  const { lastGesture, isDrawing, resetGesture } = useCameraGesture(wandPoint);

  // ジェスチャー判定通知
  const [gestureToast, setGestureToast] = useState<string | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!lastGesture || lastGesture.type === "unknown") return;
    const label = lastGesture.type === "V" ? "V字" : "M字";
    setGestureToast(
      `${label} が判定されました（信頼度: ${lastGesture.confidence.toFixed(2)}）`,
    );
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setGestureToast(null), 2500);
  }, [lastGesture]);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const trailRef = useRef<{ rawX: number; rawY: number; t: number }[]>([]);
  const animFrameRef = useRef<number>(0);
  const lastTimestampRef = useRef<number>(0);
  const wandPointRef = useRef(wandPoint);

  const viewBoundsRef = useRef<{
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
  } | null>(null);

  // wandPointの最新値をrefに反映
  useEffect(() => {
    wandPointRef.current = wandPoint;
  }, [wandPoint]);

  // 座標変換
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

  // 接続切断時にリセット
  useEffect(() => {
    if (status !== "CONNECTED" && status !== "INITIALIZING") {
      trailRef.current = [];
      lastTimestampRef.current = 0;
      viewBoundsRef.current = null;
      resetGesture();
    }
  }, [status, resetGesture]);

  // ── キャンバス描画（CONNECTED/INITIALIZING時のみループ） ──
  useEffect(() => {
    if (status !== "CONNECTED" && status !== "INITIALIZING") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const color = "34, 197, 94"; // green

    const draw = () => {
      ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

      // 背景グリッド
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

      // 描画領域の枠
      ctx.strokeStyle = "rgba(255,255,255,0.1)";
      ctx.lineWidth = 1;
      ctx.strokeRect(
        PADDING,
        PADDING,
        CANVAS_WIDTH - PADDING * 2,
        CANVAS_HEIGHT - PADDING * 2,
      );

      // 十字線
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

      // 古い軌跡を削除
      while (trail.length > 0 && now - trail[0].t > TRAIL_DURATION) {
        trail.shift();
      }

      // 検出結果をトレイルに追加
      const wp = wandPointRef.current;
      if (wp && wp.detected) {
        if (wp.timestamp !== lastTimestampRef.current) {
          trail.push({ rawX: wp.tipX, rawY: wp.tipY, t: now });
          lastTimestampRef.current = wp.timestamp;
          if (trail.length > 200) trail.shift();
        }
      }

      // ビューポート計算
      const extraPoints: { rawX: number; rawY: number }[] = [];
      if (wp && wp.detected) {
        extraPoints.push({ rawX: wp.tipX, rawY: wp.tipY });
        extraPoints.push({ rawX: wp.gripX, rawY: wp.gripY });
      }

      const { minX, maxX, minY, maxY } = adjustViewBounds(
        trail,
        extraPoints,
        viewBoundsRef,
        100,
        0.1,
      );

      // 軌跡描画
      if (trail.length > 1) {
        for (let i = 1; i < trail.length; i++) {
          const age = (now - trail[i].t) / TRAIL_DURATION;
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
          ctx.strokeStyle = `rgba(${color}, ${alpha * 0.7})`;
          ctx.lineWidth = Math.max(1, (1 - age) * 3);
          ctx.beginPath();
          ctx.moveTo(p0.cx, p0.cy);
          ctx.lineTo(p1.cx, p1.cy);
          ctx.stroke();
        }
      }

      // 杖先 + 手元の描画
      if (wp && wp.detected) {
        const tip = toCanvasCoords(wp.tipX, wp.tipY, minX, maxX, minY, maxY);
        const grip = toCanvasCoords(wp.gripX, wp.gripY, minX, maxX, minY, maxY);

        // tip-grip 接続線
        ctx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(tip.cx, tip.cy);
        ctx.lineTo(grip.cx, grip.cy);
        ctx.stroke();

        // grip（手元）: 黄ドット
        drawDot(ctx, grip.cx, grip.cy, "234, 179, 8");

        // tip（杖先）: 緑ドット
        drawDot(ctx, tip.cx, tip.cy, color);

        // 座標ラベル
        ctx.fillStyle = "rgba(255,255,255,0.8)";
        ctx.font = "11px monospace";
        ctx.fillText(
          `tip (${Math.round(wp.tipX)}, ${Math.round(wp.tipY)})`,
          tip.cx + 14,
          tip.cy - 8,
        );
      }

      // モードラベル
      ctx.fillStyle = "rgba(255,255,255,0.4)";
      ctx.font = "bold 12px sans-serif";
      ctx.fillText("CAMERA モード", PADDING, PADDING - 10);

      // 範囲情報
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
    return () => {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = 0;
    };
  }, [status]);

  const isConnected = status === "CONNECTED";

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6">
      {/* ジェスチャー判定トースト */}
      {gestureToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-[fadeSlideIn_0.3s_ease-out]">
          <div className="px-6 py-3 rounded-xl bg-gray-800/90 border border-cyan-500/50 shadow-lg shadow-cyan-500/20 backdrop-blur-sm">
            <p className="text-sm font-semibold text-cyan-300">
              {gestureToast}
            </p>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto">
        <Link
          href={CONNECTION_CHECK_ROUTE}
          className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300 transition-colors hover:text-cyan-200"
          aria-label="接続確認画面へ戻る"
        >
          <ChevronLeft className="h-5 w-5" />
          接続確認へ戻る
        </Link>
        <h1 className="text-2xl font-bold mb-4">カメラ杖検出テスト</h1>

        {/* 接続ボタン + ステータス */}
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          {status === "DISCONNECTED" || status === "ERROR" ? (
            <button
              onClick={connect}
              className="px-5 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
            >
              カメラを接続
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
                : status === "INITIALIZING"
                  ? "bg-yellow-900/50 text-yellow-400"
                  : status === "ERROR"
                    ? "bg-red-900/50 text-red-400"
                    : "bg-gray-800 text-gray-400"
            }`}
          >
            {status}
          </span>

          {status === "INITIALIZING" && (
            <span className="text-green-400 text-sm animate-pulse">
              モデル読み込み中...
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
          {/* メインエリア */}
          <div className="space-y-4">
            {/* トレイルキャンバス */}
            <div className="relative">
              <canvas
                ref={canvasRef}
                width={CANVAS_WIDTH}
                height={CANVAS_HEIGHT}
                className="w-full rounded-xl border border-gray-800 bg-gray-900"
                style={{ aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}` }}
              />
            </div>

            {/* カメラプレビュー */}
            <div className="relative rounded-xl border border-gray-800 overflow-hidden bg-gray-900">
              <video
                ref={videoRef}
                className="w-full"
                style={{
                  aspectRatio: "640/480",
                  transform: "scaleX(-1)",
                  display: isConnected ? "block" : "none",
                }}
                playsInline
                muted
              />
              {!isConnected && (
                <div
                  className="flex items-center justify-center bg-gray-900"
                  style={{ aspectRatio: "640/480" }}
                >
                  <p className="text-gray-500 text-sm">
                    {status === "INITIALIZING"
                      ? "カメラ・モデル初期化中..."
                      : "カメラを接続してください"}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* サイドパネル */}
          <div className="space-y-4">
            {/* 杖先座標 */}
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
              <h2 className="text-sm font-semibold text-gray-400 mb-3">
                杖先 (tip)
              </h2>
              <div className="space-y-2 font-mono">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="bg-gray-800 rounded p-2">
                    <span className="text-gray-500 text-xs">X</span>
                    <p className="text-green-400 text-lg font-bold">
                      {wandPoint?.detected ? Math.round(wandPoint.tipX) : "—"}
                    </p>
                  </div>
                  <div className="bg-gray-800 rounded p-2">
                    <span className="text-gray-500 text-xs">Y</span>
                    <p className="text-green-400 text-lg font-bold">
                      {wandPoint?.detected ? Math.round(wandPoint.tipY) : "—"}
                    </p>
                  </div>
                </div>
                <div className="bg-gray-800/50 rounded p-2 text-xs">
                  <span className="text-gray-500">信頼度</span>
                  <p className="text-green-400">
                    {wandPoint?.detected
                      ? wandPoint.tipConfidence.toFixed(3)
                      : "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* 手元座標 */}
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
              <h2 className="text-sm font-semibold text-gray-400 mb-3">
                手元 (grip)
              </h2>
              <div className="grid grid-cols-2 gap-2 text-sm font-mono">
                <div className="bg-gray-800 rounded p-2">
                  <span className="text-gray-500 text-xs">X</span>
                  <p className="text-yellow-400 text-lg font-bold">
                    {wandPoint?.detected ? Math.round(wandPoint.gripX) : "—"}
                  </p>
                </div>
                <div className="bg-gray-800 rounded p-2">
                  <span className="text-gray-500 text-xs">Y</span>
                  <p className="text-yellow-400 text-lg font-bold">
                    {wandPoint?.detected ? Math.round(wandPoint.gripY) : "—"}
                  </p>
                </div>
              </div>
            </div>

            {/* 検出信頼度 */}
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
              <h2 className="text-sm font-semibold text-gray-400 mb-2">
                検出信頼度
              </h2>
              <p className="text-3xl font-bold text-white font-mono">
                {wandPoint?.detected ? wandPoint.confidence.toFixed(3) : "—"}
              </p>
            </div>

            {/* BBox情報 */}
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
              <h2 className="text-sm font-semibold text-gray-400 mb-2">BBox</h2>
              <div className="text-xs font-mono space-y-1">
                <p>
                  x:{" "}
                  <span className="text-gray-300">
                    {wandPoint?.detected
                      ? Math.round(wandPoint.boundingBox.x)
                      : "—"}
                  </span>
                  {"  "}y:{" "}
                  <span className="text-gray-300">
                    {wandPoint?.detected
                      ? Math.round(wandPoint.boundingBox.y)
                      : "—"}
                  </span>
                </p>
                <p>
                  w:{" "}
                  <span className="text-gray-300">
                    {wandPoint?.detected
                      ? Math.round(wandPoint.boundingBox.width)
                      : "—"}
                  </span>
                  {"  "}h:{" "}
                  <span className="text-gray-300">
                    {wandPoint?.detected
                      ? Math.round(wandPoint.boundingBox.height)
                      : "—"}
                  </span>
                </p>
              </div>
            </div>

            {/* ジェスチャー認識 */}
            <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
              <h2 className="text-sm font-semibold text-gray-400 mb-2">
                ジェスチャー認識
              </h2>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-block w-2 h-2 rounded-full ${
                      isDrawing ? "bg-green-400 animate-pulse" : "bg-gray-600"
                    }`}
                  />
                  <span className="text-xs text-gray-400">
                    {isDrawing ? "描画中..." : "待機中"}
                  </span>
                </div>
                {lastGesture ? (
                  <div className="bg-gray-800 rounded p-3">
                    <p
                      className={`text-3xl font-bold text-center ${
                        lastGesture.type === "V"
                          ? "text-cyan-400"
                          : lastGesture.type === "M"
                            ? "text-purple-400"
                            : "text-gray-500"
                      }`}
                    >
                      {lastGesture.type === "unknown" ? "?" : lastGesture.type}
                    </p>
                    {"confidence" in lastGesture && (
                      <p className="text-xs text-gray-400 text-center mt-1">
                        信頼度: {lastGesture.confidence.toFixed(3)}
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-gray-600 text-sm italic">
                    杖を動かしてジェスチャーを描いてください
                  </p>
                )}
              </div>
            </div>

            {/* 軌跡クリア */}
            <button
              onClick={() => {
                trailRef.current = [];
                viewBoundsRef.current = null;
                resetGesture();
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
