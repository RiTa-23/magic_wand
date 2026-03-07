import tapo from "tp-link-tapo-connect";

export async function getTapoClient() {
  const email = process.env.TAPO_EMAIL;
  const password = process.env.TAPO_PASSWORD;
  const ip = process.env.TAPO_P300_IP;

  if (!email || !password || !ip) {
    throw new Error("環境変数が足りません。.env.localを確認してください。");
  }

  const device = await tapo.loginDeviceByIp(email, password, ip);
  return device;
}
