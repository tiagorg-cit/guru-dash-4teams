import { InfluxDB } from 'influx';

export const influxInstance = new InfluxDB(process.env.INFLUXDB!);