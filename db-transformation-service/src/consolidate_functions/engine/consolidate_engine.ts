import { logger } from '../../shared/logger';
import { IPoint } from "influx";
import { IPodRelations, IPodRelationsMetaItem } from "../../providers/strapi/strapi.types";
import { dropMeasurement, parsePoints, save } from "../../database/database.functions";
import { IDeployData } from "../../database/database.types";
import { generateMonthYearDateKey, generateDayMonthYearDateKey } from "../../shared/date_utils";
import { QueryDeployFunction, MapDeploymentPointsFunction } from "./consolidate.types";

export async function consolidate(metricName: string, 
    podRelations: IPodRelations, fnQueryDeploys: QueryDeployFunction, fnMapPoints: MapDeploymentPointsFunction, countUnique: Boolean){
    try {
        if(podRelations?.meta?.relations?.length > 0){
            for(let relation of podRelations?.meta?.relations){
                const groupedDeploysPerMonthForPOD = await getPODDeploysPerMonth(relation, fnQueryDeploys, countUnique);
                const pointsForThisPOD: IPoint[] = 
                    fnMapPoints(metricName, relation, groupedDeploysPerMonthForPOD);
                parsePoints(pointsForThisPOD);
                await dropMeasurement(metricName);
                await save(pointsForThisPOD);
            }
        }
    } catch (err) {
        logger.error(err, `Error consolidating metric ${metricName} for: ${podRelations.name}`);
    }   
}

async function getPODDeploysPerMonth(relation: IPodRelationsMetaItem, fnQueryDeploys: QueryDeployFunction, countUnique: Boolean){
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
            await fnQueryDeploys(repositoryId); 
        logger.debug(`Retrieving ${deployDBResponse?.length} items!`); 

        if(deployDBResponse?.length > 0){
            /* Getting all deploy records to this repository and calculate number of 
            deploys for each month/year for this repo for this pod */
            for(let deployDB of deployDBResponse){
                const deployDate:Date = deployDB.time;
                const deployYearMonthDate = generateMonthYearDateKey(deployDate);

                if(deploysPerMonth[deployYearMonthDate]){
                    /* Verify if the deploy time is unique in month 
                     (to avoid count duplicated deploys in same day) */
                    if (countUnique) {
                        deploysPerMonth[deployYearMonthDate] = pushUnique(deployDB, deploysPerMonth[deployYearMonthDate]);
                    } else {
                        deploysPerMonth[deployYearMonthDate].push(deployDB);
                    }
                } else {
                    deploysPerMonth[deployYearMonthDate] = [deployDB];
                }
            }
        }            
    }
    return deploysPerMonth;
}

function pushUnique(deployDB: IDeployData, deploysPerMonth: IDeployData[]): IDeployData[]{
    let haveValue:Boolean = false;
    const uniqueFormatedDate = generateDayMonthYearDateKey(deployDB.time);
    for(let deploy of deploysPerMonth){
       const formatedDate  = generateDayMonthYearDateKey(deploy.time);
       if(uniqueFormatedDate === formatedDate){
            haveValue = true;
            break;
       }
    }
    if(!haveValue){
        deploysPerMonth.push(deployDB);
    }

    return deploysPerMonth;
}