export type Role = {
    id: string;
    name: string;
    type: string;
    customer: string;
    permissions: string[];
};

export type RolesResponse = {
    roles: Role[];
};
