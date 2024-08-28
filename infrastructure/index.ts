import { Image, Repository } from "@pulumi/awsx/ecr";

import { provider } from "./cluster";
export { kubeconfig } from "./cluster";
import { Simulation } from "./Simulation";
import { Ui } from "./Ui";

const repository = new Repository("repository", { forceDelete: true });

const repositoryUrl = repository.url;

const simulationImage = new Image("simulation", {
  repositoryUrl,
  dockerfile: "./simulation.Dockerfile",
  platform: "linux/arm64",
});

const simulation = new Simulation(
  "simulation",
  { image: simulationImage.imageUri },
  { provider },
);

const uiImage = new Image("ui", {
  repositoryUrl,
  context: "..",
  dockerfile: "./ui.Dockerfile",
  platform: "linux/arm64",
  args: {
    ["VITE_ENDPOINT"]: simulation.endpoint,
  },
});

const ui = new Ui("boat", { image: uiImage.imageUri }, { provider });

export const { address: url } = ui;
