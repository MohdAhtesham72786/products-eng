import type { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}
export function errorHandler(
  error: any,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  if (error instanceof ZodError) {
    res.status(400).json({
      code: "VALIDATION_ERROR",
      message: "Check your input.",
      issues: error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
    return;
  }
  if (error instanceof ApiError) {
    res.status(error.status).json({ code: error.code, message: error.message });
    return;
  }
  if (error?.code === "23505") {
    res.status(409).json({
      code: "CONFLICT",
      message: "This record already exists or research is already in progress.",
    });
    return;
  }
  if (error?.type === "entity.too.large") {
    res
      .status(413)
      .json({ code: "INPUT_TOO_LARGE", message: "Request is too large." });
    return;
  }
  console.error(
    "Unhandled request error:",
    error?.name || "Error",
    error?.code || "INTERNAL",
  );
  res.status(500).json({
    code: "INTERNAL_ERROR",
    message: "The request could not be completed. Please retry.",
  });
}
export const notFound = () =>
  new ApiError(404, "NOT_FOUND", "Resource not found.");
