import * as aws from "@pulumi/aws";
import type { Settings } from "../config";

export function createNetwork(settings: Settings) {
  const vpc = new aws.ec2.Vpc("network", {
    cidrBlock: "10.52.0.0/16",
    enableDnsHostnames: true,
    enableDnsSupport: true,
    tags: settings.tags,
  });
  const gateway = new aws.ec2.InternetGateway("gateway", {
    vpcId: vpc.id,
    tags: settings.tags,
  });
  const zones = aws.getAvailabilityZonesOutput({ state: "available" });
  const publicRoutes = new aws.ec2.RouteTable("public-routes", {
    vpcId: vpc.id,
    routes: [{ cidrBlock: "0.0.0.0/0", gatewayId: gateway.id }],
    tags: settings.tags,
  });
  const privateRoutes = new aws.ec2.RouteTable("private-routes", {
    vpcId: vpc.id,
    tags: settings.tags,
  });
  const publicSubnets = [0, 1].map(index => new aws.ec2.Subnet(`public-${index}`, {
    vpcId: vpc.id,
    availabilityZone: zones.names.apply(names => names[index]),
    cidrBlock: `10.52.${index}.0/24`,
    mapPublicIpOnLaunch: false,
    tags: { ...settings.tags, Tier: "Application" },
  }));
  const privateSubnets = [0, 1].map(index => new aws.ec2.Subnet(`private-${index}`, {
    vpcId: vpc.id,
    availabilityZone: zones.names.apply(names => names[index]),
    cidrBlock: `10.52.${10 + index}.0/24`,
    mapPublicIpOnLaunch: false,
    tags: { ...settings.tags, Tier: "Database" },
  }));
  publicSubnets.forEach((subnet, index) => new aws.ec2.RouteTableAssociation(
    `public-route-${index}`,
    { subnetId: subnet.id, routeTableId: publicRoutes.id },
  ));
  privateSubnets.forEach((subnet, index) => new aws.ec2.RouteTableAssociation(
    `private-route-${index}`,
    { subnetId: subnet.id, routeTableId: privateRoutes.id },
  ));
  return { vpc, gateway, publicSubnets, privateSubnets };
}

export type Network = ReturnType<typeof createNetwork>;
