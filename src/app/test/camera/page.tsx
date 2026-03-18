"use client";

import { ChevronLeft } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { FloatingParticles } from "@/components/floating-particles";
import { WandIcon } from "@/components/wand-icon";
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
    <main className="relative h-svh w-full overflow-hidden overscroll-none bg-[color:var(--background)] text-[color:var(--foreground)]">
      {/* Background layers (match Home/Spells ambience) */}
      <div
        className="fixed inset-0"
        style={{ background: "var(--background)", opacity: 0.3 }}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgba(0,0,0,0.25), rgba(0,0,0,0.15), rgba(0,0,0,0.35))",
        }}
        aria-hidden="true"
      />
      <div
        className="fixed inset-0 shadow-[inset_0_0_200px_80px_rgba(0,0,0,0.6)]"
        aria-hidden="true"
      />

      <FloatingParticles />

      {/* ジェスチャー判定トースト */}
      {gestureToast && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-50 animate-[fadeSlideIn_0.3s_ease-out]">
          <div className="px-6 py-3 rounded-xl bg-black/60 border border-gold/25 shadow-lg backdrop-blur-sm">
            <p className="text-sm font-semibold text-gold-bright">
              {gestureToast}
            </p>
          </div>
        </div>
      )}

      <div className="relative z-20 h-full overflow-hidden px-6 sm:px-10 flex flex-col">
        {/* Top area */}
        <div className="relative pt-8 sm:pt-10 flex-none">
          <Link
            href={CONNECTION_CHECK_ROUTE}
            className="absolute left-0 top-8 sm:top-10 group flex items-center gap-2 text-gold-dim transition-colors hover:text-gold-bright"
            aria-label="接続確認画面へ戻る"
          >
            <ChevronLeft className="h-5 w-5" />
            <span className="text-xs uppercase tracking-widest text-shadow-glow">
              Back
            </span>
          </Link>

          <header className="text-center">
            <WandIcon className="w-9 h-9 sm:w-10 sm:h-10 mx-auto mb-2 sm:mb-3 text-gold opacity-80" />
            <h1 className="text-xl sm:text-2xl font-bold tracking-[0.4em] text-gold-bright uppercase">
              WAND CHECK
            </h1>
          </header>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-hidden py-6 sm:py-10">
          <div className="mx-auto w-full max-w-5xl h-full min-h-0">
            <div className="h-full min-h-0 overflow-hidden rounded-2xl border border-gold/15 bg-black/20 backdrop-blur-sm">
              <div className="magic-scroll h-full min-h-0 overflow-auto p-5 sm:p-8">
                {/* 接続ボタン + ステータス */}
                <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                  {status === "DISCONNECTED" || status === "ERROR" ? (
                    <button
                      onClick={connect}
                      className="px-5 py-2 rounded-lg border border-gold/25 bg-gold/10 text-gold-bright text-sm font-medium tracking-[0.14em] transition-colors hover:bg-gold/15"
                    >
                      カメラを接続
                    </button>
                  ) : (
                    <button
                      onClick={disconnect}
                      className="px-5 py-2 rounded-lg border border-gold-dim/20 bg-stone/40 text-foreground/85 text-sm font-medium tracking-[0.14em] transition-colors hover:border-gold/30 hover:bg-stone/50"
                    >
                      切断
                    </button>
                  )}

                  <span
                    className={
                      "px-3 py-1 rounded-full text-xs font-semibold tracking-[0.14em] border bg-stone/40 " +
                      (status === "CONNECTED"
                        ? "border-gold/25 text-gold-bright"
                        : status === "INITIALIZING"
                          ? "border-gold-dim/25 text-gold-dim"
                          : status === "ERROR"
                            ? "border-destructive/30 text-destructive"
                            : "border-gold/10 text-foreground/60")
                    }
                  >
                    {status}
                  </span>

                  {status === "INITIALIZING" && (
                    <span className="text-gold-dim text-sm animate-pulse tracking-[0.14em]">
                      モデル読み込み中...
                    </span>
                  )}
                </div>

                <div className="mt-6 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6">
                  {/* メインエリア */}
                  <div className="space-y-4">
                    {/* トレイルキャンバス */}
                    <div className="relative overflow-hidden rounded-xl border border-gold/15 bg-black/10">
                      <canvas
                        ref={canvasRef}
                        width={CANVAS_WIDTH}
                        height={CANVAS_HEIGHT}
                        className="w-full"
                        style={{
                          aspectRatio: `${CANVAS_WIDTH}/${CANVAS_HEIGHT}`,
                        }}
                      />
                    </div>

                    {/* カメラプレビュー */}
                    <div className="relative overflow-hidden rounded-xl border border-gold/15 bg-black/10">
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
                          className="flex items-center justify-center"
                          style={{ aspectRatio: "640/480" }}
                        >
                          <p className="text-foreground/55 text-sm tracking-[0.12em]">
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
                    <div className="p-4 rounded-xl border border-gold/15 bg-black/10">
                      <h2 className="text-xs font-semibold text-gold-dim/80 tracking-[0.2em] mb-3">
                        杖先 (tip)
                      </h2>
                      <div className="space-y-2 font-mono">
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="rounded-lg border border-gold/10 bg-stone/30 p-2">
                            <span className="text-foreground/55 text-[11px] tracking-[0.18em]">
                              X
                            </span>
                            <p className="text-gold-bright text-lg font-bold">
                              {wandPoint?.detected
                                ? Math.round(wandPoint.tipX)
                                : "—"}
                            </p>
                          </div>
                          <div className="rounded-lg border border-gold/10 bg-stone/30 p-2">
                            <span className="text-foreground/55 text-[11px] tracking-[0.18em]">
                              Y
                            </span>
                            <p className="text-gold-bright text-lg font-bold">
                              {wandPoint?.detected
                                ? Math.round(wandPoint.tipY)
                                : "—"}
                            </p>
                          </div>
                        </div>
                        <div className="rounded-lg border border-gold/10 bg-stone/20 p-2 text-xs">
                          <span className="text-foreground/55 tracking-[0.14em]">
                            信頼度
                          </span>
                          <p className="text-gold-dim">
                            {wandPoint?.detected
                              ? wandPoint.tipConfidence.toFixed(3)
                              : "—"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 手元座標 */}
                    <div className="p-4 rounded-xl border border-gold/15 bg-black/10">
                      <h2 className="text-xs font-semibold text-gold-dim/80 tracking-[0.2em] mb-3">
                        手元 (grip)
                      </h2>
                      <div className="grid grid-cols-2 gap-2 text-sm font-mono">
                        <div className="rounded-lg border border-gold/10 bg-stone/30 p-2">
                          <span className="text-foreground/55 text-[11px] tracking-[0.18em]">
                            X
                          </span>
                          <p className="text-parchment text-lg font-bold">
                            {wandPoint?.detected
                              ? Math.round(wandPoint.gripX)
                              : "—"}
                          </p>
                        </div>
                        <div className="rounded-lg border border-gold/10 bg-stone/30 p-2">
                          <span className="text-foreground/55 text-[11px] tracking-[0.18em]">
                            Y
                          </span>
                          <p className="text-parchment text-lg font-bold">
                            {wandPoint?.detected
                              ? Math.round(wandPoint.gripY)
                              : "—"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* 検出信頼度 */}
                    <div className="p-4 rounded-xl border border-gold/15 bg-black/10">
                      <h2 className="text-xs font-semibold text-gold-dim/80 tracking-[0.2em] mb-2">
                        検出信頼度
                      </h2>
                      <p className="text-3xl font-bold text-foreground font-mono">
                        {wandPoint?.detected
                          ? wandPoint.confidence.toFixed(3)
                          : "—"}
                      </p>
                    </div>

                    {/* BBox情報 */}
                    <div className="p-4 rounded-xl border border-gold/15 bg-black/10">
                      <h2 className="text-xs font-semibold text-gold-dim/80 tracking-[0.2em] mb-2">
                        BBox
                      </h2>
                      <div className="text-xs font-mono space-y-1 text-foreground/70">
                        <p>
                          x:{" "}
                          <span className="text-foreground/85">
                            {wandPoint?.detected
                              ? Math.round(wandPoint.boundingBox.x)
                              : "—"}
                          </span>
                          {"  "}y:{" "}
                          <span className="text-foreground/85">
                            {wandPoint?.detected
                              ? Math.round(wandPoint.boundingBox.y)
                              : "—"}
                          </span>
                        </p>
                        <p>
                          w:{" "}
                          <span className="text-foreground/85">
                            {wandPoint?.detected
                              ? Math.round(wandPoint.boundingBox.width)
                              : "—"}
                          </span>
                          {"  "}h:{" "}
                          <span className="text-foreground/85">
                            {wandPoint?.detected
                              ? Math.round(wandPoint.boundingBox.height)
                              : "—"}
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* ジェスチャー認識 */}
                    <div className="p-4 rounded-xl border border-gold/15 bg-black/10">
                      <h2 className="text-xs font-semibold text-gold-dim/80 tracking-[0.2em] mb-2">
                        ジェスチャー認識
                      </h2>
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={
                              "inline-block w-2 h-2 rounded-full " +
                              (isDrawing
                                ? "bg-gold-bright animate-pulse"
                                : "bg-stone-light")
                            }
                          />
                          <span className="text-xs text-foreground/60 tracking-[0.14em]">
                            {isDrawing ? "描画中..." : "待機中"}
                          </span>
                        </div>
                        {lastGesture ? (
                          <div className="rounded-lg border border-gold/10 bg-stone/25 p-3">
                            <p
                              className={
                                "text-3xl font-bold text-center " +
                                (lastGesture.type === "unknown"
                                  ? "text-foreground/40"
                                  : "text-gold-bright")
                              }
                            >
                              {lastGesture.type === "unknown"
                                ? "?"
                                : lastGesture.type}
                            </p>
                            {"confidence" in lastGesture && (
                              <p className="text-xs text-foreground/60 text-center mt-1 tracking-[0.14em]">
                                信頼度: {lastGesture.confidence.toFixed(3)}
                              </p>
                            )}
                          </div>
                        ) : (
                          <p className="text-foreground/45 text-sm italic">
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
                      className="w-full px-4 py-2 rounded-lg border border-gold/15 bg-stone/30 hover:bg-stone/40 hover:border-gold/30 text-foreground/80 text-sm tracking-[0.16em] transition-colors"
                    >
                      軌跡をクリア
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
