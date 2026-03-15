import { useState, useCallback, useRef, useEffect } from "react";
import { PhomemoBluetooth } from "./phomemo-bluetooth";
import { PhomemoStatus, PhomemoState } from "../types/phomemo";

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

  return {
    status,
    deviceName,
    errorMessage,
    connect,
    disconnect,
    isConnected: status === "CONNECTED",
  };
}
