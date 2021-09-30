import {IAzureMetadata} from "./azure.types";

import {getBugs} from "./metrics/azure.bugs";
import {getBuildsAndReleases} from "./metrics/azure.builds";

export async function getAzureMetrics(metadata: IAzureMetadata) {
  const buildsAndReleases = await getBuildsAndReleases(metadata);
  const bugs = await getBugs(metadata);

  return [...buildsAndReleases, ...bugs];
}
