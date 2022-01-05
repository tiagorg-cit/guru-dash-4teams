import { logger } from '../shared/logger';
import { IPoint } from "influx";
import { save } from "../database/database.functions";
import { IGalaxyFromTo, IGalaxyFromToMetaJiraItem } from "../providers/strapi/strapi.types";
import { getIncidentsByProduct } from "../database/database.incident";
import { IIncidentData, IMeanTimeToRecoverMeasure } from "../database/database.types";
import { generateMonthYearDateKey } from "../shared/date_utils";

export async function consolidateMeanTimeToRecoverFromJira(metricName: string, galaxyFromTo: IGalaxyFromTo){   
    try{
        const entries: IGalaxyFromToMetaJiraItem[] = galaxyFromTo.meta?.entries;
        if(entries && entries.length > 0){
            for(let entry of entries){
                const getGroupedIncidentsByDateForProduct = 
                    await getProductIncidentsPerMonth(entry.jiraProductName?.toUpperCase());
                const pointsToPersist: IPoint[] = getPoints(metricName, entry, getGroupedIncidentsByDateForProduct);
                await save(pointsToPersist);
            }
        }
    } catch (e){
        logger.error(e, `Error consolidating metric ${metricName} for: ${galaxyFromTo.name}`);
    }     
}

async function getProductIncidentsPerMonth(jiraProductName: string) {
    const incidentsDBResponse: IIncidentData[] = await getIncidentsByProduct(jiraProductName); 

    logger.debug(`Retrieving ${incidentsDBResponse?.length} incident items!`); 
    const incidentsPerMonth:any = {};

    if(incidentsDBResponse?.length > 0){
        /* Getting all incident records to this product and calculate number of 
        incidents for each month/year */
        for(let incidentDB of incidentsDBResponse){
            const incidentDate:Date = incidentDB.time;
            const incidentYearMonthDate = generateMonthYearDateKey(incidentDate);
            if(incidentsPerMonth[incidentYearMonthDate]){
                incidentsPerMonth[incidentYearMonthDate].push(incidentDB);   
            } else {
                incidentsPerMonth[incidentYearMonthDate] = [incidentDB];
            }
        }
    }
    return incidentsPerMonth;
}

/* With all incidents for all PRODUCTS separated by year/month 
    we can persist in databse, calculating the MTTR 
    using the rational: <sum of each (crisisenddate - crisisstartdate)>/<number of incidents in month> */
function getPoints(metricName: string, entry: IGalaxyFromToMetaJiraItem, incidentsPerMonth:any): IPoint[] {
    const pointsForThisProduct: IPoint[] = [];  
    for(let dateKey in incidentsPerMonth){
        const arrayOfIncidentsByMonthYear: IIncidentData[] = incidentsPerMonth[dateKey];
        const quantityOfIncidentsByMonthYear = arrayOfIncidentsByMonthYear.length;
        if(quantityOfIncidentsByMonthYear > 0){
            const mttr = calculateUnavailabilityTime(arrayOfIncidentsByMonthYear) / quantityOfIncidentsByMonthYear;
            logger.debug(`
                FOR PRODUCT NAME: ${entry.jiraProductName}
                With Galaxy Product ID: ${entry.galaxyProductId} 
                Getting ${quantityOfIncidentsByMonthYear} incidents in period ${dateKey}.  
                Mean Time to Recover for this Product for this month/year is: 
                ${mttr}!`
            );
        
            //Push to array to persist in InfluxDB the measurement with Mean Time to Recover history data.
            pointsForThisProduct.push(mapMeanTimeToRecover(
                metricName, 
                {
                "productId": entry.galaxyProductId,
                "productName": entry.jiraProductName,
                "numberOfIncidents": quantityOfIncidentsByMonthYear,
                "mttr": mttr,
                "time": new Date(dateKey)
                }
            ));
            
        }
    }
    return pointsForThisProduct;
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