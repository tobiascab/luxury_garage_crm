const { z } = require('zod');

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  firstName: z.string().min(1, 'Nombre requerido').max(100),
  lastName: z.string().min(1, 'Apellido requerido').max(100),
  phone: z.string().optional().nullable(),
  role: z.enum(['CLIENT', 'EMPLOYEE', 'ADMIN', 'SUPER_ADMIN']).optional(),
  arizarContactId: z.string().optional().nullable(),
  // Vehicle data (optional, for registration with vehicle)
  vehicle: z.object({
    brand: z.string().min(1),
    model: z.string().min(1),
    year: z.number().int().min(1900).max(2030),
    color: z.string().min(1),
    licensePlate: z.string().min(1),
    notes: z.string().optional().nullable(),
  }).optional(),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Contraseña actual requerida'),
  newPassword: z.string().min(8, 'Mínimo 8 caracteres'),
});

const updateProfileSchema = z.object({
  firstName: z.string().min(1).max(100).optional(),
  lastName: z.string().min(1).max(100).optional(),
  phone: z.string().optional().nullable(),
  avatarUrl: z.string().url().optional().nullable(),
});

module.exports = { loginSchema, registerSchema, changePasswordSchema, updateProfileSchema };
