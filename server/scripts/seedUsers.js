// Seed script to initialize user roles and demo accounts in PostgreSQL
import { initializeUserSchema, getAllUsers } from "../models/userModel.js";

async function seed() {
  console.log("=== RESQ Authentication Seeding Script ===");
  console.log("Initializing user schema and demo accounts...");

  await initializeUserSchema();
  const users = await getAllUsers();

  console.log("\nRegistered Demo Accounts for IIT Hackathon Evaluation:");
  console.log("-------------------------------------------------------");
  users.forEach((u) => {
    console.log(`• [${u.role}] ${u.email} - ${u.name} (${u.department || 'Operations'})`);
  });
  console.log("\nDefault Demo Password: Resq@2026!");
  console.log("-------------------------------------------------------");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding error:", err);
  process.exit(1);
});
