import { IPoint } from "influx";
import { consolidate } from "./mttr_engine/mttr_consolidate_engine";
import { IIncidentData, IMttrByCorrectionLevelMeasure } from "../../database/database.types";

export async function consolidateMTTRByCorrectionLevel(metricName: string){  
    await consolidate(
        metricName, 
        mapPoints
    ); 
}

function mapPoints(metricName: string, productId:string, productName: string, dateKey:Date, 
    arrayOfIncidentsByMonthYear:IIncidentData[]): IPoint[]{
    const points: IPoint[] = [];
    if(arrayOfIncidentsByMonthYear && arrayOfIncidentsByMonthYear.length > 0){
        const mapByCorrectionLevel: any = 
            mapIssuesByCorrectionLevel(arrayOfIncidentsByMonthYear);
        for (const correctionLevelKey in mapByCorrectionLevel){
            const arrayOfIssues: IIncidentData[] = mapByCorrectionLevel[correctionLevelKey];
            points.push(mapMttrByCorrectionLevel(
                metricName, 
                {
                "productId": productId,
                "productName": productName,
                "correctionLevel": correctionLevelKey,
                "value": arrayOfIssues.length,
                "time": dateKey
                }
            ));
        }
    }

    return points;
}

function mapIssuesByCorrectionLevel(arrayOfIncidentsByMonthYear: IIncidentData[]): any {
    const mapByCorrectionLevel: any = {};
    for (const incidentData of arrayOfIncidentsByMonthYear) {
        const correctionLevel = incidentData.correctionlevel || "Not Classified";
        if (mapByCorrectionLevel[correctionLevel]
            && mapByCorrectionLevel[correctionLevel].length > 0) {
            mapByCorrectionLevel[correctionLevel].push(incidentData);
        } else {
            mapByCorrectionLevel[correctionLevel] = [incidentData];
        }
    }
    return mapByCorrectionLevel;
}

function mapMttrByCorrectionLevel(metricName: string, measure: IMttrByCorrectionLevelMeasure): IPoint {
    return {
        measurement: metricName,
        tags: {
            productName: measure.productName,
            correctionLevel: measure.correctionLevel,
        },
        fields: {
            productId: measure.productId,
            correctionLevel: measure.correctionLevel,
            value: measure.value
        },
        timestamp: measure.time
    };
  }

