// вещи между инвентарём и снаряжением: надеть из инвентаря в слот, снять из слота в инвентарь
import { edit, val } from './sheetState.js'
import { invToSlot, slotToInv } from '../shared/items.js'
import { sfx } from '../sound/sound.js'

// вещь i из инвентаря → в слот (из стопки — одна); что было в слоте — в инвентарь на её место
export function equipFromInv(i, slot) {
  const inv = (val('Inventory') || []).slice()
  const it = inv[i]
  if (!it || val(`SlotLocks.${slot}`)) return false
  const old = val(slot)
  if (it.Quantity > 1) inv[i] = { ...it, Quantity: it.Quantity - 1 }
  else inv.splice(i, 1)
  if (old) inv.splice(it.Quantity > 1 ? i + 1 : i, 0, { ...slotToInv(old), Stored: !!it.Stored, Pack: !!it.Pack })
  edit(slot, invToSlot(it))
  edit('Inventory', inv, { now: true })
  sfx('cardPlace', 0.15)
  return true
}
// вещь из слота → в сумку (в начало инвентаря)
export function unequipToInv(slot) {
  const s = val(slot)
  if (!s || val(`SlotLocks.${slot}`)) return false
  edit('Inventory', [slotToInv(s), ...(val('Inventory') || [])])
  edit(slot, null, { now: true })
  sfx('cardSlide', 0.15)
  return true
}
