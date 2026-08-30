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
      name: "Prince",
      fullName: "Prince",
      email: "admin@resq.demo",
      mobile: "+91 98765 00001",
      username: "prince",
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
      name: "Rahul",
      fullName: "Rahul",
      email: "operator@resq.demo",
      mobile: "+91 98765 00002",
      username: "rahul",
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
      name: "Ayush",
      fullName: "Ayush",
      email: "viewer@resq.demo",
      mobile: "+91 98765 00003",
      username: "ayush",
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

// In-memory store for password reset tokens
const passwordResetTokens = new Map();

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

      // Seed demo accounts or update existing names
      for (const user of fallbackUsersStore.values()) {
        await client.query(
          `INSERT INTO public.resq_users (id, name, email, mobile, username, password_hash, role, status, department, last_login_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
           ON CONFLICT (email) DO UPDATE SET
             name = EXCLUDED.name,
             username = EXCLUDED.username,
             mobile = COALESCE(public.resq_users.mobile, EXCLUDED.mobile),
             department = EXCLUDED.department;`,
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
  const cleanMobile = mobile.replace(/[^0-9+]/g, "").trim();
  if (isDbAvailable) {
    try {
      const res = await pool.query("SELECT * FROM public.resq_users WHERE mobile = $1 LIMIT 1", [cleanMobile]);
      if (res.rows.length > 0) return res.rows[0];
    } catch (err) {
      console.warn("DB findUserByMobile failed, checking fallback store:", err.message);
    }
  }
  for (const user of fallbackUsersStore.values()) {
    if (user.mobile && user.mobile.replace(/[^0-9+]/g, "") === cleanMobile) {
      return user;
    }
  }
  return null;
}

export async function findUserById(id) {
  if (!id) return null;
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

export async function findUserByIdentifier(identifier) {
  if (!identifier) return null;
  const clean = identifier.toString().trim();
  if (clean.includes("@") && clean.includes(".")) {
    return await findUserByEmail(clean);
  }
  if (clean.startsWith("@") || /^[a-zA-Z0-9_]{3,20}$/.test(clean)) {
    const byUser = await findUserByUsername(clean);
    if (byUser) return byUser;
  }
  const byMobile = await findUserByMobile(clean);
  if (byMobile) return byMobile;
  return (await findUserByEmail(clean)) || (await findUserByUsername(clean));
}

export async function isUsernameAvailable(username) {
  if (!username) return false;
  const existing = await findUserByUsername(username);
  return !existing;
}

export async function createUser({ name, email, mobile, username, password, role = ROLES.VIEWER, department = "General Operations" }) {
  const normalizedEmail = email.toLowerCase().trim();
  const cleanUsername = username ? username.replace(/^@/, "").toLowerCase().trim() : null;
  const cleanMobile = mobile ? mobile.replace(/[^0-9+]/g, "").trim() : null;
  const id = `usr_${crypto.randomBytes(8).toString("hex")}`;
  const salt = bcrypt.genSaltSync(10);
  const password_hash = bcrypt.hashSync(password, salt);
  const now = new Date().toISOString();

  const newUser = {
    id,
    name: name.trim(),
    fullName: name.trim(),
    email: normalizedEmail,
    mobile: cleanMobile,
    username: cleanUsername,
    profile_photo: null,
    password_hash,
    role: role.toUpperCase(),
    status: USER_STATUS.ACTIVE,
    department: department.trim(),
    last_login_at: now,
    created_at: now,
    updated_at: now,
  };

  if (isDbAvailable) {
    try {
      const res = await pool.query(
        `INSERT INTO public.resq_users (id, name, email, mobile, username, password_hash, role, status, department, last_login_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING *;`,
        [id, newUser.name, newUser.email, newUser.mobile, newUser.username, password_hash, newUser.role, newUser.status, newUser.department, now]
      );
      return res.rows[0];
    } catch (err) {
      console.warn("DB createUser failed, saving to fallback store:", err.message);
    }
  }

  fallbackUsersStore.set(normalizedEmail, newUser);
  return newUser;
}

export async function updateUserPassword(userId, newPassword) {
  const salt = bcrypt.genSaltSync(10);
  const password_hash = bcrypt.hashSync(newPassword, salt);
  const now = new Date().toISOString();

  if (isDbAvailable) {
    try {
      const res = await pool.query(
        "UPDATE public.resq_users SET password_hash = $1, updated_at = $2 WHERE id = $3 RETURNING *;",
        [password_hash, now, userId]
      );
      if (res.rows.length > 0) return res.rows[0];
    } catch (err) {
      console.warn("DB updateUserPassword failed:", err.message);
    }
  }

  const user = await findUserById(userId);
  if (user) {
    user.password_hash = password_hash;
    user.updated_at = now;
    return user;
  }
  return null;
}

export async function updateProfile(userId, { name, mobile, username, department, profile_photo }) {
  const now = new Date().toISOString();
  const cleanUsername = username ? username.replace(/^@/, "").toLowerCase().trim() : undefined;
  const cleanMobile = mobile ? mobile.replace(/[^0-9+]/g, "").trim() : undefined;

  if (isDbAvailable) {
    try {
      const res = await pool.query(
        `UPDATE public.resq_users
         SET name = COALESCE($1, name),
             mobile = COALESCE($2, mobile),
             username = COALESCE($3, username),
             department = COALESCE($4, department),
             profile_photo = COALESCE($5, profile_photo),
             updated_at = $6
         WHERE id = $7
         RETURNING *;`,
        [name ? name.trim() : null, cleanMobile, cleanUsername, department ? department.trim() : null, profile_photo, now, userId]
      );
      if (res.rows.length > 0) return res.rows[0];
    } catch (err) {
      console.warn("DB updateProfile failed:", err.message);
    }
  }

  const user = await findUserById(userId);
  if (user) {
    if (name) user.name = name.trim();
    if (cleanMobile) user.mobile = cleanMobile;
    if (cleanUsername) user.username = cleanUsername;
    if (department) user.department = department.trim();
    if (profile_photo !== undefined) user.profile_photo = profile_photo;
    user.updated_at = now;
    return user;
  }
  return null;
}

export async function updateUserRole(userId, newRole) {
  const validRole = ROLES[newRole.toUpperCase()];
  if (!validRole) throw new Error(`Invalid role: ${newRole}`);
  const now = new Date().toISOString();

  if (isDbAvailable) {
    try {
      const res = await pool.query(
        "UPDATE public.resq_users SET role = $1, updated_at = $2 WHERE id = $3 RETURNING *;",
        [validRole, now, userId]
      );
      if (res.rows.length > 0) return res.rows[0];
    } catch (err) {
      console.warn("DB updateUserRole failed:", err.message);
    }
  }

  const user = await findUserById(userId);
  if (user) {
    user.role = validRole;
    user.updated_at = now;
    return user;
  }
  return null;
}

export async function updateUserStatus(userId, newStatus) {
  const validStatus = USER_STATUS[newStatus.toUpperCase()];
  if (!validStatus) throw new Error(`Invalid status: ${newStatus}`);
  const now = new Date().toISOString();

  if (isDbAvailable) {
    try {
      const res = await pool.query(
        "UPDATE public.resq_users SET status = $1, updated_at = $2 WHERE id = $3 RETURNING *;",
        [validStatus, now, userId]
      );
      if (res.rows.length > 0) return res.rows[0];
    } catch (err) {
      console.warn("DB updateUserStatus failed:", err.message);
    }
  }

  const user = await findUserById(userId);
  if (user) {
    user.status = validStatus;
    user.updated_at = now;
    return user;
  }
  return null;
}

export async function updateLastLogin(userId) {
  const now = new Date().toISOString();
  if (isDbAvailable) {
    try {
      await pool.query("UPDATE public.resq_users SET last_login_at = $1 WHERE id = $2;", [now, userId]);
    } catch (err) {
      console.warn("DB updateLastLogin failed:", err.message);
    }
  }
  const user = await findUserById(userId);
  if (user) {
    user.last_login_at = now;
  }
}

export async function listAllUsers() {
  if (isDbAvailable) {
    try {
      const res = await pool.query(
        "SELECT id, name, email, mobile, username, profile_photo, role, status, department, last_login_at, created_at FROM public.resq_users ORDER BY created_at ASC;"
      );
      if (res.rows.length > 0) return res.rows;
    } catch (err) {
      console.warn("DB listAllUsers failed, returning memory store:", err.message);
    }
  }
  return Array.from(fallbackUsersStore.values()).map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    mobile: u.mobile,
    username: u.username,
    profile_photo: u.profile_photo,
    role: u.role,
    status: u.status,
    department: u.department,
    last_login_at: u.last_login_at,
    created_at: u.created_at,
  }));
}

