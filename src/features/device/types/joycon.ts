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
 */
export type IRCameraMode = "CLUSTERING" | "MOMENT" | "IMAGE_TRANSFER";

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
    type: "CLUSTERING";
    /** 検出された光点の数の配列 (最大で数十個程度) */
    clusters: IRCluster[];
    /** ストリーム時のタイムスタンプ */
    timestamp: number;
};

/**
 * モーメントモード(`0x03`) のフレーム
 * フレーム全体の明るさ・ノイズ統計を取得
 */
export type IRMomentFrame = {
    type: "MOMENT";
    /** フラグメント番号 */
    fragmentNumber: number;
    /** 平均輝度 (0-255) */
    averageIntensity: number;
    /** 白ピクセル数 */
    whitePixelCount: number;
    /** 環境ノイズ数 */
    ambientNoiseCount: number;
    timestamp: number;
};

/**
 * 画像転送モード(`0x07`) のフレーム
 * 160x120 (or 320x240) の生IR画像データ
 */
export type IRImageFrame = {
    type: "IMAGE_TRANSFER";
    /** 完成した1フレーム分の画像データ (グレースケール) */
    imageData: Uint8Array;
    /** 画像の幅 */
    width: number;
    /** 画像の高さ */
    height: number;
    timestamp: number;
};

/**
 * 3モードの出力を統一するユニオン型
 */
export type IRFrame = IRClusterFrame | IRMomentFrame | IRImageFrame;

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
