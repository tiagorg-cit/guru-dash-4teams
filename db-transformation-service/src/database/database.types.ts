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
    numberOfUniqueDeploys: number;
    deploymentFrequency: number; 
}

export interface IChangeFailureRateMeasure {
    time: Date;
    productId: string;
    productName: string;
    valueStreamId: string;
    valueStreamName: string;
    podId: string;
    podName: string;
    numberOfAllDeploys: number;
    numberOfSucceededDeploys: number;
    numberOfFailedDeploys: number;
    changeFailureRate: number; 
}

export interface ICycleTimePostDevMeasure {
    time: Date;
    productId: string;
    productName: string;
    valueStreamId: string;
    valueStreamName: string;
    podId: string;
    podName: string;
    numberOfDeploys: number;
    meanCycleTimePostDev: number;
    worstDurationDeployInMonth: number;
}