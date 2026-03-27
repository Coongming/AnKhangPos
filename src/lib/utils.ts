// Utility functions

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND',
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('vi-VN').format(num);
}

export function formatDate(date: Date | string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date));
}

export function formatDateTime(date: Date | string): string {
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date));
}

// Generate auto-increment code: SP001, NCC001, KH001, PN001, HD001
export function generateCode(prefix: string, lastCode: string | null): string {
  if (!lastCode) return `${prefix}001`;
  const num = parseInt(lastCode.replace(prefix, ''), 10);
  return `${prefix}${String(num + 1).padStart(3, '0')}`;
}

// Calculate weighted average cost
export function calculateWeightedAvgCost(
  currentStock: number,
  currentCost: number,
  newQuantity: number,
  newPrice: number
): number {
  if (currentStock + newQuantity === 0) return 0;
  return (
    (currentStock * currentCost + newQuantity * newPrice) /
    (currentStock + newQuantity)
  );
}
