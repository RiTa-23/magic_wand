"use client";

import { useEffect, useRef, useState } from "react";
import { useJoyCon } from "@/features/device/api/useJoyCon";

// キャンバスの表示サイズ
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;
const PADDING = 40;

type TrackingMode = "IR" | "IMU";

// ジャイロ感度（値が大きいほど少しの動きで大きく動く）
const GYRO_SENSITIVITY = 0.15;
// キャリブレーション時間（ミリ秒）
const CALIBRATION_DURATION = 3000;
// デッドゾーン（これ以下の角速度変化は無視する）
const GYRO_DEADZONE = 10;

export default function WandTrackingPage() {
    const { status, irFrame, isSwitching, joyconState, connect, disconnect } =
        useJoyCon();

    const [trackingMode, setTrackingMode] = useState<TrackingMode>("IR");

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const trailRef = useRef<{ rawX: number; rawY: number; t: number }[]>([]);
    const animFrameRef = useRef<number>(0);

    // IMUモード用: カーソル位置（生の累積座標、無制限）
    const imuPosRef = useRef({ x: 0, y: 0 });

    // キャリブレーション用
    const [calibrationState, setCalibrationState] = useState<
        "idle" | "calibrating" | "done"
    >("idle");
    const [calibrationProgress, setCalibrationProgress] = useState(0);
    const calibrationStartRef = useRef<number>(0);
    const calibrationSamplesRef = useRef<{ x: number; y: number; z: number }[]>(
        [],
    );
    const gyroBiasRef = useRef({ x: 0, y: 0, z: 0 });

    // モード変更時に軌跡をリセット
    const handleModeChange = (mode: TrackingMode) => {
        setTrackingMode(mode);
        trailRef.current = [];
        imuPosRef.current = { x: 0, y: 0 };
        gyroBiasRef.current = { x: 0, y: 0, z: 0 };
        if (mode === "IMU") {
            // IMUモードに入ったらキャリブレーション開始
            setCalibrationState("calibrating");
            setCalibrationProgress(0);
            calibrationStartRef.current = Date.now();
            calibrationSamplesRef.current = [];
        } else {
            setCalibrationState("idle");
        }
    };

    // ── キャリブレーション & トラッキング ──
    useEffect(() => {
        if (trackingMode !== "IMU" || !joyconState) return;

        const gyro = joyconState.imu.gyro;

        if (calibrationState === "calibrating") {
            // キャリブレーション中: サンプルを収集
            calibrationSamplesRef.current.push({ ...gyro });

            const elapsed = Date.now() - calibrationStartRef.current;
            const progress = Math.min(1, elapsed / CALIBRATION_DURATION);
            setCalibrationProgress(progress);

            if (elapsed >= CALIBRATION_DURATION) {
                // キャリブレーション完了: 平均値をバイアスとして記録
                const samples = calibrationSamplesRef.current;
                const sum = samples.reduce(
                    (acc, s) => ({ x: acc.x + s.x, y: acc.y + s.y, z: acc.z + s.z }),
                    { x: 0, y: 0, z: 0 },
                );
                gyroBiasRef.current = {
                    x: sum.x / samples.length,
                    y: sum.y / samples.length,
                    z: sum.z / samples.length,
                };
                setCalibrationState("done");
                calibrationSamplesRef.current = [];
            }
            return;
        }

        if (calibrationState !== "done") return;

        // ── トラッキング: バイアスを差し引いて移動 ──
        const bias = gyroBiasRef.current;
        let correctedY = gyro.y - bias.y; // 左右 (yaw)
        let correctedX = gyro.x - bias.x; // 上下 (pitch)

        // デッドゾーン処理: 10以下の微小な変化は無視する
        if (Math.abs(correctedY) <= GYRO_DEADZONE) correctedY = 0;
        if (Math.abs(correctedX) <= GYRO_DEADZONE) correctedX = 0;

        const pos = imuPosRef.current;
        pos.x += correctedY * GYRO_SENSITIVITY;
        pos.y += correctedX * GYRO_SENSITIVITY;

        // 軌跡に追加
        const now = performance.now();
        trailRef.current.push({ rawX: pos.x, rawY: pos.y, t: now });
        if (trailRef.current.length > 300) trailRef.current.shift();
    }, [trackingMode, joyconState, calibrationState]);

    // ── IRモード用: 自動スケーリング座標変換 ──
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

    // ── キャンバス描画 ──
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

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

            // 古い軌跡を削除（5秒以上前）
            const TRAIL_DURATION = trackingMode === "IMU" ? 5000 : 3000;
            while (trail.length > 0 && now - trail[0].t > TRAIL_DURATION) {
                trail.shift();
            }

            const isIR = trackingMode === "IR";
            const color = isIR ? "59, 130, 246" : "168, 85, 247"; // blue vs purple

            if (isIR) {
                // ── IR モード ──
                // 自動スケーリング用のmin/max計算
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
                if (irFrame && irFrame.type === "CLUSTERING") {
                    for (const c of irFrame.clusters) {
                        if (c.cx < minX) minX = c.cx;
                        if (c.cx > maxX) maxX = c.cx;
                        if (c.cy < minY) minY = c.cy;
                        if (c.cy > maxY) maxY = c.cy;
                    }
                }

                const MIN_SPAN = 200;
                if (isFinite(minX)) {
                    if (maxX - minX < MIN_SPAN) {
                        const c = (minX + maxX) / 2;
                        minX = c - MIN_SPAN / 2;
                        maxX = c + MIN_SPAN / 2;
                    }
                    if (maxY - minY < MIN_SPAN) {
                        const c = (minY + maxY) / 2;
                        minY = c - MIN_SPAN / 2;
                        maxY = c + MIN_SPAN / 2;
                    }
                    const mx = (maxX - minX) * 0.1,
                        my = (maxY - minY) * 0.1;
                    minX -= mx;
                    maxX += mx;
                    minY -= my;
                    maxY += my;
                }

                // 軌跡描画
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
                        ctx.strokeStyle = `rgba(${color}, ${alpha * 0.7})`;
                        ctx.lineWidth = Math.max(1, (1 - age) * 3);
                        ctx.beginPath();
                        ctx.moveTo(p0.cx, p0.cy);
                        ctx.lineTo(p1.cx, p1.cy);
                        ctx.stroke();
                    }
                }

                // 杖先描画
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
                    drawDot(ctx, cx, cy, color);
                    ctx.fillStyle = "rgba(255,255,255,0.8)";
                    ctx.font = "11px monospace";
                    ctx.fillText(`(${primary.cx}, ${primary.cy})`, cx + 14, cy - 8);

                    trail.push({ rawX: primary.cx, rawY: primary.cy, t: now });
                    if (trail.length > 200) trail.shift();
                }

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
            } else {
                // ── IMU モード（自動スケーリング）──
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
                const imuPos = imuPosRef.current;
                if (imuPos.x < minX) minX = imuPos.x;
                if (imuPos.x > maxX) maxX = imuPos.x;
                if (imuPos.y < minY) minY = imuPos.y;
                if (imuPos.y > maxY) maxY = imuPos.y;

                const MIN_SPAN = 50;
                if (isFinite(minX)) {
                    if (maxX - minX < MIN_SPAN) {
                        const c = (minX + maxX) / 2;
                        minX = c - MIN_SPAN / 2;
                        maxX = c + MIN_SPAN / 2;
                    }
                    if (maxY - minY < MIN_SPAN) {
                        const c = (minY + maxY) / 2;
                        minY = c - MIN_SPAN / 2;
                        maxY = c + MIN_SPAN / 2;
                    }
                    const mx = (maxX - minX) * 0.1,
                        my = (maxY - minY) * 0.1;
                    minX -= mx;
                    maxX += mx;
                    minY -= my;
                    maxY += my;
                }

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

                // カーソル描画
                const { cx: curX, cy: curY } = toCanvasCoords(
                    imuPos.x,
                    imuPos.y,
                    minX,
                    maxX,
                    minY,
                    maxY,
                );
                drawDot(ctx, curX, curY, color);

                // ジャイロ値表示
                if (joyconState) {
                    ctx.fillStyle = "rgba(255,255,255,0.3)";
                    ctx.font = "10px monospace";
                    ctx.fillText(
                        `Gyro  X:${joyconState.imu.gyro.x}  Y:${joyconState.imu.gyro.y}  Z:${joyconState.imu.gyro.z}`,
                        PADDING,
                        CANVAS_HEIGHT - 10,
                    );
                }
            }

            // モードラベル
            ctx.fillStyle = "rgba(255,255,255,0.4)";
            ctx.font = "bold 12px sans-serif";
            ctx.fillText(`${trackingMode} モード`, PADDING, PADDING - 10);

            animFrameRef.current = requestAnimationFrame(draw);
        };

        animFrameRef.current = requestAnimationFrame(draw);
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [irFrame, joyconState, trackingMode]);

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

    // テキスト表示用
    const primaryCluster =
        irFrame && irFrame.type === "CLUSTERING" && irFrame.clusters.length > 0
            ? irFrame.clusters.reduce((a, b) => (a.pixelCount > b.pixelCount ? a : b))
            : null;

    const isConnected = status === "CONNECTED";

    return (
        <div className="min-h-screen bg-gray-950 text-white p-6">
            <div className="max-w-4xl mx-auto">
                <h1 className="text-2xl font-bold mb-4">🪄 杖トラッキングテスト</h1>

                {/* 接続 + モード切替 */}
                <div className="flex items-center gap-4 mb-6 flex-wrap">
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

                    {/* モード切替タブ */}
                    <div className="flex bg-gray-800 rounded-lg p-1 ml-auto">
                        <button
                            onClick={() => handleModeChange("IR")}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${trackingMode === "IR"
                                ? "bg-blue-600 text-white"
                                : "text-gray-400 hover:text-white"
                                }`}
                        >
                            IR（赤外線）
                        </button>
                        <button
                            onClick={() => handleModeChange("IMU")}
                            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${trackingMode === "IMU"
                                ? "bg-purple-600 text-white"
                                : "text-gray-400 hover:text-white"
                                }`}
                        >
                            IMU（慣性）
                        </button>
                    </div>

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
                        {/* オーバーレイ */}
                        {!isConnected && (
                            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-gray-900/80 z-10">
                                <p className="text-gray-500 text-sm">
                                    Joy-Con (R) を接続してください
                                </p>
                            </div>
                        )}
                        {isConnected &&
                            trackingMode === "IR" &&
                            (!irFrame || irFrame.type !== "CLUSTERING") && (
                                <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-gray-900/80 z-10">
                                    <p className="text-gray-500 text-sm">
                                        {isSwitching
                                            ? "IRカメラ初期化中..."
                                            : "クラスタリングデータ受信待ち..."}
                                    </p>
                                </div>
                            )}
                        {isConnected &&
                            trackingMode === "IMU" &&
                            calibrationState === "calibrating" && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center rounded-xl bg-gray-900/90 z-10 space-y-4">
                                    <p className="text-purple-400 font-bold text-lg animate-pulse">
                                        キャリブレーション中...
                                    </p>
                                    <p className="text-gray-300 text-sm text-center">
                                        SL/SRボタン（レール側）を下に向けて<br />
                                        平らな場所に静止させてください。
                                    </p>
                                    <div className="w-48 h-2 bg-gray-800 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-purple-500 transition-all duration-100 ease-linear"
                                            style={{ width: `${calibrationProgress * 100}%` }}
                                        />
                                    </div>
                                </div>
                            )}
                    </div>

                    {/* サイドパネル */}
                    <div className="space-y-4">
                        {/* IR モードのサイド情報 */}
                        {trackingMode === "IR" && (
                            <>
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
                            </>
                        )}

                        {/* IMU モードのサイド情報 */}
                        {trackingMode === "IMU" && joyconState && (
                            <>
                                <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
                                    <h2 className="text-sm font-semibold text-gray-400 mb-3">
                                        カーソル位置
                                    </h2>
                                    <div className="grid grid-cols-2 gap-2 text-sm font-mono">
                                        <div className="bg-gray-800 rounded p-2">
                                            <span className="text-gray-500 text-xs">X</span>
                                            <p className="text-purple-400 text-lg font-bold">
                                                {Math.round(imuPosRef.current.x)}
                                            </p>
                                        </div>
                                        <div className="bg-gray-800 rounded p-2">
                                            <span className="text-gray-500 text-xs">Y</span>
                                            <p className="text-purple-400 text-lg font-bold">
                                                {Math.round(imuPosRef.current.y)}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
                                    <h2 className="text-sm font-semibold text-gray-400 mb-2">
                                        ジャイロ
                                    </h2>
                                    <div className="text-xs font-mono space-y-1">
                                        <p>
                                            X (pitch):{" "}
                                            <span className="text-purple-400">
                                                {joyconState.imu.gyro.x}
                                            </span>
                                        </p>
                                        <p>
                                            Y (yaw):{" "}
                                            <span className="text-purple-400">
                                                {joyconState.imu.gyro.y}
                                            </span>
                                        </p>
                                        <p>
                                            Z (roll):{" "}
                                            <span className="text-purple-400">
                                                {joyconState.imu.gyro.z}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                                <div className="p-4 bg-gray-900 border border-gray-800 rounded-xl">
                                    <h2 className="text-sm font-semibold text-gray-400 mb-2">
                                        加速度
                                    </h2>
                                    <div className="text-xs font-mono space-y-1">
                                        <p>
                                            X:{" "}
                                            <span className="text-purple-400">
                                                {joyconState.imu.accel.x}
                                            </span>
                                        </p>
                                        <p>
                                            Y:{" "}
                                            <span className="text-purple-400">
                                                {joyconState.imu.accel.y}
                                            </span>
                                        </p>
                                        <p>
                                            Z:{" "}
                                            <span className="text-purple-400">
                                                {joyconState.imu.accel.z}
                                            </span>
                                        </p>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* 軌跡クリア / リセンタリング */}
                        <button
                            onClick={() => {
                                trailRef.current = [];
                                if (trackingMode === "IMU") {
                                    imuPosRef.current = { x: 0, y: 0 };
                                    setCalibrationState("calibrating");
                                    setCalibrationProgress(0);
                                    calibrationStartRef.current = Date.now();
                                    calibrationSamplesRef.current = [];
                                }
                            }}
                            className="w-full px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm transition-colors"
                        >
                            {trackingMode === "IMU"
                                ? "軌跡クリア & 再キャリブレーション"
                                : "軌跡をクリア"}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
