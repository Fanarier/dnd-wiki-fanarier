// Знаки на корешках и обложках (в поле 24×24) и руны (10×12).
function gear() {
  const pts = [], T = 8
  for (let i = 0; i < T * 4; i++) {
    const a = (i / (T * 4)) * Math.PI * 2 - Math.PI / (T * 4) * 0.5, out = i % 4 === 0 || i % 4 === 1
    const r = out ? 10.5 : 7.6
    pts.push(`${(12 + Math.cos(a) * r).toFixed(2)} ${(12 + Math.sin(a) * r).toFixed(2)}`)
  }
  return `M${pts.join(' L')} Z M12 8.6 a3.4 3.4 0 1 0 0.01 0 Z`
}
// снежинка: шесть лучей с веточками
function snow() {
  let d = ''
  for (let i = 0; i < 6; i++) {
    const a = (i * Math.PI) / 3
    const P = (r, da = 0) => `${(12 + Math.cos(a + da) * r).toFixed(2)} ${(12 + Math.sin(a + da) * r).toFixed(2)}`
    d += `M12 12 L${P(10.5)} M${P(5.2)} L${P(8, 0.42)} M${P(5.2)} L${P(8, -0.42)} `
  }
  return d.trim()
}
export const EMBLEM_PATHS = {
  gear: gear(),
  sword: 'M12 1.5 L14 5 V15 H10 V5 Z M6.5 15 H17.5 V17 H6.5 Z M11 17 H13 V21 H11 Z M12 21 a1.4 1.4 0 1 0 0.01 0 Z',
  star: 'M12 1 L14.2 9.8 L23 12 L14.2 14.2 L12 23 L9.8 14.2 L1 12 L9.8 9.8 Z',
  claw: 'M6 3 Q4 12 7 21 M12 2 Q10 12 13 22 M18 3 Q16 12 19 21',
  eye: 'M1.5 12 Q12 2.5 22.5 12 Q12 21.5 1.5 12 Z M12 8 a4 4 0 1 0 0.01 0 Z',
  wing: 'M3 20 Q5 8 21 3 Q19 9 15 11 Q19 11 20 10 Q17 15 12 15 Q15 16 16 15.5 Q12 20 3 20 Z',
  crosshair: 'M12 4 a8 8 0 1 0 0.01 0 Z M12 1 V8 M12 16 V23 M1 12 H8 M16 12 H23',
  crown: 'M3 18 L2 7 L8 12 L12 4 L16 12 L22 7 L21 18 Z M3 20 H21 V21.5 H3 Z',
  wave: 'M1 9 Q5 3 9 9 T17 9 T25 9 M1 16 Q5 10 9 16 T17 16 T25 16',
  drop: 'M12 2 Q20 13 17.5 18 A6.5 6.5 0 0 1 6.5 18 Q4 13 12 2 Z',
  moon: 'M16 2 A10.5 10.5 0 1 0 22 16 A8.5 8.5 0 0 1 16 2 Z',
  shield: 'M12 2 L21 5 V12 Q21 19 12 22.5 Q3 19 3 12 V5 Z M12 6 V19',
  sun: 'M12 7 a5 5 0 1 0 0.01 0 Z M12 1 V4 M12 20 V23 M1 12 H4 M20 12 H23 M4.2 4.2 L6.3 6.3 M17.7 17.7 L19.8 19.8 M4.2 19.8 L6.3 17.7 M17.7 6.3 L19.8 4.2',
  flame: 'M12 2 Q18 9 16 13 Q19 12 18.5 9.5 Q22 16 17 20.5 A7 7 0 0 1 6 19 Q3 14 8 9 Q8 12 10 12.5 Q9 7 12 2 Z',
  leaf: 'M4 20 Q3 8 20 3 Q21 17 8 19 Z M5 21 L14 10',
  cross: 'M9 3 H15 V9 H21 V15 H15 V21 H9 V15 H3 V9 H9 Z',
  snow: snow()
}
// какие знаки заливаются, а какие — только контуром
export const EMBLEM_FILL = { gear: 1, sword: 1, star: 1, eye: 1, wing: 1, crown: 1, drop: 1, moon: 1, sun: 1, flame: 1, cross: 1 }
export const RUNES = ['M2 0 V12 M2 2 L8 6 L2 10', 'M5 0 V12 M1 4 L5 0 L9 4', 'M1 0 L9 12 M9 0 L1 12', 'M2 12 V0 L8 4 L2 7', 'M1 6 L5 0 L9 6 L5 12 Z', 'M2 0 V12 M8 0 V12 M2 3 L8 9']
