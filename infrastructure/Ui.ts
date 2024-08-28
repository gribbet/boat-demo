import { Deployment } from "@pulumi/kubernetes/apps/v1";
import { Service } from "@pulumi/kubernetes/core/v1";
import type { ComponentResourceOptions, Input, Output } from "@pulumi/pulumi";
import { ComponentResource } from "@pulumi/pulumi";

import { SecureIngress } from "./SecureIngress";

export class Ui extends ComponentResource {
  public address: Output<string>;

  constructor(
    name: string,
    args: { image: Input<string> },
    opts: ComponentResourceOptions,
  ) {
    super("ui", name, args, opts);

    const { image } = args;

    const labels = { name };

    new Deployment(
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
                  ports: [{ containerPort: 80 }],
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
        metadata: { labels },
        spec: {
          selector: labels,
          ports: [{ port: 80 }],
        },
      },

      { ...opts, parent: this },
    );

    const ingress = new SecureIngress(
      name,
      { service: service.metadata.name },
      { ...opts, parent: this },
    );

    this.address = ingress.host;
  }
}
