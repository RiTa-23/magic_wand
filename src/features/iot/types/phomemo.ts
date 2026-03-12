/**
 * Phomemo M02Sプリンターの接続状態
 */
export type PhomemoStatus =
  | "DISCONNECTED" // 未接続
  | "CONNECTING" // 接続中
  | "CONNECTED" // 接続完了
  | "PRINTING" // 印刷中
  | "ERROR"; // エラー

/**
 * Phomemoプリンターの状態
 */
export interface PhomemoState {
  status: PhomemoStatus;
  deviceName?: string;
  batteryLevel?: number;
  errorMessage?: string;
}

/**
 * Bluetooth接続結果
 */
export interface BluetoothConnectionResult {
  success: boolean;
  message: string;
  deviceName?: string;
}
