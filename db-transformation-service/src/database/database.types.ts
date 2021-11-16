export interface IDeployData {
    time: Date;
    duration: number;
    project: string;
    repositoryId: string;
    success: number;
}

export interface IDeploymentFrequencyMeasure {
    time: Date;
    productId: string;
    productName: string;
    valueStreamId: string;
    valueStreamName: string;
    podId: string;
    podName: string;
    numberOfDeploys: number;
    deploymentFrequency: number; 
}