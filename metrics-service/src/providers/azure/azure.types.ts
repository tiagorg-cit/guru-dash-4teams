import { IGalaxyMetadataConnector } from "../../galaxy/galaxy.types";

export interface IAzureMetadata {
  organization: string;
  project: string;
  stepInsert: Boolean;
  key: string;
  connectors: IAzureConnector;
  deployOnBuild: Boolean;
  builds: IAzureMetadataBuilds;
  releases: string[];
  bugsQuery: string;
}

export interface IAzureMetadataBuilds {
  getLastNumMonths: number;
  defaultBuildStep: string;
  defaultDeployStep: string;
  repositories: IAzureMetadataBuildsRepositories[];
}

export interface IAzureMetadataBuildsRepositories {
  id: string;
  type: string;
  name: string;
  buildSteps: string[];
  deploySteps: string[];
  deployBranch?: string;
}

interface IAzureConnector {
   galaxy: IGalaxyMetadataConnector;
}

export interface IAzureResponse<T> {
  count: number;
  value: T[];
}

export interface IAzureBuild {
  definition: {
    name: string;
  };
  repository: {
    id: string;
    name: string;
  };
  _links: {
    timeline: {
      href: string;
    }
  };
  buildNumber: number;
  result: string;
  startTime: string;
  finishTime: string;
  sourceBranch: string;
}

export interface IAzureTimeline {
  records: IRecordAzureTimeline[];
}

export interface IRecordAzureTimeline {
  startTime: string;
  finishTime: string;
  name: string;
  type: string;
  state: string;
  result: string;
  identifier: string;
}

export interface IAzureRelease {
  releaseDefinition: {
    name: string;
  };
  releaseEnvironment: {
    name: string;
  },
  deploymentStatus: string;
  startedOn: string;
  completedOn: string;
}

export interface IAzureWIQLResponse {
  workItems: IWorkItemSummary[];
}

interface IWorkItemSummary {
  id: number;
}

export interface IAzureWorkItem {
  fields: {
    'System.State': string;
    'System.CreatedDate': string;
    'Microsoft.VSTS.Common.ClosedDate': string;
  }
}
