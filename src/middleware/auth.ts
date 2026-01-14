import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { config } from "../config";
import type { UserRole } from "../types/domain";
import { forbidden, unauthorized } from "../utils/errors";

interface AuthPayload {
  sub: string;
  role: UserRole;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    return next(unauthorized("Missing token"));
  }
  if (token.length > 1000) {
    return next(unauthorized("Invalid token"));
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
    if (!payload.sub || typeof payload.sub !== 'string') {
      return next(unauthorized("Invalid token"));
    }
    req.user = { id: payload.sub, role: payload.role };
    return next();
  } catch {
    return next(unauthorized("Invalid token"));
  }
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : undefined;
  if (!token) {
    return next();
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
    req.user = { id: payload.sub, role: payload.role };
  } catch {
    return next();
  }
  return next();
}

export function requireRole(role: UserRole) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(unauthorized());
    }
    if (req.user.role !== role) {
      return next(forbidden());
    }
    return next();
  };
}
