const DATA_CODEWORDS_L = [0, 19, 34, 55, 80, 108]
const EC_CODEWORDS_L = [0, 7, 10, 15, 20, 26]
const ALIGNMENT_POSITIONS: Record<number, number[]> = {
  1: [],
  2: [6, 18],
  3: [6, 22],
  4: [6, 26],
  5: [6, 30],
}

export function qrSvgDataUrl(text: string, scale = 5) {
  const bytes = Array.from(new TextEncoder().encode(text))
  const version = DATA_CODEWORDS_L.findIndex((capacity, index) => index > 0 && bytes.length <= capacity - 2)
  if (version <= 0) return ''

  const size = 17 + version * 4
  const modules = Array.from({ length: size }, () => Array<boolean | null>(size).fill(null))
  const reserved = Array.from({ length: size }, () => Array<boolean>(size).fill(false))

  function set(row: number, col: number, value: boolean, isReserved = true) {
    if (row < 0 || col < 0 || row >= size || col >= size) return
    modules[row][col] = value
    if (isReserved) reserved[row][col] = true
  }

  function finder(row: number, col: number) {
    for (let y = -1; y <= 7; y += 1) {
      for (let x = -1; x <= 7; x += 1) {
        const r = row + y
        const c = col + x
        const isOuter = x >= 0 && x <= 6 && y >= 0 && y <= 6 && (x === 0 || x === 6 || y === 0 || y === 6)
        const isInner = x >= 2 && x <= 4 && y >= 2 && y <= 4
        set(r, c, isOuter || isInner)
      }
    }
  }

  finder(0, 0)
  finder(0, size - 7)
  finder(size - 7, 0)

  for (let i = 8; i < size - 8; i += 1) {
    set(6, i, i % 2 === 0)
    set(i, 6, i % 2 === 0)
  }

  for (const row of ALIGNMENT_POSITIONS[version]) {
    for (const col of ALIGNMENT_POSITIONS[version]) {
      if (reserved[row][col]) continue
      for (let y = -2; y <= 2; y += 1) {
        for (let x = -2; x <= 2; x += 1) {
          set(row + y, col + x, Math.max(Math.abs(x), Math.abs(y)) !== 1)
        }
      }
    }
  }

  set(4 * version + 9, 8, true)
  reserveFormatAreas(size, reserved)

  const data = buildData(bytes, version)
  const ec = reedSolomonRemainder(data, EC_CODEWORDS_L[version])
  const bits = [...data, ...ec].flatMap((codeword) =>
    Array.from({ length: 8 }, (_, index) => ((codeword >>> (7 - index)) & 1) === 1),
  )

  placeData(modules, reserved, bits)
  applyMask(modules, reserved)
  placeFormatBits(modules, 1, 0)

  const quiet = 4
  const renderedSize = (size + quiet * 2) * scale
  const rects: string[] = []
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (modules[row][col]) {
        rects.push(`<rect x="${(col + quiet) * scale}" y="${(row + quiet) * scale}" width="${scale}" height="${scale}"/>`)
      }
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${renderedSize} ${renderedSize}" shape-rendering="crispEdges"><path fill="#fff" d="M0 0h${renderedSize}v${renderedSize}H0z"/><g fill="#102421">${rects.join('')}</g></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function reserveFormatAreas(size: number, reserved: boolean[][]) {
  for (let i = 0; i < 9; i += 1) {
    reserved[8][i] = true
    reserved[i][8] = true
    reserved[8][size - 1 - i] = true
    reserved[size - 1 - i][8] = true
  }
}

function buildData(bytes: number[], version: number) {
  const bitLength = DATA_CODEWORDS_L[version] * 8
  const bits = [false, true, false, false]
  pushBits(bits, bytes.length, 8)
  for (const byte of bytes) pushBits(bits, byte, 8)
  pushBits(bits, 0, Math.min(4, bitLength - bits.length))
  while (bits.length % 8) bits.push(false)

  const data: number[] = []
  for (let index = 0; index < bits.length; index += 8) {
    data.push(bits.slice(index, index + 8).reduce((value, bit) => (value << 1) | Number(bit), 0))
  }

  for (let pad = 0; data.length < DATA_CODEWORDS_L[version]; pad += 1) {
    data.push(pad % 2 === 0 ? 0xec : 0x11)
  }
  return data
}

function pushBits(bits: boolean[], value: number, count: number) {
  for (let i = count - 1; i >= 0; i -= 1) bits.push(((value >>> i) & 1) === 1)
}

function reedSolomonRemainder(data: number[], degree: number) {
  const generator = reedSolomonGenerator(degree)
  const result = Array(degree).fill(0)
  for (const byte of data) {
    const factor = byte ^ result.shift()
    result.push(0)
    for (let i = 0; i < degree; i += 1) result[i] ^= gfMultiply(generator[i], factor)
  }
  return result
}

function reedSolomonGenerator(degree: number) {
  let result = [1]
  for (let i = 0; i < degree; i += 1) {
    const next = Array(result.length + 1).fill(0)
    for (let j = 0; j < result.length; j += 1) {
      next[j] ^= gfMultiply(result[j], 1)
      next[j + 1] ^= gfMultiply(result[j], gfPow(2, i))
    }
    result = next
  }
  return result.slice(1)
}

function gfMultiply(x: number, y: number) {
  let result = 0
  for (; y > 0; y >>>= 1) {
    if (y & 1) result ^= x
    x = (x << 1) ^ (x & 0x80 ? 0x11d : 0)
  }
  return result & 0xff
}

function gfPow(x: number, power: number) {
  let result = 1
  for (let i = 0; i < power; i += 1) result = gfMultiply(result, x)
  return result
}

function placeData(modules: (boolean | null)[][], reserved: boolean[][], bits: boolean[]) {
  const size = modules.length
  let bitIndex = 0
  let upward = true
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right -= 1
    for (let vert = 0; vert < size; vert += 1) {
      const row = upward ? size - 1 - vert : vert
      for (let j = 0; j < 2; j += 1) {
        const col = right - j
        if (!reserved[row][col]) modules[row][col] = bits[bitIndex++] ?? false
      }
    }
    upward = !upward
  }
}

function applyMask(modules: (boolean | null)[][], reserved: boolean[][]) {
  for (let row = 0; row < modules.length; row += 1) {
    for (let col = 0; col < modules.length; col += 1) {
      if (!reserved[row][col] && (row + col) % 2 === 0) modules[row][col] = !modules[row][col]
    }
  }
}

function placeFormatBits(modules: (boolean | null)[][], eccLevel: number, mask: number) {
  const size = modules.length
  let data = (eccLevel << 3) | mask
  let bits = data << 10
  for (let i = 14; i >= 10; i -= 1) {
    if ((bits >>> i) & 1) bits ^= 0x537 << (i - 10)
  }
  data = ((data << 10) | bits) ^ 0x5412

  const positionsA = [[8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8], [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]]
  const positionsB = [[size - 1, 8], [size - 2, 8], [size - 3, 8], [size - 4, 8], [size - 5, 8], [size - 6, 8], [size - 7, 8], [8, size - 8], [8, size - 7], [8, size - 6], [8, size - 5], [8, size - 4], [8, size - 3], [8, size - 2], [8, size - 1]]
  for (let i = 0; i < 15; i += 1) {
    const bit = ((data >>> i) & 1) === 1
    modules[positionsA[i][0]][positionsA[i][1]] = bit
    modules[positionsB[i][0]][positionsB[i][1]] = bit
  }
}
