import { Deployment } from "@pulumi/kubernetes/apps/v1";
import { Service } from "@pulumi/kubernetes/core/v1/service";
import type { ComponentResourceOptions, Input, Output } from "@pulumi/pulumi";
import { ComponentResource, interpolate } from "@pulumi/pulumi";

import { SecureIngress } from "./SecureIngress";

export class Simulation extends ComponentResource {
  public endpoint: Output<string>;

  constructor(
    name: string,
    args: { image: Input<string> },
    opts: ComponentResourceOptions,
  ) {
    super("simulation", name, args, opts);

    const { image } = args;

    const labels = { name };

    const deployment = new Deployment(
      name,
      {
        metadata: { labels },
        spec: {
          selector: { matchLabels: labels },
          template: {
            metadata: { labels },
            spec: {
              containers: [
                {
                  name,
                  image,
                  tty: true,
                },
                {
                  name: "udp-websocket",
                  image: "gribbet/udp-websocket",
                  ports: [
                    { containerPort: 8080 },
                    { containerPort: 14550, protocol: "UDP" },
                  ],
                },
              ],
            },
          },
        },
      },
      { ...opts, parent: this },
    );

    const service = new Service(
      name,
      {
        spec: {
          selector: labels,
          ports: [
            {
              port: 80,
              targetPort: 8080,
            },
          ],
        },
      },
      { ...opts, parent: this, dependsOn: deployment },
    );

    const ingress = new SecureIngress(
      name,
      { service: service.metadata.name },
      { ...opts, parent: this },
    );

    this.endpoint = interpolate`wss://${ingress.host}`;
  }
}
