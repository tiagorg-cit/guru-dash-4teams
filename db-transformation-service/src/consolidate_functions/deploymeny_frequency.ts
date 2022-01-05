import { logger } from '../shared/logger';
import { IPoint } from "influx";
import { IPodRelations, IPodRelationsMetaItem } from "../providers/strapi/strapi.types";
import { getSucceededDeploysByRepositoryIdOrderByTimeDesc } from "../database/database.deploy";
import { getDaysInMonth } from "../shared/date_utils";
import { IDeploymentFrequencyMeasure } from "../database/database.types";
import { consolidate } from "./engine/consolidate_engine";

export async function consolidateDeploymentFrequency(metricName: string, 
    podRelations: IPodRelations){
    const countJustUniqueDeploysPerDay = true;
    await consolidate(
        metricName, 
        podRelations, 
        getSucceededDeploysByRepositoryIdOrderByTimeDesc, 
        getPoints,
        countJustUniqueDeploysPerDay
    ); 
}

/* With all deploys for all repos for this POD separated by year/month 
    we can persist in databse, calculating the deployment frequency 
    using the rational: <number of days in month>/<number of deployments in month> */
function getPoints(metricName: string, relation:IPodRelationsMetaItem, deploysPerMonth:any): IPoint[] {
    const pointsForThisPOD: IPoint[] = [];  
    for(let dateKey in deploysPerMonth){
        const deploysByMonthYear = deploysPerMonth[dateKey].length;
        const daysInMonth = getDaysInMonth(dateKey);
        const deploymentFrequency: number = daysInMonth / deploysByMonthYear;      
        logger.debug(`
            FOR POD_ID: ${relation.podId} 
            Getting ${deploysByMonthYear} deploys in period ${dateKey}. 
            This month/year have ${daysInMonth} days! 
            Mean of Deployment frequency for this repo/pod is:
            1 DEPLOY of EACH ${deploymentFrequency} DAYS!`
        );
        //Push to array to persist in InfluxDB the measurement with deployment frequency history data.
        pointsForThisPOD.push(mapDeploymentFrequency(
            metricName, 
            {
            "productId": relation.productId,
            "productName": relation.productName,
            "valueStreamId": relation.valueStreamId,
            "valueStreamName": relation.valueStreamName,
            "podId": relation.podId,
            "podName": relation.podName,
            "numberOfUniqueDeploys": deploysByMonthYear,
            "deploymentFrequency": deploymentFrequency,
            "time": new Date(dateKey)
            }
        ));
    }
    return pointsForThisPOD;
}

function mapDeploymentFrequency(metricName: string, measure: IDeploymentFrequencyMeasure):IPoint {
    return {
      measurement: metricName,
      tags: {
        podName: measure.podName,
        valueStreamName: measure.valueStreamName,
        productName: measure.productName,
      },
      fields: {
        productId: measure.productId,
        valueStreamId: measure.valueStreamId,
        podId: measure.podId,
        deploymentFrequencyValue: measure.deploymentFrequency,
        numberOfUniqueDeploys: measure.numberOfUniqueDeploys
      },
      timestamp: measure.time
    };
  }