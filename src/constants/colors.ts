// BHD Color Tokens — espejo de las variables CSS en index.css
export const C = {
  // Fondo base y superficies
  background:           '#0d1117',
  surface:              '#161b22',
  surfaceRaised:        '#1c2128',
  border:               '#30363d',
  borderStrong:         '#484f58',

  // Texto
  foreground:           '#e6edf3',
  muted:                '#8b949e',

  // Marca / Primario
  primary:              '#58a6ff',
  primaryHover:         '#79b8ff',
  primaryActive:        '#1f6feb',
  primarySoft:          '#0d2241',

  // Estados
  success:              '#3fb950',
  successSoft:          '#0d2818',
  danger:               '#f85149',
  dangerSoft:           '#2d1014',
  warning:              '#d29922',
  warningSoft:          '#2d1f03',
  info:                 '#58a6ff',
  infoSoft:             '#0d2241',

  // Disabled
  disabledFg:           '#484f58',
  disabledBg:           '#21262d',

  // Paleta fija de apoyo (para Canvas del juego)
  greyBlue900:          '#161a1d',
  greyBlue800:          '#2c353a',
  greyBlue700:          '#424f57',
  greyBlue600:          '#586a74',
  greyBlue500:          '#6e8491',
  greyBlue200:          '#c5ced3',
  white:                '#ffffff',
  green400:             '#50b940',
  green600:             '#00a80c',
  green100:             '#e2f2e3',
  error600:             '#db2500',
  error100:             '#fff2f0',
  warning600:           '#e5a000',
  warning100:           '#fffaf0',
  info600:              '#3c80f6',
  grey700:              '#333333',
} as const

export type ColorKey = keyof typeof C