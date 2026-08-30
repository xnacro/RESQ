// Authentication and Role-Based Access Control Middleware for RESQ
import jwt from "jsonwebtoken";
import { findUserById, USER_STATUS } from "../models/userModel.js";

export const JWT_SECRET = process.env.JWT_SECRET || "resq-operational-command-secret-2026";
export const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "24h";

// Generates signed JWT token for authenticated user
export function generateToken(user, rememberMe = false) {
  const expiresIn = rememberMe ? "7d" : JWT_EXPIRES_IN;
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
      role: user.role,
      department: user.department,
    },
    JWT_SECRET,
    { expiresIn }
  );
}

// Middleware: Authenticate incoming request via Bearer JWT
export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      code: "AUTH_TOKEN_MISSING",
      error: "Authentication token is missing. Please sign in to RESQ.",
    });
  }

  const token = authHeader.split(" ")[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await findUserById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        code: "USER_NOT_FOUND",
        error: "Authenticated user record no longer exists.",
      });
    }

    if (user.status === USER_STATUS.DISABLED) {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_DISABLED",
        error: "Your account is currently disabled. Contact a RESQ Administrator.",
      });
    }

    req.user = {
      id: user.id,
      name: user.name,
      fullName: user.name,
      email: user.email,
      mobile: user.mobile || null,
      username: user.username || null,
      profile_photo: user.profile_photo || null,
      role: user.role,
      status: user.status,
      department: user.department,
      last_login_at: user.last_login_at,
    };
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        code: "TOKEN_EXPIRED",
        error: "Your session has expired. Please sign in again.",
      });
    }
    return res.status(401).json({
      success: false,
      code: "INVALID_TOKEN",
      error: "Invalid authentication credentials.",
    });
  }
}

// Middleware: Authorize specific roles
export function authorize(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        code: "UNAUTHENTICATED",
        error: "Please sign in to access this resource.",
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        code: "PERMISSION_DENIED",
        error: `Insufficient permissions. Required role: ${allowedRoles.join(" or ")}.`,
        userRole: req.user.role,
      });
    }

    next();
  };
}
