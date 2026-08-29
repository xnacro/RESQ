import gridService from "../services/gridService.js";
import pool from "../config/db.js";

async function main() {
  const force = process.argv.includes("--force");
  const stateArg = process.argv.find((arg) => arg.startsWith("--state="));
  const targetState = stateArg ? stateArg.split("=")[1] : null;

  console.log("🚀 Starting RESQ 500m Grid Generation...");
  console.log(`Parameters: force=${force}, targetState=${targetState || "ALL (Assam & Meghalaya)"}`);

  try {
    let result;
    if (targetState) {
      const stateResult = await gridService.generateStateGrid(targetState, { force });
      result = { [targetState]: stateResult };
    } else {
      result = await gridService.generateAllStateGrids({ force });
    }

    console.log("\n==========================================");
    console.log("🎉 Grid Generation Summary:");
    console.log(JSON.stringify(result, null, 2));
    console.log("==========================================\n");

    process.exit(0);
  } catch (error) {
    console.error("❌ Fatal error generating grid:", error);
    process.exit(1);
  }
}

main();
