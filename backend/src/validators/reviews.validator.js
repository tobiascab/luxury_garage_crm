const { z } = require('zod');

const createReviewSchema = z.object({
  serviceRecordId: z.string().uuid('ID de registro de servicio inválido'),
  rating: z.number().int().min(1, 'Mínimo 1 estrella').max(5, 'Máximo 5 estrellas'),
  comment: z.string().max(1000, 'Máximo 1000 caracteres').optional().nullable(),
});

const respondReviewSchema = z.object({
  adminResponse: z.string().min(1, 'Respuesta requerida').max(1000),
});

module.exports = { createReviewSchema, respondReviewSchema };
