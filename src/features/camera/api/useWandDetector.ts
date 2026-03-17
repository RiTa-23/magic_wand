import { useState, useCallback, useRef, useEffect } from "react";
import { WandDetector } from "./wand-detector";
import type { CameraStatus, WandDetectionResult } from "../types/camera";

function createDetector(
  setWandPoint: (result: WandDetectionResult) => void,
  setStatus: (status: CameraStatus) => void,
): WandDetector {
  const detector = new WandDetector();
  detector.onWandDetection = (result) => {
    setWandPoint(result);
  };
  detector.onError = (e) => {
    console.error("WandDetector error:", e);
    setStatus("ERROR");
  };
  return detector;
}

export function useWandDetector() {
  const [status, setStatus] = useState<CameraStatus>("DISCONNECTED");
  const [wandPoint, setWandPoint] = useState<WandDetectionResult | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectorRef = useRef<WandDetector | null>(null);

  // 初回マウント時にインスタンス化
  useEffect(() => {
    if (!detectorRef.current) {
      detectorRef.current = createDetector(setWandPoint, setStatus);
    }
    return () => {
      // アンマウント時にリソース解放
      if (detectorRef.current) {
        detectorRef.current.destroy();
        detectorRef.current = null;
      }
    };
  }, []);

  const connect = useCallback(async () => {
    if (!detectorRef.current || !videoRef.current) return;
    // INITIALIZING/CONNECTED中の二重呼び出しを防止
    if (status === "INITIALIZING" || status === "CONNECTED") return;
    setStatus("INITIALIZING");
    try {
      await detectorRef.current.initialize(videoRef.current);
      detectorRef.current.start();
      setStatus("CONNECTED");
    } catch (e) {
      console.error(e);
      // 部分初期化リソースをクリーンアップ
      detectorRef.current.destroy();
      detectorRef.current = createDetector(setWandPoint, setStatus);
      setStatus("ERROR");
    }
  }, [status]);

  const disconnect = useCallback(() => {
    if (!detectorRef.current) return;
    detectorRef.current.destroy();
    // 再接続に備えて新しいインスタンスを作成
    detectorRef.current = createDetector(setWandPoint, setStatus);
    setWandPoint(null);
    setStatus("DISCONNECTED");
  }, []);

  return { status, wandPoint, videoRef, connect, disconnect };
}
