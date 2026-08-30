// Authentication & User Management Routes for RESQ
import express from "express";
import bcrypt from "bcryptjs";
import {
  findUserByEmail,
  findUserById,
  findUserByUsername,
  findUserByMobile,
  findUserByIdentifier,
  isUsernameAvailable,
  getAllUsers,
  updateUserRole,
  updateUserStatus,
  updateLastLogin,
  updateUserPassword,
  createUser,
  createPasswordResetToken,
  resetUserPasswordWithToken,
  ROLES,
  USER_STATUS,
} from "../models/userModel.js";
import {
  generateToken,
  authenticate,
  authorize,
} from "../middleware/authMiddleware.js";

const router = express.Router();

// In-memory rate limiting for failed authentication attempts
const failedLoginAttempts = new Map();

function checkRateLimit(key) {
  const record = failedLoginAttempts.get(key);
  if (!record) return { allowed: true };
  const elapsed = Date.now() - record.firstAttemptTime;
  if (elapsed > 60000) {
    failedLoginAttempts.delete(key);
    return { allowed: true };
  }
  if (record.count >= 5) {
    const waitSeconds = Math.ceil((60000 - elapsed) / 1000);
    return { allowed: false, waitSeconds };
  }
  return { allowed: true };
}

function recordFailedAttempt(key) {
  const record = failedLoginAttempts.get(key);
  const now = Date.now();
  if (!record || now - record.firstAttemptTime > 60000) {
    failedLoginAttempts.set(key, { count: 1, firstAttemptTime: now });
  } else {
    record.count += 1;
  }
}

function clearFailedAttempts(key) {
  failedLoginAttempts.delete(key);
}

// GET /api/auth/check-username - Real-time username availability check
router.get("/check-username", async (req, res) => {
  try {
    const raw = (req.query.username || "").toString().trim();
    if (!raw) {
      return res.status(400).json({
        success: false,
        available: false,
        message: "Username parameter is required.",
      });
    }

    const clean = raw.replace(/^@/, "").toLowerCase();
    const validPattern = /^[a-zA-Z0-9_]{3,20}$/;

    if (clean.length < 3) {
      return res.status(200).json({
        success: true,
        available: false,
        message: "Username must be at least 3 characters.",
      });
    }

    if (clean.length > 20) {
      return res.status(200).json({
        success: true,
        available: false,
        message: "Username must not exceed 20 characters.",
      });
    }

    if (!validPattern.test(clean)) {
      return res.status(200).json({
        success: true,
        available: false,
        message: "Letters, numbers and underscores only (no spaces).",
      });
    }

    const available = await isUsernameAvailable(clean);
    return res.status(200).json({
      success: true,
      available,
      username: `@${clean}`,
      message: available ? "Username available ✓" : "Username already taken",
    });
  } catch (err) {
    console.error("Check username error:", err.message);
    return res.status(500).json({
      success: false,
      available: false,
      message: "Error checking username availability.",
    });
  }
});

