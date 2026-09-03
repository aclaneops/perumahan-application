export type OverdueLevel = 0 | 1 | 2 | 3 | 4

export interface OverdueInfo {
  level: OverdueLevel
  levelLabel: string
  badgeColorClass: string
  badgeBgClass: string
  textClass: string
  overdueMonthsCount: number
  totalOverdueAmount: number
  overduePeriods: {
    month: number
    year: number
    monthName: string
    amount: number
    status: string
    billId: string
  }[]
  currentMonthBillStatus: string | null
}

export const MONTH_NAMES = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

export function getLevelMetadata(level: OverdueLevel) {
  switch (level) {
    case 0:
      return {
        label: 'LEVEL 0 — LANCAR',
        badgeText: '🟢 LANCAR',
        badgeBgClass: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        textClass: 'text-emerald-600',
        dotColor: 'bg-emerald-500'
      }
    case 1:
      return {
        label: 'LEVEL 1 — TERLAMBAT',
        badgeText: '🟡 TERLAMBAT (1 BLN)',
        badgeBgClass: 'bg-yellow-100 text-yellow-800 border-yellow-200',
        textClass: 'text-yellow-600',
        dotColor: 'bg-yellow-500'
      }
    case 2:
      return {
        label: 'LEVEL 2 — PERHATIAN',
        badgeText: '🟠 PERHATIAN (2 BLN)',
        badgeBgClass: 'bg-orange-100 text-orange-800 border-orange-200',
        textClass: 'text-orange-600',
        dotColor: 'bg-orange-500'
      }
    case 3:
      return {
        label: 'LEVEL 3 — TUNGGAKAN',
        badgeText: '🔴 TUNGGAKAN (3 BLN)',
        badgeBgClass: 'bg-red-100 text-red-800 border-red-200',
        textClass: 'text-red-600',
        dotColor: 'bg-red-500'
      }
    case 4:
    default:
      return {
        label: 'LEVEL 4 — TUNGGAKAN BERAT',
        badgeText: '🔴 TUNGGAKAN BERAT (4+ BLN)',
        badgeBgClass: 'bg-rose-950 text-rose-200 border-rose-800',
        textClass: 'text-rose-600',
        dotColor: 'bg-rose-600'
      }
  }
}

export function calculateResidentDues(bills: any[], currentMonth: number, currentYear: number): OverdueInfo {
  if (!bills || bills.length === 0) {
    const meta = getLevelMetadata(0)
    return {
      level: 0,
      levelLabel: meta.label,
      badgeColorClass: meta.textClass,
      badgeBgClass: meta.badgeBgClass,
      textClass: meta.textClass,
      overdueMonthsCount: 0,
      totalOverdueAmount: 0,
      overduePeriods: [],
      currentMonthBillStatus: null
    }
  }

  // Filter bills that are NOT fully paid (UNPAID, PENDING_CONFIRMATION, PARTIAL)
  const unpaidBills = bills.filter(b => b.status !== 'PAID')

  // Find status for current month
  const currentBill = bills.find(b => b.period_month === currentMonth && b.period_year === currentYear)
  const currentMonthBillStatus = currentBill ? currentBill.status : null

  // Sort unpaid bills chronologically
  unpaidBills.sort((a, b) => {
    if (a.period_year !== b.period_year) return a.period_year - b.period_year
    return a.period_month - b.period_month
  })

  const overduePeriods = unpaidBills.map(b => ({
    month: b.period_month,
    year: b.period_year,
    monthName: MONTH_NAMES[b.period_month - 1] || `Bulan ${b.period_month}`,
    amount: Number(b.total_amount || 0),
    status: b.status,
    billId: b.id
  }))

  const overdueMonthsCount = overduePeriods.length
  const totalOverdueAmount = overduePeriods.reduce((sum, item) => sum + item.amount, 0)

  let level: OverdueLevel = 0
  if (overdueMonthsCount === 1) level = 1
  else if (overdueMonthsCount === 2) level = 2
  else if (overdueMonthsCount === 3) level = 3
  else if (overdueMonthsCount >= 4) level = 4

  const meta = getLevelMetadata(level)

  return {
    level,
    levelLabel: meta.label,
    badgeColorClass: meta.textClass,
    badgeBgClass: meta.badgeBgClass,
    textClass: meta.textClass,
    overdueMonthsCount,
    totalOverdueAmount,
    overduePeriods,
    currentMonthBillStatus
  }
}
