import { IGroupedIncidentData } from "../database/database.types";
import { query } from "./database.functions";

export async function getIncidentsGroupedByProduct(): Promise<IGroupedIncidentData[]> {
    const incidentDBResponse:any = await query(
        `SELECT * FROM jira_incidents GROUP BY productId, affectedproduct ORDER BY time`
    );
    return incidentDBResponse.groups();
}