export interface IPodRelations {
  name: string;
  meta: IPodRelationsMeta;
}

export interface IGalaxyFromTo {
  name: string;
  meta: IGalaxyFromToMeta;
  provider: string;
}

interface IGalaxyFromToMeta {
  entries: any[];
}

export interface IGalaxyFromToMetaJiraItem {
  jiraProductName: string;
  galaxyProductId: string;
}

interface IPodRelationsMeta {
  relations: IPodRelationsMetaItem[];
}

export interface IPodRelationsMetaItem {
  productId: string
  productName: string;
  valueStreamId: string;
  valueStreamName: string;
  podId: string;
  podName: string;
  idRepositories: string[];
}