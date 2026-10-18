export function parseAdminCommand(command) {
  const match = typeof command === 'string' && /^set-total\s+(0|[1-9]\d*)$/.exec(command.trim())
  const count = match ? Number(match[1]) : NaN
  if (!Number.isSafeInteger(count) || count < 0) throw new Error('set-total に続けて、0以上の整数を入力してください。例: set-total 12345')
  return { count }
}
