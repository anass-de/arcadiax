import fs from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

type HomeMediaItem = {
  id: string;
  url: string;
  type: "IMAGE" | "VIDEO" | string;
  title: string | null;
  createdAt: Date;
};

function toAbsolutePublicPath(publicUrl: string) {
  const normalized = publicUrl.replace(/^\/+/, "");
  return path.join(process.cwd(), "public", normalized);
}

async function fileExists(absolutePath: string) {
  try {
    await fs.access(absolutePath);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  const { prisma } = await import("../src/lib/prisma");

  console.log("🔎 Prüfe HomeMedia-Einträge...\n");

  const items = (await prisma.homeMedia.findMany({
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      url: true,
      type: true,
      title: true,
      createdAt: true,
    },
  })) as HomeMediaItem[];

  if (items.length === 0) {
    console.log("Keine HomeMedia-Einträge gefunden.");
    return;
  }

  console.log(`Gefunden: ${items.length} Einträge\n`);

  const brokenItems: HomeMediaItem[] = [];
  const skippedItems: HomeMediaItem[] = [];

  for (const item of items) {
    if (!item.url || !item.url.startsWith("/uploads/")) {
      skippedItems.push(item);
      continue;
    }

    const absolutePath = toAbsolutePublicPath(item.url);
    const exists = await fileExists(absolutePath);

    if (!exists) {
      brokenItems.push(item);
    }
  }

  if (skippedItems.length > 0) {
    console.log("Übersprungene Einträge ohne /uploads/-URL:");
    for (const item of skippedItems) {
      console.log(`- ${item.id} | ${item.url}`);
    }
    console.log("");
  }

  if (brokenItems.length === 0) {
    console.log("✅ Keine kaputten HomeMedia-Einträge gefunden.");
    return;
  }

  console.log(`❌ Kaputte Einträge gefunden: ${brokenItems.length}\n`);

  for (const item of brokenItems) {
    console.log(
      `- ${item.id} | ${item.type} | ${item.title ?? "Ohne Titel"} | ${item.url}`,
    );
  }

  console.log("\n🗑 Lösche kaputte DB-Einträge...");

  const result = await prisma.homeMedia.deleteMany({
    where: {
      id: {
        in: brokenItems.map((item) => item.id),
      },
    },
  });

  console.log(`✅ Gelöscht: ${result.count} Einträge.`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error("\n❌ cleanup-home-media Fehler:");
  console.error(error);
  process.exitCode = 1;
});