import { useState, useCallback, useRef, useEffect } from "react";
import { JoyConWebHID } from "./joycon-webhid";
import { IRClusterFrame, JoyConState, JoyConStatus } from "../types/joycon";

export function useJoyCon() {
    const [status, setStatus] = useState<JoyConStatus>("DISCONNECTED");
    const [irFrame, setIrFrame] = useState<IRClusterFrame | null>(null);
    const [joyconState, setJoyconState] = useState<JoyConState | null>(null);

    // useRefを用いて同一インスタンスを保持する
    const joyconRef = useRef<JoyConWebHID | null>(null);

    // 初回マウント時にインスタンス化
    useEffect(() => {
        if (!joyconRef.current) {
            joyconRef.current = new JoyConWebHID();
            joyconRef.current.onIRFrame = (frame: IRClusterFrame) => {
                setIrFrame(frame);
            };
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
                // テストとしてIRカメラの初期化コマンドも送信してみる
                await joyconRef.current.enableIRCamera();
            } else {
                setStatus("DISCONNECTED");
            }
        } catch (e) {
            console.error(e);
            setStatus("ERROR");
        }
    }, []);

    const disconnect = useCallback(async () => {
        if (!joyconRef.current) return;
        await joyconRef.current.disconnect();
        setStatus("DISCONNECTED");
    }, []);

    return {
        status,
        irFrame,
        joyconState,
        connect,
        disconnect,
    };
}
