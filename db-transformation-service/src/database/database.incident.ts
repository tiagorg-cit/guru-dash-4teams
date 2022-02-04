import { 
    IGroupedIncidentData, 
    IMeanCrisisDuration, 
    IDistinctProductIncidentData 
} from "../database/database.types";
import { query } from "./database.functions";

export async function getIncidentsGroupedByProduct(): Promise<IGroupedIncidentData[]> {
    const incidentDBResponse:any = await query(
        `SELECT * FROM jira_incidents GROUP BY productId, affectedproduct ORDER BY time`
    );
    return incidentDBResponse.groups();
}

export async function getProductsWithIncidentsInLastDays(days:number): Promise<IDistinctProductIncidentData[] | null> {
    const incidentDBResponse:IDistinctProductIncidentData[] = await query(
        `SELECT DISTINCT(productId) as \"productId\" FROM jira_incidents WHERE time > now()-${days}d`
    );
    return incidentDBResponse;
}

export async function getMeanOfDurationCrisisByPeriod(days:number, productId: string): Promise<IMeanCrisisDuration | null> {
    const incidentDBResponse:any = await query(
        `SELECT MEAN(crisisduration) as \"meanOfCrisisDuration\" ` +
            `FROM jira_incidents ` + 
            `WHERE productId = '${productId}' ` + 
                `AND time > now()-${days}d`
    );
    return incidentDBResponse[0] || null;
}