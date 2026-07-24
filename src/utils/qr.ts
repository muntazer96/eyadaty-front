import * as QRCode from 'qrcode'

export function qrSvgDataUrl(text: string, scale = 6) {
  if (!text.trim()) return ''

  const qr = QRCode.create(text, {
    errorCorrectionLevel: 'M',
    margin: 4,
  })

  const quietZone = 4
  const moduleSize = scale
  const size = qr.modules.size
  const renderedSize = (size + quietZone * 2) * moduleSize
  const rects: string[] = []

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (qr.modules.data[row * size + col]) {
        rects.push(
          `<rect x="${(col + quietZone) * moduleSize}" y="${(row + quietZone) * moduleSize}" width="${moduleSize}" height="${moduleSize}"/>`,
        )
      }
    }
  }

  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${renderedSize} ${renderedSize}" shape-rendering="crispEdges">`,
    `<path fill="#fff" d="M0 0h${renderedSize}v${renderedSize}H0z"/>`,
    `<g fill="#000">${rects.join('')}</g>`,
    '</svg>',
  ].join('')

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
