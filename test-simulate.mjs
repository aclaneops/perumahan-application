let thisAmount = 300000
let remainingAmount = thisAmount

let newWater = 50000
let newTrash = 10000
let newSecurity = 30000
let newTreasury = 10000
let billOriginalTotal = newWater + newTrash + newSecurity + newTreasury

let payment = {
  covered_items: { water: true, trash: true, security: true, treasury: true }
}

if (payment?.covered_items) {
  if (payment.covered_items.water) { remainingAmount -= newWater; newWater = 0; }
  if (payment.covered_items.trash) { remainingAmount -= newTrash; newTrash = 0; }
  if (payment.covered_items.security) { remainingAmount -= newSecurity; newSecurity = 0; }
  if (payment.covered_items.treasury) { remainingAmount -= newTreasury; newTreasury = 0; }
} else {
  remainingAmount -= billOriginalTotal
  newWater = 0; newTrash = 0; newSecurity = 0; newTreasury = 0;
}

const amountUsedForPrimary = thisAmount - Math.max(0, remainingAmount)
console.log('amountUsedForPrimary:', amountUsedForPrimary)
console.log('remainingAmount:', remainingAmount)
