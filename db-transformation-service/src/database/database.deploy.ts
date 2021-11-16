import { IDeployData } from "../database/database.types";
import { influxInstance } from "./database.instance";

export async function getSuceededDeploysByRepositoryIdOrderByTimeDesc(repositoryId:string): Promise<IDeployData[]> {
    const deployDBResponse:IDeployData[] = await influxInstance.query(
        `SELECT * FROM deploy WHERE repositoryId = '${repositoryId}' 
            AND success = 1 ORDER BY time DESC`
    );
    return deployDBResponse;
}