import { IIncidentData } from "../database/database.types";
import { query } from "./database.functions";

export async function getIncidentsByProduct(productName:string): Promise<IIncidentData[]> {
    const incidentDBResponse:IIncidentData[] = await query(
        `SELECT * FROM jira_incidents WHERE affectedproduct = '${productName}' 
            ORDER BY time`
    );
    return incidentDBResponse;
}