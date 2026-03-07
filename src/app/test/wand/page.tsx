"use client";

import { useEffect, useRef } from "react";
import { useJoyCon } from "@/features/device/api/useJoyCon";

// クラスタリングモードの座標範囲（16bit: 0〜65535）
const IR_MAX_X = 65535;
const IR_MAX_Y = 65535;

// キャンバスの表示サイズ
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;

// スケール係数
const SCALE_X = CANVAS_WIDTH / IR_MAX_X;
const SCALE_Y = CANVAS_HEIGHT / IR_MAX_Y;

export default function WandTrackingPage() {
    const {
        status,
        irFrame,
        isSwitching,
        joyconState,
        connect,
        disconnect,
    } = useJoyCon();

    const canvasRef = useRef<HTMLCanvasElement>(null);
    // 軌跡を保存するバッファ（最大200点）
    const trailRef = useRef<{ x: number; y: number; t: number }[]>([]);
    const animFrameRef = useRef<number>(0);

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

            // ── 十字線（中央） ──
            ctx.strokeStyle = "rgba(255,255,255,0.15)";
            ctx.setLineDash([4, 4]);
            ctx.beginPath();
            ctx.moveTo(CANVAS_WIDTH / 2, 0);
            ctx.lineTo(CANVAS_WIDTH / 2, CANVAS_HEIGHT);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(0, CANVAS_HEIGHT / 2);
            ctx.lineTo(CANVAS_WIDTH, CANVAS_HEIGHT / 2);
            ctx.stroke();
            ctx.setLineDash([]);

            const now = performance.now();
            const trail = trailRef.current;

            // 古い軌跡を削除（2秒以上前）
            while (trail.length > 0 && now - trail[0].t > 2000) {
                trail.shift();
            }

            // ── 軌跡を描画 ──
            if (trail.length > 1) {
                for (let i = 1; i < trail.length; i++) {
                    const age = (now - trail[i].t) / 2000; // 0〜1 (新しい→古い)
                    const alpha = Math.max(0, 1 - age);
                    ctx.strokeStyle = `rgba(59, 130, 246, ${alpha * 0.7})`;
                    ctx.lineWidth = Math.max(1, (1 - age) * 3);
                    ctx.beginPath();
                    ctx.moveTo(trail[i - 1].x, trail[i - 1].y);
                    ctx.lineTo(trail[i].x, trail[i].y);
                    ctx.stroke();
                }
            }

            // ── 現在のクラスタを描画 ──
            if (irFrame && irFrame.type === "CLUSTERING") {
                for (const cluster of irFrame.clusters) {
                    const cx = cluster.cx * SCALE_X;
                    const cy = cluster.cy * SCALE_Y;

                    // 外側のグロー
                    const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, 24);
                    gradient.addColorStop(0, "rgba(59, 130, 246, 0.4)");
                    gradient.addColorStop(1, "rgba(59, 130, 246, 0)");
                    ctx.fillStyle = gradient;
                    ctx.beginPath();
                    ctx.arc(cx, cy, 24, 0, Math.PI * 2);
                    ctx.fill();

                    // ドット本体
                    const dotRadius = Math.min(8, Math.max(3, cluster.pixelCount / 50));
                    ctx.fillStyle = "#3b82f6";
                    ctx.beginPath();
                    ctx.arc(cx, cy, dotRadius, 0, Math.PI * 2);
                    ctx.fill();

                    // 白い芯
                    ctx.fillStyle = "#ffffff";
                    ctx.beginPath();
                    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
                    ctx.fill();

                    // 座標ラベル
                    ctx.fillStyle = "rgba(255,255,255,0.8)";
                    ctx.font = "11px monospace";
                    ctx.fillText(`(${cluster.cx}, ${cluster.cy})`, cx + 12, cy - 8);
                    ctx.fillStyle = "rgba(255,255,255,0.5)";
                    ctx.fillText(
                        `輝度:${cluster.averageIntensity} 面積:${cluster.pixelCount}`,
                        cx + 12,
                        cy + 6,
                    );
                }

                // 最も大きいクラスタ（杖先）の軌跡を追加
                if (irFrame.clusters.length > 0) {
                    const primary = irFrame.clusters.reduce((a, b) =>
                        a.pixelCount > b.pixelCount ? a : b,
                    );
                    trail.push({
                        x: primary.cx * SCALE_X,
                        y: primary.cy * SCALE_Y,
                        t: now,
                    });
                    // 最大200点に制限
                    if (trail.length > 200) trail.shift();
                }
            }

            animFrameRef.current = requestAnimationFrame(draw);
        };

        animFrameRef.current = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [irFrame]);

    // 一番大きいクラスタ情報（テキスト表示用）
    const primaryCluster =
        irFrame &&
            irFrame.type === "CLUSTERING" &&
            irFrame.clusters.length > 0
            ? irFrame.clusters.reduce((a, b) =>
                a.pixelCount > b.pixelCount ? a : b,
            )
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
                        className={`px-3 py-1 rounded-full text-xs font-semibold ${status === "CONNECTED"
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
                        <div className="absolute bottom-2 left-2 text-[10px] text-gray-600 font-mono">
                            座標範囲: 0〜{IR_MAX_X} | 表示: {CANVAS_WIDTH}×
                            {CANVAS_HEIGHT}
                        </div>
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
