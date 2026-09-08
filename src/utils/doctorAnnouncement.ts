import { mdiPhone, mdiMapMarker, mdiHeartPulse } from '@mdi/js'

export interface AnnouncementData {
  title: string
  name: string
  specialty: string
  phone: string
  address: string
  link: string
}

// Preview and download share one canvas so the exported layout is identical.
export function drawAnnouncement(canvas: HTMLCanvasElement, data: AnnouncementData, logo: HTMLImageElement) {
  canvas.width = canvas.height = 2160
  const ctx = canvas.getContext('2d')!
  ctx.scale(2, 2)
  const navy = '#163e54', teal = '#236783'
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
  function text(value: string, x: number, y: number, width: number, height: number, size: number, color = navy, weight = 700, direction: CanvasDirection = 'rtl') {
    ctx.direction = direction; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = color
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
    ctx.save(); ctx.translate(card.x + 131, 664); ctx.scale(1.5, 1.5); ctx.fillStyle = '#fff'; ctx.fill(new Path2D(card.icon)); ctx.restore()
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
