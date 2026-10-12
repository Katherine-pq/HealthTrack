import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import type { Settings } from "../config";
import type { Security } from "../security";
import type { Data } from "../data";
import type { Delivery } from "../delivery";

export function createObservability(
  settings: Settings,
  security: Security,
  data: Data,
  delivery: Delivery,
) {
  const account = aws.getCallerIdentityOutput();
  const region = aws.getRegionOutput();
  const logs = new aws.cloudwatch.LogGroup("application-logs", {
    name: "/aws/healthtrack/production/application",
    retentionInDays: 30,
    kmsKeyId: security.encryptionKey.arn,
    tags: settings.tags,
  });
  const topic = new aws.sns.Topic("operations-alerts", {
    kmsMasterKeyId: security.encryptionKey.id,
    tags: settings.tags,
  });
  if (settings.alertEmail) {
    new aws.sns.TopicSubscription("email-alerts", {
      topic: topic.arn,
      protocol: "email",
      endpoint: settings.alertEmail,
    });
  }
  new aws.cloudwatch.MetricAlarm("unhealthy-targets", {
    namespace: "AWS/ApplicationELB",
    metricName: "UnHealthyHostCount",
    statistic: "Maximum",
    period: 60,
    evaluationPeriods: 3,
    comparisonOperator: "GreaterThanThreshold",
    threshold: 0,
    treatMissingData: "notBreaching",
    dimensions: { LoadBalancer: delivery.alb.arnSuffix, TargetGroup: delivery.target.arnSuffix },
    alarmActions: [topic.arn],
    tags: settings.tags,
  });
  new aws.cloudwatch.MetricAlarm("database-cpu", {
    namespace: "AWS/RDS",
    metricName: "CPUUtilization",
    statistic: "Average",
    period: 300,
    evaluationPeriods: 3,
    comparisonOperator: "GreaterThanThreshold",
    threshold: 80,
    treatMissingData: "notBreaching",
    dimensions: { DBInstanceIdentifier: data.db.identifier },
    alarmActions: [topic.arn],
    tags: settings.tags,
  });
  new aws.cloudwatch.MetricAlarm("database-storage", {
    namespace: "AWS/RDS",
    metricName: "FreeStorageSpace",
    statistic: "Average",
    period: 300,
    evaluationPeriods: 2,
    comparisonOperator: "LessThanThreshold",
    threshold: 5 * 1024 * 1024 * 1024,
    treatMissingData: "notBreaching",
    dimensions: { DBInstanceIdentifier: data.db.identifier },
    alarmActions: [topic.arn],
    tags: settings.tags,
  });
  new aws.budgets.Budget("monthly-budget", {
    name: "HealthTrack-Production",
    budgetType: "COST",
    limitAmount: String(settings.monthlyBudget),
    limitUnit: "USD",
    timeUnit: "MONTHLY",
    costFilters: [{ name: "TagKeyValue", values: ["user:Project$HealthTrack"] }],
    notifications: settings.alertEmail ? [50, 80, 100].map(threshold => ({
      comparisonOperator: "GREATER_THAN",
      threshold,
      thresholdType: "PERCENTAGE",
      notificationType: "ACTUAL",
      subscriberEmailAddresses: [settings.alertEmail!],
    })) : [],
  });

  const auditBucket = new aws.s3.Bucket("audit-records", {
    forceDestroy: false,
    tags: settings.tags,
  });
  new aws.s3.BucketPublicAccessBlock("audit-public-access", {
    bucket: auditBucket.id,
    blockPublicAcls: true,
    blockPublicPolicy: true,
    ignorePublicAcls: true,
    restrictPublicBuckets: true,
  });
  new aws.s3.BucketVersioning("audit-versioning", {
    bucket: auditBucket.id,
    versioningConfiguration: { status: "Enabled" },
  });
  new aws.s3.BucketServerSideEncryptionConfiguration("audit-encryption", {
    bucket: auditBucket.id,
    rules: [{ applyServerSideEncryptionByDefault: {
      sseAlgorithm: "aws:kms",
      kmsMasterKeyId: security.encryptionKey.arn,
    } }],
  });
  const trailName = "healthtrack-production";
  const trailArn = pulumi.interpolate`arn:aws:cloudtrail:${region.region}:${account.accountId}:trail/${trailName}`;
  const bucketPolicy = new aws.s3.BucketPolicy("audit-policy", {
    bucket: auditBucket.id,
    policy: pulumi.jsonStringify({
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "CloudTrailAclCheck",
          Effect: "Allow",
          Principal: { Service: "cloudtrail.amazonaws.com" },
          Action: "s3:GetBucketAcl",
          Resource: auditBucket.arn,
          Condition: { StringEquals: { "AWS:SourceArn": trailArn } },
        },
        {
          Sid: "CloudTrailWrite",
          Effect: "Allow",
          Principal: { Service: "cloudtrail.amazonaws.com" },
          Action: "s3:PutObject",
          Resource: pulumi.interpolate`${auditBucket.arn}/cloudtrail/AWSLogs/${account.accountId}/*`,
          Condition: { StringEquals: {
            "s3:x-amz-acl": "bucket-owner-full-control",
            "AWS:SourceArn": trailArn,
          } },
        },
      ],
    }),
  });
  const trail = new aws.cloudtrail.Trail("audit-trail", {
    name: trailName,
    s3BucketName: auditBucket.id,
    s3KeyPrefix: "cloudtrail",
    kmsKeyId: security.encryptionKey.arn,
    enableLogFileValidation: true,
    includeGlobalServiceEvents: true,
    isMultiRegionTrail: true,
    tags: settings.tags,
  }, { dependsOn: [bucketPolicy] });
  return { logs, topic, trail, auditBucket };
}

export type Observability = ReturnType<typeof createObservability>;
