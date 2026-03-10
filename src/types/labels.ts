export const LABEL_SORT_BY_VALUES = ["id", "name", "type", "createTime", "updateTime"] as const;

export const LABEL_SORT_ORDER_VALUES = ["asc", "desc"] as const;

export type Label = {
    id: string;
    name: string;
    color: string;
    type: string;
    createTime?: string;
    updateTime?: string;
};

export type LabelsResponse = {
    pageToken?: string;
    rowCount: number;
    labels: Label[];
};
