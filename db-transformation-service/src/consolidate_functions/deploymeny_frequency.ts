import { logger } from '../shared/logger';
import { IPoint } from "influx";
import { IPodRelations, IPodRelationsMetaItem } from "../providers/strapi/strapi.types";
import { getSucceededDeploysByRepositoryIdOrderByTimeDesc } from "../database/database.deploy";
import { generateMonthYearDateKey, getDaysInMonth } from "../shared/date_utils";
import { IDeploymentFrequencyMeasure } from "../database/database.types";
import { save } from "../database/database.functions";

export async function consolidateDeploymentFrequency(metricName: string, 
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
            await getSucceededDeploysByRepositoryIdOrderByTimeDesc(repositoryId); 
        logger.debug(`Retrieving ${deployDBResponse?.length} items!`); 

        if(deployDBResponse?.length > 0){
            /* Getting all deploy records to this repository and calculate number of 
            deploys for each month/year to know the deployment frequency for this repo for 
            this pod */
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
        //Persist in InfluxDB the measurement with deployment frequency history data.
        pointsForThisPOD.push(mapDeploymentFrequency(
            metricName, 
            {
            "productId": relation.productId,
            "productName": relation.productName,
            "valueStreamId": relation.valueStreamId,
            "valueStreamName": relation.valueStreamName,
            "podId": relation.podId,
            "podName": relation.podName,
            "numberOfDeploys": deploysByMonthYear,
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
        deploysPerMonth: measure.numberOfDeploys
      },
      timestamp: measure.time
    };
  }