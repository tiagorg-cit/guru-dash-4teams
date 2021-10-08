export interface IAzureMetadata {
  organization: string;
  project: string;
  key: string;
  connectors: IAzureConnector;
  deployOnBuild: Boolean;
  builds: IAzureMetadataBuilds;
  releases: string[];
  bugsQuery: string;
}

export interface IAzureMetadataBuilds {
  getLastNumMonths: number;
  buildStepName: string;
  deployStepName: string;
  repositories: IAzureMetadataBuildsRepositories[];
}

export interface IAzureMetadataBuildsRepositories {
  id: string;
  type: string;
  name: string;
}

interface IAzureConnector{
   galaxy: IAzureConnectorGalaxy;
}

interface IAzureConnectorGalaxy {
  apiKey: string;
  apiUrl: string;
}

export interface IAzureResponse<T> {
  count: number;
  value: T[];
}

export interface IAzureBuild {
  definition: {
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
