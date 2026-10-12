import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import type { Settings } from "../config";
import type { Network } from "../network";
import type { Security } from "../security";

export function createDelivery(settings: Settings, network: Network, security: Security) {
  const alb = new aws.lb.LoadBalancer("load-balancer", {
    internal: true,
    loadBalancerType: "application",
    subnets: network.privateSubnets.map(subnet => subnet.id),
    securityGroups: [security.alb.id],
    dropInvalidHeaderFields: true,
    enableDeletionProtection: true,
    tags: settings.tags,
  });
  const target = new aws.lb.TargetGroup("app-target", {
    port: 8000,
    protocol: "HTTP",
    targetType: "ip",
    vpcId: network.vpc.id,
    deregistrationDelay: 30,
    healthCheck: {
      path: "/ready",
      matcher: "200",
      interval: 30,
      timeout: 10,
      healthyThreshold: 2,
      unhealthyThreshold: 3,
    },
    tags: settings.tags,
  });
  const listener = new aws.lb.Listener("http-listener", {
    loadBalancerArn: alb.arn,
    port: 80,
    protocol: "HTTP",
    defaultActions: [{ type: "forward", targetGroupArn: target.arn }],
    tags: settings.tags,
  });
  const origin = new aws.cloudfront.VpcOrigin("private-origin", {
    vpcOriginEndpointConfig: {
      name: "healthtrack-production-origin",
      arn: alb.arn,
      httpPort: 80,
      httpsPort: 443,
      originProtocolPolicy: "http-only",
      originSslProtocols: { items: ["TLSv1.2"], quantity: 1 },
    },
    tags: settings.tags,
  }, {
    dependsOn: [listener, network.gateway],
    customTimeouts: { create: "30m", delete: "30m" },
  });

  const waf = new aws.wafv2.WebAcl("edge-protection", {
    scope: "CLOUDFRONT",
    description: "HealthTrack managed edge protection",
    defaultAction: { allow: {} },
    visibilityConfig: {
      cloudwatchMetricsEnabled: true,
      metricName: "healthtrack-edge",
      sampledRequestsEnabled: true,
    },
    rules: [
      {
        name: "AWSCommonRules",
        priority: 10,
        overrideAction: { none: {} },
        statement: { managedRuleGroupStatement: { name: "AWSManagedRulesCommonRuleSet", vendorName: "AWS" } },
        visibilityConfig: { cloudwatchMetricsEnabled: true, metricName: "common-rules", sampledRequestsEnabled: true },
      },
      {
        name: "AWSKnownBadInputs",
        priority: 20,
        overrideAction: { none: {} },
        statement: { managedRuleGroupStatement: { name: "AWSManagedRulesKnownBadInputsRuleSet", vendorName: "AWS" } },
        visibilityConfig: { cloudwatchMetricsEnabled: true, metricName: "bad-inputs", sampledRequestsEnabled: true },
      },
      {
        name: "PerIpRateLimit",
        priority: 30,
        action: { block: {} },
        statement: { rateBasedStatement: { aggregateKeyType: "IP", limit: 1200 } },
        visibilityConfig: { cloudwatchMetricsEnabled: true, metricName: "ip-rate-limit", sampledRequestsEnabled: true },
      },
    ],
    tags: settings.tags,
  });

  const cache = aws.cloudfront.getCachePolicyOutput({ name: "Managed-CachingDisabled" });
  const request = aws.cloudfront.getOriginRequestPolicyOutput({ name: "Managed-AllViewer" });
  const securityHeaders = new aws.cloudfront.ResponseHeadersPolicy("security-headers", {
    securityHeadersConfig: {
      contentTypeOptions: { override: true },
      frameOptions: { frameOption: "DENY", override: true },
      referrerPolicy: { referrerPolicy: "strict-origin-when-cross-origin", override: true },
      strictTransportSecurity: {
        accessControlMaxAgeSec: 31536000,
        includeSubdomains: true,
        preload: false,
        override: true,
      },
      xssProtection: { modeBlock: true, protection: true, override: true },
    },
  });
  const distribution = new aws.cloudfront.Distribution("public-site", {
    enabled: true,
    comment: "HealthTrack production",
    priceClass: "PriceClass_100",
    httpVersion: "http2and3",
    isIpv6Enabled: true,
    webAclId: waf.arn,
    origins: [{
      originId: "healthtrack-app",
      domainName: alb.dnsName,
      vpcOriginConfig: {
        vpcOriginId: origin.id,
        originReadTimeout: 60,
        originKeepaliveTimeout: 5,
      },
    }],
    defaultCacheBehavior: {
      targetOriginId: "healthtrack-app",
      viewerProtocolPolicy: "redirect-to-https",
      allowedMethods: ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
      cachedMethods: ["GET", "HEAD"],
      cachePolicyId: cache.id,
      originRequestPolicyId: request.id,
      responseHeadersPolicyId: securityHeaders.id,
      compress: true,
    },
    restrictions: { geoRestriction: { restrictionType: "none" } },
    // AWS ignores custom TLS policies when its default *.cloudfront.net
    // certificate is used. HTTPS is still mandatory at the cache behavior.
    viewerCertificate: { cloudfrontDefaultCertificate: true },
    tags: settings.tags,
  });
  return {
    alb,
    target,
    listener,
    origin,
    waf,
    distribution,
    url: pulumi.interpolate`https://${distribution.domainName}`,
  };
}

export type Delivery = ReturnType<typeof createDelivery>;
