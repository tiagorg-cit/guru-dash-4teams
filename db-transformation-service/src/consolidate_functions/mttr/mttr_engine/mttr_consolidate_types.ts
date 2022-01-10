import { IPoint } from "influx";
import { IIncidentData } from "../../../database/database.types";

export type MttrPointFunction = (
    metricName: string, 
    productId:string, 
    productName: string, 
    dateKey:Date,
    arrayOfIncidentsByMonthYear:IIncidentData[]
) => IPoint[];