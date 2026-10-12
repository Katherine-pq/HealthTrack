import * as pulumi from "@pulumi/pulumi";

export function validateCapacity(cpu: number, memory: number, desiredCount: number) {
  const validMemory = cpu === 512 && [1024, 2048, 3072, 4096].includes(memory);
  if (!validMemory || desiredCount < 2 || desiredCount > 4) {
    throw new Error("Production guard: 512 CPU, 1024-4096 MiB and 2-4 tasks only.");
  }
}

export function configuration() {
  const config = new pulumi.Config();
  const cpu = config.getNumber("cpu") ?? 512;
  const memory = config.getNumber("memory") ?? 1024;
  const desiredCount = config.getNumber("desiredCount") ?? 2;
  validateCapacity(cpu, memory, desiredCount);

  const environment = config.get("environment") ?? "production";
  if (environment !== "production") throw new Error("This stack is restricted to production.");

  return {
    cpu,
    memory,
    desiredCount,
    environment,
    expectedAccount: config.require("expectedAccount"),
    imageTag: config.require("imageTag"),
    deploymentId: config.require("deploymentId"),
    databaseVersion: config.get("databaseVersion") ?? "18.6",
    backupRetentionDays: config.getNumber("backupRetentionDays") ?? 7,
    monthlyBudget: config.getNumber("monthlyBudgetUsd") ?? 150,
    alertEmail: config.get("alertEmail"),
    tags: {
      Project: "HealthTrack",
      Environment: environment,
      ManagedBy: "Pulumi",
      Owner: "HealthTrack",
    },
  };
}

export type Settings = ReturnType<typeof configuration>;
