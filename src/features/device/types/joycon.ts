/**
 * Joy-Con (R) デバイスの接続状態
 */
export type JoyConStatus =
    | "DISCONNECTED"
    | "CONNECTING"
    | "CONNECTED"
    | "ERROR";

/**
 * IRカメラの動作モード
 * (今回は画像取得を中心とするため、主に IMAGE_TRANSFER 等を想定)
 */
export type IRCameraMode =
    | "STANDBY"
    | "MOMENT" // モーメントモード（光点検出等）
    | "IMAGE_TRANSFER" // 画像転送モード
    | "CLUSTERING"; // クラスタリングモード

/**
 * クラスタリングモード(`0x06`) で得られる個別の光点(ブロブ)データ
 */
export type IRCluster = {
    /** 平均輝度 (0-255) */
    averageIntensity: number;
    /** ピクセル数(面積) */
    pixelCount: number;
    /** 重心 X 座標 (解像度座標系) */
    cx: number;
    /** 重心 Y 座標 (解像度座標系) */
    cy: number;
    /** バウンディングボックス(左) */
    boundXLeft: number;
    /** バウンディングボックス(右) */
    boundXRight: number;
    /** バウンディングボックス(上) */
    boundYTop: number;
    /** バウンディングボックス(下) */
    boundYBottom: number;
};

/**
 * Reactなどに渡されるクラスタ配列フレーム
 */
export type IRClusterFrame = {
    /** 検出された光点の数の配列 (最大で数十個程度) */
    clusters: IRCluster[];
    /** ストリーム時のタイムスタンプ */
    timestamp: number;
};

/**
 * Joy-Conから受け取る生パケットやフラグメントに関する一時的な型
 * (通信・解析処理の内部で利用)
 */
export type IRCameraPacketFragment = {
    fragmentId: number;
    data: Uint8Array;
};

/**
 * Joy-Conのボタン押下状態
 */
export type JoyConButtons = {
    a: boolean;
    b: boolean;
    x: boolean;
    y: boolean;
    r: boolean;
    zr: boolean;
    sr: boolean;
    sl: boolean;
    plus: boolean;
    home: boolean;
    rStick: boolean;
};

/**
 * IMU(ジャイロ・加速度)センサーデータ
 */
export type JoyConIMU = {
    accel: { x: number; y: number; z: number };
    gyro: { x: number; y: number; z: number };
};

/**
 * Reactなどに渡されるデバイス状態(ボタンとIMU)
 */
export type JoyConState = {
    buttons: JoyConButtons;
    imu: JoyConIMU;
    timestamp: number;
};