export const getAllUsers = listAllUsers;

export async function createPasswordResetToken(identifier) {
  const user = await findUserByIdentifier(identifier);
  if (!user) return null;
  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = Date.now() + 15 * 60 * 1000;
  passwordResetTokens.set(token, { userId: user.id, expiresAt });
  return { token, email: user.email, expiresAt };
}

export async function resetUserPasswordWithToken(token, newPassword) {
  const record = passwordResetTokens.get(token);
  if (!record || Date.now() > record.expiresAt) {
    passwordResetTokens.delete(token);
    return { success: false, error: "Reset link has expired or is invalid." };
  }
  const updatedUser = await updateUserPassword(record.userId, newPassword);
  passwordResetTokens.delete(token);
  return { success: !!updatedUser, user: updatedUser };
}

export function verifyPassword(password, hash) {
  if (!password || !hash) return false;
  return bcrypt.compareSync(password, hash);
}

export default {
  ROLES,
  USER_STATUS,
  initializeUserSchema,
  findUserByEmail,
  findUserByUsername,
  findUserByMobile,
  findUserById,
  findUserByIdentifier,
  isUsernameAvailable,
  createUser,
  updateUserPassword,
  updateProfile,
  updateUserRole,
  updateUserStatus,
  updateLastLogin,
  listAllUsers,
  getAllUsers,
  createPasswordResetToken,
  resetUserPasswordWithToken,
  verifyPassword,
};
