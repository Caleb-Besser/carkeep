import { readFile } from "node:fs/promises";
import { prisma } from "../src/lib/prisma";
import { parseLedgerTransactionsCsv } from "../src/lib/transaction-import";
import { importCsvLedger } from "../src/lib/server/csv-ledger-import";
import { rebuildPersonalFinanceSetup, reclassifyPersonalTransactions, removeCrossSourceDuplicates } from "../src/lib/server/personal-finance-setup";

async function main() {
  const csvPaths = process.argv.slice(2);
  const setup = await rebuildPersonalFinanceSetup();
  const imports = [];
  for (const path of csvPaths) {
    const parsed = parseLedgerTransactionsCsv(await readFile(path, "utf8"));
    imports.push({ path, ...(await importCsvLedger((await prisma.user.findFirstOrThrow()).id, parsed.source, parsed.transactions)) });
  }
  const user = await prisma.user.findFirstOrThrow();
  const classified = await reclassifyPersonalTransactions(user.id);
  const removedCrossSourceDuplicates = await removeCrossSourceDuplicates(user.id);
  const finalCount = await prisma.transaction.count({ where: { userId: user.id } });
  if (finalCount + removedCrossSourceDuplicates < setup.beforeCount) throw new Error("Transaction history count decreased beyond verified cross-source duplicates.");
  console.log(JSON.stringify({ setup, imports, classified, removedCrossSourceDuplicates, finalCount }, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Finance rebuild failed.");
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
