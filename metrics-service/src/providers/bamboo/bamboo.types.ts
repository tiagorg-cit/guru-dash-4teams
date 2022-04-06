import { IGalaxyMetadataConnector } from "../../galaxy/galaxy.types";

export interface IBambooMetadata {
  bambooServer: string;
  stepInsert?: boolean;
  connectors: IBambooConnector;
  user: string;
  key: string;
  projects: IBambooProject[];
}

interface IBambooConnector {
  galaxy: IGalaxyMetadataConnector;
}

export interface IBambooProject {
  name: string;
  repositories: IBambooProjectRepository[];
}

export interface IBambooProjectRepository {
  id: string;
  name: string;
}

export interface IBambooBuild {
  plan: {
    shortName: string;
    key: string;
  };
  buildState: string;
  buildStartedTime: string;
  buildCompletedTime: string;
  projectName: string;
}

export interface IBambooPlanList{
  key: string;
  shortName: string;
}

export interface IBambooResponse<T> {
  value: T[];
}

export interface IBambooReleaseProjet {
    id: number,
    name: string,
    description: string
}

export interface IBambooRelease {
  deploymentVersionName: string;
  releaseEnvironment: string;
  deploymentState: string;
  startedDate: string;
  finishedDate: string;
}