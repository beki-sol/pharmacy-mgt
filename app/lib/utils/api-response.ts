export function successResponse(data: any, meta?: any) {
  return {
    success: true,
    data,
    meta: meta || null,
  };
}

export function errorResponse(message: string) {
  return {
    success: false,
    error: message,
  };
}