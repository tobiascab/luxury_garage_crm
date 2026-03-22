const { z } = require('zod');

// Middleware factory: validates req.body against a Zod schema
function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(result.error); // Caught by errorHandler as ZodError
    }
    req.validatedBody = result.data;
    next();
  };
}

// Middleware factory: validates req.query against a Zod schema
function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(result.error);
    }
    req.validatedQuery = result.data;
    next();
  };
}

module.exports = { validateBody, validateQuery };
