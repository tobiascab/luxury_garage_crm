// Custom error classes
class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
  }
}

class ValidationError extends AppError {
  constructor(message, details = []) {
    super(message, 400, 'VALIDATION_ERROR');
    this.details = details;
  }
}

class AuthError extends AppError {
  constructor(message = 'No autorizado') {
    super(message, 401, 'AUTH_ERROR');
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Acceso denegado') {
    super(message, 403, 'FORBIDDEN');
  }
}

class NotFoundError extends AppError {
  constructor(resource = 'Recurso') {
    super(`${resource} no encontrado`, 404, 'NOT_FOUND');
  }
}

class ConflictError extends AppError {
  constructor(message = 'El recurso ya existe') {
    super(message, 409, 'CONFLICT');
  }
}

// Prisma error mapper
function mapPrismaError(err) {
  switch (err.code) {
    case 'P2002':
      return new ConflictError('ese valor ya está registrado');
    case 'P2025':
      return new NotFoundError('Registro');
    case 'P2003':
      return new ValidationError('Referencia inválida: el registro relacionado no existe');
    default:
      return new AppError('Error de base de datos', 500, 'DB_ERROR');
  }
}

// Central error handler middleware
function errorHandler(err, req, res, next) {
  // Map Prisma errors
  if (err.code && err.code.startsWith('P2')) {
    err = mapPrismaError(err);
  }

  // Map Zod validation errors
  if (err.name === 'ZodError') {
    const details = err.errors.map(e => ({ field: e.path.join('.'), message: e.message }));
    err = new ValidationError('Datos inválidos', details);
  }

  const statusCode = err.statusCode || 500;
  const response = {
    success: false,
    message: err.message || 'Error interno del servidor',
    code: err.code || 'INTERNAL_ERROR',
  };

  if (err.details) response.details = err.details;
  if (process.env.NODE_ENV === 'development' && statusCode === 500) {
    response.stack = err.stack;
  }

  if (statusCode === 500) {
    console.error('❌ Error interno:', err);
  }

  res.status(statusCode).json(response);
}

module.exports = {
  AppError,
  ValidationError,
  AuthError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  errorHandler,
};
