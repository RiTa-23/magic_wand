import { calculateCRC8CCITT } from "../lib/crc8";
import { IrCameraRegisters } from "../lib/ir-registers";
import {
  IRCameraMode,
  IRCluster,
  IRFrame,
  JoyConState,
  JoyConStatus,
} from "../types/joycon";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// モードID定数
const IR_MODE_ID: Record<IRCameraMode, number> = {
  MOMENT: 0x03,
  CLUSTERING: 0x06,
  IMAGE_TRANSFER: 0x07,
};

export class JoyConWebHID {
  private device: HIDDevice | null = null;
  public status: JoyConStatus = "DISCONNECTED";

  public onIRFrame?: (frame: IRFrame) => void;
  public onStateChange?: (state: JoyConState) => void;
  private irPollingTimer: ReturnType<typeof setInterval> | null = null;
  private currentIRMode: IRCameraMode = "CLUSTERING";

  // Image Transfer 用のフラグメントバッファ
  private imageBuffer: Uint8Array = new Uint8Array(160 * 120);
  private imageFragsReceived: Set<number> = new Set();
  private imageMaxFrag = IrCameraRegisters.RESOLUTION_160x120.maxFragment;

  // パケット送信時のカウンター (0x00 - 0x0F でループ)
  private packetCounter = 0;

