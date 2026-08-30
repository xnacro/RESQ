// RESQ Mode Session Data Model and Persistence Layer for PostgreSQL / Memory
import crypto from "crypto";
import pool from "../config/db.js";

// In-memory fallback session store when database is offline or initializing
const memorySessions = new Map();
let isSessionDbAvailable = true;

// Session Status Constants
export const SESSION_STATUS = {
  ACTIVE: "ACTIVE",
  ENDED: "ENDED",
  EXPIRED: "EXPIRED",
  SOS: "SOS",
};

// Initialize resq_sessions database table
export async function initializeSessionSchema() {
  try {
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS public.resq_sessions (
        session_id VARCHAR(64) PRIMARY KEY,
        user_id VARCHAR(64) NOT NULL,
        user_name VARCHAR(128) NOT NULL,
        user_mobile VARCHAR(32),
        status VARCHAR(32) DEFAULT 'ACTIVE',
        is_active BOOLEAN DEFAULT TRUE,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        ended_at TIMESTAMPTZ,
        last_location_at TIMESTAMPTZ,
        last_checkin_at TIMESTAMPTZ,
        safety_timer_minutes INTEGER DEFAULT 30,
        timer_expires_at TIMESTAMPTZ,
        current_grid_id VARCHAR(32),
        current_district VARCHAR(64),
        current_state VARCHAR(64) DEFAULT 'Assam',
        current_lat DOUBLE PRECISION,
        current_lon DOUBLE PRECISION,
        current_accuracy DOUBLE PRECISION,
        static_risk DOUBLE PRECISION DEFAULT 0,
        dynamic_risk DOUBLE PRECISION DEFAULT 0,
        risk_score DOUBLE PRECISION DEFAULT 0,
        risk_status VARCHAR(32) DEFAULT 'LOW',
        risk_confidence DOUBLE PRECISION DEFAULT 0.9,
        trusted_contacts JSONB DEFAULT '[]'::jsonb,
        emergency_alert_id VARCHAR(64),
        route_id VARCHAR(64),
        metadata JSONB DEFAULT '{}'::jsonb,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_resq_sessions_user_id ON public.resq_sessions(user_id);
      CREATE INDEX IF NOT EXISTS idx_resq_sessions_is_active ON public.resq_sessions(is_active);
      CREATE INDEX IF NOT EXISTS idx_resq_sessions_status ON public.resq_sessions(status);
      CREATE INDEX IF NOT EXISTS idx_resq_sessions_timer ON public.resq_sessions(timer_expires_at);
    `;

    await pool.query(createTableQuery);
    isSessionDbAvailable = true;
    console.log("RESQ Sessions schema initialized successfully in public.resq_sessions");
  } catch (err) {
    console.warn("Failed to initialize PostgreSQL session schema, using in-memory store:", err.message);
    isSessionDbAvailable = false;
  }
}

// Create a new RESQ Mode active session
export async function createResqSession({
  userId,
  userName,
  userMobile = null,
  safetyTimerMinutes = 30,
  trustedContacts = [],
  metadata = {},
}) {
  const sessionId = crypto.randomUUID();
  const now = new Date();
  const timerExpiresAt = safetyTimerMinutes > 0
    ? new Date(now.getTime() + safetyTimerMinutes * 60 * 1000)
    : null;

  const sessionObj = {
    session_id: sessionId,
    user_id: userId,
    user_name: userName,
    user_mobile: userMobile,
    status: SESSION_STATUS.ACTIVE,
    is_active: true,
    started_at: now.toISOString(),
    ended_at: null,
    last_location_at: now.toISOString(),
    last_checkin_at: now.toISOString(),
    safety_timer_minutes: safetyTimerMinutes,
    timer_expires_at: timerExpiresAt ? timerExpiresAt.toISOString() : null,
    current_grid_id: null,
    current_district: "Kamrup Metropolitan",
    current_state: "Assam",
    current_lat: 26.1445,
    current_lon: 91.7362,
    current_accuracy: 50,
    static_risk: 24.8,
    dynamic_risk: 0,
    risk_score: 24.8,
    risk_status: "LOW",
    risk_confidence: 0.95,
    trusted_contacts: trustedContacts,
    emergency_alert_id: null,
    route_id: null,
    metadata: metadata,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };

  // Always store in memory for fast lookup
  memorySessions.set(sessionId, { ...sessionObj });

  if (isSessionDbAvailable) {
    try {
      const query = `
        INSERT INTO public.resq_sessions (
          session_id, user_id, user_name, user_mobile, status, is_active,
          started_at, safety_timer_minutes, timer_expires_at,
          trusted_contacts, metadata, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        RETURNING *
      `;
      const values = [
        sessionId,
        userId,
        userName,
        userMobile,
        SESSION_STATUS.ACTIVE,
        true,
        now,
        safetyTimerMinutes,
        timerExpiresAt,
        JSON.stringify(trustedContacts),
        JSON.stringify(metadata),
        now,
        now,
      ];
      const res = await pool.query(query, values);
      return formatSessionRow(res.rows[0]);
    } catch (err) {
      console.error("Database insert failed for session, using in-memory copy:", err.message);
      return sessionObj;
    }
  }

  return sessionObj;
}

// Find session by sessionId
export async function findResqSessionById(sessionId) {
  if (!sessionId) return null;

  if (isSessionDbAvailable) {
    try {
      const res = await pool.query(
        "SELECT * FROM public.resq_sessions WHERE session_id = $1 LIMIT 1",
        [sessionId]
      );
      if (res.rows.length > 0) {
        return formatSessionRow(res.rows[0]);
      }
    } catch (err) {
      console.warn("DB lookup error for session, falling back to memory:", err.message);
    }
  }

  const mem = memorySessions.get(sessionId);
  return mem ? { ...mem } : null;
}

// Find active session for a specific user
export async function findActiveSessionByUserId(userId) {
  if (!userId) return null;

  if (isSessionDbAvailable) {
    try {
      const res = await pool.query(
        "SELECT * FROM public.resq_sessions WHERE user_id = $1 AND is_active = TRUE ORDER BY started_at DESC LIMIT 1",
        [userId]
      );
      if (res.rows.length > 0) {
        return formatSessionRow(res.rows[0]);
      }
    } catch (err) {
      console.warn("DB lookup error for active user session:", err.message);
    }
  }

  for (const session of memorySessions.values()) {
    if (session.user_id === userId && session.is_active) {
      return { ...session };
    }
  }
  return null;
}

// Update session state
export async function updateResqSession(sessionId, updates = {}) {
  const session = await findResqSessionById(sessionId);
  if (!session) return null;

  const now = new Date();
  const merged = { ...session, ...updates, updated_at: now.toISOString() };
  memorySessions.set(sessionId, merged);

  if (isSessionDbAvailable) {
    try {
      const keys = Object.keys(updates);
      if (keys.length === 0) return merged;

      const setClauses = [];
      const values = [sessionId];
      let idx = 2;

      for (const key of keys) {
        let val = updates[key];
        if (key === "trusted_contacts" || key === "metadata") {
          val = JSON.stringify(val);
        }
        setClauses.push(`${key} = $${idx}`);
        values.push(val);
        idx++;
      }
      setClauses.push(`updated_at = $${idx}`);
      values.push(now);

      const query = `
        UPDATE public.resq_sessions
        SET ${setClauses.join(", ")}
        WHERE session_id = $1
        RETURNING *
      `;
      const res = await pool.query(query, values);
      if (res.rows.length > 0) {
        return formatSessionRow(res.rows[0]);
      }
    } catch (err) {
      console.warn("DB update failed for session:", err.message);
    }
  }

  return merged;
}

// End a RESQ Mode session
export async function endResqSession(sessionId, userId) {
  const session = await findResqSessionById(sessionId);
  if (!session) return null;

  // Verify ownership
  if (userId && session.user_id !== userId) {
    throw new Error("Unauthorized to end this session");
  }

  const now = new Date();
  const updates = {
    is_active: false,
    status: SESSION_STATUS.ENDED,
    ended_at: now.toISOString(),
  };

  return await updateResqSession(sessionId, updates);
}

// Helper to format database row into clean session object
function formatSessionRow(row) {
  if (!row) return null;
  return {
    session_id: row.session_id,
    user_id: row.user_id,
    user_name: row.user_name,
    user_mobile: row.user_mobile,
    status: row.status,
    is_active: row.is_active,
    started_at: row.started_at ? new Date(row.started_at).toISOString() : null,
    ended_at: row.ended_at ? new Date(row.ended_at).toISOString() : null,
    last_location_at: row.last_location_at ? new Date(row.last_location_at).toISOString() : null,
    last_checkin_at: row.last_checkin_at ? new Date(row.last_checkin_at).toISOString() : null,
    safety_timer_minutes: row.safety_timer_minutes,
    timer_expires_at: row.timer_expires_at ? new Date(row.timer_expires_at).toISOString() : null,
    current_grid_id: row.current_grid_id,
    current_district: row.current_district,
    current_state: row.current_state,
    current_lat: row.current_lat ? parseFloat(row.current_lat) : null,
    current_lon: row.current_lon ? parseFloat(row.current_lon) : null,
    current_accuracy: row.current_accuracy ? parseFloat(row.current_accuracy) : null,
    static_risk: row.static_risk ? parseFloat(row.static_risk) : 0,
    dynamic_risk: row.dynamic_risk ? parseFloat(row.dynamic_risk) : 0,
    risk_score: row.risk_score ? parseFloat(row.risk_score) : 0,
    risk_status: row.risk_status || "LOW",
    risk_confidence: row.risk_confidence ? parseFloat(row.risk_confidence) : 0.9,
    trusted_contacts: typeof row.trusted_contacts === "string" ? JSON.parse(row.trusted_contacts) : (row.trusted_contacts || []),
    emergency_alert_id: row.emergency_alert_id,
    route_id: row.route_id,
    metadata: typeof row.metadata === "string" ? JSON.parse(row.metadata) : (row.metadata || {}),
    created_at: row.created_at ? new Date(row.created_at).toISOString() : null,
    updated_at: row.updated_at ? new Date(row.updated_at).toISOString() : null,
  };
}

export default {
  SESSION_STATUS,
  initializeSessionSchema,
  createResqSession,
  findResqSessionById,
  findActiveSessionByUserId,
  updateResqSession,
  endResqSession,
};
