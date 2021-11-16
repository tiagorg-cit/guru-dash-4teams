import { IDeployData } from "../database/database.types";
import { query } from "./database.functions";

export async function getSuceededDeploysByRepositoryIdOrderByTimeDesc(repositoryId:string): Promise<IDeployData[]> {
    const deployDBResponse:IDeployData[] = await query(
        `SELECT * FROM deploy WHERE repositoryId = '${repositoryId}' 
            AND success = 1 ORDER BY time DESC`
    );
    return deployDBResponse;
}