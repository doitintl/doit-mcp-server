export type Folder = {
    id: string;
    name: string;
    description?: string;
    parentFolderId?: string;
};

export type FoldersResponse = {
    pageToken?: string;
    rowCount: number;
    folders: Folder[];
};
