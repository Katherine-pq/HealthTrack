require('ts-node/register/transpile-only');
const { test, before } = require('node:test');
const assert = require('node:assert/strict');
const pulumi = require('@pulumi/pulumi');
const resources = [];

process.env.PULUMI_CONFIG = JSON.stringify({
  'healthtrack-aws:expectedAccount': '948218213320',
  'healthtrack-aws:imageTag': 'test',
  'healthtrack-aws:deploymentId': '20261012000000',
});

pulumi.runtime.setMocks({
  newResource(args) {
    resources.push(args);
    const state = {
      ...args.inputs,
      arn: `arn:aws:test:::${args.name}`,
      name: args.inputs.name || args.name,
      address: 'database.invalid',
      domainName: 'site.cloudfront.net',
      dnsName: 'internal.invalid',
      arnSuffix: args.name,
      registryId: '948218213320',
      repositoryUrl: 'repository.invalid/app',
      repoDigest: 'repository.invalid/app@sha256:test',
    };
    if (args.type === 'aws:rds/instance:Instance') {
      state.masterUserSecrets = [{ secretArn: 'arn:aws:secretsmanager:us-east-1:948218213320:secret:test' }];
    }
    return { id: `${args.name}-id`, state };
  },
  call(args) {
    if (args.token.includes('getAvailabilityZones')) return { names: ['us-east-1a', 'us-east-1b'] };
    if (args.token.includes('getPolicyDocument')) return { json: JSON.stringify(args.inputs) };
    if (args.token.includes('getAuthorizationToken')) return { userName: 'AWS', password: 'mock-token', proxyEndpoint: 'https://registry.invalid' };
    if (args.token.includes('getRegion')) return { region: 'us-east-1', name: 'us-east-1' };
    if (args.token.includes('getCallerIdentity')) return { accountId: '948218213320', arn: 'arn:aws:iam::948218213320:user/test', userId: 'test' };
    if (args.token.includes('getManagedPrefixList')) return { id: 'pl-cloudfront' };
    return { ...args.inputs, id: 'managed-resource' };
  },
}, 'healthtrack-aws', 'production', false);

before(async () => {
  let stack;
  await pulumi.runtime.runInPulumiStack(async () => { stack = require('../src/index'); });
  await Promise.all(Object.values(stack).map(value => pulumi.output(value).promise()));
  await pulumi.runtime.waitForRPCs();
});

const ofType = type => resources.filter(resource => resource.type === type);

test('RDS is private, encrypted, Multi-AZ and protected', () => {
  const db = ofType('aws:rds/instance:Instance')[0].inputs;
  assert.equal(db.publiclyAccessible, false);
  assert.equal(db.storageEncrypted, true);
  assert.equal(db.multiAz, true);
  assert.equal(db.deletionProtection, true);
  assert.equal(db.manageMasterUserPassword, true);
  assert.equal(db.backupRetentionPeriod, 7);
  assert.equal(db.performanceInsightsEnabled, true);
});

test('CloudFront uses a private VPC origin, HTTPS and WAF', () => {
  assert.equal(ofType('aws:lb/loadBalancer:LoadBalancer')[0].inputs.internal, true);
  const distribution = ofType('aws:cloudfront/distribution:Distribution')[0].inputs;
  assert.ok(distribution.origins[0].vpcOriginConfig);
  assert.equal(distribution.defaultCacheBehavior.viewerProtocolPolicy, 'redirect-to-https');
  assert.ok(distribution.webAclId);
});

test('application and database ports are never public', () => {
  const rules = ofType('aws:vpc/securityGroupIngressRule:SecurityGroupIngressRule');
  assert.ok(rules.every(rule => rule.inputs.cidrIpv4 !== '0.0.0.0/0'));
  assert.ok(rules.filter(rule => [8000, 5432].includes(rule.inputs.fromPort)).every(rule => rule.inputs.referencedSecurityGroupId));
});

test('Fargate is bounded, immutable and uses secret references', () => {
  for (const task of ofType('aws:ecs/taskDefinition:TaskDefinition')) {
    assert.equal(task.inputs.networkMode, 'awsvpc');
    assert.equal(task.inputs.cpu, '512');
    assert.equal(task.inputs.memory, '1024');
    const container = JSON.parse(task.inputs.containerDefinitions)[0];
    assert.equal(container.readonlyRootFilesystem, true);
    assert.equal(container.secrets.length, 2);
    assert.ok(container.environment.every(item => !/password|secret/i.test(item.name)));
  }
  const service = ofType('aws:ecs/service:Service')[0].inputs;
  assert.equal(service.desiredCount, 2);
  assert.equal(service.deploymentCircuitBreaker.rollback, true);
});

test('audit, logs, alarms and budget are provisioned', () => {
  assert.equal(ofType('aws:cloudtrail/trail:Trail').length, 1);
  assert.ok(ofType('aws:cloudwatch/logGroup:LogGroup').every(group => group.inputs.kmsKeyId));
  assert.ok(ofType('aws:cloudwatch/metricAlarm:MetricAlarm').length >= 3);
  assert.equal(ofType('aws:budgets/budget:Budget')[0].inputs.limitAmount, '150');
});

test('capacity guard rejects under-provisioned production', () => {
  const { validateCapacity } = require('../src/config');
  assert.throws(() => validateCapacity(256, 512, 1));
  assert.doesNotThrow(() => validateCapacity(512, 1024, 2));
});
