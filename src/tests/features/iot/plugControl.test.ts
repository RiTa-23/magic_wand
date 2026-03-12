import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  castVentus,
  castVentusOff,
  castLumos,
  castLumosOff,
  castIncendio,
  castIncendioOff,
  castAguamenti,
  castAguamentiOff,
  castMaxima,
  castNox,
  getDeviceStatus,
} from "@/features/iot/lib/plugControl";
import * as tapoClient from "@/features/iot/api/tapoClient";

// getTapoClientをモック化
vi.mock("@/features/iot/api/tapoClient", () => ({
  getTapoClient: vi.fn(),
}));

describe("IoT Plug Control Tests", () => {
  // モックのTapoデバイス
  const mockTapoDevice = {
    turnOn: vi.fn().mockResolvedValue(undefined),
    turnOff: vi.fn().mockResolvedValue(undefined),
    getDeviceInfo: vi.fn().mockResolvedValue({
      device_id: "mock-device-id",
      nickname: "Mock P300",
      model: "P300",
      device_on: true,
      ip: "192.168.1.100",
      mac: "AA:BB:CC:DD:EE:FF",
      fw_ver: "1.0.0",
      signal_level: 3,
    }),
    getChildDevicesInfo: vi.fn().mockResolvedValue([
      {
        device_id: "child-0",
        nickname: "Port 0 - Wind",
        device_on: false,
        on_time: 0,
      },
      {
        device_id: "child-1",
        nickname: "Port 1 - Light",
        device_on: false,
        on_time: 0,
      },
      {
        device_id: "child-2",
        nickname: "Port 2 - Fire",
        device_on: false,
        on_time: 0,
      },
      {
        device_id: "child-3",
        nickname: "Port 3 - Water",
        device_on: false,
        on_time: 0,
      },
    ]),
  };

  beforeEach(() => {
    // 各テストの前にモックをリセット
    vi.clearAllMocks();
    vi.mocked(tapoClient.getTapoClient).mockResolvedValue(
      mockTapoDevice as any,
    );
  });

  describe("個別ポート制御（ON）", () => {
    it("castVentus: ポート0（風）をONにできる", async () => {
      const result = await castVentus();

      expect(result.success).toBe(true);
      expect(result.message).toContain("ヴェンタス成功");
      expect(mockTapoDevice.turnOn).toHaveBeenCalledWith("child-0");
      expect(mockTapoDevice.turnOn).toHaveBeenCalledTimes(1);
    });

    it("castLumos: ポート1（光）をONにできる", async () => {
      const result = await castLumos();

      expect(result.success).toBe(true);
      expect(result.message).toContain("ルーモス成功");
      expect(mockTapoDevice.turnOn).toHaveBeenCalledWith("child-1");
    });

    it("castIncendio: ポート2（炎）をONにできる", async () => {
      const result = await castIncendio();

      expect(result.success).toBe(true);
      expect(result.message).toContain("インセンディオ成功");
      expect(mockTapoDevice.turnOn).toHaveBeenCalledWith("child-2");
    });

    it("castAguamenti: ポート3（水）をONにできる", async () => {
      const result = await castAguamenti();

      expect(result.success).toBe(true);
      expect(result.message).toContain("アグアメンティ成功");
      expect(mockTapoDevice.turnOn).toHaveBeenCalledWith("child-3");
    });
  });

  describe("個別ポート制御（OFF）", () => {
    it("castVentusOff: ポート0（風）をOFFにできる", async () => {
      const result = await castVentusOff();

      expect(result.success).toBe(true);
      expect(result.message).toContain("ヴェンタス解除成功");
      expect(mockTapoDevice.turnOff).toHaveBeenCalledWith("child-0");
      expect(mockTapoDevice.turnOff).toHaveBeenCalledTimes(1);
    });

    it("castLumosOff: ポート1（光）をOFFにできる", async () => {
      const result = await castLumosOff();

      expect(result.success).toBe(true);
      expect(result.message).toContain("ルーモス解除成功");
      expect(mockTapoDevice.turnOff).toHaveBeenCalledWith("child-1");
    });

    it("castIncendioOff: ポート2（炎）をOFFにできる", async () => {
      const result = await castIncendioOff();

      expect(result.success).toBe(true);
      expect(result.message).toContain("インセンディオ解除成功");
      expect(mockTapoDevice.turnOff).toHaveBeenCalledWith("child-2");
    });

    it("castAguamentiOff: ポート3（水）をOFFにできる", async () => {
      const result = await castAguamentiOff();

      expect(result.success).toBe(true);
      expect(result.message).toContain("アグアメンティ解除成功");
      expect(mockTapoDevice.turnOff).toHaveBeenCalledWith("child-3");
    });
  });

  describe("全ポート制御", () => {
    it("castMaxima: すべてのポートをONにできる", async () => {
      const result = await castMaxima();

      expect(result.success).toBe(true);
      expect(result.message).toContain("マキシマ成功");
      expect(result.message).toContain("4個のポート");
      expect(mockTapoDevice.turnOn).toHaveBeenCalledTimes(4);
      expect(mockTapoDevice.turnOn).toHaveBeenNthCalledWith(1, "child-0");
      expect(mockTapoDevice.turnOn).toHaveBeenNthCalledWith(2, "child-1");
      expect(mockTapoDevice.turnOn).toHaveBeenNthCalledWith(3, "child-2");
      expect(mockTapoDevice.turnOn).toHaveBeenNthCalledWith(4, "child-3");
    });

    it("castNox: すべてのポートをOFFにできる", async () => {
      const result = await castNox();

      expect(result.success).toBe(true);
      expect(result.message).toContain("ノックス成功");
      expect(result.message).toContain("4個のポート");
      expect(mockTapoDevice.turnOff).toHaveBeenCalledTimes(4);
      expect(mockTapoDevice.turnOff).toHaveBeenNthCalledWith(1, "child-0");
      expect(mockTapoDevice.turnOff).toHaveBeenNthCalledWith(2, "child-1");
      expect(mockTapoDevice.turnOff).toHaveBeenNthCalledWith(3, "child-2");
      expect(mockTapoDevice.turnOff).toHaveBeenNthCalledWith(4, "child-3");
    });
  });

  describe("デバイス情報取得", () => {
    it("getDeviceStatus: デバイス情報を正しく取得できる", async () => {
      const result = await getDeviceStatus();

      expect(result.success).toBe(true);
      expect(result.deviceInfo).toBeDefined();
      expect(result.childDevices).toBeDefined();
      expect(result.deviceInfo?.nickname).toBe("Mock P300");
      expect(result.childDevices).toHaveLength(4);
      expect(result.message).toContain("ポート数: 4");
    });

    it("getDeviceStatus: シリアライズ可能なオブジェクトを返す", async () => {
      const result = await getDeviceStatus();

      // JSON.stringifyでエラーが出ないことを確認
      expect(() => JSON.stringify(result)).not.toThrow();

      // 必要なフィールドが含まれていることを確認
      expect(result.deviceInfo).toHaveProperty("device_id");
      expect(result.deviceInfo).toHaveProperty("nickname");
      expect(result.deviceInfo).toHaveProperty("model");
      expect(result.deviceInfo).toHaveProperty("device_on");

      // 子デバイスも適切にシリアライズされているか確認
      result.childDevices?.forEach((child) => {
        expect(child).toHaveProperty("device_id");
        expect(child).toHaveProperty("nickname");
        expect(child).toHaveProperty("device_on");
      });
    });
  });

  describe("エラーハンドリング", () => {
    it("子デバイスが0個の場合、エラーを返す", async () => {
      mockTapoDevice.getChildDevicesInfo.mockResolvedValueOnce([]);

      const result = await castVentus();

      expect(result.success).toBe(false);
      expect(result.message).toContain("子デバイスが見つかりません");
    });

    it("存在しないポートへのアクセスでエラーを返す", async () => {
      // 2個だけの子デバイスを返す
      mockTapoDevice.getChildDevicesInfo.mockResolvedValueOnce([
        { device_id: "child-0", nickname: "Port 0", device_on: false },
        { device_id: "child-1", nickname: "Port 1", device_on: false },
      ]);

      // ポート3（インデックス3）にアクセスしようとする
      const result = await castAguamenti();

      expect(result.success).toBe(false);
      expect(result.message).toContain("ポート3が見つかりません");
    });

    it("getTapoClientが失敗した場合、エラーを返す", async () => {
      vi.mocked(tapoClient.getTapoClient).mockRejectedValueOnce(
        new Error("接続失敗"),
      );

      const result = await castVentus();

      expect(result.success).toBe(false);
      expect(result.message).toContain("失敗");
    });

    it("turnOnが失敗した場合、エラーを返す", async () => {
      mockTapoDevice.turnOn.mockRejectedValueOnce(new Error("ON失敗"));

      const result = await castVentus();

      expect(result.success).toBe(false);
      expect(result.message).toContain("失敗");
    });

    it("turnOffが失敗した場合、エラーを返す", async () => {
      mockTapoDevice.turnOff.mockRejectedValueOnce(new Error("OFF失敗"));

      const result = await castNox();

      expect(result.success).toBe(false);
      expect(result.message).toContain("失敗");
    });
  });

  describe("ポート番号の検証", () => {
    it("各魔法が正しいポート番号を制御している", async () => {
      // それぞれの魔法を実行して、正しいポートが制御されているか確認
      await castVentus();
      expect(mockTapoDevice.turnOn).toHaveBeenLastCalledWith("child-0");

      await castLumos();
      expect(mockTapoDevice.turnOn).toHaveBeenLastCalledWith("child-1");

      await castIncendio();
      expect(mockTapoDevice.turnOn).toHaveBeenLastCalledWith("child-2");

      await castAguamenti();
      expect(mockTapoDevice.turnOn).toHaveBeenLastCalledWith("child-3");
    });
  });
});
