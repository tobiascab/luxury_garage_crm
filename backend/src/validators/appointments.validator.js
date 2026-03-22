const { z } = require('zod');

const createAppointmentSchema = z.object({
  vehicleId: z.string().uuid('ID de vehículo inválido'),
  serviceId: z.string().uuid('ID de servicio inválido'),
  date: z.string().refine(val => !isNaN(Date.parse(val)), 'Fecha inválida'),
  startTime: z.string().refine(val => !isNaN(Date.parse(val)), 'Hora de inicio inválida'),
  notes: z.string().max(500).optional().nullable(),
});

module.exports = { createAppointmentSchema };
