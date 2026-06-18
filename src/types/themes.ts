export type ThemeColors = {
    light: string[];
    dark: string[];
};

export type CustomTheme = {
    id: string;
    name: string;
    primaryColor: string;
    colors: ThemeColors;
    createTime?: string;
    updateTime?: string;
};

export type ThemesResponse = {
    rowCount?: number;
    themes: CustomTheme[];
};
