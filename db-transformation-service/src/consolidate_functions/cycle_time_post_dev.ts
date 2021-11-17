import { logger } from '../shared/logger';
import { IPoint } from "influx";
import { IPodRelations, IPodRelationsMetaItem } from "../providers/strapi/strapi.types";
import { getSucceededDeploysByRepositoryIdOrderByTimeDesc } from "../database/database.deploy";
import { ICycleTimePostDevMeasure, IDeployData } from "../database/database.types";
import { consolidate } from "./engine/consolidate_engine";


export async function consolidateCycleTimePostDev(metricName: string, 
    podRelations: IPodRelations){
    const countJustUniqueDeploysPerDay = false;
    await consolidate(
        metricName, 
        podRelations, 
        getSucceededDeploysByRepositoryIdOrderByTimeDesc, 
        getPoints,
        countJustUniqueDeploysPerDay
    ); 
}    

/* With all deploys for all repos for this POD separated by year/month 
    we can persist in databse, calculating the mean of cycle time post dev (duration field) 
    using the rational: <sum of all deployment durations in month>/<number of succeeded deployments in month> */
function getPoints(metricName: string, relation:IPodRelationsMetaItem, deploysPerMonth:any): IPoint[] {
    const pointsForThisPOD: IPoint[] = [];  
    for(let dateKey in deploysPerMonth){
        const deploysByMonthYear = deploysPerMonth[dateKey].length;
        const sumOfDurationDeploysInMonth: number = deploysPerMonth[dateKey].reduce(sumDurationDeploys).duration || 0;
        const meanCycleTimePostDev: number = sumOfDurationDeploysInMonth / deploysByMonthYear;
        const worstDurationDeployInMonth: number = deploysPerMonth[dateKey].reduce(getWorstDurationDeploy).duration || 0;
        logger.debug(`
            FOR POD_ID: ${relation.podId} 
            Getting ${deploysByMonthYear} deploys in period ${dateKey}. 
            This month/year have mean of ${meanCycleTimePostDev} succeeded deployments interval post dev!
            AND the worst duration is ${worstDurationDeployInMonth}. 
            `
        );
        //Persist in InfluxDB the measurement with Cycle Type Post Dev history data.
        pointsForThisPOD.push(mapCycleTimePostDev(
            metricName, 
            {
            "productId": relation.productId,
            "productName": relation.productName,
            "valueStreamId": relation.valueStreamId,
            "valueStreamName": relation.valueStreamName,
            "podId": relation.podId,
            "podName": relation.podName,
            "numberOfDeploys": deploysByMonthYear,
            "meanCycleTimePostDev": meanCycleTimePostDev,
            "worstDurationDeployInMonth": worstDurationDeployInMonth,
            "time": new Date(dateKey)
            }
        ));
    }
    return pointsForThisPOD;
}

function sumDurationDeploys(previousValue: IDeployData, currentValue: IDeployData){
    return {duration: previousValue.duration + currentValue.duration};
}

function getWorstDurationDeploy(previousValue: IDeployData, currentValue: IDeployData){
    return previousValue.duration > currentValue.duration ? {duration: previousValue.duration} : {duration: currentValue.duration};
}
    
function mapCycleTimePostDev(metricName: string, measure: ICycleTimePostDevMeasure):IPoint {
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
            numberOfDeploys: measure.numberOfDeploys,
            meanCycleTimePostDev: measure.meanCycleTimePostDev,
            worstDurationDeployInMonth: measure.worstDurationDeployInMonth
        },
        timestamp: measure.time
    };
}