// POST /api/auth/login - Authenticate user credentials via email, mobile, or username
router.post("/login", async (req, res) => {
  try {
    const { email, identifier: rawId, password, rememberMe } = req.body;
    const loginIdentifier = (rawId || email || "").toString().trim();

    if (!loginIdentifier || !password) {
      return res.status(400).json({
        success: false,
        error: "Email or username and Password are required.",
      });
    }

    // Check rate limit
    const rateLimitKey = loginIdentifier.toLowerCase();
    const rateLimit = checkRateLimit(rateLimitKey);
    if (!rateLimit.allowed) {
      return res.status(429).json({
        success: false,
        error: `Too many failed sign-in attempts. Please try again in ${rateLimit.waitSeconds}s.`,
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (email && !rawId && !emailRegex.test(email.trim())) {
      return res.status(400).json({
        success: false,
        error: "Please enter a valid email address.",
      });
    }

    // Universal resolution: by email, username, or mobile
    const user = await findUserByIdentifier(loginIdentifier);
    if (!user) {
      recordFailedAttempt(rateLimitKey);
      return res.status(401).json({
        success: false,
        error: "Incorrect email or password.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      recordFailedAttempt(rateLimitKey);
      return res.status(401).json({
        success: false,
        error: "Incorrect email or password.",
      });
    }

    if (user.status === USER_STATUS.DISABLED) {
      return res.status(403).json({
        success: false,
        error: "Your account is currently disabled. Please contact an administrator.",
      });
    }

    clearFailedAttempts(rateLimitKey);
    await updateLastLogin(user.id);
    const token = generateToken(user, !!rememberMe);

    return res.status(200).json({
      success: true,
      message: "Authentication successful.",
      token,
      user: {
        id: user.id,
        name: user.name,
        fullName: user.name,
        email: user.email,
        mobile: user.mobile || null,
        username: user.username || null,
        profile_photo: user.profile_photo || null,
        role: user.role,
        department: user.department,
        status: user.status,
        last_login_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error("Login endpoint error:", err.message);
    return res.status(500).json({
      success: false,
      error: "Unable to connect to RESQ authentication service.",
    });
  }
});

// POST /api/auth/register - Multi-step account creation with photo, username, and role
router.post("/register", async (req, res) => {
  try {
    const {
      fullName,
      name,
      email,
      mobile,
      username,
      profilePhoto,
      password,
      confirmPassword,
      role,
      department,
    } = req.body;

    const chosenName = (fullName || name || "").trim();
    const chosenEmail = (email || "").trim().toLowerCase();
    const chosenMobile = (mobile || "").trim();
    const chosenUsername = (username || "").replace(/^@/, "").trim().toLowerCase();

    if (!chosenName) {
      return res.status(400).json({
        success: false,
        error: "Full name is required.",
      });
    }

    if (!chosenEmail) {
      return res.status(400).json({
        success: false,
        error: "Email address is required.",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(chosenEmail)) {
      return res.status(400).json({
        success: false,
        error: "Please enter a valid email address.",
      });
    }

    if (!chosenMobile) {
      return res.status(400).json({
        success: false,
        error: "Mobile number is required.",
      });
    }

    // Validate mobile number: check digits length (allow +91 or standard 10 digits)
    const rawDigits = chosenMobile.replace(/\D/g, "");
    if (rawDigits.length < 10) {
      return res.status(400).json({
        success: false,
        error: "Please enter a valid 10-digit mobile number.",
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        error: "Password is required.",
      });
    }

    if (confirmPassword && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: "Passwords do not match.",
      });
    }

    // Password strength: at least 8 chars, 1 uppercase, 1 lowercase, 1 number
    const pwdRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!pwdRegex.test(password)) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 8 characters long and include an uppercase letter, lowercase letter, and a number.",
      });
    }

    // Validate username rules
    if (chosenUsername) {
      const usernamePattern = /^[a-zA-Z0-9_]{3,20}$/;
      if (!usernamePattern.test(chosenUsername)) {
        return res.status(400).json({
          success: false,
          error: "Username must be 3-20 characters long and contain only letters, numbers, and underscores.",
        });
      }
      const available = await isUsernameAvailable(chosenUsername);
      if (!available) {
        return res.status(400).json({
          success: false,
          error: "This username is already taken. Please choose another.",
        });
      }
    }

    // Role mapping and security enforcement:
    // Relief Operator -> OPERATOR
    // Monitoring / Viewer -> VIEWER
    // Any attempt to self-promote to ADMIN is blocked and defaulted to VIEWER
    let assignedRole = ROLES.VIEWER;
    if (role === "OPERATOR" || role === "Relief Operator") {
      assignedRole = ROLES.OPERATOR;
    } else if (role === "VIEWER" || role === "Monitoring / Viewer") {
      assignedRole = ROLES.VIEWER;
    }

    const user = await createUser({
      fullName: chosenName,
      name: chosenName,
      email: chosenEmail,
      mobile: chosenMobile,
      username: chosenUsername || null,
      profilePhoto: profilePhoto || null,
      password,
      role: assignedRole,
      department: department || (assignedRole === ROLES.OPERATOR ? "Relief Logistics & Convoy Ops" : "Disaster Monitoring & Analytics"),
    });

    const token = generateToken(user, true);

    return res.status(201).json({
      success: true,
      message: `Account created successfully. Welcome to RESQ (${assignedRole === ROLES.OPERATOR ? 'Relief Operator' : 'Monitoring / Viewer'}).`,
      token,
      user,
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: err.message || "Failed to create account.",
    });
  }
});

// POST /api/auth/forgot-password - Generate password reset token
router.post("/forgot-password", async (req, res) => {
  try {
    const { email, identifier } = req.body;
    const target = (email || identifier || "").toString().trim();
    if (!target) {
      return res.status(400).json({ success: false, error: "Email or mobile number is required." });
    }

    const user = await findUserByIdentifier(target);
    const genericMsg = "If an active operations account exists with this identifier, password reset instructions have been generated.";

    if (!user) {
      return res.status(200).json({ success: true, message: genericMsg });
    }

    const resetData = createPasswordResetToken(user.email);

    return res.status(200).json({
      success: true,
      message: genericMsg,
      devResetToken: resetData.token,
      devResetLink: `/login?resetToken=${resetData.token}`,
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Failed to initiate password reset." });
  }
});

// POST /api/auth/reset-password - Update password with valid reset token
router.post("/reset-password", async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;
    if (!token || !newPassword) {
      return res.status(400).json({ success: false, error: "Token and new password are required." });
    }

    if (confirmPassword && newPassword !== confirmPassword) {
      return res.status(400).json({ success: false, error: "Passwords do not match." });
    }

    const pwdRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!pwdRegex.test(newPassword)) {
      return res.status(400).json({
        success: false,
        error: "Password must be at least 8 characters long and include an uppercase letter, lowercase letter, and a number.",
      });
    }

    await resetUserPasswordWithToken(token, newPassword);

    return res.status(200).json({
      success: true,
      message: "Password updated successfully. You may now sign in.",
    });
  } catch (err) {
    return res.status(400).json({ success: false, error: err.message || "Failed to reset password." });
  }
});

// GET /api/auth/oauth/config - Check OAuth configuration status
router.get("/oauth/config", (req, res) => {
  res.status(200).json({
    success: true,
    google: {
      enabled: !!process.env.GOOGLE_CLIENT_ID,
      clientId: process.env.GOOGLE_CLIENT_ID || null,
    },
    apple: {
      enabled: !!process.env.APPLE_CLIENT_ID,
      clientId: process.env.APPLE_CLIENT_ID || null,
    },
    microsoft: {
      enabled: !!process.env.MICROSOFT_CLIENT_ID,
      clientId: process.env.MICROSOFT_CLIENT_ID || null,
      tenantId: process.env.MICROSOFT_TENANT_ID || null,
    },
    sso: {
      enabled: !!process.env.SSO_PROVIDER_URL,
      providerUrl: process.env.SSO_PROVIDER_URL || null,
    },
  });
});

// POST /api/auth/oauth/google - Real OAuth callback / verification
router.post("/oauth/google", async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(400).json({
      success: false,
      configured: false,
      error: "Google sign-in is not configured for this environment.",
    });
  }
  return res.status(501).json({
    success: false,
    error: "Google credential exchange requires server-side OAuth callback validation.",
  });
});

// POST /api/auth/oauth/apple - Real Apple OAuth callback / verification
router.post("/oauth/apple", async (req, res) => {
  if (!process.env.APPLE_CLIENT_ID) {
    return res.status(400).json({
      success: false,
      configured: false,
      error: "Apple sign-in is not configured for this environment.",
    });
  }
  return res.status(501).json({
    success: false,
    error: "Apple credential exchange requires server-side OAuth callback validation.",
  });
});

// POST /api/auth/logout - Invalidate current session
router.post("/logout", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Logged out from RESQ Command Center.",
  });
});

