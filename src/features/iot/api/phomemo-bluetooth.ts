import {
  PhomemoStatus,
  PhomemoState,
  BluetoothConnectionResult,
} from "../types/phomemo";

/**
 * Phomemo M02S モバイルプリンター制御クラス
 * Web Bluetooth APIを使用してブラウザから直接Bluetooth接続を行う
 */
export class PhomemoBluetooth {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  public status: PhomemoStatus = "DISCONNECTED";

  // 状態変更のコールバック
  public onStateChange?: (state: PhomemoState) => void;

  /**
   * Phomemo M02Sとペアリング・接続
   * ブラウザのBluetoothデバイス選択ダイアログが表示される
   *
   * @returns 接続結果
   */
  async connect(): Promise<BluetoothConnectionResult> {
    try {
      this.status = "CONNECTING";
      this.emitStateChange();

      // Web Bluetooth APIでデバイスをリクエスト
      // namePrefix で M02S から始まるデバイスをフィルタリング
      this.device = await navigator.bluetooth.requestDevice({
        filters: [
          {
            namePrefix: "M02S",
          },
        ],
        // optionalServicesは後で印刷用のサービスUUIDを追加する
        optionalServices: [],
      });

      console.log(`📱 デバイス選択: ${this.device.name}`);

      // GATTサーバーへ接続
      const gattServer = await this.device.gatt?.connect();
      this.server = gattServer ?? null;

      if (!this.server) {
        throw new Error("GATTサーバーへの接続に失敗しました");
      }

      console.log(`✅ GATTサーバー接続成功: ${this.device.name}`);

      this.status = "CONNECTED";
      this.emitStateChange();

      // デバイスの切断イベントをリスン
      this.device.addEventListener(
        "gattserverdisconnected",
        this.handleDisconnect.bind(this),
      );

      return {
        success: true,
        message: `${this.device.name} に接続しました！`,
        deviceName: this.device.name,
      };
    } catch (error) {
      console.error("❌ Bluetooth接続エラー:", error);

      this.status = "ERROR";
      const errorMessage = this.getErrorMessage(error);
      this.emitStateChange(errorMessage);

      return {
        success: false,
        message: errorMessage,
      };
    }
  }

  /**
   * デバイスから切断
   */
  async disconnect(): Promise<void> {
    try {
      if (this.server?.connected) {
        this.server.disconnect();
        console.log("🔌 GATTサーバーから切断しました");
      }

      this.device = null;
      this.server = null;
      this.status = "DISCONNECTED";
      this.emitStateChange();
    } catch (error) {
      console.error("❌ 切断処理エラー:", error);
      this.status = "ERROR";
      this.emitStateChange(
        error instanceof Error ? error.message : "切断処理エラー",
      );
    }
  }

  /**
   * 接続状態を取得
   */
  isConnected(): boolean {
    return this.server?.connected ?? false;
  }

  /**
   * デバイス名を取得
   */
  getDeviceName(): string | undefined {
    return this.device?.name;
  }

  /**
   * デバイス切断イベントハンドラー
   */
  private handleDisconnect(): void {
    console.log("⚠️ デバイスが切断されました");
    this.status = "DISCONNECTED";
    this.server = null;
    this.emitStateChange();
  }

  /**
   * 状態変更を通知
   */
  private emitStateChange(errorMessage?: string): void {
    if (this.onStateChange) {
      const state: PhomemoState = {
        status: this.status,
        deviceName: this.device?.name,
        errorMessage,
      };
      this.onStateChange(state);
    }
  }

  /**
   * エラーメッセージを整形
   */
  private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      // ユーザーがキャンセルした場合
      if (error.name === "NotFoundError") {
        return "デバイスが選択されませんでした";
      }
      // Bluetoothが無効な場合
      if (error.name === "NotSupportedError") {
        return "お使いのブラウザはWeb Bluetooth APIをサポートしていません";
      }
      // その他のエラー
      return `接続エラー: ${error.message}`;
    }
    return "不明なエラーが発生しました";
  }
}
