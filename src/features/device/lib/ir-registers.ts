/**
 * Joy-Con (R) IR Camera Register Initialization Values
 *
 * Values derived from the open-source joycon-sys library implementations:
 *
 * 1. Default Registers needed for basic image transfer:
 *    - Resolution: Page 0, Offset 0x2e => R160x120 is 0x50, R320x240 is 0x00
 *    - Exposure (LSB, MSB): Page 1, Offset 0x30, 0x31 (Default: Manual, ~200us)
 *    - Exposure Mode: Page 1, Offset 0x32 (0 for Manual)
 *    - Digital Gain (LSB, MSB): Page 1, Offset 0x2e, 0x2f
 *    - IR LEDs: Page 0, Offset 0x10 (0x10 for enabled?)
 *    - Denoiser: Page 1, Offset 0x67 (0x01 for enabled)
 *    - Finish Register: Page 0, Offset 0x07 (Must be set to 1 at the end of configs)
 *
 * 2. MCU Init Sequence:
 *    a) x03 0x31 (Input Report Mode -> Standard Full + MCU)
 *    b) x21 00 05 (Set MCU Mode -> IR)
 *    c) x23 01 07 ... (Set IR Mode -> IRSensorReset for config?) Wait wait,
 *       in `set_ir_wait_conf`: IR Mode = 0 (Reset), frags = 0.
 *    d) Write Registers (x23 04 ...):
 *       - Resolution Register
 *       - Exposure Registers
 *       - Finish Register (Page 0, Offset 7, Value 1)
 *    e) x23 01 07 ... (Set IR Mode -> Image Transfer (7)), frags = depends on resolution (0x3F for 160x120)
 *
 */
export const IrCameraRegisters = {
  RESOLUTION_160x120: {
    page: 0x00,
    offset: 0x2e,
    value: 0x50,
    maxFragment: 0x3f,
  },
  RESOLUTION_320x240: {
    page: 0x00,
    offset: 0x2e,
    value: 0x00,
    maxFragment: 0xff,
  },
  FINISH: { page: 0x00, offset: 0x07, value: 0x01 },
  // TODO: Add other default registers if the image is too dark or empty
};
