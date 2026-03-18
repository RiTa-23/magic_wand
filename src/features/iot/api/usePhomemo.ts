import { useState, useCallback, useRef, useEffect } from "react";
import { PhomemoBluetooth } from "./phomemo-bluetooth";
import { PhomemoStatus, PhomemoState } from "../types/phomemo";
import { renderCanvasImage, loadImageFromUrl } from "@/features/phomemo/lib/imageProcessor";
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
  const lastPrintedImageRef = useRef<string | null>(null);

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

  /**
   * キャラクター画像をランダムに選んで印刷する
   * public/omikujiimage/ フォルダから画像を自動取得
   */
  const printOmikujiWithRandomImage = useCallback(async () => {
    if (!phomemoRef.current) return;

    try {
      // public/omikujiimage/ フォルダのファイル一覧を取得
      const manifestResponse = await fetch(
        "/api/omikujiimage-manifest.json"
      );
      if (!manifestResponse.ok) {
        throw new Error("画像マニフェストの読み込みに失敗しました");
      }

      const manifest = await manifestResponse.json();
      const imageFiles: string[] = manifest.images || [];

      if (imageFiles.length === 0) {
        throw new Error("omikujiimage フォルダに画像ファイルが見つかりません");
      }

      // 連続で同じ画像が出ないよう、直前に印刷した画像は候補から除外する
      const candidates =
        imageFiles.length > 1
          ? imageFiles.filter((file) => file !== lastPrintedImageRef.current)
          : imageFiles;

      const randomImage =
        candidates[Math.floor(Math.random() * candidates.length)];
      lastPrintedImageRef.current = randomImage;
      const imagePath = `/omikujiimage/${randomImage}`;

      // 画像を読み込む
      const img = await loadImageFromUrl(imagePath);

      // 画像のアスペクト比を保ったまま、キャンバスサイズを計算
      const maxWidth = 576;
      const imageAspectRatio =
        img.naturalWidth / img.naturalHeight;
      const canvasWidth = maxWidth;
      const canvasHeight = Math.round(maxWidth / imageAspectRatio);

      // キャンバスに画像を描画して印刷
      const imageData = renderCanvasImage({
        width: canvasWidth,
        height: canvasHeight,
        image: img,
        padding: 12,
      });

      const encoded = encodeImageDataToPhomemo(imageData, { threshold: 170 });
      const result = await phomemoRef.current.print(encoded);

      if (!result.success) {
        console.error("印刷失敗:", result.message);
        return;
      }

      console.log("おみくじ画像印刷完了:", {
        imagePath,
        bytesWritten: result.bytesWritten,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("おみくじ印刷エラー:", message);
      throw error;
    }
  }, []);

  return {
    status,
    deviceName,
    errorMessage,
    transportInfo,
    connect,
    disconnect,
    printTestPage,
    printOmikujiWithRandomImage,
    isConnected: phomemoRef.current?.isConnected() ?? false,
  };
}
