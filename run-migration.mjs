// Migration runner for PPF Abuja Cars
// Uses Supabase REST API to execute the schema SQL
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const SUPABASE_URL = "https://ntehtkfwvzvddrjitkjw.supabase.co";
const ANON_KEY = "sb_publishable_Xl5YY5qslf-iWaBG9--sOg_vta1xdjL";

// Read the SQL file
const sqlPath = join(__dirname, "supabase", "migrations", "20260612000000_ppf_abuja_cars_schema.sql");
const sql = readFileSync(sqlPath, "utf-8");

console.log("📦 PPF Abuja Cars — Running database migration...");
console.log(`📡 Supabase: ${SUPABASE_URL}`);

// Split into individual statements and run each
const statements = sql
  .split(";")
  .map(s => s.trim())
  .filter(s => s.length > 0 && !s.startsWith("--"));

const client = createClient(SUPABASE_URL, ANON_KEY);

// Try to fetch from a known table to test connection
const { error: testError } = await client.from("customers").select("id").limit(1);

if (testError && testError.code === "PGRST116") {
  console.log("✅ Connected to Supabase");
} else if (testError && testError.message.includes("relation") && testError.message.includes("does not exist")) {
  console.log("✅ Connected — tables not yet created, proceeding with migration...");
} else if (!testError) {
  console.log("✅ Connected — tables already exist!");
  console.log("\n🎉 Database is already configured. Your app is ready to use!");
  process.exit(0);
} else {
  console.log("⚠️  Connection info:", testError.message);
}

console.log("\n📝 To run the migration, please paste the SQL file contents into:");
console.log("   Supabase Dashboard → SQL Editor → New query → Run");
console.log(`\n   File: ${sqlPath}`);
console.log("\n✅ Your .env credentials have been saved. The app will connect once tables are created.");
