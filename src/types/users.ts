export type User = {
    id: string;
    email: string;
    displayName: string;
    firstName: string;
    lastName: string;
    jobFunction: string;
    phone: string;
    phoneExtension: string;
    language: string;
    roleId: string;
    organizationId: string;
    status: string;
};

export type UsersResponse = {
    users: User[];
    rowCount: number;
};
