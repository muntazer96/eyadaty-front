export interface ExternalLinkTypeConfig {
  value: number
  label: string
  icon: string
  inputLabel: string
  placeholder: string
  hint: string
  color: string
}

export const EXTERNAL_LINK_TYPES: ExternalLinkTypeConfig[] = [
  {
    value: 1,
    label: 'Instagram',
    icon: 'mdi-instagram',
    inputLabel: 'رابط Instagram',
    placeholder: 'https://instagram.com/username',
    hint: 'رابط حساب الانستغرام أو اسم المستخدم',
    color: '#E4405F',
  },
  {
    value: 2,
    label: 'Facebook',
    icon: 'mdi-facebook',
    inputLabel: 'رابط Facebook',
    placeholder: 'https://facebook.com/username',
    hint: 'رابط صفحة الفيسبوك',
    color: '#1877F2',
  },
  {
    value: 3,
    label: 'TikTok',
    icon: 'mdi-music-note-sixteenth-dotted',
    inputLabel: 'رابط TikTok',
    placeholder: 'https://tiktok.com/@username',
    hint: 'رابط حساب التيك توك أو اسم المستخدم',
    color: '#000000',
  },
  {
    value: 4,
    label: 'WhatsApp',
    icon: 'mdi-whatsapp',
    inputLabel: 'رقم WhatsApp',
    placeholder: '0770 123 4567',
    hint: 'رقم الهاتف العراقي لحساب واتساب',
    color: '#25D366',
  },
  {
    value: 5,
    label: 'الموقع الإلكتروني',
    icon: 'mdi-web',
    inputLabel: 'رابط الموقع',
    placeholder: 'https://example.com',
    hint: 'رابط الموقع الإلكتروني الشخصي أو العيادة',
    color: '#1976D2',
  },
  {
    value: 6,
    label: 'رابط مخصص',
    icon: 'mdi-link-variant',
    inputLabel: 'الرابط',
    placeholder: 'https://example.com',
    hint: 'رابط مخصص لحساب أو صفحة',
    color: '#7B1FA2',
  },
]

export function getLinkTypeConfig(type: number): ExternalLinkTypeConfig {
  return EXTERNAL_LINK_TYPES.find((t) => t.value === type) ?? EXTERNAL_LINK_TYPES[5]
}

export function getLinkTypeIcon(type: number): string {
  return getLinkTypeConfig(type).icon
}

export function getLinkTypeColor(type: number): string {
  return getLinkTypeConfig(type).color
}
