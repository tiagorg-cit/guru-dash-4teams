import { 
    IDeployData, 
    IDeploymentFrequencyLastPeriodMeasureResponse, 
    IDeploymentIntervalLastPeriodMeasureResponse, 
    IChangeFailureRateLastPeriodMeasureResponse,
    ITotalDeploysLastPeriodMeasureResponse 
} from "../database/database.types";
import { query } from "./database.functions";

export async function getSucceededDeploysByRepositoryIdOrderByTimeDesc(repositoryId:string): Promise<IDeployData[]> {
    const deployDBResponse:IDeployData[] = await query(
        `SELECT * FROM deploy WHERE repositoryId = '${repositoryId}' 
            AND success = 1 ORDER BY time DESC`
    );
    return deployDBResponse;
}

export async function getAllDeploysByRepositoryIdOrderByTimeDesc(repositoryId:string): Promise<IDeployData[]> {
    const deployDBResponse:IDeployData[] = await query(
        `SELECT * FROM deploy WHERE repositoryId = '${repositoryId}' ORDER BY time DESC`
    );
    return deployDBResponse;
}

export async function getUniqueDeploysByRepositoryIdsForLastDays(days:number, repositoryIds: string[]): Promise<IDeploymentFrequencyLastPeriodMeasureResponse | null>{
    const deployDBResponse:any = await query(
        `SELECT COUNT(qtDeploysInDay) as \"lastDeploysOnPeriod\" FROM ( ` +
                            `SELECT COUNT(project) as \"qtDeploysInDay\" ` +
                                `FROM deploy ` +
                                `WHERE success = 1 AND repositoryId =~ /^(${repositoryIds.join('|')})$/ ` +
                                `AND time > now()-${days}d GROUP BY time(1d)) 
                        WHERE qtDeploysInDay > 0`
    );    
    return deployDBResponse[0] || null;
}

export async function getAllFailedDeploysByRepositoryIdsForLastDays(days:number, repositoryIds: string[]): Promise<IChangeFailureRateLastPeriodMeasureResponse | null>{
    const deployDBResponse:any = await query(
        `SELECT SUM(qtDeploysInDay) as \"failedDeploysOnPeriod\" FROM ( ` +
                            `SELECT COUNT("project") as \"qtDeploysInDay\" ` +
                                `FROM deploy ` +
                                `WHERE success = 0 AND repositoryId =~ /^(${repositoryIds.join('|')})$/ ` +
                                `AND time > now()-${days}d GROUP BY time(1d)) 
                        WHERE qtDeploysInDay > 0`
    );    
    return deployDBResponse[0] || null;
}

export async function getAllDeploysByRepositoryIdsForLastDays(days:number, repositoryIds: string[]): Promise<ITotalDeploysLastPeriodMeasureResponse | null>{
    const deployDBResponse:any = await query(
            `SELECT COUNT("project") as \"qtDeploysInPeriod\" ` +
                    `FROM deploy ` +
                    `WHERE repositoryId =~ /^(${repositoryIds.join('|')})$/ ` +
                    `AND time > now()-${days}d`
    );    
    return deployDBResponse[0] || null;
}


export async function getMeanOfDeploysByRepositoryIdsForLastDays(days:number, repositoryIds: string[]): Promise<IDeploymentIntervalLastPeriodMeasureResponse | null>{
    const deployDBResponse:any = await query(
                            `SELECT MEAN(\"duration\") as \"deploymentIntervalForLastDays\" ` +
                                `FROM deploy ` +
                                `WHERE success = 1 AND repositoryId =~ /^(${repositoryIds.join('|')})$/ ` +
                                `AND time > now()-${days}d`
    );    
    return deployDBResponse[0] || null;
}