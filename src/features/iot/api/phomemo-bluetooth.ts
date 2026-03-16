import {
  PhomemoStatus,
  PhomemoState,
  BluetoothConnectionResult,
  PhomemoPrintResult,
} from "../types/phomemo";

const PHOMEMO_SERVICE_UUID_CANDIDATES = [
  "0000ff00-0000-1000-8000-00805f9b34fb",
  "0000ffe0-0000-1000-8000-00805f9b34fb",
  "0000ae30-0000-1000-8000-00805f9b34fb",
];

const PHOMEMO_CHARACTERISTIC_UUID_CANDIDATES = [
  "0000ff02-0000-1000-8000-00805f9b34fb",
  "0000ffe1-0000-1000-8000-00805f9b34fb",
  "0000ae01-0000-1000-8000-00805f9b34fb",
];

const WRITE_CHUNK_SIZE = 180;
const WRITE_DELAY_MS = 40;

/**
 * Phomemo M02S モバイルプリンター制御クラス
 * Web Bluetooth APIを使用してブラウザから直接Bluetooth接続を行う
 */
export class PhomemoBluetooth {
  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private writeCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  private transportInfo: string | undefined = undefined;
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
        optionalServices: PHOMEMO_SERVICE_UUID_CANDIDATES,
      });

      console.log(`📱 デバイス選択: ${this.device.name}`);

      // GATTサーバーへ接続
      const gattServer = await this.device.gatt?.connect();
      this.server = gattServer ?? null;

      if (!this.server) {
        throw new Error("GATTサーバーへの接続に失敗しました");
      }

      this.writeCharacteristic = await this.findWritableCharacteristic(
        this.server,
      );
      this.transportInfo = this.describeTransport(this.writeCharacteristic);

      console.log(`✅ GATTサーバー接続成功: ${this.device.name}`);
      console.log(`🛰️ 印刷Characteristic検出: ${this.transportInfo}`);

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
      this.writeCharacteristic = null;
      this.transportInfo = undefined;

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
      this.writeCharacteristic = null;
      this.transportInfo = undefined;
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
    return (
      (this.server?.connected ?? false) && this.writeCharacteristic !== null
    );
  }

  /**
   * デバイス名を取得
   */
  getDeviceName(): string | undefined {
    return this.device?.name;
  }

  /**
   * 印刷データを書き込む
   */
  async print(data: Uint8Array): Promise<PhomemoPrintResult> {
    if (!this.server?.connected || !this.writeCharacteristic) {
      return {
        success: false,
        message: "プリンターに接続されていません",
      };
    }

    if (data.length === 0) {
      return {
        success: false,
        message: "印刷データが空です",
      };
    }

    const previousStatus = this.status;

    try {
      this.status = "PRINTING";
      this.emitStateChange();

      for (let offset = 0; offset < data.length; offset += WRITE_CHUNK_SIZE) {
        const chunk = data.slice(
          offset,
          Math.min(offset + WRITE_CHUNK_SIZE, data.length),
        );
        await this.writeChunk(chunk);

        if (offset + WRITE_CHUNK_SIZE < data.length) {
          await this.delay(WRITE_DELAY_MS);
        }
      }

      this.status = "CONNECTED";
      this.emitStateChange();

      return {
        success: true,
        message: `${data.length} bytes を送信しました`,
        bytesWritten: data.length,
      };
    } catch (error) {
      console.error("❌ 印刷データ送信エラー:", error);
      this.status = "ERROR";
      this.emitStateChange(this.getErrorMessage(error));

      return {
        success: false,
        message: this.getErrorMessage(error),
      };
    } finally {
      if (this.server?.connected && this.status !== "ERROR") {
        this.status =
          previousStatus === "PRINTING" ? "CONNECTED" : previousStatus;
        this.emitStateChange();
      }
    }
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
    this.writeCharacteristic = null;
    this.transportInfo = undefined;
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
        transportInfo: this.transportInfo,
      };
      this.onStateChange(state);
    }
  }

  private async findWritableCharacteristic(
    server: BluetoothRemoteGATTServer,
  ): Promise<BluetoothRemoteGATTCharacteristic> {
    for (const serviceUuid of PHOMEMO_SERVICE_UUID_CANDIDATES) {
      try {
        const service = await server.getPrimaryService(serviceUuid);

        for (const characteristicUuid of PHOMEMO_CHARACTERISTIC_UUID_CANDIDATES) {
          try {
            const characteristic =
              await service.getCharacteristic(characteristicUuid);
            if (this.canWrite(characteristic)) {
              return characteristic;
            }
          } catch {
            // Try the next known characteristic UUID.
          }
        }

        const characteristics = await service.getCharacteristics();
        const writable = characteristics.find((characteristic) =>
          this.canWrite(characteristic),
        );
        if (writable) {
          return writable;
        }
      } catch {
        // Try the next known service UUID.
      }
    }

    const primaryServices = await server.getPrimaryServices();
    for (const service of primaryServices) {
      const characteristics = await service.getCharacteristics();
      const writable = characteristics.find((characteristic) =>
        this.canWrite(characteristic),
      );
      if (writable) {
        return writable;
      }
    }

    throw new Error(
      "書き込み可能なBluetooth characteristicが見つかりませんでした",
    );
  }

  private canWrite(characteristic: BluetoothRemoteGATTCharacteristic): boolean {
    return (
      characteristic.properties.write === true ||
      characteristic.properties.writeWithoutResponse === true
    );
  }

  private describeTransport(
    characteristic: BluetoothRemoteGATTCharacteristic,
  ): string {
    const serviceUuid = characteristic.service.uuid;
    const characteristicUuid = characteristic.uuid;
    return `${serviceUuid} / ${characteristicUuid}`;
  }

  private async writeChunk(chunk: Uint8Array): Promise<void> {
    if (!this.writeCharacteristic) {
      throw new Error("書き込み先Characteristicが初期化されていません");
    }

    const buffer = this.toArrayBuffer(chunk);

    if (this.writeCharacteristic.properties.writeWithoutResponse) {
      await this.writeCharacteristic.writeValueWithoutResponse(buffer);
      return;
    }

    if (this.writeCharacteristic.properties.write) {
      await this.writeCharacteristic.writeValueWithResponse(buffer);
      return;
    }

    throw new Error("このCharacteristicは書き込みに対応していません");
  }

  private async delay(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }

  private toArrayBuffer(view: Uint8Array): ArrayBuffer {
    return view.buffer.slice(
      view.byteOffset,
      view.byteOffset + view.byteLength,
    ) as ArrayBuffer;
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