// GET /api/auth/me - Verify and return current authenticated user
router.get("/me", authenticate, (req, res) => {
  res.status(200).json({
    success: true,
    user: req.user,
  });
});

// POST /api/auth/change-password - Update user password securely
router.post("/change-password", authenticate, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: "Current password and new password are both required.",
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: "New password must be at least 8 characters long.",
      });
    }

    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, error: "User not found." });
    }

    const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: "Current password does not match.",
      });
    }

    await updateUserPassword(req.user.id, newPassword);
    res.status(200).json({
      success: true,
      message: "Password updated successfully.",
    });
  } catch (err) {
    console.error("Change password error:", err.message);
    res.status(500).json({ success: false, error: "Failed to update password." });
  }
});

// GET /api/auth/users - List all users (ADMIN only)
router.get("/users", authenticate, authorize(ROLES.ADMIN), async (req, res) => {
  try {
    const users = await getAllUsers();
    res.status(200).json({
      success: true,
      users,
    });
  } catch (err) {
    console.error("Get users error:", err.message);
    res.status(500).json({ success: false, error: "Failed to retrieve users." });
  }
});

// PATCH /api/auth/users/:id/role - Change user role (ADMIN only)
router.patch("/users/:id/role", authenticate, authorize(ROLES.ADMIN), async (req, res) => {
  try {
    const { role } = req.body;
    if (!role || !Object.values(ROLES).includes(role)) {
      return res.status(400).json({
        success: false,
        error: `Valid role is required (${Object.values(ROLES).join(", ")}).`,
      });
    }

    // Protect last admin from demoting self
    if (req.params.id === req.user.id && role !== ROLES.ADMIN) {
      return res.status(400).json({
        success: false,
        error: "You cannot change your own administrator role.",
      });
    }

    const updated = await updateUserRole(req.params.id, role);
    if (!updated) {
      return res.status(404).json({ success: false, error: "User not found." });
    }

    res.status(200).json({
      success: true,
      message: `User role updated to ${role}.`,
      user: updated,
    });
  } catch (err) {
    console.error("Update role error:", err.message);
    res.status(500).json({ success: false, error: "Failed to update role." });
  }
});

// PATCH /api/auth/users/:id/status - Toggle user status (ADMIN only)
router.patch("/users/:id/status", authenticate, authorize(ROLES.ADMIN), async (req, res) => {
  try {
    const { status } = req.body;
    if (!status || !Object.values(USER_STATUS).includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Valid status required (${Object.values(USER_STATUS).join(", ")}).`,
      });
    }

    // Cannot disable self
    if (req.params.id === req.user.id && status === USER_STATUS.DISABLED) {
      return res.status(400).json({
        success: false,
        error: "You cannot disable your own administrator account.",
      });
    }

    const updated = await updateUserStatus(req.params.id, status);
    if (!updated) {
      return res.status(404).json({ success: false, error: "User not found." });
    }

    res.status(200).json({
      success: true,
      message: `User status updated to ${status}.`,
      user: updated,
    });
  } catch (err) {
    console.error("Update status error:", err.message);
    res.status(500).json({ success: false, error: "Failed to update user status." });
  }
});

export default router;
