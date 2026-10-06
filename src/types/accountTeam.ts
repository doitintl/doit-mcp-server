export type AccountManager = {
    email: string;
    id: string;
    name: string;
    role: string;
    calendlyLink?: string;
};

export type AccountTeamResponse = {
    accountManagers: AccountManager[];
};
