// prisma/seed.cjs
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");

const prisma = new PrismaClient();

async function main() {
  const email = "demo@example.com";
  const password = "demo1234";
  const passwordHash = await bcrypt.hash(password, 12);

  const user = await prisma.user.upsert({
    where: { email },
    update: { emailVerifiedAt: new Date(), plan: "FREE" },
    create: { email, passwordHash, emailVerifiedAt: new Date(), plan: "FREE" },
  });

  console.log("Seeded user:", user.email, "password:", password);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
}).finally(async () => {
  await prisma.$disconnect();
});
