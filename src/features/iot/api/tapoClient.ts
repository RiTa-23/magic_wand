import { loginDeviceByIp } from "tp-link-tapo-connect";

const IS_TEST_ENV = process.env.NODE_ENV === "test";

let cachedClient: Awaited<ReturnType<typeof loginDeviceByIp>> | null = null;
let cachedClientKey: string | null = null;

export function resetTapoClientCache() {
  cachedClient = null;
  cachedClientKey = null;
}

export async function getTapoClient(): Promise<
  Awaited<ReturnType<typeof loginDeviceByIp>>
> {
  const email = process.env.TAPO_EMAIL;
  const password = process.env.TAPO_PASSWORD;
  const ip = process.env.TAPO_P300_IP;

  if (!email || !password || !ip) {
    throw new Error("環境変数が足りません。.env.localを確認してください。");
  }

  const clientKey = `${email}|${ip}`;
  if (!IS_TEST_ENV && cachedClient && cachedClientKey === clientKey) {
    return cachedClient;
  }

  const device = await loginDeviceByIp(email, password, ip);

  if (!IS_TEST_ENV) {
    cachedClient = device;
    cachedClientKey = clientKey;
  }

  return device;
}
