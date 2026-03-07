import { useState, useCallback, useRef, useEffect } from "react";
import { JoyConWebHID } from "./joycon-webhid";
import {
  IRCameraMode,
  IRFrame,
  JoyConState,
  JoyConStatus,
} from "../types/joycon";

export function useJoyCon() {
  const [status, setStatus] = useState<JoyConStatus>("DISCONNECTED");
  const [irFrame, setIrFrame] = useState<IRFrame | null>(null);
  const [joyconState, setJoyconState] = useState<JoyConState | null>(null);
  const [irMode, setIrMode] = useState<IRCameraMode>("CLUSTERING");
  const [isSwitching, setIsSwitching] = useState(false);

  // useRefを用いて同一インスタンスを保持する
  const joyconRef = useRef<JoyConWebHID | null>(null);

  // 初回マウント時にインスタンス化
  useEffect(() => {
    if (!joyconRef.current) {
      joyconRef.current = new JoyConWebHID();
      joyconRef.current.onStateChange = (state: JoyConState) => {
        setJoyconState(state);
      };
    }
    return () => {
      // アンマウント時に切断処理を行う
      if (joyconRef.current) {
        joyconRef.current.disconnect();
        joyconRef.current = null;
      }
    };
  }, []);

  const connect = useCallback(async () => {
    if (!joyconRef.current) return;
    setStatus("CONNECTING");
    try {
      const success = await joyconRef.current.connect();
      if (success) {
        setStatus("CONNECTED");
        // IRカメラの初期化（デフォルトモードで）
        setIsSwitching(true);
        try {
          await joyconRef.current.enableIRCamera(irMode);
        } finally {
          setIsSwitching(false);
        }
      } else {
        setStatus("DISCONNECTED");
      }
    } catch (e) {
      console.error(e);
      setStatus("ERROR");
    }
  }, [irMode]);

  const disconnect = useCallback(async () => {
    if (!joyconRef.current) return;
    await joyconRef.current.disconnect();
    setStatus("DISCONNECTED");
  }, []);

  const switchMode = useCallback(
    async (mode: IRCameraMode) => {
      if (!joyconRef.current || status !== "CONNECTED" || isSwitching) return;
      setIsSwitching(true);
      setIrMode(mode);
      setIrFrame(null); // 前のモードのデータをクリア
      try {
        await joyconRef.current.switchIRMode(mode);
      } finally {
        setIsSwitching(false);
      }
    },
    [status, isSwitching],
  );

  const [isCapturing, setIsCapturing] = useState(false);

  const captureImage = useCallback(async () => {
    if (!joyconRef.current || status !== "CONNECTED" || isCapturing) return;
    setIsCapturing(true);
    setIrFrame(null); // 前の画像をクリア
    await joyconRef.current.captureImage();
  }, [status, isCapturing]);

  // onIRFrameコールバックでIMAGE_TRANSFERフレーム受信時にisCapturingを解除
  useEffect(() => {
    if (!joyconRef.current) return;
    joyconRef.current.onIRFrame = (frame: IRFrame) => {
      setIrFrame(frame);
      if (frame.type === "IMAGE_TRANSFER") {
        setIsCapturing(false);
      }
    };
  }, []);

  return {
    status,
    irFrame,
    irMode,
    isSwitching,
    isCapturing,
    joyconState,
    connect,
    disconnect,
    switchMode,
    captureImage,
  };
}
