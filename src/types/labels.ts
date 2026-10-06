export const LABEL_SORT_BY_VALUES = ["id", "name", "type", "createTime", "updateTime"] as const;

export const LABEL_SORT_ORDER_VALUES = ["asc", "desc"] as const;

export const LABEL_COLOR_VALUES = [
    "blue",
    "skyBlue",
    "teal",
    "mint",
    "lime",
    "softYellow",
    "apricot",
    "lavender",
    "purple",
    "rosePink",
    "slateGrey",
] as const;

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

export const LABEL_ASSIGNMENT_OBJECT_TYPE_VALUES = [
    "alert",
    "allocation",
    "budget",
    "metric",
    "report",
    "annotation",
] as const;

export type LabelAssignmentObject = {
    objectId: string;
    objectType: (typeof LABEL_ASSIGNMENT_OBJECT_TYPE_VALUES)[number];
};

export type LabelAssignmentsResponse = {
    assignments: LabelAssignmentObject[];
};
