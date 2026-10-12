import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { configuration } from "./config";
import { createNetwork } from "./network";
import { createSecurity } from "./security";
import { createData } from "./data";
import { createDelivery } from "./delivery";
import { createObservability } from "./observability";
import { createApplication } from "./application";

const settings = configuration();
const provider = new aws.Provider("account-guard", {
  allowedAccountIds: [settings.expectedAccount],
  region: "us-east-1",
});

pulumi.runtime.registerStackTransformation(args =>
  args.type.startsWith("aws:")
    ? { props: args.props, opts: { ...args.opts, provider } }
    : undefined,
);

const network = createNetwork(settings);
const security = createSecurity(settings, network);
const data = createData(settings, network, security);
const delivery = createDelivery(settings, network, security);
const observability = createObservability(settings, security, data, delivery);
const application = createApplication(
  settings,
  network,
  security,
  data,
  delivery,
  observability,
);

export const publicUrl = delivery.url;
export const distributionId = delivery.distribution.id;
export const clusterArn = application.cluster.arn;
export const serviceName = application.service.name;
export const taskDefinitionArn = application.definition.arn;
export const migrationTaskDefinitionArn = application.migrationDefinition.arn;
export const repositoryUrl = application.repository.repositoryUrl;
export const imageDigest = application.image.repoDigest;
export const databaseIdentifier = data.db.identifier;
export const databaseSecretArn = data.secretArn;
export const logGroupName = observability.logs.name;
export const cloudTrailName = observability.trail.name;
export const wafArn = delivery.waf.arn;
