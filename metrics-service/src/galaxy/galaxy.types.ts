export interface IGalaxyDeployments {
    deployments: IGalaxyDeploy[];
}

export interface IGalaxyDeploymentsResponse {
    deployments: IGalaxyDeploy[];
    client_id: string;
}

export interface IGalaxyDeploy {
    project: string;
    timestamp: Date;
    duration: Number;
    success: Boolean;
};