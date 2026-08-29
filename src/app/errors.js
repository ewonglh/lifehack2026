export function toAppError(error, fallback = 'Something went wrong. Please try again.') {
  if (error?.code && error?.message) return error;
  return {
    code: error?.code || 'unexpected_error',
    message: error?.message || fallback,
    details: error?.details,
  };
}
