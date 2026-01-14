import "express-serve-static-core";
import type { UserRole } from "./domain";

declare module "express-serve-static-core" {
  interface Request {
    user?: {
      id: string;
      role: UserRole;
    };
  }
}
