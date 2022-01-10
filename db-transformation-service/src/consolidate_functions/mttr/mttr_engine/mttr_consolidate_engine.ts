import { logger } from '../../../shared/logger';
import { IPoint } from "influx";
import { save } from "../../../database/database.functions";
import { generateMonthYearDateKey } from "../../../shared/date_utils";
import { IIncidentData, IGroupedIncidentData } from "../../../database/database.types";
import { MttrPointFunction } from "./mttr_consolidate_types";
import { getIncidentsGroupedByProduct } from "../../../database/database.incident";

export async function consolidate(metricName: string, fnMapPoints: MttrPointFunction){  
    try{
        const getGroupedIncidentsByDateForProduct = 
            await getProductIncidentsPerMonth();
        const pointsToPersist: IPoint[] = getPoints(metricName, getGroupedIncidentsByDateForProduct, fnMapPoints);
        await save(pointsToPersist);        
            
    } catch (e){
        logger.error(e, `Error consolidating metric ${metricName}`);   
    }
}

/* With all incidents for all PRODUCTS separated by year/month 
    we can persist in databse, calculating the MTTR 
    using the rational: <sum of each (crisisenddate - crisisstartdate)>/<number of incidents in month> */
function getPoints(metricName: string, incidentsPerAllProductIds:any, fnMapPoints: MttrPointFunction): IPoint[] {
    const pointsForAllProducts: IPoint[] = [];  
    if(incidentsPerAllProductIds){
        for(const productIdKey in incidentsPerAllProductIds){
            const incidentsPerMonth = incidentsPerAllProductIds[productIdKey];
            const productName = incidentsPerMonth.name;
            for(const dateKey in incidentsPerMonth){
                if(Array.isArray(incidentsPerMonth[dateKey])){
                    const arrayOfIncidentsByMonthYear: IIncidentData[] = incidentsPerMonth[dateKey];
                    pointsForAllProducts.push(
                        ...fnMapPoints(
                            metricName, 
                            productIdKey, 
                            productName, 
                            new Date(dateKey), 
                            arrayOfIncidentsByMonthYear
                        )
                    );
                }
            }
        }
    }  
    return pointsForAllProducts;
}

async function getProductIncidentsPerMonth() {
    const incidentsDBResponse: IGroupedIncidentData[] = await getIncidentsGroupedByProduct(); 
 
    const incidentsPerAllProductIds:any = {};

    if(incidentsDBResponse?.length > 0){
        /* Getting all incident records to this product and calculate number of 
        incidents for each month/year */
        for(const incidentDB of incidentsDBResponse){
            const groupedRows: IIncidentData[] = incidentDB.rows;
            const productId:string = incidentDB?.tags?.productId;
            const productName:string = incidentDB?.tags?.affectedproduct;
            incidentsPerAllProductIds[productId] = 
                addNewIncidentsByMonth(productName, groupedRows);
        }
    }
    return incidentsPerAllProductIds;
}

function addIncidentsByMonth(incidentsPerProductId:any, groupedRows: IIncidentData[]) {
    if(groupedRows && groupedRows.length > 0){
        for(const row of groupedRows){
            const incidentDate:Date = row.time;
            const incidentYearMonthDate = generateMonthYearDateKey(incidentDate);
            if(incidentsPerProductId[incidentYearMonthDate]){
                incidentsPerProductId[incidentYearMonthDate].push(row);   
            } else {
                incidentsPerProductId[incidentYearMonthDate] = [row];
            }
        }
    }
    return incidentsPerProductId;
}

function addNewIncidentsByMonth(productName:string, groupedRows: IIncidentData[]) {
    return addIncidentsByMonth({"name": productName}, groupedRows);     
}