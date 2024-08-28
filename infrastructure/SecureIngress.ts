import { Record } from "@pulumi/aws/route53";
import { Ingress } from "@pulumi/kubernetes/networking/v1/ingress";
import type { CustomResourceOptions, Input, Output } from "@pulumi/pulumi";
import { ComponentResource, interpolate } from "@pulumi/pulumi";

import { letsencrypt, zoneId, zoneName } from "./cluster";

export type SecureIngressArgs = {
  service: Input<string>;
};

export class SecureIngress extends ComponentResource {
  host: Output<string>;

  constructor(
    name: string,
    args: SecureIngressArgs,
    opts?: CustomResourceOptions,
  ) {
    super("secure-ingress", name, args, opts);

    const { service } = args;

    const host = interpolate`${name}.${zoneName}`;

    const ingress = new Ingress(
      name,
      {
        metadata: {
          annotations: {
            "kubernetes.io/ingress.class": "nginx",
            "cert-manager.io/issuer": letsencrypt.metadata.name,
            "nginx.ingress.kubernetes.io/proxy-read-timeout": "600",
          },
        },
        spec: {
          rules: [
            {
              host,
              http: {
                paths: [
                  {
                    path: "/",
                    pathType: "Prefix",
                    backend: {
                      service: { name: service, port: { number: 80 } },
                    },
                  },
                ],
              },
            },
          ],
          tls: [
            {
              secretName: name,
              hosts: [host],
            },
          ],
        },
      },
      { ...opts, parent: this },
    );

    new Record(
      name,
      {
        name: interpolate`${name}.`,
        zoneId,
        type: "CNAME",
        ttl: 300,
        records: [ingress.status.loadBalancer.ingress[0].hostname],
      },
      { ...opts, provider: undefined, parent: this },
    );

    this.host = host;
  }
}
