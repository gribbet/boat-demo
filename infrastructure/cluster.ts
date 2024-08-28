import { Zone } from "@pulumi/aws/route53";
import { Cluster } from "@pulumi/eks";
import { Provider } from "@pulumi/kubernetes";
import { CustomResource } from "@pulumi/kubernetes/apiextensions";
import { CertManager } from "@pulumi/kubernetes-cert-manager";
import { IngressController } from "@pulumi/kubernetes-ingress-nginx";
import { secret } from "@pulumi/pulumi";

const cluster = new Cluster("cluster", {
  instanceType: "t4g.medium",
  maxSize: 4,
  desiredCapacity: 1,
});

export const kubeconfig = secret(cluster.kubeconfig);

export const provider = new Provider("provider", { kubeconfig });

const zone = new Zone("demo", { name: "demo.grahamgibbons.com" }); // TODO: Change

export const zoneId = zone.id;
export const zoneName = zone.name;

const nginxIngress = new IngressController(
  "nginx",
  { controller: { service: { externalTrafficPolicy: "Local" } } },
  { provider },
);

const certManager = new CertManager(
  "cert-manager",
  { installCRDs: true },
  { provider },
);

export const letsencrypt = new CustomResource(
  "letsencrypt",
  {
    apiVersion: "cert-manager.io/v1",
    kind: "Issuer",
    metadata: {},
    spec: {
      acme: {
        server: "https://acme-v02.api.letsencrypt.org/directory",
        email: "graham.gibbons@gmail.com",
        privateKeySecretRef: {
          name: "letsencrypt",
        },
        solvers: [
          {
            selector: {},
            http01: {
              ingress: {
                class: "nginx",
              },
            },
          },
        ],
      },
    },
  },
  { provider, dependsOn: [certManager, nginxIngress] },
);
