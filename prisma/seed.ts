import "dotenv/config";
import { PrismaClient, Role, ReleaseStatus } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const prisma = new PrismaClient({
  adapter: new PrismaPg(pool),
});

function slugify(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

async function main() {
  const adminEmail = "admin@arcadiax.com";
  const adminPasswordHash = await bcrypt.hash("admin123456", 12);

  const admin = await prisma.user.upsert({
    where: {
      email: adminEmail,
    },
    update: {},
    create: {
      email: adminEmail,
      username: "admin",
      name: "ArcadiaX Admin",
      role: Role.ADMIN,
      passwordHash: adminPasswordHash,
    },
    select: {
      id: true,
      email: true,
      username: true,
    },
  });

  const releases = [
    {
      title: "ArcadiaX v0.1",
      version: "0.1.0",
      description: "First public test release",
      fileUrl: "https://example.com/arcadiax-0.1.0.zip",
      imageUrl: null,
      status: ReleaseStatus.PUBLISHED,
    },
    {
      title: "ArcadiaX v0.2",
      version: "0.2.0",
      description: "Improved UI + bugfixes",
      fileUrl: "https://example.com/arcadiax-0.2.0.zip",
      imageUrl: null,
      status: ReleaseStatus.PUBLISHED,
    },
  ];

  for (const item of releases) {
    const slug = slugify(`${item.title}-${item.version}`);

    await prisma.release.upsert({
      where: {
        slug,
      },
      update: {
        title: item.title,
        version: item.version,
        description: item.description,
        fileUrl: item.fileUrl,
        imageUrl: item.imageUrl,
        status: item.status,
        authorId: admin.id,
      },
      create: {
        title: item.title,
        version: item.version,
        slug,
        description: item.description,
        fileUrl: item.fileUrl,
        imageUrl: item.imageUrl,
        status: item.status,
        authorId: admin.id,
      },
    });
  }

  console.log("✅ Seed done");
  console.log(`Admin: ${admin.email} (${admin.username})`);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed");
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });