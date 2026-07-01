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

export type ActiveTheme = {
    /**
     * Identifier of the active theme. The reserved sentinel "default" is returned
     * when the user is using the built-in default (no custom or preset theme stored).
     */
    themeId: string;
};
