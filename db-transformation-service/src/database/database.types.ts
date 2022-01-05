export interface IIncidentData {
    time: Date;
    affectedcountries: string;
    affectedplataforms: string;
    affectedproduct: string;
    affectedsquads: string;
    components: string;
    correctionlevel: string;
    createdDate: Date;
    crisisenddate: Date;
    crisisstartdate: Date;
    errortype: string;
    errorsubtype: string;
    issueName: string;
    issueType: string;
    priority: string;
    resolutionDate: Date;
    status: string;
    statusCategory: string;
    summary: string;
    targetsquad: string;
}

export interface IDeployData {
    time: Date;
    duration: number;
    project: string;
    repositoryId: string;
    success: number;
}

export interface IMeanTimeToRecoverMeasure {
    time: Date;
    productId: string;
    productName: string;
    numberOfIncidents: number;
    mttr: number;
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