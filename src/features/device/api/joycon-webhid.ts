import { calculateCRC8CCITT } from "../lib/crc8";
import { IrCameraRegisters } from "../lib/ir-registers";
import { IRCluster, IRClusterFrame, JoyConState, JoyConStatus } from "../types/joycon";

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class JoyConWebHID {
    private device: HIDDevice | null = null;
    public status: JoyConStatus = "DISCONNECTED";

    public onIRFrame?: (frame: IRClusterFrame) => void;
    public onStateChange?: (state: JoyConState) => void;
    private irFrameBuffer: Uint8Array | null = null;
    private irPollingTimer: ReturnType<typeof setInterval> | null = null;

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
                        // productId: 0x2006, // Joy-Con (R) (※今回はRight決め打ちだが、指定しなくても一旦OK)
                    },
                ],
            });

            if (devices.length === 0) {
                this.status = "DISCONNECTED";
                return false;
            }

            this.device = devices[0];
            await this.device.open();

            // 受信イベントの登録
            this.device.addEventListener("inputreport", this.handleInputReport);

            this.status = "CONNECTED";
            return true;
        } catch (e) {
            console.error("Joy-Con Connection Error", e);
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

        // Subcommand Arguments
        for (let i = 0; i < data.length; i++) {
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
        data: number[]
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
        } catch (e) {
            // ポーリング中のエラーは静かに無視
        }
    }

    // MCU状態の確認をポーリングで待つ (inputreportイベント経由)
    private waitForMCUState(
        predicate: (mcuReportId: number, view: Uint8Array) => boolean,
        timeoutMs = 3000
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
                const view = new Uint8Array(event.data.buffer, event.data.byteOffset, event.data.byteLength);
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
    public async enableIRCamera() {
        if (!this.device) return;

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

            // MCU状態をポーリング: Standby (state=1) を待つ
            console.log("Polling MCU for Standby state...");
            try {
                await this.waitForMCUState((reportId, view) => {
                    // MCU状態レポート (reportId 0x01): byte 56(full) -> 55(WebHID) にMCU state
                    if (reportId === 0x01) {
                        const mcuState = view[55];
                        console.log(`  MCU state report: state=${mcuState}`);
                        return mcuState === 0x01; // Standby
                    }
                    return false;
                }, 2000);
                console.log("MCU is in Standby state.");
            } catch {
                console.warn("MCU Standby poll timeout, continuing anyway...");
            }

            // === Phase 3: MCUをIRモードに移行 ===
            console.log("Step 3: Set MCU Mode to IR (0x21 0x00 0x05)...");
            await this.sendMCUCommand(0x21, 0x00, [0x05]);
            await sleep(200);

            // MCUがIRモード (state=5) になるのを待つ
            console.log("Polling MCU for IR state...");
            try {
                await this.waitForMCUState((reportId, view) => {
                    if (reportId === 0x01) {
                        const mcuState = view[55];
                        console.log(`  MCU state report: state=${mcuState}`);
                        return mcuState === 0x05; // IR
                    }
                    return false;
                }, 3000);
                console.log("MCU is in IR state.");
            } catch {
                console.warn("MCU IR state poll timeout, continuing anyway...");
            }

            // === Phase 4: IRセンサーリセット ===
            console.log("Step 4: Send IRSensorReset...");
            await this.sendMCUCommand(0x23, 0x01, [0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
            await sleep(200);

            // IRセンサーがConfiguration Waitに入るまで待つ
            console.log("Waiting for IR sensor configuration state...");
            try {
                await this.waitForMCUState((reportId) => {
                    // IRステータスレポート (reportId 0x13) を待つ
                    return reportId === 0x13;
                }, 3000);
                console.log("IR sensor is ready for configuration.");
            } catch {
                console.warn("IR config state poll timeout, continuing anyway...");
            }

            // === Phase 5: レジスタ書き込み ===
            console.log("Step 5: Write IR Registers...");
            const regData = [
                9,
                0x00, 0x2e, 0x50,  // Resolution 160x120
                0x00, 0x0e, 0x03,  // External Light Filter x1
                0x00, 0x10, 0x10,  // IR LEDs enabled
                0x00, 0x11, 0x01,  // LED Intensity Far
                0x00, 0x12, 0x01,  // LED Intensity Near
                0x01, 0x30, 0x60,  // Exposure LSB (raw 6240 = 0x1860)
                0x01, 0x31, 0x18,  // Exposure MSB
                0x01, 0x32, 0x00,  // Exposure Mode = Manual
                0x00, 0x07, 0x01,  // Finish (must be last)
            ];
            await this.sendMCUCommand(0x23, 0x04, regData);
            await sleep(200);

            // === Phase 6: クラスタリングモード設定 ===
            console.log("Step 6: Set MCU IR Mode to Clustering (6)...");
            await this.sendMCUCommand(0x23, 0x01, [
                0x06,
                0x00, // non-fragmented
                0x00, 0x00, 0x00, 0x00
            ]);
            await sleep(200);

            // IRセンサーがクラスタリングモードに入るのを確認
            console.log("Waiting for Clustering mode confirmation...");
            try {
                await this.waitForMCUState((reportId) => {
                    return reportId === 0x13;
                }, 3000);
                console.log("IR sensor is in Clustering mode.");
            } catch {
                console.warn("Clustering mode poll timeout, continuing anyway...");
            }

            console.log("IR Camera (Clustering Mode) started successfully!");

            // IRデータの定期リクエストを開始（Output Report 0x11）
            console.log("Starting IR data polling...");
            this.irPollingTimer = setInterval(() => {
                this.sendIRDataRequest();
            }, 50); // 50ms間隔でリクエスト
        } catch (e) {
            console.error("Error setting up IR Camera:", e);
        }
    }

    // デバイスからの入力を受け取るハンドラー
    private handleInputReport = (event: HIDInputReportEvent) => {
        const { reportId, data } = event;
        const view = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);

        // reportId === 0x31 が 標準入力 + IMU + MCUデータのイベント
        if (reportId === 0x31) {

            // --- 1. ボタン・IMUの状態抽出 ---
            // HIDEventの data プロパティは reportId を含まないため、全データのoffsetは-1されます。
            // 右Joy-Conのボタン状態(Byte 2)
            const rightBtns = view[2];
            // 共有ボタン状態(Byte 3)
            const sharedBtns = view[3];

            // 16bit signed little-endianの読み取り補助
            const getInt16LE = (offset: number) => {
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
                    timestamp: performance.now()
                });
            }

            // --- 2. MCU(IR)データの抽出 ---
            // JSのHIDEventでは data に reportId が含まないため、Rustでのoffsetより -1 される
            // MCUReportId は offset 48
            const mcuReportId = view[48];

            if (mcuReportId === 0x03) {
                // 0x03 は IRData
                // クラスタリングモードでは offset 60 からクラスタデータ開始、各16バイト
                const clusters: IRCluster[] = [];
                const clusterBaseOffset = 60;

                // バッファ終端まで16バイトごとに走査 (最大16クラスタ)
                for (let offset = clusterBaseOffset; offset + 15 < view.length; offset += 16) {
                    const avgIntensity = view[offset] | (view[offset + 1] << 8);
                    const pixelCount = view[offset + 2] | (view[offset + 3] << 8);
                    const cx = view[offset + 4] | (view[offset + 5] << 8);
                    const cy = view[offset + 6] | (view[offset + 7] << 8);

                    // pixelCount が 0 のスロットは未検出なのでスキップ
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

                if (this.onIRFrame) {
                    this.onIRFrame({
                        clusters,
                        timestamp: performance.now(),
                    });
                }
            }
        } else if (reportId === 0x21) {
            // 通常のボタンデータ等
        }
    };
}
