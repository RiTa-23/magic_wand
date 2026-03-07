import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getTapoClient } from "@/features/iot/api/tapoClient";
import * as tapoConnect from "tp-link-tapo-connect";

// tp-link-tapo-connectをモック化
vi.mock("tp-link-tapo-connect", () => ({
  loginDeviceByIp: vi.fn(),
}));

describe("Tapo Client Tests", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // 環境変数をリセット
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    // 環境変数を復元
    process.env = originalEnv;
  });

  describe("getTapoClient", () => {
    it("正しい環境変数が設定されている場合、デバイスに接続できる", async () => {
      // 環境変数を設定
      process.env.TAPO_EMAIL = "test@example.com";
      process.env.TAPO_PASSWORD = "test-password";
      process.env.TAPO_P300_IP = "192.168.1.100";

      const mockDevice = {
        turnOn: vi.fn(),
        turnOff: vi.fn(),
        getDeviceInfo: vi.fn(),
      };

      vi.mocked(tapoConnect.loginDeviceByIp).mockResolvedValueOnce(
        mockDevice as any,
      );

      const device = await getTapoClient();

      expect(device).toBe(mockDevice);
      expect(tapoConnect.loginDeviceByIp).toHaveBeenCalledWith(
        "test@example.com",
        "test-password",
        "192.168.1.100",
      );
      expect(tapoConnect.loginDeviceByIp).toHaveBeenCalledTimes(1);
    });

    it("TAPO_EMAILが未設定の場合、エラーをスローする", async () => {
      process.env.TAPO_EMAIL = undefined;
      process.env.TAPO_PASSWORD = "test-password";
      process.env.TAPO_P300_IP = "192.168.1.100";

      await expect(getTapoClient()).rejects.toThrow(
        "環境変数が足りません。.env.localを確認してください。",
      );
    });

    it("TAPO_PASSWORDが未設定の場合、エラーをスローする", async () => {
      process.env.TAPO_EMAIL = "test@example.com";
      process.env.TAPO_PASSWORD = undefined;
      process.env.TAPO_P300_IP = "192.168.1.100";

      await expect(getTapoClient()).rejects.toThrow(
        "環境変数が足りません。.env.localを確認してください。",
      );
    });

    it("TAPO_P300_IPが未設定の場合、エラーをスローする", async () => {
      process.env.TAPO_EMAIL = "test@example.com";
      process.env.TAPO_PASSWORD = "test-password";
      process.env.TAPO_P300_IP = undefined;

      await expect(getTapoClient()).rejects.toThrow(
        "環境変数が足りません。.env.localを確認してください。",
      );
    });

    it("すべての環境変数が未設定の場合、エラーをスローする", async () => {
      process.env.TAPO_EMAIL = undefined;
      process.env.TAPO_PASSWORD = undefined;
      process.env.TAPO_P300_IP = undefined;

      await expect(getTapoClient()).rejects.toThrow(
        "環境変数が足りません。.env.localを確認してください。",
      );
    });

    it("空文字列の環境変数もエラーとして扱う", async () => {
      process.env.TAPO_EMAIL = "";
      process.env.TAPO_PASSWORD = "test-password";
      process.env.TAPO_P300_IP = "192.168.1.100";

      await expect(getTapoClient()).rejects.toThrow(
        "環境変数が足りません。.env.localを確認してください。",
      );
    });

    it("loginDeviceByIpが失敗した場合、エラーを伝播する", async () => {
      process.env.TAPO_EMAIL = "test@example.com";
      process.env.TAPO_PASSWORD = "test-password";
      process.env.TAPO_P300_IP = "192.168.1.100";

      vi.mocked(tapoConnect.loginDeviceByIp).mockRejectedValueOnce(
        new Error("接続に失敗しました"),
      );

      await expect(getTapoClient()).rejects.toThrow("接続に失敗しました");
    });

    it("返されたデバイスオブジェクトは正しい型を持つ", async () => {
      process.env.TAPO_EMAIL = "test@example.com";
      process.env.TAPO_PASSWORD = "test-password";
      process.env.TAPO_P300_IP = "192.168.1.100";

      const mockDevice = {
        turnOn: vi.fn(),
        turnOff: vi.fn(),
        getDeviceInfo: vi.fn(),
        getChildDevicesInfo: vi.fn(),
        setBrightness: vi.fn(),
        setColour: vi.fn(),
        setHSL: vi.fn(),
        getEnergyUsage: vi.fn(),
        getHubDevices: vi.fn(),
        playAlarm: vi.fn(),
        stopAlarm: vi.fn(),
        getEventLogs: vi.fn(),
        getAlarmTones: vi.fn(),
      };

      vi.mocked(tapoConnect.loginDeviceByIp).mockResolvedValueOnce(
        mockDevice as any,
      );

      const device = await getTapoClient();

      // 必要なメソッドが存在するか確認
      expect(device).toHaveProperty("turnOn");
      expect(device).toHaveProperty("turnOff");
      expect(device).toHaveProperty("getDeviceInfo");
      expect(device).toHaveProperty("getChildDevicesInfo");
    });
  });
});
