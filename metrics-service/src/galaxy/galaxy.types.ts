export interface IGalaxyMetadataConnector {
    apiKey: string;
    apiUrl: string;
    clientId: string;
    dataIngestion: IGalaxyDataIngestionMetadataConnector;
}

export interface IGalaxyDataIngestionMetadataConnector {
    type: string;
    apiUrl: string;
}

export interface IGalaxyDataIngestionDeployment {
    deploymentDate: Date,
    deploymentSucceeded: Boolean;
    artifactId?: string;
    artifactName: string;
    deploymentId?: string;
    previousBuildId?: string;
    deploymentMarker?: string;
}

export interface IGalaxyDeployments {
    deployments: IGalaxyDeploy[];
}

export interface IGalaxyDeploymentsResponse {
    deployments: IGalaxyDeploy[];
    client_id: string;
}

export interface IGalaxyDeploy {
    buildNumber?: string;
    projectId?: string;
    project: string;
    timestamp: Date;
    duration?: Number;
    success: Boolean;
};

export interface IGalaxyActionPlan {
    project_key: string;
    issues: IGalaxyActionPlanIssue[];
};

export interface IGalaxyActionPlanIssue {
      issue_key: string | null;
      issue_type: string | null;
      summary: string | null;
      created: any | null,
      status: string | null;
      team_name?: string | null;
      capabilities?: string[] | null;
      updated?: any | null;
      resolved?: any | null;
      due_date?: any | null;
}

export interface IGalaxyActionPlanResponse {
    message: string;
};