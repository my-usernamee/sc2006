/**
 * One error type for everything the user is allowed to see.
 * Services throw `new AppError(400, 'message')` and the error handler turns it
 * into a JSON response. Anything else that is thrown becomes a generic 500.
 */
export class AppError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export const badRequest = (msg: string) => new AppError(400, msg);
export const unauthorized = (msg = 'You must be logged in.') => new AppError(401, msg);
export const forbidden = (msg = 'You are not allowed to do that.') => new AppError(403, msg);
export const notFound = (msg = 'Not found.') => new AppError(404, msg);
export const conflict = (msg: string) => new AppError(409, msg);
