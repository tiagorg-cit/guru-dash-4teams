import { IPoint } from "influx";
import { consolidate } from "./mttr_engine/mttr_consolidate_engine";
import { IIncidentData, IMttrByPlatformMeasure } from "../../database/database.types";

export async function consolidateMTTRByPlatform(metricName: string){  
    await consolidate(
        metricName, 
        mapPoints
    ); 
}

function mapPoints(metricName: string, productId:string, productName: string, dateKey:Date, 
    arrayOfIncidentsByMonthYear:IIncidentData[]): IPoint[]{
    const points: IPoint[] = [];
    if(arrayOfIncidentsByMonthYear && arrayOfIncidentsByMonthYear.length > 0){
        const mapByPlatform: any = 
            mapIssuesByAffectedPlatform(arrayOfIncidentsByMonthYear);
        for (const platformKey in mapByPlatform){
            const crisisDuration: number = mapByPlatform[platformKey];
            
            points.push(mapMttrByPlatform(
                metricName, 
                {
                "productId": productId,
                "productName": productName,
                "crisisDuration": crisisDuration,
                "platform": platformKey,
                "time": dateKey
                }
            ));
        }
    }

    return points;
}

function mapIssuesByAffectedPlatform(arrayOfIncidentsByMonthYear: IIncidentData[]): any {
    const mapByAffectedPlatform: any = {};
    for (const incidentData of arrayOfIncidentsByMonthYear) {
        const affectedplataforms = incidentData?.affectedplataforms?.split(',');
        if(affectedplataforms && affectedplataforms.length > 0){
            for(const affectedPlataform of affectedplataforms){
                if (mapByAffectedPlatform[affectedPlataform]
                    && mapByAffectedPlatform[affectedPlataform] > 0) {
                        mapByAffectedPlatform[affectedPlataform] += incidentData.crisisduration;
                } else {
                    mapByAffectedPlatform[affectedPlataform] = incidentData.crisisduration;
                }
            }
        }
    }
    return mapByAffectedPlatform;
}

function mapMttrByPlatform(metricName: string, measure: IMttrByPlatformMeasure): IPoint {
    return {
        measurement: metricName,
        tags: {
            productName: measure.productName,
            platform: measure.platform,
        },
        fields: {
            productId: measure.productId,
            platform: measure.platform,
            crisisDuration: measure.crisisDuration
        },
        timestamp: measure.time
    };
  }

