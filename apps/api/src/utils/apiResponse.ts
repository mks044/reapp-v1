export const okResponse = <T>(data: T) => {
  return {
    ok: true,
    ...data
  };
};

export const errorResponse = (error: string, details?: unknown) => {
  return {
    ok: false,
    error,
    ...(details !== undefined ? { details } : {})
  };
};
