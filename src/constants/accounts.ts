export interface Cuenta {
  id: string
  num: string
  tipo: 'CA' | 'CC'
  alias: string
  saldo: number
}

export const CUENTAS: Cuenta[] = [
  { id: '1', num: '0042', tipo: 'CA', alias: 'Ahorro Personal',    saldo: 12450  },
  { id: '2', num: '0117', tipo: 'CC', alias: 'Cuenta Corriente',   saldo: 87320  },
  { id: '3', num: '0258', tipo: 'CA', alias: 'Fondo de Viaje',     saldo: 5890   },
  { id: '4', num: '0391', tipo: 'CA', alias: 'Gastos del Hogar',   saldo: 23100  },
  { id: '5', num: '0524', tipo: 'CC', alias: 'Empresa SRL',        saldo: 154000 },
]

export function formatMonto(n: number): string {
  return `$${n.toLocaleString('es-DO')}`
}

export function findCuentaById(id: string): Cuenta | undefined {
  return CUENTAS.find(c => c.id === id)
}