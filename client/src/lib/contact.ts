// Single source of truth for contact details shown across the app.
export const WHATSAPP_NUMBER = '573136380121';
export const PHONE_DISPLAY = '(+57) 313 6380121';
export const CONTACT_EMAIL = 'info@easycomex.com';

export function whatsappUrl(message?: string) {
  const base = `https://wa.me/${WHATSAPP_NUMBER}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
