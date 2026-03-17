import { useState, useCallback, useRef, useEffect } from "react";
import { WandDetector } from "./wand-detector";
import type { CameraStatus, WandDetectionResult } from "../types/camera";

export function useWandDetector() {
  const [status, setStatus] = useState<CameraStatus>("DISCONNECTED");
  const [wandPoint, setWandPoint] = useState<WandDetectionResult | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectorRef = useRef<WandDetector | null>(null);

  // 初回マウント時にインスタンス化
  useEffect(() => {
    if (!detectorRef.current) {
      detectorRef.current = new WandDetector();
      detectorRef.current.onWandDetection = (result) => {
        setWandPoint(result);
      };
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
    setStatus("INITIALIZING");
    try {
      await detectorRef.current.initialize(videoRef.current);
      detectorRef.current.start();
      setStatus("CONNECTED");
    } catch (e) {
      console.error(e);
      setStatus("ERROR");
    }
  }, []);

  const disconnect = useCallback(() => {
    if (!detectorRef.current) return;
    detectorRef.current.destroy();
    // 再接続に備えて新しいインスタンスを作成
    detectorRef.current = new WandDetector();
    detectorRef.current.onWandDetection = (result) => {
      setWandPoint(result);
    };
    setWandPoint(null);
    setStatus("DISCONNECTED");
  }, []);

  return { status, wandPoint, videoRef, connect, disconnect };
}
