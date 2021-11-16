import { logger } from '../shared/logger';
import { IPoint } from "influx";
import { IPodRelations, IPodRelationsMetaItem } from "../providers/strapi/strapi.types";
import { getAllDeploysByRepositoryIdOrderByTimeDesc } from "../database/database.deploy";
import { IChangeFailureRateMeasure, IDeployData } from "../database/database.types";
import { save } from "../database/database.functions";
import { generateMonthYearDateKey } from "../shared/date_utils";


export async function consolidateChangeFailureRate(metricName: string, 
    podRelations: IPodRelations){
    
    try {
        if(podRelations?.meta?.relations?.length > 0){
            for(let relation of podRelations?.meta?.relations){
                const groupedDeploysPerMonthForPOD = await getPODDeploysPerMonth(relation);
                const pointsForThisPOD: IPoint[] = 
                    getPoints(metricName, relation, groupedDeploysPerMonthForPOD);  
                await save(pointsForThisPOD);
            }
        }
    } catch (err) {
        logger.error(err, `Error consolidating metric ${metricName} for: ${podRelations.name}`);
    }      
}

async function getPODDeploysPerMonth(relation: IPodRelationsMetaItem){
    const deploysPerMonth:any = {};
    //Getting deploy data for pod for each repository
    for(let repositoryId of relation.idRepositories){
        logger.debug(`
            Getting deployment data for repo: ${repositoryId} 
            for POD: ${relation.podName} 
            of VS: ${relation.valueStreamName} 
            of Product: ${relation.productName}`
        );
     
        const deployDBResponse = 
            await getAllDeploysByRepositoryIdOrderByTimeDesc(repositoryId); 
        logger.debug(`Retrieving ${deployDBResponse?.length} items!`); 

        if(deployDBResponse?.length > 0){
            /* Getting all deploy records to this repository and calculate number of 
            failed deploys versus succeeded deploys for each month/year to know the change failure rate 
            for this repo for this pod */
            for(let deployDB of deployDBResponse){
                const deployDate:Date = deployDB.time;
                const deployYearMonthDate = generateMonthYearDateKey(deployDate);

                if(deploysPerMonth[deployYearMonthDate]){
                    deploysPerMonth[deployYearMonthDate].push(deployDB);
                } else {
                    deploysPerMonth[deployYearMonthDate] = [deployDB];
                }
            }
        }            
    }
    return deploysPerMonth;
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
            //Persist in InfluxDB the measurement with deployment frequency history data.
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