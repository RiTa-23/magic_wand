"use client";

import { useRef, useEffect, useState } from "react";
import { useJoyCon } from "@/features/device/api/useJoyCon";
import { IRCameraMode } from "@/features/device/types/joycon";

const MODE_LABELS: Record<string, string> = {
  CLUSTERING: "クラスタリング",
  IMAGE_TRANSFER: "画像転送",
};

export default function JoyConSandboxPage() {
  const {
    status,
    irFrame,
    irMode,
    joyconState,
    connect,
    disconnect,
    switchMode,
  } = useJoyCon();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedMode, setSelectedMode] = useState<IRCameraMode>(irMode);

  // Image Transfer用: canvasへの描画（モード切替時にクリア）
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // IMAGE_TRANSFER以外のモードや無効なフレームの場合はcanvasをクリア
    if (
      irMode !== "IMAGE_TRANSFER" ||
      !irFrame ||
      irFrame.type !== "IMAGE_TRANSFER"
    ) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      return;
    }

    canvas.width = irFrame.width;
    canvas.height = irFrame.height;
    const expected = irFrame.width * irFrame.height;
    if (irFrame.imageData.length !== expected) {
      console.warn(
        `IR image data length mismatch: expected ${expected}, got ${irFrame.imageData.length}`,
      );
    }
    const pixelCount = Math.min(irFrame.imageData.length, expected);
    const imgData = ctx.createImageData(irFrame.width, irFrame.height);
    for (let i = 0; i < pixelCount; i++) {
      const v = irFrame.imageData[i];
      imgData.data[i * 4] = v;
      imgData.data[i * 4 + 1] = v;
      imgData.data[i * 4 + 2] = v;
      imgData.data[i * 4 + 3] = 255;
    }
    ctx.putImageData(imgData, 0, 0);
  }, [irFrame, irMode]);

  return (
    <div className="p-8 font-sans max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-6">Joy-Con(R) IR Camera Sandbox</h1>

      <div className="mb-8 p-6 bg-gray-50 border border-gray-200 rounded-xl shadow-sm">
        <h2 className="text-xl font-semibold mb-4">1. デバイス接続</h2>
        <div className="flex items-center gap-4">
          {status === "DISCONNECTED" || status === "ERROR" ? (
            <button
              onClick={connect}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
            >
              Joy-Con (R) を接続する
            </button>
          ) : (
            <button
              onClick={disconnect}
              className="px-6 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors"
            >
              切断する
            </button>
          )}

          <div className="flex items-center gap-2">
            <span className="text-gray-600 font-medium">ステータス:</span>
            <span
              className={`font-mono px-3 py-1 rounded-full text-sm font-semibold ${
                status === "CONNECTED"
                  ? "bg-green-100 text-green-700"
                  : status === "CONNECTING"
                    ? "bg-yellow-100 text-yellow-700"
                    : status === "ERROR"
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-200 text-gray-700"
              }`}
            >
              {status}
            </span>
          </div>
        </div>
        <p className="mt-4 text-sm text-gray-500">
          ※ ChromeなどのWebHID対応ブラウザで実行し、ペアリング済みのJoy-Con (R)
          を選択してください。
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
        <div className="p-6 bg-gray-50 border border-gray-200 rounded-xl shadow-sm">
          <h2 className="text-xl font-semibold mb-4">
            2. ボタン・センサー確認
          </h2>
          {status === "CONNECTED" && joyconState ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-medium text-gray-700 mb-2">
                  押下されているボタン:
                </h3>
                <div className="flex flex-wrap gap-2 text-sm">
                  {Object.entries(joyconState.buttons).map(([key, pressed]) =>
                    pressed ? (
                      <span
                        key={key}
                        className="bg-blue-100 text-blue-800 px-2 py-1 rounded font-mono uppercase"
                      >
                        {key}
                      </span>
                    ) : null,
                  )}
                  {Object.values(joyconState.buttons).every((v) => !v) && (
                    <span className="text-gray-400 font-mono">None</span>
                  )}
                </div>
              </div>
              <div>
                <h3 className="font-medium text-gray-700 mb-2">
                  ジャイロ / 加速度 (IMU):
                </h3>
                <div className="grid grid-cols-2 gap-4 text-xs font-mono bg-white p-3 rounded border">
                  <div>
                    <p className="font-semibold text-gray-500 mb-1">Accel</p>
                    <p>X: {joyconState.imu.accel.x}</p>
                    <p>Y: {joyconState.imu.accel.y}</p>
                    <p>Z: {joyconState.imu.accel.z}</p>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-500 mb-1">Gyro</p>
                    <p>X: {joyconState.imu.gyro.x}</p>
                    <p>Y: {joyconState.imu.gyro.y}</p>
                    <p>Z: {joyconState.imu.gyro.z}</p>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-gray-500 text-sm">
              デバイス未接続またはデータ受信待ち...
            </div>
          )}
        </div>

        <div className="p-6 bg-gray-50 border border-gray-200 rounded-xl shadow-sm">
          <h2 className="text-xl font-semibold mb-4">3. IR カメラ</h2>

          {/* モード選択 + 切り替えボタン */}
          {status === "CONNECTED" && (
            <div className="flex items-center gap-2 mb-4">
              <div className="flex gap-1">
                {(Object.keys(MODE_LABELS) as IRCameraMode[]).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSelectedMode(mode)}
                    className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                      selectedMode === mode
                        ? "bg-blue-600 text-white"
                        : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                    }`}
                  >
                    {MODE_LABELS[mode]}
                  </button>
                ))}
              </div>
              <button
                onClick={() => switchMode(selectedMode)}
                disabled={selectedMode === irMode}
                className={`px-4 py-1.5 text-sm rounded-lg font-medium transition-colors ${
                  selectedMode !== irMode
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                切り替え
              </button>
            </div>
          )}

          {status === "CONNECTED" ? (
            <div>
              {/* Clustering モード表示 */}
              {irMode === "CLUSTERING" && (
                <div>
                  {!irFrame || irFrame.type !== "CLUSTERING" ? (
                    <div className="text-gray-400 text-sm italic p-4 text-center border-dashed border-2 rounded">
                      データ受信待ち...
                    </div>
                  ) : irFrame.clusters.length > 0 ? (
                    <>
                      <p className="text-sm text-gray-600 mb-2">
                        検出された光点の数:{" "}
                        <span className="font-bold">
                          {irFrame.clusters.length}
                        </span>
                      </p>
                      <div className="space-y-2 max-h-64 overflow-y-auto">
                        {irFrame.clusters.map((cluster, idx) => (
                          <div
                            key={idx}
                            className="text-sm font-mono bg-white p-2 rounded border border-gray-100 flex justify-between items-center"
                          >
                            <div>
                              <span className="text-red-500 font-bold mr-2">
                                #{idx + 1}
                              </span>
                              X: {cluster.cx}, Y: {cluster.cy}
                            </div>
                            <div className="text-gray-400 text-xs">
                              Area: {cluster.pixelCount} | Int:{" "}
                              {cluster.averageIntensity}
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-gray-400 text-sm italic p-4 text-center border-dashed border-2 rounded">
                      光源が見つかりません
                    </div>
                  )}
                </div>
              )}

              {/* Image Transfer モード表示 */}
              {irMode === "IMAGE_TRANSFER" && (
                <div>
                  <canvas
                    ref={canvasRef}
                    width={160}
                    height={120}
                    className="w-full max-w-[320px] border border-gray-300 rounded bg-black"
                    style={{ imageRendering: "pixelated" }}
                  />
                  {(!irFrame || irFrame.type !== "IMAGE_TRANSFER") && (
                    <p className="text-gray-400 text-sm italic mt-2 text-center">
                      フラグメント受信中...
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="text-gray-500 text-sm">デバイス未接続...</div>
          )}
        </div>
      </div>
    </div>
  );
}
