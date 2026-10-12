import * as aws from "@pulumi/aws";
import * as command from "@pulumi/command";
import * as docker from "@pulumi/docker";
import * as pulumi from "@pulumi/pulumi";
import * as path from "node:path";
import type { Settings } from "../config";
import type { Network } from "../network";
import type { Security } from "../security";
import type { Data } from "../data";
import type { Delivery } from "../delivery";
import type { Observability } from "../observability";

export function createApplication(
  settings: Settings,
  network: Network,
  security: Security,
  data: Data,
  delivery: Delivery,
  observability: Observability,
) {
  const region = aws.getRegionOutput();
  const repository = new aws.ecr.Repository("app-images", {
    imageTagMutability: "IMMUTABLE",
    imageScanningConfiguration: { scanOnPush: true },
    encryptionConfigurations: [{ encryptionType: "KMS", kmsKey: security.encryptionKey.arn }],
    forceDelete: false,
    tags: settings.tags,
  });
  new aws.ecr.LifecyclePolicy("image-retention", {
    repository: repository.name,
    policy: JSON.stringify({ rules: [{
      rulePriority: 1,
      description: "Keep the last ten images",
      selection: { tagStatus: "any", countType: "imageCountMoreThan", countNumber: 10 },
      action: { type: "expire" },
    }] }),
  });
  const auth = aws.ecr.getAuthorizationTokenOutput({ registryId: repository.registryId });
  const image = new docker.Image("app-image", {
    imageName: pulumi.interpolate`${repository.repositoryUrl}:${settings.imageTag}`,
    build: {
      context: path.resolve(__dirname, "../../../.."),
      dockerfile: path.resolve(__dirname, "../../../../Dockerfile"),
      platform: "linux/amd64",
    },
    registry: {
      server: auth.proxyEndpoint,
      username: auth.userName,
      password: pulumi.secret(auth.password),
    },
  });

  const secretAccess = new aws.iam.RolePolicy("execution-secret-access", {
    role: security.execution.name,
    policy: aws.iam.getPolicyDocumentOutput({ statements: [{
      actions: ["secretsmanager:GetSecretValue"],
      resources: [data.secretArn],
    }, {
      actions: ["kms:Decrypt"],
      resources: [security.encryptionKey.arn],
    }] }).json,
  });
  const cluster = new aws.ecs.Cluster("app-cluster", {
    settings: [{ name: "containerInsights", value: "enhanced" }],
    tags: settings.tags,
  });
  const containerDefinitions = (migration: boolean) => pulumi.jsonStringify([{
    name: "app",
    image: image.repoDigest,
    essential: true,
    user: "app",
    readonlyRootFilesystem: true,
    ...(migration
      ? { command: ["alembic", "-c", "/app/alembic.ini", "upgrade", "head"] }
      : {
          portMappings: [{ containerPort: 8000, protocol: "tcp" }],
          healthCheck: {
            command: ["CMD-SHELL", "python -c \"import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/health', timeout=3)\" || exit 1"],
            interval: 30,
            timeout: 5,
            retries: 3,
            startPeriod: 60,
          },
        }),
    environment: [
      { name: "APP_ENVIRONMENT", value: "production" },
      { name: "PUBLIC_URL", value: delivery.url },
      { name: "POSTGRES_HOST", value: data.db.address },
      { name: "POSTGRES_PORT", value: "5432" },
      { name: "POSTGRES_DB", value: "healthtrack" },
      { name: "POSTGRES_SSLMODE", value: "require" },
      { name: "PYTHONUNBUFFERED", value: "1" },
      { name: "PYTHONDONTWRITEBYTECODE", value: "1" },
    ],
    secrets: [
      { name: "POSTGRES_USER", valueFrom: pulumi.interpolate`${data.secretArn}:username::` },
      { name: "POSTGRES_PASSWORD", valueFrom: pulumi.interpolate`${data.secretArn}:password::` },
    ],
    logConfiguration: {
      logDriver: "awslogs",
      options: {
        "awslogs-group": observability.logs.name,
        "awslogs-region": region.region,
        "awslogs-stream-prefix": migration ? "migration" : "application",
        mode: "blocking",
      },
    },
  }]);
  const task = (name: string, migration: boolean) => new aws.ecs.TaskDefinition(name, {
    family: `healthtrack-production-${name}`,
    networkMode: "awsvpc",
    requiresCompatibilities: ["FARGATE"],
    cpu: String(settings.cpu),
    memory: String(settings.memory),
    runtimePlatform: { operatingSystemFamily: "LINUX", cpuArchitecture: "X86_64" },
    executionRoleArn: security.execution.arn,
    taskRoleArn: security.task.arn,
    containerDefinitions: containerDefinitions(migration),
    tags: settings.tags,
  }, { dependsOn: [secretAccess] });

  const migrationDefinition = task("migration", true);
  const migrationScript = path.resolve(__dirname, "../../scripts/Run-Migration.ps1");
  const migrationCommand = pulumi.interpolate`& '${migrationScript}' -Cluster '${cluster.arn}' -TaskDefinition '${migrationDefinition.arn}' -Subnet '${network.publicSubnets[0].id}' -SecurityGroup '${security.app.id}' -Region '${region.region}'`;
  const migration = new command.local.Command("apply-database-migrations", {
    interpreter: ["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-Command"],
    create: migrationCommand,
    triggers: [image.repoDigest, migrationDefinition.arn],
  }, {
    dependsOn: [data.db, secretAccess],
    customTimeouts: { create: "20m" },
  });

  const definition = task("web", false);
  const service = new aws.ecs.Service("app-service", {
    cluster: cluster.arn,
    taskDefinition: definition.arn,
    desiredCount: settings.desiredCount,
    launchType: "FARGATE",
    platformVersion: "LATEST",
    networkConfiguration: {
      assignPublicIp: true,
      subnets: network.publicSubnets.map(subnet => subnet.id),
      securityGroups: [security.app.id],
    },
    loadBalancers: [{
      targetGroupArn: delivery.target.arn,
      containerName: "app",
      containerPort: 8000,
    }],
    deploymentMinimumHealthyPercent: 100,
    deploymentMaximumPercent: 200,
    deploymentCircuitBreaker: { enable: true, rollback: true },
    healthCheckGracePeriodSeconds: 90,
    waitForSteadyState: true,
    enableExecuteCommand: false,
    tags: settings.tags,
  }, {
    dependsOn: [migration, delivery.listener],
    customTimeouts: { create: "25m", update: "25m" },
  });

  const scalingTarget = new aws.appautoscaling.Target("service-scaling", {
    maxCapacity: 4,
    minCapacity: settings.desiredCount,
    resourceId: pulumi.interpolate`service/${cluster.name}/${service.name}`,
    scalableDimension: "ecs:service:DesiredCount",
    serviceNamespace: "ecs",
  });
  new aws.appautoscaling.Policy("cpu-scaling", {
    policyType: "TargetTrackingScaling",
    resourceId: scalingTarget.resourceId,
    scalableDimension: scalingTarget.scalableDimension,
    serviceNamespace: scalingTarget.serviceNamespace,
    targetTrackingScalingPolicyConfiguration: {
      targetValue: 70,
      scaleInCooldown: 300,
      scaleOutCooldown: 60,
      predefinedMetricSpecification: { predefinedMetricType: "ECSServiceAverageCPUUtilization" },
    },
  });
  return { repository, image, cluster, service, definition, migrationDefinition, migration };
}