  // 接続処理
  async connect(): Promise<boolean> {
    try {
      this.status = "CONNECTING";
      const devices = await navigator.hid.requestDevice({
        filters: [
          {
            vendorId: 0x057e, // Nintendo
          },
        ],
      });

      if (devices.length === 0) {
        this.status = "DISCONNECTED";
        return false;
      }

      this.device = devices[0];

      // Joy-Con (R) の productId チェック（警告のみ、接続は許可）
      if (this.device.productId !== 0x2006) {
        console.warn(
          `Selected device may not be Joy-Con (R): productId=0x${this.device.productId.toString(16)}`,
        );
      }

      // device.open() にタイムアウトを設定（5秒）
      const openTimeout = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("device.open() timed out")), 5000),
      );
      await Promise.race([this.device.open(), openTimeout]);

      // 受信イベントの登録
      this.device.addEventListener("inputreport", this.handleInputReport);

      this.status = "CONNECTED";
      return true;
    } catch (e) {
      console.error("Joy-Con Connection Error", e);
      if (this.device) {
        try {
          await this.device.close();
        } catch {
          // close失敗は無視
        }
        this.device = null;
      }
      this.status = "ERROR";
      return false;
    }
  }

  // 切断処理
  async disconnect() {
    if (this.irPollingTimer) {
      clearInterval(this.irPollingTimer);
      this.irPollingTimer = null;
    }
    if (this.device) {
      this.device.removeEventListener("inputreport", this.handleInputReport);
      await this.device.close();
      this.device = null;
    }
    this.status = "DISCONNECTED";
  }

  // サブコマンドを送る汎用メソッド
  private async sendSubcommand(subcmdId: number, data: number[]) {
    if (!this.device || !this.device.opened) return;

    // Output Report ID 0x01 通信パケット (先頭の 0x01 は WebHIDの reportId引数として渡すので配列には含めない)
    const reportData = new Uint8Array(48);

    // Timer / Packet counter
    reportData[0] = this.packetCounter & 0x0f;
    this.packetCounter++;

    // Rumble data (ダミーデータ)
    reportData[1] = 0x00;
    reportData[2] = 0x01;
    reportData[3] = 0x40;
    reportData[4] = 0x40;
    reportData[5] = 0x00;
    reportData[6] = 0x01;
    reportData[7] = 0x40;
    reportData[8] = 0x40;

    // Subcommand ID
    reportData[9] = subcmdId;

    // Subcommand Arguments（バッファオーバーフロー防止）
    const maxCopy = Math.min(data.length, reportData.length - 10);
    for (let i = 0; i < maxCopy; i++) {
      reportData[10 + i] = data[i];
    }

    try {
      await this.device.sendReport(0x01, reportData);
    } catch (e) {
      console.error("Failed to send subcommand", e);
    }
  }

  // MCUコマンド(0x21 Config / 0x23 IR Config)を送るラッパーメソッド
  private async sendMCUCommand(
    cmdId: number,
    subcmdId: number,
    data: number[],
  ) {
    // 38 byte: btn/rumble(10) 以降に入る部分(index 10+ に該当)のさらに中身のPayload
    // cmdId=1byte, subcmdId=1byte, MCU Payload(35bytes), CRC(1byte)
    const mcuData = new Uint8Array(38);
    mcuData[0] = cmdId;
    mcuData[1] = subcmdId;

    // Copy data
    for (let i = 0; i < Math.min(data.length, 35); i++) {
      mcuData[2 + i] = data[i];
    }

    // CRC over subcmdId (index 1) and payload (index 2 to 36) -> length 36
    const crcBuf = new Uint8Array(36);
    crcBuf[0] = subcmdId;
    for (let i = 0; i < 35; i++) {
      crcBuf[1 + i] = mcuData[2 + i];
    }
    const crc = calculateCRC8CCITT(crcBuf, 0, 36);
    mcuData[37] = crc; // Byte 37 is the CRC

    // Send via standard subcommand 0x21 (MCU Command)
    await this.sendSubcommand(0x21, Array.from(mcuData));
  }

  // Output Report 0x11 を使ってMCUにIRデータを要求する
  private async sendIRDataRequest() {
    if (!this.device || !this.device.opened) return;

    // Output Report 0x11 のフォーマット:
    // Byte 0: パケットカウンター
    // Byte 1-8: Rumble data
    // Byte 9: MCU cmd (0x03 = Request IR data)
    // Byte 10-45: 引数 (空)
    // Byte 46: CRC-8 for bytes 10-45 (36 bytes)
    // Byte 47: Unknown (0x00)
    const reportData = new Uint8Array(48);

    reportData[0] = this.packetCounter & 0x0f;
    this.packetCounter++;

    // Rumble data (ダミー)
    reportData[1] = 0x00;
    reportData[2] = 0x01;
    reportData[3] = 0x40;
    reportData[4] = 0x40;
    reportData[5] = 0x00;
    reportData[6] = 0x01;
    reportData[7] = 0x40;
    reportData[8] = 0x40;

    // MCU cmd: 0x03 = Request IR data
    reportData[9] = 0x03;

    // bytes 10-45 は空のまま
    // CRC: bytes 10-45 (36 bytes) の CRC-8
    const crcBuf = reportData.subarray(10, 46);
    reportData[46] = calculateCRC8CCITT(crcBuf, 0, 36);

    // Byte 47: unknown
    reportData[47] = 0x00;

    try {
      await this.device.sendReport(0x11, reportData);
    } catch (err) {
      console.warn("IR data request polling error", err);
    }
  }

  // MCU状態の確認をポーリングで待つ (inputreportイベント経由)
  private waitForMCUState(
    predicate: (mcuReportId: number, view: Uint8Array) => boolean,
    timeoutMs = 3000,
  ): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (this.device) {
          this.device.removeEventListener("inputreport", handler);
        }
        reject(new Error("MCU state poll timeout"));
      }, timeoutMs);

      const handler = (event: HIDInputReportEvent) => {
        if (event.reportId !== 0x31) return;
        const view = new Uint8Array(
          event.data.buffer,
          event.data.byteOffset,
          event.data.byteLength,
        );
        const mcuReportId = view[48];
        if (predicate(mcuReportId, view)) {
          clearTimeout(timeout);
          if (this.device) {
            this.device.removeEventListener("inputreport", handler);
          }
          resolve(view);
        }
      };

      if (this.device) {
        this.device.addEventListener("inputreport", handler);
      } else {
        reject(new Error("Device not connected"));
      }
    });
  }

  // IRカメラ（MCU）を有効化しデータ受信を開始するための関数
  public async enableIRCamera(mode: IRCameraMode = "CLUSTERING") {
    if (!this.device) return;
    this.currentIRMode = mode;

    try {
      // === Phase 1: IMU有効化 & レポートモード設定 ===
      console.log("Step 0: Enabling IMU (0x40)...");
      await this.sendSubcommand(0x40, [0x01]);
      await sleep(100);

      console.log("Step 1: Setting input report mode to MCU/IR (0x31)...");
      await this.sendSubcommand(0x03, [0x31]);
      await sleep(100);

      // === Phase 2: MCU有効化 & Standby確認 ===
      console.log("Step 2: Resume MCU to Standby (Subcmd 0x22)...");
      await this.sendSubcommand(0x22, [0x01]);
      await sleep(200);

      try {
        await this.waitForMCUState((reportId, view) => {
          if (reportId === 0x01) return view[55] === 0x01;
          return false;
        }, 2000);
      } catch (err) {
        console.warn("MCU poll timeout while waiting for Standby state", err);
      }

      // === Phase 3: MCUをIRモードに移行 ===
      console.log("Step 3: Set MCU Mode to IR...");
      await this.sendMCUCommand(0x21, 0x00, [0x05]);
      await sleep(200);

      try {
        await this.waitForMCUState((reportId, view) => {
          if (reportId === 0x01) return view[55] === 0x05;
          return false;
        }, 3000);
      } catch (err) {
        console.warn("MCU poll timeout while waiting for IR mode", err);
      }

      // Phase 4-6: レジスタ書き込みとモード設定
      await this.configureIRMode(mode);

      // IRデータの定期リクエストを開始（Output Report 0x11）
      console.log("Starting IR data polling...");
      this.startIRPolling();

      console.log(`IR Camera (${mode}) started successfully!`);
    } catch (e) {
      console.error("Error setting up IR Camera:", e);
    }
  }

  // IRモードを切り替える（既にenableIRCamera済みの場合に使用）
  public async switchIRMode(mode: IRCameraMode) {
    if (!this.device) return;
    this.stopIRPolling();
    this.currentIRMode = mode;

    try {
      await this.configureIRMode(mode);
      this.startIRPolling();
      console.log(`IR mode switched to ${mode}`);
    } catch (e) {
      console.error("Error switching IR mode:", e);
    }
  }

  // IRモードの共通設定処理（リセット→レジスタ→モード設定）
  private async configureIRMode(mode: IRCameraMode) {
    // IRセンサーリセット
    console.log("Resetting IR sensor...");
    await this.sendMCUCommand(0x23, 0x01, [0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
    await sleep(200);

    try {
      await this.waitForMCUState((reportId) => reportId === 0x13, 3000);
    } catch (err) {
      console.warn("MCU poll timeout while waiting for IR sensor reset", err);
    }

    // レジスタ書き込み
    console.log("Writing IR registers...");
    const resolution = IrCameraRegisters.RESOLUTION_160x120;
    const finish = IrCameraRegisters.FINISH;
    const regData = [
      9,
      resolution.page,
      resolution.offset,
      resolution.value, // Resolution 160x120
      0x00,
      0x0e,
      0x03, // External Light Filter x1
      0x00,
      0x10,
      0x10, // IR LEDs enabled
      0x00,
      0x11,
      0x01, // LED Intensity Far
      0x00,
      0x12,
      0x01, // LED Intensity Near
      0x01,
      0x30,
      0x60, // Exposure LSB (raw 6240 = 0x1860)
      0x01,
      0x31,
      0x18, // Exposure MSB
      0x01,
      0x32,
      0x00, // Exposure Mode = Manual
      finish.page,
      finish.offset,
      finish.value, // Finish
    ];
    await this.sendMCUCommand(0x23, 0x04, regData);
    await sleep(200);

    // モード設定
    const modeId = IR_MODE_ID[mode];
    this.imageMaxFrag = resolution.maxFragment;
    const frags = mode === "IMAGE_TRANSFER" ? this.imageMaxFrag : 0x00;
    console.log(
      `Setting IR mode to ${mode} (0x${modeId.toString(16)}, frags=0x${frags.toString(16)})...`,
    );
    await this.sendMCUCommand(0x23, 0x01, [
      modeId,
      frags,
      0x00,
      0x00,
      0x00,
      0x00,
    ]);
    await sleep(200);

    // Image Transferの場合はバッファをリセット
    if (mode === "IMAGE_TRANSFER") {
      this.imageBuffer = new Uint8Array(160 * 120);
      this.imageFragsReceived = new Set();
    }

    try {
      await this.waitForMCUState((reportId) => reportId === 0x13, 3000);
    } catch (err) {
      console.warn(
        "MCU poll timeout while waiting for IR mode confirmation",
        err,
      );
    }
  }

  private startIRPolling() {
    this.stopIRPolling();
    this.irPollingTimer = setInterval(() => {
      this.sendIRDataRequest();
    }, 50);
  }

  private stopIRPolling() {
    if (this.irPollingTimer) {
      clearInterval(this.irPollingTimer);
      this.irPollingTimer = null;
    }
  }

  // デバイスからの入力を受け取るハンドラー
  private handleInputReport = (event: HIDInputReportEvent) => {
    const { reportId, data } = event;
    const view = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);

    // reportId === 0x31 が 標準入力 + IMU + MCUデータのイベント
    if (reportId === 0x31) {
      // 最小長チェック: ボタン(index 2-3) + IMU(index 12-23) + MCU(index 48) が必要
      if (view.length < 49) return;

      // --- 1. ボタン・IMUの状態抽出 ---
      // HIDEventの data プロパティは reportId を含まないため、全データのoffsetは-1されます。
      // 右Joy-Conのボタン状態(Byte 2)
      const rightBtns = view[2];
      // 共有ボタン状態(Byte 3)
      const sharedBtns = view[3];

      // 16bit signed little-endianの読み取り補助
      const getInt16LE = (offset: number) => {
        if (offset + 1 >= view.length) return 0;
        let val = view[offset] | (view[offset + 1] << 8);
        if (val >= 32768) val -= 65536;
        return val;
      };

      // IMUフレーム1 (データの先頭はByte 12)
      // 実運用ではキャリブレーション値の補正やジャイロの単位変換(dps)が必要ですが、今回はテスト用として生値を抽出
      const accel = {
        x: getInt16LE(12),
        y: getInt16LE(14),
        z: getInt16LE(16),
      };
      const gyro = {
        x: getInt16LE(18),
        y: getInt16LE(20),
        z: getInt16LE(22),
      };

      if (this.onStateChange) {
        this.onStateChange({
          buttons: {
            y: (rightBtns & 0x01) !== 0,
            x: (rightBtns & 0x02) !== 0,
            b: (rightBtns & 0x04) !== 0,
            a: (rightBtns & 0x08) !== 0,
            sr: (rightBtns & 0x10) !== 0,
            sl: (rightBtns & 0x20) !== 0,
            r: (rightBtns & 0x40) !== 0,
            zr: (rightBtns & 0x80) !== 0,

            // マイナス・プラス・Rスティック・ホームボタンなどは共有領域(Byte 4)
            plus: (sharedBtns & 0x02) !== 0,
            rStick: (sharedBtns & 0x04) !== 0,
            home: (sharedBtns & 0x10) !== 0,
          },
          imu: { accel, gyro },
          timestamp: performance.now(),
        });
      }

      // --- 2. MCU(IR)データの抽出 ---
      const mcuReportId = view[48];

      if (mcuReportId === 0x03 && this.onIRFrame) {
        // IRData レポート: モードに応じて異なるパース
        this.parseIRData(view);
      }
    }
  };

  // モードに応じたIRデータパース
  private parseIRData(view: Uint8Array) {
    switch (this.currentIRMode) {
      case "CLUSTERING":
        this.parseClusteringData(view);
        break;
      case "MOMENT":
        this.parseMomentData(view);
        break;
      case "IMAGE_TRANSFER":
        this.parseImageTransferData(view);
        break;
    }
  }

  private parseClusteringData(view: Uint8Array) {
    const clusters: IRCluster[] = [];
    const clusterBaseOffset = 60;

    for (
      let offset = clusterBaseOffset;
      offset + 15 < view.length;
      offset += 16
    ) {
      const avgIntensity = view[offset] | (view[offset + 1] << 8);
      const pixelCount = view[offset + 2] | (view[offset + 3] << 8);
      const cx = view[offset + 4] | (view[offset + 5] << 8);
      const cy = view[offset + 6] | (view[offset + 7] << 8);

      if (pixelCount > 0) {
        clusters.push({
          averageIntensity: avgIntensity,
          pixelCount,
          cx,
          cy,
          boundXLeft: view[offset + 8] | (view[offset + 9] << 8),
          boundXRight: view[offset + 10] | (view[offset + 11] << 8),
          boundYTop: view[offset + 12] | (view[offset + 13] << 8),
          boundYBottom: view[offset + 14] | (view[offset + 15] << 8),
        });
      }
    }

    this.onIRFrame?.({
      type: "CLUSTERING",
      clusters,
      timestamp: performance.now(),
    });
  }

  private parseMomentData(view: Uint8Array) {
    // IRData ヘッダー: offset 48=reportId, 49-50=unknown, 51=frag, 52=avgIntensity,
    //                  53=unknown, 54-55=whitePixelCount, 56-57=ambientNoise
    const fragmentNumber = view[51];
    const averageIntensity = view[52];
    const whitePixelCount = view[54] | (view[55] << 8);
    const ambientNoiseCount = view[56] | (view[57] << 8);

    this.onIRFrame?.({
      type: "MOMENT",
      fragmentNumber,
      averageIntensity,
      whitePixelCount,
      ambientNoiseCount,
      timestamp: performance.now(),
    });
  }

  private parseImageTransferData(view: Uint8Array) {
    const fragNumber = view[51];

    // fragNumber のバリデーション
    if (
      !Number.isFinite(fragNumber) ||
      fragNumber < 0 ||
      fragNumber > this.imageMaxFrag
    ) {
      return;
    }

    // 画像データは offset 58 から 300 バイト
    const imgDataOffset = 58;
    const fragSize = 300;
    const destOffset = fragNumber * fragSize;

    if (destOffset >= this.imageBuffer.length) return;

    // フラグメントをバッファにコピー
    for (let i = 0; i < fragSize && imgDataOffset + i < view.length; i++) {
      if (destOffset + i < this.imageBuffer.length) {
        this.imageBuffer[destOffset + i] = view[imgDataOffset + i];
      }
    }
    this.imageFragsReceived.add(fragNumber);

    // 全フラグメントが揃ったらフレームを完成
    if (this.imageFragsReceived.size >= this.imageMaxFrag + 1) {
      this.onIRFrame?.({
        type: "IMAGE_TRANSFER",
        imageData: new Uint8Array(this.imageBuffer),
        width: 160,
        height: 120,
        timestamp: performance.now(),
      });
      // バッファをリセット
      this.imageFragsReceived.clear();
      this.imageBuffer = new Uint8Array(160 * 120);
    }
  }
}
