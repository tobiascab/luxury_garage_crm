const { z } = require('zod');

const createVehicleSchema = z.object({
  brand: z.string().min(1, 'Marca requerida').max(100),
  model: z.string().min(1, 'Modelo requerido').max(100),
  year: z.number().int().min(1900, 'Año inválido').max(2030),
  color: z.string().min(1, 'Color requerido').max(50),
  licensePlate: z.string().min(1, 'Placa requerida').max(20),
  photoUrl: z.string().url().optional().nullable(),
  isPrimary: z.boolean().optional().default(false),
  notes: z.string().max(500, 'Máximo 500 caracteres').optional().nullable(),
});

const updateVehicleSchema = createVehicleSchema.partial();

module.exports = { createVehicleSchema, updateVehicleSchema };
