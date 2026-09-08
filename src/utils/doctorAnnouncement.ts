import { mdiPhone, mdiMapMarker, mdiHeartPulse } from '@mdi/js'

export interface AnnouncementData {
  title: string
  name: string
  specialty: string
  phone: string
  address: string
  link: string
}

export type AnnouncementFormat = 'square' | 'reel'

// Preview and download share one canvas so the exported layout is identical.
export function drawAnnouncement(canvas: HTMLCanvasElement, data: AnnouncementData, logo: HTMLImageElement, format: AnnouncementFormat = 'square') {
  canvas.width = 2160
  canvas.height = format === 'reel' ? 3840 : 2160
  const ctx = canvas.getContext('2d')!
  ctx.scale(2, 2)
  const navy = '#163e54', teal = '#236783'
  const text = (value: string, x: number, y: number, width: number, height: number, size: number, color = navy, weight = 700, direction: CanvasDirection = 'rtl', align: CanvasTextAlign = 'center') => {
    ctx.direction = direction; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillStyle = color
    let lines: string[] = []
    // Wrap explicit newlines, ordinary words and unusually long unbroken input.
    for (; size >= 1; size--) {
      ctx.font = `${weight} ${size}px Tajawal, Arial, sans-serif`
      lines = []
      for (const paragraph of (value.trim() || '—').split('\n').filter(line => line.trim())) {
        let line = ''
        for (const word of paragraph.split(/\s+/)) {
          if (ctx.measureText(line ? `${line} ${word}` : word).width <= width) { line = line ? `${line} ${word}` : word; continue }
          if (line) lines.push(line)
          line = ''
          for (const character of word) {
            if (ctx.measureText(line + character).width > width) { lines.push(line); line = '' }
            line += character
          }
        }
        lines.push(line)
      }
      if (lines.length * size * 1.3 <= height) break
    }
    lines.forEach((line, i) => ctx.fillText(line, x, y + (i - (lines.length - 1) / 2) * size * 1.3))
  }
  const drawIcon = (path: string, x: number, y: number, scale = 1.5) => {
    ctx.save(); ctx.translate(x, y); ctx.scale(scale, scale); ctx.fillStyle = '#fff'; ctx.fill(new Path2D(path)); ctx.restore()
  }
  if (format === 'reel') {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, 1080, 1920)
    for (const [x, y, rx, ry] of [[-85, -70, 420, 355], [1160, 2010, 430, 380], [1010, 245, 190, 160], [85, 1680, 165, 135]]) {
      ctx.fillStyle = '#edf4f8'
      ctx.beginPath(); ctx.ellipse(x!, y!, rx!, ry!, -.5, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = '#dae9f1'
      ctx.beginPath(); ctx.ellipse(x!, y!, rx! * .72, ry! * .76, -.5, 0, Math.PI * 2); ctx.fill()
    }
    ctx.fillStyle = '#cad9e1'
    for (let row = 0; row < 8; row++) for (let col = 0; col < 7; col++) {
      for (const [x, y] of [[898, 90], [78, 1588]]) {
        ctx.beginPath(); ctx.arc(x! + col * 18, y! + row * 18, 2, 0, Math.PI * 2); ctx.fill()
      }
    }
    ctx.strokeStyle = teal; ctx.lineWidth = 8; ctx.strokeRect(4, 4, 1072, 1912)
    ctx.drawImage(logo, 456, 62, 168, 168)
    text('عيادتي', 540, 270, 420, 70, 66, navy, 800)
    text('دليلك لعيادة أقرب إليك', 540, 323, 650, 34, 26, navy, 500)
    text(data.title === 'الدكتورة' ? 'طبيبة جديدة انضمت' : 'طبيب جديد انضم', 540, 430, 850, 86, 70, '#121827', 800)
    text('إلى تطبيق عيادتي', 540, 526, 850, 88, 74, teal, 800)
    ctx.strokeStyle = '#8ca5b2'; ctx.lineWidth = 1.5
    ctx.beginPath(); ctx.moveTo(228, 607); ctx.lineTo(510, 607); ctx.moveTo(570, 607); ctx.lineTo(852, 607); ctx.stroke()
    ctx.fillStyle = teal; ctx.beginPath(); ctx.arc(540, 607, 8, 0, Math.PI * 2); ctx.fill()
    text('نرحب بانضمام', 540, 675, 650, 45, 33, teal)
    text(`${data.title} ${data.name.trim() || 'اسم الطبيب'}`, 540, 785, 900, 140, 76, '#192337', 800)
    text(data.specialty || 'الاختصاص', 540, 895, 870, 72, 42, teal)

    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = navy; ctx.lineWidth = 2
    ctx.beginPath(); ctx.roundRect(92, 995, 896, 550, 30); ctx.fill(); ctx.stroke()
    const rows = [
      { y: 1088, label: 'رقم الحجز والاستفسار', value: data.phone, direction: 'ltr' as const, valueSize: 42 },
      { y: 1269, label: 'عنوان العيادة', value: data.address, direction: 'rtl' as const, valueSize: 33 },
      { y: 1450, label: 'الاختصاص', value: data.specialty, direction: 'rtl' as const, valueSize: 35 },
    ]
    for (const row of rows) {
      text(row.label, 540, row.y - 36, 780, 32, 25, navy, 800)
      text(row.value, 540, row.y + 29, 790, 96, row.valueSize, '#51483c', 700, row.direction)
      if (row.y !== 1450) {
        ctx.strokeStyle = '#d7e4eb'; ctx.lineWidth = 1.5
        ctx.beginPath(); ctx.moveTo(148, row.y + 91); ctx.lineTo(932, row.y + 91); ctx.stroke()
      }
    }
    text(`تكدر تشوف معلومات ${data.title} وتحجز إلكترونياً من خلال تطبيق عيادتي`, 540, 1632, 850, 56, 32, '#192337', 500)
    text('أو مباشرة من خلال الرابط:', 540, 1693, 800, 36, 27, '#192337', 500)
    ctx.strokeStyle = navy; ctx.lineWidth = 1.8
    ctx.beginPath(); ctx.roundRect(142, 1732, 796, 64, 17); ctx.stroke()
    text(data.link || 'رابط الحجز الإلكتروني', 540, 1765, 750, 44, 29, teal, 700, 'ltr')
    text('حمّل تطبيق عيادتي الآن  •  Google Play', 540, 1852, 820, 40, 28)
    return
  }
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, 1080, 1080)
  for (const [x, y] of [[-70, -100], [1150, 1190]]) {
    ctx.fillStyle = '#edf4f8'
    ctx.beginPath(); ctx.ellipse(x!, y!, 360, 310, -.5, 0, Math.PI * 2); ctx.fill()
    ctx.fillStyle = '#dae9f1'
    ctx.beginPath(); ctx.ellipse(x!, y!, 260, 255, -.5, 0, Math.PI * 2); ctx.fill()
  }
  ctx.fillStyle = '#cad9e1'
  for (let row = 0; row < 6; row++) for (let col = 0; col < 6; col++) {
    for (const [x, y] of [[918, 65], [40, 880]]) {
      ctx.beginPath(); ctx.arc(x! + col * 18, y! + row * 18, 2, 0, Math.PI * 2); ctx.fill()
    }
  }
  ctx.strokeStyle = teal; ctx.lineWidth = 8; ctx.strokeRect(4, 4, 1072, 1072)
  ctx.drawImage(logo, 466, 22, 148, 148)
  text('عيادتي', 540, 196, 400, 65, 60, navy, 800)
  text('دليلك لعيادة أقرب إليك', 540, 242, 600, 32, 24, navy, 500)
  text(data.title === 'الدكتورة' ? 'طبيبة جديدة انضمت' : 'طبيب جديد انضم', 540, 315, 870, 70, 59, '#121827', 800)
  text('إلى تطبيق عيادتي', 540, 389, 870, 70, 64, teal, 800)
  ctx.strokeStyle = '#8ca5b2'; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.moveTo(285, 441); ctx.lineTo(521, 441); ctx.moveTo(559, 441); ctx.lineTo(795, 441); ctx.stroke()
  ctx.fillStyle = teal; ctx.beginPath(); ctx.arc(540, 441, 6, 0, Math.PI * 2); ctx.fill()
  text('نرحب بانضمام', 540, 475, 650, 40, 29, teal)
  text(`${data.title} ${data.name.trim() || 'اسم الطبيب'}`, 540, 535, 900, 85, 62, '#192337', 800)
  text(data.specialty || 'الاختصاص', 540, 600, 890, 45, 33, teal)
  const cards = [
    { x: 76, label: 'رقم الحجز والاستفسار', value: data.phone, icon: mdiPhone, direction: 'ltr' as const },
    { x: 391, label: 'عنوان العيادة', value: data.address, icon: mdiMapMarker, direction: 'rtl' as const },
    { x: 706, label: 'الاختصاص', value: data.specialty, icon: mdiHeartPulse, direction: 'rtl' as const },
  ]
  for (const card of cards) {
    ctx.fillStyle = '#ffffff'; ctx.strokeStyle = navy; ctx.lineWidth = 2
    ctx.beginPath(); ctx.roundRect(card.x, 642, 298, 217, 23); ctx.fill(); ctx.stroke()
    ctx.fillStyle = teal; ctx.beginPath(); ctx.arc(card.x + 149, 682, 29, 0, Math.PI * 2); ctx.fill()
    drawIcon(card.icon, card.x + 131, 664)
    text(card.label, card.x + 149, 730, 278, 30, 23)
    text(card.value, card.x + 149, 797, 268, 94, card.direction === 'ltr' ? 33 : 29, '#51483c', 700, card.direction)
  }
  text(`تكدر تشوف معلومات ${data.title} وتحجز إلكترونياً من خلال تطبيق عيادتي`, 540, 901, 900, 33, 25, '#192337', 500)
  text('أو مباشرة من خلال الرابط:', 540, 934, 800, 30, 23, '#192337', 500)
  ctx.strokeStyle = navy; ctx.lineWidth = 1.5
  ctx.beginPath(); ctx.roundRect(172, 957, 736, 47, 13); ctx.stroke()
  text(data.link || 'رابط الحجز الإلكتروني', 540, 982, 702, 35, 26, teal, 700, 'ltr')
  text('حمّل تطبيق عيادتي الآن  •  Google Play', 540, 1037, 800, 34, 24)
}
