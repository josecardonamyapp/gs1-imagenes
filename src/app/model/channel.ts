export interface Channel {
    channelID: number;
    gln: number;
    provider: string;
    width: number;
    height: number;
    extension: string;
    dpi: number;
    max_size_kb: number;
    background_color: string; // Optional property for background color
    adaptation_type: string;
    renaming_type: string;
    rename_base: string;
    rename_separator: string;
    rename_start_index: number;
    folder_structure: number;
}
