export const JOB_FUNCTION_VALUES = [
    "Data Engineer / Data Analysts",
    "Executive Team",
    "Finance / Accounting",
    "Founder",
    "Legal / Purchasing",
    "Management",
    "Sales / Marketing",
    "Software / Ops Engineer",
] as const;

export const LANGUAGE_VALUES = ["en", "ja", "es"] as const;

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
