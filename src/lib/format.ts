export function formatNumber(n: number): string {
  return new Intl.NumberFormat('ar-EG', { maximumFractionDigits: 0 }).format(n);
}

export function formatCurrency(n: number): string {
  return `${formatNumber(n)} ر.ي`;
}

export function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ar', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatDateShort(iso: string): string {
  try {
    return new Intl.DateTimeFormat('ar', { dateStyle: 'short' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `قبل ${formatNumber(mins)} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `قبل ${formatNumber(hours)} ساعة`;
  const days = Math.floor(hours / 24);
  return `قبل ${formatNumber(days)} يوم`;
}
