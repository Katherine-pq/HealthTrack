import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import type { Settings } from "../config";
import type { Network } from "../network";
import type { Security } from "../security";

export function createData(settings: Settings, network: Network, security: Security) {
  const identifier = "healthtrack-production-db";
  const databaseLogs = new aws.cloudwatch.LogGroup("database-logs", {
    name: `/aws/rds/instance/${identifier}/postgresql`,
    retentionInDays: 30,
    kmsKeyId: security.encryptionKey.arn,
    tags: settings.tags,
  });
  const subnetGroup = new aws.rds.SubnetGroup("database-subnets", {
    subnetIds: network.privateSubnets.map(subnet => subnet.id),
    tags: settings.tags,
  });
  const parameterGroup = new aws.rds.ParameterGroup("database-parameters", {
    family: "postgres18",
    description: "HealthTrack PostgreSQL 18 TLS and security settings",
    parameters: [
      { name: "rds.force_ssl", value: "1", applyMethod: "pending-reboot" },
      { name: "log_connections", value: "all", applyMethod: "immediate" },
      { name: "log_disconnections", value: "1", applyMethod: "immediate" },
    ],
    tags: settings.tags,
  });
  const db = new aws.rds.Instance("database", {
    identifier,
    engine: "postgres",
    engineVersion: settings.databaseVersion,
    instanceClass: "db.t4g.micro",
    allocatedStorage: 20,
    maxAllocatedStorage: 100,
    storageType: "gp3",
    storageEncrypted: true,
    kmsKeyId: security.encryptionKey.arn,
    dbName: "healthtrack",
    username: "healthtrack_owner",
    manageMasterUserPassword: true,
    masterUserSecretKmsKeyId: security.encryptionKey.keyId,
    dbSubnetGroupName: subnetGroup.name,
    parameterGroupName: parameterGroup.name,
    vpcSecurityGroupIds: [security.db.id],
    publiclyAccessible: false,
    multiAz: true,
    backupRetentionPeriod: settings.backupRetentionDays,
    backupWindow: "05:00-05:30",
    maintenanceWindow: "sun:06:00-sun:07:00",
    autoMinorVersionUpgrade: true,
    allowMajorVersionUpgrade: false,
    performanceInsightsEnabled: true,
    performanceInsightsRetentionPeriod: 7,
    performanceInsightsKmsKeyId: security.encryptionKey.arn,
    deletionProtection: true,
    skipFinalSnapshot: false,
    finalSnapshotIdentifier: `healthtrack-production-final-${settings.deploymentId}`,
    copyTagsToSnapshot: true,
    deleteAutomatedBackups: false,
    enabledCloudwatchLogsExports: ["postgresql"],
    tags: {
      ...settings.tags,
      created_by: "rds-oss-skill",
      generation_model: "gpt-5",
    },
  }, { dependsOn: [databaseLogs] });
  const secretArn = db.masterUserSecrets.apply(secrets => {
    if (!secrets[0]?.secretArn) throw new Error("RDS did not expose a managed master secret ARN.");
    return secrets[0].secretArn;
  });
  return { db, secretArn, databaseLogs, parameterGroup };
}

export type Data = ReturnType<typeof createData>;
