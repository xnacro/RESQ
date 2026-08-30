// User Model and Store for RESQ Authentication & Role-Based Access Control
import crypto from "crypto";
import bcrypt from "bcryptjs";
import pool from "../config/db.js";

// Standard roles supported in RESQ
export const ROLES = Object.freeze({
  ADMIN: "ADMIN",
  OPERATOR: "OPERATOR",
  VIEWER: "VIEWER",
});

export const USER_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  PENDING: "PENDING",
  DISABLED: "DISABLED",
});

// Demo accounts pre-seeded with bcrypt hashes
// Password for all demo accounts: Resq@2026!
const DEMO_PASSWORD = "Resq@2026!";
const DEMO_SALT = bcrypt.genSaltSync(10);
const DEMO_HASH = bcrypt.hashSync(DEMO_PASSWORD, DEMO_SALT);

const fallbackUsersStore = new Map([
  [
    "admin@resq.demo",
    {
      id: "usr_admin_001",
      name: "Commander Rajesh Sharma",
      fullName: "Commander Rajesh Sharma",
      email: "admin@resq.demo",
      mobile: "+91 98765 00001",
      username: "admin_command",
      profile_photo: null,
      password_hash: DEMO_HASH,
      role: ROLES.ADMIN,
      status: USER_STATUS.ACTIVE,
      department: "State Disaster Command & Control",
      last_login_at: new Date(Date.now() - 3600000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  [
    "operator@resq.demo",
    {
      id: "usr_operator_002",
      name: "Rahul Kumar",
      fullName: "Rahul Kumar",
      email: "operator@resq.demo",
      mobile: "+91 98765 00002",
      username: "rahul_resq",
      profile_photo: null,
      password_hash: DEMO_HASH,
      role: ROLES.OPERATOR,
      status: USER_STATUS.ACTIVE,
      department: "Field Logistics & Convoy Operations",
      last_login_at: new Date(Date.now() - 7200000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
  [
    "viewer@resq.demo",
    {
      id: "usr_viewer_003",
      name: "Dr. Ananya Roy",
      fullName: "Dr. Ananya Roy",
      email: "viewer@resq.demo",
      mobile: "+91 98765 00003",
      username: "ananya_analyst",
      profile_photo: null,
      password_hash: DEMO_HASH,
      role: ROLES.VIEWER,
      status: USER_STATUS.ACTIVE,
      department: "Regional Disaster Research & Analytics",
      last_login_at: new Date(Date.now() - 86400000).toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  ],
]);

let isDbAvailable = false;

// Initialize Postgres Schema if database is reachable
export async function initializeUserSchema() {
  try {
    const client = await pool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS public.resq_users (
          id VARCHAR(64) PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          email VARCHAR(255) UNIQUE NOT NULL,
          mobile VARCHAR(30),
          username VARCHAR(50) UNIQUE,
          profile_photo TEXT,
          password_hash VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL DEFAULT 'VIEWER',
          status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
          department VARCHAR(255) DEFAULT 'General Operations',
          last_login_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        ALTER TABLE public.resq_users ADD COLUMN IF NOT EXISTS mobile VARCHAR(30);
        ALTER TABLE public.resq_users ADD COLUMN IF NOT EXISTS username VARCHAR(50) UNIQUE;
        ALTER TABLE public.resq_users ADD COLUMN IF NOT EXISTS profile_photo TEXT;
        CREATE INDEX IF NOT EXISTS idx_resq_users_email ON public.resq_users (email);
        CREATE INDEX IF NOT EXISTS idx_resq_users_username ON public.resq_users (username);
        CREATE INDEX IF NOT EXISTS idx_resq_users_mobile ON public.resq_users (mobile);
        CREATE INDEX IF NOT EXISTS idx_resq_users_role ON public.resq_users (role);
      `);

      // Seed demo accounts if empty
      for (const user of fallbackUsersStore.values()) {
        await client.query(
          `INSERT INTO public.resq_users (id, name, email, mobile, username, password_hash, role, status, department, last_login_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (email) DO UPDATE SET
             username = COALESCE(public.resq_users.username, EXCLUDED.username),
             mobile = COALESCE(public.resq_users.mobile, EXCLUDED.mobile);`,
          [
            user.id,
            user.name,
            user.email,
            user.mobile,
            user.username,
            user.password_hash,
            user.role,
            user.status,
            user.department,
            user.last_login_at,
          ]
        );
      }
      isDbAvailable = true;
      console.log("PostgreSQL auth schema initialized successfully.");
    } finally {
      client.release();
    }
  } catch (err) {
    isDbAvailable = false;
    console.warn("PostgreSQL auth notice (using fallback memory store):", err.message);
  }
}

export async function findUserByEmail(email) {
  if (!email) return null;
  const normalized = email.toLowerCase().trim();
  if (isDbAvailable) {
    try {
      const res = await pool.query("SELECT * FROM public.resq_users WHERE LOWER(email) = $1 LIMIT 1", [normalized]);
      if (res.rows.length > 0) return res.rows[0];
    } catch (err) {
      console.warn("DB findUserByEmail failed, checking fallback store:", err.message);
    }
  }
  return fallbackUsersStore.get(normalized) || null;
}

export async function findUserByUsername(username) {
  if (!username) return null;
  const clean = username.replace(/^@/, "").toLowerCase().trim();
  if (isDbAvailable) {
    try {
      const res = await pool.query("SELECT * FROM public.resq_users WHERE LOWER(username) = $1 LIMIT 1", [clean]);
      if (res.rows.length > 0) return res.rows[0];
    } catch (err) {
      console.warn("DB findUserByUsername failed, checking fallback store:", err.message);
    }
  }
  for (const user of fallbackUsersStore.values()) {
    if (user.username && user.username.toLowerCase() === clean) return user;
  }
  return null;
}

export async function findUserByMobile(mobile) {
  if (!mobile) return null;
  const digits = mobile.replace(/\D/g, "");
  if (isDbAvailable) {
    try {
      const res = await pool.query(
        "SELECT * FROM public.resq_users WHERE regexp_replace(mobile, '\\D', '', 'g') = $1 LIMIT 1",
        [digits]
      );
      if (res.rows.length > 0) return res.rows[0];
    } catch (err) {
      console.warn("DB findUserByMobile failed, checking fallback store:", err.message);
    }
  }
  for (const user of fallbackUsersStore.values()) {
    if (user.mobile && user.mobile.replace(/\D/g, "") === digits) return user;
  }
  return null;
}

// Universal identifier resolver: supports email, username (@name or name), and mobile phone number
export async function findUserByIdentifier(identifier) {
  if (!identifier || typeof identifier !== "string") return null;
  const trimmed = identifier.trim();

  // If contains @ and looks like email
  if (trimmed.includes("@") && trimmed.includes(".")) {
    const byEmail = await findUserByEmail(trimmed);
    if (byEmail) return byEmail;
  }

  // If starts with @ or purely alphanumeric username
  const cleanUsername = trimmed.replace(/^@/, "");
  const byUsername = await findUserByUsername(cleanUsername);
  if (byUsername) return byUsername;

  // If digits or phone number
  const digits = trimmed.replace(/\D/g, "");
  if (digits.length >= 10) {
    const byMobile = await findUserByMobile(digits);
    if (byMobile) return byMobile;
  }

  return (await findUserByUsername(trimmed)) || (await findUserByEmail(trimmed));
}

// Check if username is available (real-time validation)
export async function isUsernameAvailable(username) {
  if (!username) return false;
  const clean = username.replace(/^@/, "").toLowerCase().trim();

  // Username must be 3-20 chars alphanumeric + underscore
  const validPattern = /^[a-zA-Z0-9_]{3,20}$/;
  if (!validPattern.test(clean)) return false;

  const existing = await findUserByUsername(clean);
  return !existing;
}

export async function findUserById(id) {
  if (isDbAvailable) {
    try {
      const res = await pool.query("SELECT * FROM public.resq_users WHERE id = $1 LIMIT 1", [id]);
      if (res.rows.length > 0) return res.rows[0];
    } catch (err) {
      console.warn("DB findUserById failed, checking fallback store:", err.message);
    }
  }
  for (const user of fallbackUsersStore.values()) {
    if (user.id === id) return user;
  }
  return null;
}

export async function getAllUsers() {
  if (isDbAvailable) {
    try {
      const res = await pool.query(
        "SELECT id, name, email, mobile, username, profile_photo, role, status, department, last_login_at, created_at FROM public.resq_users ORDER BY created_at ASC"
      );
      return res.rows;
    } catch (err) {
      console.warn("DB getAllUsers failed, using fallback store:", err.message);
    }
  }
  return Array.from(fallbackUsersStore.values()).map(
    ({ password_hash, ...safeUser }) => safeUser
  );
}

export async function updateUserRole(id, newRole) {
  if (!Object.values(ROLES).includes(newRole)) {
    throw new Error(`Invalid role: ${newRole}`);
  }
  const now = new Date().toISOString();
  if (isDbAvailable) {
    try {
      const res = await pool.query(
        "UPDATE public.resq_users SET role = $1, updated_at = $2 WHERE id = $3 RETURNING id, name, email, mobile, username, profile_photo, role, status, department, last_login_at",
        [newRole, now, id]
      );
      if (res.rows.length > 0) return res.rows[0];
    } catch (err) {
      console.warn("DB updateUserRole failed, applying to fallback store:", err.message);
    }
  }
  for (const user of fallbackUsersStore.values()) {
    if (user.id === id) {
      user.role = newRole;
      user.updated_at = now;
      const { password_hash, ...safeUser } = user;
      return safeUser;
    }
  }
  return null;
}

export async function updateUserStatus(id, newStatus) {
  if (!Object.values(USER_STATUS).includes(newStatus)) {
    throw new Error(`Invalid status: ${newStatus}`);
  }
  const now = new Date().toISOString();
  if (isDbAvailable) {
    try {
      const res = await pool.query(
        "UPDATE public.resq_users SET status = $1, updated_at = $2 WHERE id = $3 RETURNING id, name, email, mobile, username, profile_photo, role, status, department, last_login_at",
        [newStatus, now, id]
      );
      if (res.rows.length > 0) return res.rows[0];
    } catch (err) {
      console.warn("DB updateUserStatus failed, applying to fallback store:", err.message);
    }
  }
  for (const user of fallbackUsersStore.values()) {
    if (user.id === id) {
      user.status = newStatus;
      user.updated_at = now;
      const { password_hash, ...safeUser } = user;
      return safeUser;
    }
  }
  return null;
}

export async function updateLastLogin(id) {
  const now = new Date().toISOString();
  if (isDbAvailable) {
    try {
      await pool.query("UPDATE public.resq_users SET last_login_at = $1 WHERE id = $2", [now, id]);
    } catch (err) {
      console.warn("DB updateLastLogin failed:", err.message);
    }
  }
  for (const user of fallbackUsersStore.values()) {
    if (user.id === id) {
      user.last_login_at = now;
      break;
    }
  }
}

export async function updateUserPassword(id, newPassword) {
  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(newPassword, salt);
  const now = new Date().toISOString();

  if (isDbAvailable) {
    try {
      await pool.query(
        "UPDATE public.resq_users SET password_hash = $1, updated_at = $2 WHERE id = $3",
        [hash, now, id]
      );
      return true;
    } catch (err) {
      console.warn("DB updateUserPassword failed, updating fallback store:", err.message);
    }
  }

  for (const user of fallbackUsersStore.values()) {
    if (user.id === id) {
      user.password_hash = hash;
      user.updated_at = now;
      return true;
    }
  }
  return false;
}

const passwordResetTokens = new Map();

export async function createUser({
  fullName,
  name,
  email,
  mobile = null,
  username = null,
  profilePhoto = null,
  password,
  department = "Relief Field Operations",
  role = ROLES.VIEWER,
}) {
  const normalizedEmail = email.toLowerCase().trim();
  const existingEmail = await findUserByEmail(normalizedEmail);
  if (existingEmail) {
    throw new Error("An account with this email address already exists.");
  }

  // Sanitize username
  let cleanUsername = null;
  if (username) {
    cleanUsername = username.replace(/^@/, "").toLowerCase().trim();
    const existingUser = await findUserByUsername(cleanUsername);
    if (existingUser) {
      throw new Error("This username is already taken. Please choose another.");
    }
  } else {
    // Generate username from email prefix
    cleanUsername = normalizedEmail.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "_");
  }

  if (mobile) {
    const existingMobile = await findUserByMobile(mobile);
    if (existingMobile) {
      throw new Error("An account with this mobile number already exists.");
    }
  }

  const salt = await bcrypt.genSalt(10);
  const hash = await bcrypt.hash(password, salt);
  const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const now = new Date().toISOString();

  let assignedRole = ROLES.VIEWER;
  if (role === ROLES.OPERATOR || role === "Relief Operator") {
    assignedRole = ROLES.OPERATOR;
  } else if (role === ROLES.VIEWER || role === "Monitoring / Viewer") {
    assignedRole = ROLES.VIEWER;
  }

  const displayName = (fullName || name || cleanUsername).trim();

  const newUser = {
    id,
    name: displayName,
    fullName: displayName,
    email: normalizedEmail,
    mobile: mobile ? mobile.trim() : null,
    username: cleanUsername,
    profile_photo: profilePhoto || null,
    password_hash: hash,
    role: assignedRole,
    status: USER_STATUS.ACTIVE,
    department: department.trim() || "Relief Field Operations",
    last_login_at: now,
    created_at: now,
    updated_at: now,
  };

  if (isDbAvailable) {
    try {
      await pool.query(
        `INSERT INTO public.resq_users (id, name, email, mobile, username, profile_photo, password_hash, role, status, department, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          id,
          newUser.name,
          normalizedEmail,
          newUser.mobile,
          newUser.username,
          newUser.profile_photo,
          hash,
          assignedRole,
          USER_STATUS.ACTIVE,
          newUser.department,
          now,
          now,
        ]
      );
    } catch (err) {
      console.warn("DB createUser failed, falling back to memory store:", err.message);
    }
  }

  fallbackUsersStore.set(normalizedEmail, newUser);

  const { password_hash, ...safeUser } = newUser;
  return safeUser;
}

export function createPasswordResetToken(emailOrMobile) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = Date.now() + 15 * 60 * 1000; // 15 minutes validity
  passwordResetTokens.set(token, { identifier: emailOrMobile.trim(), expiresAt });
  return { token, expiresAt };
}

export async function resetUserPasswordWithToken(token, newPassword) {
  const record = passwordResetTokens.get(token);
  if (!record) {
    throw new Error("Invalid or expired password reset link.");
  }

  if (Date.now() > record.expiresAt) {
    passwordResetTokens.delete(token);
    throw new Error("Password reset link has expired. Please request a new one.");
  }

  const user = await findUserByIdentifier(record.identifier);
  if (!user) {
    passwordResetTokens.delete(token);
    throw new Error("User account no longer exists.");
  }

  await updateUserPassword(user.id, newPassword);
  passwordResetTokens.delete(token);
  return { success: true, email: user.email };
}

export default {
  ROLES,
  USER_STATUS,
  initializeUserSchema,
  findUserByEmail,
  findUserByUsername,
  findUserByMobile,
  findUserByIdentifier,
  isUsernameAvailable,
  findUserById,
  getAllUsers,
  updateUserRole,
  updateUserStatus,
  updateLastLogin,
  updateUserPassword,
  createUser,
  createPasswordResetToken,
  resetUserPasswordWithToken,
};
