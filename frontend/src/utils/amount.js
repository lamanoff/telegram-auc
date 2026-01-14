export function formatBalance(amount, currency) {
  const num = parseFloat(amount)
  if (isNaN(num)) return '0'
  
  if (currency === 'TON') {
    return num.toFixed(4) + ' TON'
  } else if (currency === 'USDT') {
    return num.toFixed(2) + ' USDT'
  }
  return num.toString()
}

export function parseAmount(amountString) {
  return parseFloat(amountString) || 0
}
