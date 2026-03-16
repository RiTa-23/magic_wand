import { useState, useCallback, useRef, useEffect } from "react";
import { PhomemoBluetooth } from "./phomemo-bluetooth";
import { PhomemoStatus, PhomemoState } from "../types/phomemo";
import { renderCanvasImage } from "@/features/phomemo/lib/imageProcessor";
import { encodeImageDataToPhomemo } from "@/features/phomemo/lib/phomemoEncoder";

/**
 * Phomemoプリンター制御用のReactカスタムフック
 * Web Bluetooth APIを使ってPhomemo M02Sとの接続を管理する
 */
export function usePhomemo() {
  const [status, setStatus] = useState<PhomemoStatus>("DISCONNECTED");
  const [deviceName, setDeviceName] = useState<string | undefined>(undefined);
  const [errorMessage, setErrorMessage] = useState<string | undefined>(
    undefined,
  );
  const [transportInfo, setTransportInfo] = useState<string | undefined>(
    undefined,
  );

  // 同一インスタンスを保持
  const phomemoRef = useRef<PhomemoBluetooth | null>(null);

  // 初回マウント時にインスタンス化
  useEffect(() => {
    if (!phomemoRef.current) {
      phomemoRef.current = new PhomemoBluetooth();
      phomemoRef.current.onStateChange = (state: PhomemoState) => {
        setStatus(state.status);
        setDeviceName(state.deviceName);
        setErrorMessage(state.errorMessage);
        setTransportInfo(state.transportInfo);
      };
    }
    return () => {
      // アンマウント時に切断処理
      if (phomemoRef.current) {
        phomemoRef.current.disconnect();
        phomemoRef.current = null;
      }
    };
  }, []);

  /**
   * デバイスに接続
   */
  const connect = useCallback(async () => {
    if (!phomemoRef.current) return;
    const result = await phomemoRef.current.connect();
    // ユーザーキャンセル以外のエラーの場合のみログ出力
    if (
      !result.success &&
      result.message !== "デバイスが選択されませんでした"
    ) {
      console.error("接続失敗:", result.message);
    }
  }, []);

  /**
   * デバイスから切断
   */
  const disconnect = useCallback(async () => {
    if (!phomemoRef.current) return;
    await phomemoRef.current.disconnect();
  }, []);

  /**
   * テスト用の簡易ラベルを生成して印刷する
   */
  const printTestPage = useCallback(async (message: string) => {
    if (!phomemoRef.current) return;

    const imageData = renderCanvasImage({
      width: 576,
      height: 320,
      text: ["Mofurun Omikuji", message].join("\n"),
      font: "bold 36px sans-serif",
      padding: 24,
    });

    const encoded = encodeImageDataToPhomemo(imageData, { threshold: 170 });
    const result = await phomemoRef.current.print(encoded);
    if (!result.success) {
      console.error("印刷失敗:", result.message);
      return;
    }

    console.log("印刷データ送信完了:", {
      bytesWritten: result.bytesWritten,
      preview: Array.from(encoded.slice(0, 24)),
    });
  }, []);

  return {
    status,
    deviceName,
    errorMessage,
    transportInfo,
    connect,
    disconnect,
    printTestPage,
    isConnected: status === "CONNECTED",
  };
}
