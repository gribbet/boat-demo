import type { vec3 } from "gl-matrix";
import OBJFileParser from "obj-file-parser";
import type { Mesh } from "world.ts";

export const loadObj = async (url: string) => {
  const response = await fetch(url);
  const contents = await response.text();
  const { models } = new OBJFileParser(contents).parse();
  const [model] = models;
  const vertices =
    model?.vertices.map(({ x, y, z }) => [x, y, z] satisfies vec3) ?? [];
  const indices =
    model?.faces.map(({ vertices }) => {
      const [a = 0, b = 0, c = 0] = vertices.map(_ => _.vertexIndex - 1);
      return [a, b, c] satisfies vec3;
    }) ?? [];
  const normals =
    model?.vertexNormals.map(({ x, y, z }) => [x, y, z] satisfies vec3) ?? [];
  return { vertices, indices, normals } satisfies Mesh;
};
