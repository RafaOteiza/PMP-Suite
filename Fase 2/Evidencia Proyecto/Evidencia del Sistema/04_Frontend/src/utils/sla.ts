// Define el límite de horas (ej: 72 horas = 3 días)
export const SLA_HOURS_LIMIT = 72; 

const humanizeHours = (hours: number, overdue: boolean) => {
  const absoluteHours = Math.abs(hours);
  if (absoluteHours < 24) return overdue ? `Vencido hace ${absoluteHours}h` : `${absoluteHours}h restantes`;
  const days = Math.floor(absoluteHours / 24);
  const dayLabel = days === 1 ? "día" : "días";
  return overdue ? `Vencido hace ${days} ${dayLabel}` : `${days} ${dayLabel} ${days===1?"restante":"restantes"}`;
};

export const calculateSLA = (fechaIngreso: string) => {
  if (!fechaIngreso) return { horas: 0, vencido: false, critico: false, sinSla: true, texto: "Sin SLA", detalle: "Sin fecha de ingreso" };

  const inicio = new Date(fechaIngreso).getTime();
  const ahora = new Date().getTime();
  const limite = inicio + (SLA_HOURS_LIMIT * 60 * 60 * 1000);
  
  const restanteMs = limite - ahora;
  // Convertimos milisegundos a horas
  const horasRestantes = Math.floor(restanteMs / (1000 * 60 * 60));
  
  return {
    horas: horasRestantes,
    sinSla: false,
    vencido: horasRestantes < 0,
    // Es crítico si falta menos de 24h y no está vencido aún
    critico: horasRestantes >= 0 && horasRestantes < 24, 
    texto: humanizeHours(horasRestantes, horasRestantes < 0),
    detalle: horasRestantes < 0
      ? `${Math.abs(horasRestantes)}h vencidas`
      : `${horasRestantes}h restantes`
  };
};
