export const ANNOTATION_SORT_BY_VALUES = ["id", "content", "timestamp", "timeCreated", "timeModified"] as const;

export const ANNOTATION_SORT_ORDER_VALUES = ["asc", "desc"] as const;

export type LabelInfo = {
    id: string;
    name: string;
};

export type Annotation = {
    id: string;
    content: string;
    timestamp: string;
    reports?: string[];
    labels?: LabelInfo[];
    createTime?: string;
    updateTime?: string;
};

export type AnnotationsResponse = {
    pageToken?: string;
    rowCount: number;
    annotations: Annotation[];
};

export type CreateAnnotationRequest = {
    content: string;
    timestamp: string;
    reports?: string[];
    labels?: string[];
};

export type UpdateAnnotationRequest = {
    content?: string | null;
    timestamp?: string | null;
    reports?: string[] | null;
    labels?: string[] | null;
};
