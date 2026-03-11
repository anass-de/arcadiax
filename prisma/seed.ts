import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

async function main() {
  await prisma.release.createMany({
    data: [
      {
        title: "ArcadiaX v0.1",
        version: "0.1.0",
        description: "First public test release",
        fileUrl: "https://example.com/arcadiax-0.1.0.zip",
      },
      {
        title: "ArcadiaX v0.2",
        version: "0.2.0",
        description: "Improved UI + bugfixes",
        fileUrl: "https://example.com/arcadiax-0.2.0.zip",
      },
    ],
    skipDuplicates: true,
  });

  console.log("✅ Seed done");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });