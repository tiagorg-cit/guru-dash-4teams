import { logger } from '../shared/logger';
import { IPoint } from "influx";
import { save } from "../database/database.functions";
import { getIncidentsGroupedByProduct } from "../database/database.incident";
import { IIncidentData, IGroupedIncidentData, IMeanTimeToRecoverMeasure } from "../database/database.types";
import { generateMonthYearDateKey } from "../shared/date_utils";

export async function consolidateMeanTimeToRecoverFromJira(metricName: string){   
    try{  
        const getGroupedIncidentsByDateForProduct = 
            await getProductIncidentsPerMonth();
        const pointsToPersist: IPoint[] = getPoints(metricName, getGroupedIncidentsByDateForProduct);
        await save(pointsToPersist);
            
    } catch (e){
        logger.error(e, `Error consolidating metric ${metricName}`);
    }     
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

/* With all incidents for all PRODUCTS separated by year/month 
    we can persist in databse, calculating the MTTR 
    using the rational: <sum of each (crisisenddate - crisisstartdate)>/<number of incidents in month> */
function getPoints(metricName: string, incidentsPerAllProductIds:any): IPoint[] {
    const pointsForAllProducts: IPoint[] = [];  
    if(incidentsPerAllProductIds){
        for(const productIdKey in incidentsPerAllProductIds){
            const incidentsPerMonth = incidentsPerAllProductIds[productIdKey];
            const productName = incidentsPerMonth.name;
            for(const dateKey in incidentsPerMonth){
                if(Array.isArray(incidentsPerMonth[dateKey])){
                    const arrayOfIncidentsByMonthYear: IIncidentData[] = incidentsPerMonth[dateKey];
                    const quantityOfIncidentsByMonthYear = arrayOfIncidentsByMonthYear.length;
                    if(quantityOfIncidentsByMonthYear > 0){
                        const mttr = calculateUnavailabilityTime(arrayOfIncidentsByMonthYear) / quantityOfIncidentsByMonthYear;
                        logger.debug(`
                            FOR PRODUCT ID: ${productIdKey}
                            WITH NAME: ${productName} 
                            Getting ${quantityOfIncidentsByMonthYear} incidents in period ${dateKey}.  
                            Mean Time to Recover for this Product for this month/year is: 
                            ${mttr/3600000}!`
                        );
                    
                        //Push to array to persist in InfluxDB the measurement with Mean Time to Recover history data.
                        pointsForAllProducts.push(mapMeanTimeToRecover(
                            metricName, 
                            {
                            "productId": productIdKey,
                            "productName": productName,
                            "numberOfIncidents": quantityOfIncidentsByMonthYear,
                            "mttr": mttr,
                            "time": new Date(dateKey)
                            }
                        ));
                        
                    }
                }
            }
        }
    }  
    return pointsForAllProducts;
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

function calculateUnavailabilityTime(arrayOfIncidentsByMonthYear:IIncidentData[]): number {
    let totalUnavailabilityTime: number = 0;
    if(arrayOfIncidentsByMonthYear && arrayOfIncidentsByMonthYear.length > 0){
        for(const incident of arrayOfIncidentsByMonthYear){
            const crisisStartDate = new Date(incident.crisisstartdate);
            const crisisEndDate = new Date(incident.crisisenddate);
            const diffTime = crisisEndDate.getTime() - crisisStartDate.getTime();
            totalUnavailabilityTime += diffTime;
        }
    }
    return totalUnavailabilityTime;
}

function mapMeanTimeToRecover(metricName: string, measure: IMeanTimeToRecoverMeasure): IPoint {
    return {
      measurement: metricName,
      tags: {
        productName: measure.productName,
      },
      fields: {
        productId: measure.productId,
        mttr: measure.mttr,
        numberOfIncidents: measure.numberOfIncidents
      },
      timestamp: measure.time
    };
  }