import { IPoint } from "influx";
import { consolidate } from "./mttr_engine/mttr_consolidate_engine";
import { IIncidentData, IMttrByTargetSquadMeasure } from "../../database/database.types";

export async function consolidateMTTRByTargetSquad(metricName: string){  
    await consolidate(
        metricName, 
        mapPoints
    ); 
}

function mapPoints(metricName: string, productId:string, productName: string, dateKey:Date, 
    arrayOfIncidentsByMonthYear:IIncidentData[]): IPoint[]{
    const points: IPoint[] = [];
    if(arrayOfIncidentsByMonthYear && arrayOfIncidentsByMonthYear.length > 0){
        const mapByTargetSquad: any = 
            mapIssuesByTargetSquad(arrayOfIncidentsByMonthYear);
        for (const targetSquadKey in mapByTargetSquad){
            const arrayOfIssues: IIncidentData[] = mapByTargetSquad[targetSquadKey];
            points.push(mapMttrByTargetSquad(
                metricName, 
                {
                "productId": productId,
                "productName": productName,
                "targetSquad": targetSquadKey,
                "value": arrayOfIssues.length,
                "time": dateKey
                }
            ));
        }
    }

    return points;
}

function mapIssuesByTargetSquad(arrayOfIncidentsByMonthYear: IIncidentData[]): any {
    const mapByTargetSquad: any = {};
    for (const incidentData of arrayOfIncidentsByMonthYear) {
        const targetSquad = incidentData.targetsquad || "Not Classified";
        if (mapByTargetSquad[targetSquad]
            && mapByTargetSquad[targetSquad].length > 0) {
                mapByTargetSquad[targetSquad].push(incidentData);
        } else {
            mapByTargetSquad[targetSquad] = [incidentData];
        }
    }
    return mapByTargetSquad;
}

function mapMttrByTargetSquad(metricName: string, measure: IMttrByTargetSquadMeasure): IPoint {
    return {
        measurement: metricName,
        tags: {
            productName: measure.productName,
            targetSquad: measure.targetSquad,
        },
        fields: {
            productId: measure.productId,
            targetSquad: measure.targetSquad,
            value: measure.value
        },
        timestamp: measure.time
    };
  }

