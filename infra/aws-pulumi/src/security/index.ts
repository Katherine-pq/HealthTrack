import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import type { Settings } from "../config";
import type { Network } from "../network";

export function createSecurity(settings: Settings, network: Network) {
  const account = aws.getCallerIdentityOutput();
  const region = aws.getRegionOutput();
  const encryptionKey = new aws.kms.Key("project-encryption", {
    description: "HealthTrack production encryption",
    enableKeyRotation: true,
    deletionWindowInDays: 30,
    policy: pulumi.jsonStringify({
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "AccountAdministration",
          Effect: "Allow",
          Principal: { AWS: pulumi.interpolate`arn:aws:iam::${account.accountId}:root` },
          Action: "kms:*",
          Resource: "*",
        },
        {
          Sid: "CloudWatchLogsEncryption",
          Effect: "Allow",
          Principal: { Service: pulumi.interpolate`logs.${region.region}.amazonaws.com` },
          Action: ["kms:Encrypt", "kms:Decrypt", "kms:ReEncrypt*", "kms:GenerateDataKey*", "kms:DescribeKey"],
          Resource: "*",
          Condition: {
            ArnLike: {
              "kms:EncryptionContext:aws:logs:arn": pulumi.interpolate`arn:aws:logs:${region.region}:${account.accountId}:log-group:*`,
            },
          },
        },
        {
          Sid: "CloudTrailEncryption",
          Effect: "Allow",
          Principal: { Service: "cloudtrail.amazonaws.com" },
          Action: ["kms:GenerateDataKey*", "kms:DescribeKey"],
          Resource: "*",
          Condition: {
            StringEquals: { "aws:SourceAccount": account.accountId },
            StringLike: {
              "kms:EncryptionContext:aws:cloudtrail:arn": pulumi.interpolate`arn:aws:cloudtrail:*:${account.accountId}:trail/*`,
            },
          },
        },
      ],
    }),
    tags: settings.tags,
  });
  new aws.kms.Alias("project-encryption-alias", {
    name: "alias/healthtrack-production",
    targetKeyId: encryptionKey.keyId,
  });

  const group = (name: string) => new aws.ec2.SecurityGroup(name, {
    vpcId: network.vpc.id,
    tags: settings.tags,
  });
  const alb = group("alb-security");
  const app = group("app-security");
  const db = group("db-security");
  const cloudFrontPrefix = aws.ec2.getManagedPrefixListOutput({
    name: "com.amazonaws.global.cloudfront.origin-facing",
  });
  new aws.vpc.SecurityGroupIngressRule("cloudfront-to-alb", {
    securityGroupId: alb.id,
    ipProtocol: "tcp",
    fromPort: 80,
    toPort: 80,
    prefixListId: cloudFrontPrefix.id,
    tags: settings.tags,
  });
  const link = (
    name: string,
    source: aws.ec2.SecurityGroup,
    target: aws.ec2.SecurityGroup,
    port: number,
  ) => {
    new aws.vpc.SecurityGroupIngressRule(`${name}-in`, {
      securityGroupId: target.id,
      referencedSecurityGroupId: source.id,
      ipProtocol: "tcp",
      fromPort: port,
      toPort: port,
      tags: settings.tags,
    });
    new aws.vpc.SecurityGroupEgressRule(`${name}-out`, {
      securityGroupId: source.id,
      referencedSecurityGroupId: target.id,
      ipProtocol: "tcp",
      fromPort: port,
      toPort: port,
      tags: settings.tags,
    });
  };
  link("alb-app", alb, app, 8000);
  link("app-db", app, db, 5432);
  new aws.vpc.SecurityGroupEgressRule("app-https", {
    securityGroupId: app.id,
    cidrIpv4: "0.0.0.0/0",
    ipProtocol: "tcp",
    fromPort: 443,
    toPort: 443,
    tags: settings.tags,
  });

  const assumeRolePolicy = aws.iam.getPolicyDocumentOutput({ statements: [{
    actions: ["sts:AssumeRole"],
    principals: [{ type: "Service", identifiers: ["ecs-tasks.amazonaws.com"] }],
  }] }).json;
  const execution = new aws.iam.Role("execution-role", {
    assumeRolePolicy,
    tags: settings.tags,
  });
  new aws.iam.RolePolicyAttachment("execution-base", {
    role: execution.name,
    policyArn: "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy",
  });
  const task = new aws.iam.Role("task-role", {
    assumeRolePolicy,
    tags: settings.tags,
  });
  return { alb, app, db, execution, task, encryptionKey };
}

export type Security = ReturnType<typeof createSecurity>;
