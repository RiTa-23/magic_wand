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
  private readonly boundHandleDisconnect = this.handleDisconnect.bind(this);
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
      // Web Bluetooth API の利用可能性チェック
      if (!navigator.bluetooth) {
        throw new Error(
          "お使いのブラウザはWeb Bluetooth APIをサポートしていません",
        );
      }

      // 接続開始時に前回のエラーをクリア
      this.status = "CONNECTING";
      this.emitStateChange(); // errorMessage を undefined に

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
        this.boundHandleDisconnect,
      );

      return {
        success: true,
        message: `${this.device.name} に接続しました！`,
        deviceName: this.device.name,
      };
    } catch (error) {
      // 失敗時は接続オブジェクトをクリア
      if (this.device) {
        this.device.removeEventListener(
          "gattserverdisconnected",
          this.boundHandleDisconnect,
        );
      }
      this.device = null;
      this.server = null;

      // ユーザーがキャンセルした場合は通常のログ、それ以外はエラーログ
      const isUserCancelled =
        error instanceof Error && error.name === "NotFoundError";

      if (isUserCancelled) {
        console.log("ℹ️ デバイス選択がキャンセルされました");
        this.status = "DISCONNECTED";
      } else {
        console.error("❌ Bluetooth接続エラー:", error);
        this.status = "ERROR";
      }

      const errorMessage = this.getErrorMessage(error);
      this.emitStateChange(isUserCancelled ? undefined : errorMessage);

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
      if (this.device) {
        this.device.removeEventListener(
          "gattserverdisconnected",
          this.boundHandleDisconnect,
        );
      }

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

    if (this.device) {
      this.device.removeEventListener(
        "gattserverdisconnected",
        this.boundHandleDisconnect,
      );
    }

    this.device = null;
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
      // ユーザーが権限を拒否した場合
      if (error.name === "NotAllowedError") {
        return "Bluetoothへのアクセスが許可されていません";
      }
      // Bluetoothアダプターが無効な場合
      if (error.name === "InvalidStateError") {
        return "Bluetoothが無効になっています。設定から有効にしてください";
      }
      // デバイスとの通信エラー
      if (error.name === "NetworkError") {
        return "デバイスとの通信に失敗しました。デバイスの電源を確認してください";
      }
      // GATT接続エラー
      if (error.message.includes("GATT")) {
        return "デバイスとの接続に失敗しました。デバイスを再起動してみてください";
      }
      // その他のエラー
      return `接続エラー: ${error.message}`;
    }
    return "不明なエラーが発生しました";
  }
}
