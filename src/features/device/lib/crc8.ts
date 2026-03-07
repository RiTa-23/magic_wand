/**
 * Joy-Con (R) との通信パケットで必要な CRC-8 CCITT の計算を行います。
 *
 * 参考: https://github.com/CTCaer/Nintendo_Switch_Reverse_Engineering/blob/ir-nfc/mcu_ir_nfc_notes.md
 */

const CRC8_TABLE = new Uint8Array(256);

// CRC-8-CCITT (Poly: 0x07, Init: 0x00, RefIn: false, RefOut: false, XorOut: 0x00)
// の計算用テーブルを事前生成
for (let i = 0; i < 256; i++) {
  let crc = i;
  for (let j = 0; j < 8; j++) {
    if ((crc & 0x80) !== 0) {
      crc = (crc << 1) ^ 0x07; // 0x07 is the polynomial for CRC-8-CCITT in SW
    } else {
      crc <<= 1;
    }
  }
  CRC8_TABLE[i] = crc & 0xff;
}

/**
 * 与えられたUint8Arrayの指定範囲に対するCRC-8 CCITTを計算します。
 * @param data バイト配列
 * @param offset 計算開始位置
 * @param length 計算する長さ
 * @returns 算出された CRC-8 値 (0-255)
 */
export function calculateCRC8CCITT(
  data: Uint8Array,
  offset: number,
  length: number,
): number {
  let crc = 0x00; // init
  for (let i = 0; i < length; i++) {
    const byte = data[offset + i];
    crc = CRC8_TABLE[(crc ^ byte) & 0xff];
  }
  return crc;
}
