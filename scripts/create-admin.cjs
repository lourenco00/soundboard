// scripts/create-admin.cjs
// One-off: create (or upgrade) a verified PRO user.
// Usage:
//   node scripts/create-admin.cjs <email> <password>
// Example:
//   node scripts/create-admin.cjs me@example.com 'SuperSecret123'
//
// Re-running with an existing email updates the password and ensures
// the account is verified + on the PRO plan.

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  const email = (process.argv[2] || "").trim().toLowerCase();
  const password = process.argv[3] || "";

  if (!email || !password) {
    console.error("Usage: node scripts/create-admin.cjs <email> <password>");
    process.exit(1);
  }
  if (password.length < 6) {
    console.error("Password must be at least 6 characters.");
    process.exit(1);
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: {
      passwordHash,
      emailVerifiedAt: new Date(),
      plan: "PRO",
    },
    create: {
      email,
      passwordHash,
      emailVerifiedAt: new Date(),
      plan: "PRO",
    },
  });

  console.log("✅ Admin user ready:");
  console.log("   id:    ", user.id);
  console.log("   email: ", user.email);
  console.log("   plan:  ", user.plan);
  console.log("   verified:", !!user.emailVerifiedAt);
}

main()
  .catch((e) => {
    console.error("❌ Failed:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
