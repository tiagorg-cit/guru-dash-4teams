import { IPoint } from "influx";
import { influxInstance } from "./database.instance";

export async function save(data: IPoint[]) {
    await influxInstance.writePoints(data);
}