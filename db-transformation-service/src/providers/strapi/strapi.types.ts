export interface IPodRelations {
  name: string;
  meta: IPodRelationsMeta;
}

interface IPodRelationsMeta {
  relations: IPodRelationsMetaItem[];
}

interface IPodRelationsMetaItem {
  productId: string
  productName: string;
  valueStreamId: string;
  valueStreamName: string;
  podId: string;
  podName: string;
  idRepositories: string[];
}