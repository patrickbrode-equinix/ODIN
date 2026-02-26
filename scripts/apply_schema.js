
import "dotenv/config";
import { initSchema } from "../backend/db/initSchema.js";
import db from "../backend/db.js";

async function run() {
    console.log("Applying schema updates...");
    try {
        const success = await db.testConnection();
        if (!success) {
            console.error("DB Connection failed");
            process.exit(1);
        }
        await initSchema();
        console.log("Schema applied successfully.");
        process.exit(0);
    } catch (err) {
        console.error("Error:", err);
        process.exit(1);
    }
}

run();
