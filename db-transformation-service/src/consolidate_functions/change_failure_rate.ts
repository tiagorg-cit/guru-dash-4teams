import { logger } from '../shared/logger';
import { IPoint } from "influx";
import { IPodRelations, IPodRelationsMetaItem } from "../providers/strapi/strapi.types";
import { getAllDeploysByRepositoryIdOrderByTimeDesc } from "../database/database.deploy";
import { IChangeFailureRateMeasure, IDeployData } from "../database/database.types";
import { consolidate } from "./engine/consolidate_engine";


export async function consolidateChangeFailureRate(metricName: string, 
    podRelations: IPodRelations){   
    const countJustUniqueDeploysPerDay = false;        
    await consolidate(
        metricName, 
        podRelations, 
        getAllDeploysByRepositoryIdOrderByTimeDesc, 
        getPoints,
        countJustUniqueDeploysPerDay
    ); 
}    

/* With all deploys for all repos for this POD separated by year/month 
    we can persist in databse, calculating the change failure rate 
    using the rational: 100-((<number of succeeded deploys>/<number of all deployments in month>)*100) */
    function getPoints(metricName: string, relation:IPodRelationsMetaItem, deploysPerMonth:any): IPoint[] {
        const pointsForThisPOD: IPoint[] = [];  
        for(let dateKey in deploysPerMonth){
            const deploysByMonthYear = deploysPerMonth[dateKey].length;
            const failedDeploysInMonth = 
                deploysPerMonth[dateKey].filter(filterFailedDeploys)?.length || 0;
            const succeededDeploys = deploysByMonthYear - failedDeploysInMonth;     
            const changeFailureRate: number = 100-((succeededDeploys/deploysByMonthYear)*100);      
            logger.debug(`
                FOR POD_ID: ${relation.podId} 
                Getting ${deploysByMonthYear} deploys in period ${dateKey}. 
                This month/year have ${succeededDeploys} succeeded deploys!
                AND ${failedDeploysInMonth} failed deploys :( 
                The change failure rate for this repo/pod is:
                ${changeFailureRate}%`
            );
            //Persist in InfluxDB the measurement with Change Failure Rate history data.
            pointsForThisPOD.push(mapChangeFailureRate(
                metricName, 
                {
                "productId": relation.productId,
                "productName": relation.productName,
                "valueStreamId": relation.valueStreamId,
                "valueStreamName": relation.valueStreamName,
                "podId": relation.podId,
                "podName": relation.podName,
                "numberOfAllDeploys": deploysByMonthYear,
                "numberOfSucceededDeploys": succeededDeploys,
                "numberOfFailedDeploys": failedDeploysInMonth,
                "changeFailureRate": changeFailureRate, 
                "time": new Date(dateKey)
                }
            ));
        }
        return pointsForThisPOD;
    }
 
function filterFailedDeploys(deploy: IDeployData){
    return deploy?.success === 0;
}
    
function mapChangeFailureRate(metricName: string, measure: IChangeFailureRateMeasure):IPoint {
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
            numberOfAllDeploys: measure.numberOfAllDeploys,
            numberOfSucceededDeploys: measure.numberOfSucceededDeploys,
            numberOfFailedDeploys: measure.numberOfFailedDeploys,
            changeFailureRate: measure.changeFailureRate
        },
        timestamp: measure.time
    };
}