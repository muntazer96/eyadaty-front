declare module 'qrcode' {
  export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H'

  export interface QRCodeCreateOptions {
    errorCorrectionLevel?: ErrorCorrectionLevel
    margin?: number
  }

  export interface QRCodeData {
    modules: {
      size: number
      data: Uint8Array | boolean[]
    }
  }

  export function create(text: string, options?: QRCodeCreateOptions): QRCodeData
}
