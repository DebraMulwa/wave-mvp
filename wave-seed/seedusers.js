import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import admin from "firebase-admin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PASSWORD = "Wave123!";

const users = [
  { email: "olivia.carter.brand@gmail.com", name: "Olivia Carter", role: "brand" },
  { email: "ethan.miller.brand@gmail.com", name: "Ethan Miller", role: "brand" },
  { email: "sophia.chen.brand@gmail.com", name: "Sophia Chen", role: "brand" },
  { email: "liam.johnson.brand@gmail.com", name: "Liam Johnson", role: "brand" },
  { email: "ava.patel.brand@gmail.com", name: "Ava Patel", role: "brand" },
  { email: "noah.williams.brand@gmail.com", name: "Noah Williams", role: "brand" },
  { email: "mia.garcia.brand@gmail.com", name: "Mia Garcia", role: "brand" },
  { email: "lucas.anderson.brand@gmail.com", name: "Lucas Anderson", role: "brand" },
  { email: "isabella.lopez.brand@gmail.com", name: "Isabella Lopez", role: "brand" },
  { email: "james.walker.brand@gmail.com", name: "James Walker", role: "brand" },
  { email: "amelia.scott.brand@gmail.com", name: "Amelia Scott", role: "brand" },
  { email: "henry.baker.brand@gmail.com", name: "Henry Baker", role: "brand" },
  { email: "grace.mitchell.brand@gmail.com", name: "Grace Mitchell", role: "brand" },
  { email: "jack.turner.brand@gmail.com", name: "Jack Turner", role: "brand" },
  { email: "scarlett.evans.brand@gmail.com", name: "Scarlett Evans", role: "brand" },
  { email: "benjamin.edwards.brand@gmail.com", name: "Benjamin Edwards", role: "brand" },
  { email: "harper.collins.brand@gmail.com", name: "Harper Collins", role: "brand" },
  { email: "sebastian.stewart.brand@gmail.com", name: "Sebastian Stewart", role: "brand" },
  { email: "evelyn.sanchez.brand@gmail.com", name: "Evelyn Sanchez", role: "brand" },
  { email: "wyatt.morris.brand@gmail.com", name: "Wyatt Morris", role: "brand" },
  { email: "alex.rivera.creator@gmail.com", name: "Alex Rivera", role: "influencer" },
  { email: "chloe.brown.creator@gmail.com", name: "Chloe Brown", role: "influencer" },
  { email: "jayden.kim.creator@gmail.com", name: "Jayden Kim", role: "influencer" },
  { email: "nina.davis.creator@gmail.com", name: "Nina Davis", role: "influencer" },
  { email: "leo.martin.creator@gmail.com", name: "Leo Martin", role: "influencer" },
  { email: "maya.singh.creator@gmail.com", name: "Maya Singh", role: "influencer" },
  { email: "daniel.clark.creator@gmail.com", name: "Daniel Clark", role: "influencer" },
  { email: "sofia.hernandez.creator@gmail.com", name: "Sofia Hernandez", role: "influencer" },
  { email: "ryan.thomas.creator@gmail.com", name: "Ryan Thomas", role: "influencer" },
  { email: "zara.ali.creator@gmail.com", name: "Zara Ali", role: "influencer" },
  { email: "kai.tan.creator@gmail.com", name: "Kai Tan", role: "influencer" },
  { email: "ella.moore.creator@gmail.com", name: "Ella Moore", role: "influencer" },
  { email: "aria.wood.creator@gmail.com", name: "Aria Wood", role: "influencer" },
  { email: "julian.price.creator@gmail.com", name: "Julian Price", role: "influencer" },
  { email: "layla.bennett.creator@gmail.com", name: "Layla Bennett", role: "influencer" },
  { email: "gabriel.foster.creator@gmail.com", name: "Gabriel Foster", role: "influencer" },
  { email: "zoe.gray.creator@gmail.com", name: "Zoe Gray", role: "influencer" },
  { email: "mason.russell.creator@gmail.com", name: "Mason Russell", role: "influencer" },
  { email: "lily.hughes.creator@gmail.com", name: "Lily Hughes", role: "influencer" },
  { email: "owen.ward.creator@gmail.com", name: "Owen Ward", role: "influencer" },
  { email: "hannah.cox.creator@gmail.com", name: "Hannah Cox", role: "influencer" },
  { email: "carter.richardson.creator@gmail.com", name: "Carter Richardson", role: "influencer" },
  { email: "aubrey.peterson.creator@gmail.com", name: "Aubrey Peterson", role: "influencer" },
  { email: "isaac.kelly.creator@gmail.com", name: "Isaac Kelly", role: "influencer" },
  { email: "admin@wave.io", name: "Wave Admin", role: "admin" },
  { email: "ops@wave.io", name: "Wave Ops", role: "admin" },
  { email: "superadmin@wave.io", name: "Wave Super Admin", role: "admin" },
  { email: "moderator@wave.io", name: "Wave Moderator", role: "admin" },
  { email: "platformlead@wave.io", name: "Wave Platform Lead", role: "admin" },
  { email: "analytics@wave.io", name: "Wave Analytics Admin", role: "admin" },
];

async function loadServiceAccount() {
  const files = await fs.readdir(__dirname);
  const jsonFiles = files.filter(
    (file) => file.endsWith(".json") && file !== "package.json" && file !== "package-lock.json"
  );

  for (const file of jsonFiles) {
    try {
      const raw = await fs.readFile(path.join(__dirname, file), "utf8");
      const parsed = JSON.parse(raw);

      if (
        parsed &&
        parsed.type === "service_account" &&
        typeof parsed.project_id === "string" &&
        typeof parsed.client_email === "string" &&
        typeof parsed.private_key === "string"
      ) {
        return parsed;
      }
    } catch (error) {
      console.warn(`Skipping ${file}: ${error.message}`);
    }
  }

  throw new Error(
    "No valid Firebase Admin service account JSON found in wave-seed/."
  );
}

async function seed() {
  const serviceAccount = await loadServiceAccount();

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });

  const auth = admin.auth();
  const db = admin.firestore();

  for (const user of users) {
    try {
      const userRecord = await auth.createUser({
        email: user.email,
        password: PASSWORD,
        displayName: user.name,
      });

      await db.collection("users").doc(userRecord.uid).set({
        email: user.email,
        fullName: user.name,
        name: user.name,
        role: user.role,
        createdAt: new Date().toISOString(),
      });

      console.log(`Created ${user.email}`);
    } catch (error) {
      console.log(`Skipped ${user.email}: ${error.message}`);
    }
  }

  console.log("Done seeding users.");
}

seed().catch((error) => {
  console.error("Failed to seed users:", error.message);
  process.exit(1);
});
