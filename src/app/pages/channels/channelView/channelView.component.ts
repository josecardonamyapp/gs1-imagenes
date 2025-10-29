

import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { ProductService } from 'src/app/services/product.service';
import { MatTableModule, MatTableDataSource } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatSnackBarModule } from '@angular/material/snack-bar';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Channel } from 'src/app/model/channel';
import { FolderStructureService } from 'src/app/services/folder_structure.service';
import { catchError, map, of } from 'rxjs';

@Component({
    selector: 'app-channelView',
    standalone: true,
    imports: [
        MatIconModule,
        CommonModule,
        FormsModule,
        MatTableModule,
        MatButtonModule,
        MatTooltipModule,
        MatFormFieldModule,
        MatInputModule,
        MatSelectModule,
        MatSnackBarModule,
        MatSlideToggleModule
    ],
    templateUrl: './channelView.component.html',
    styleUrl: './channelView.component.scss'
})
export class ChannelViewComponent {
    // Utilidad para saber si el color es uno de los default
    isCustomColor(color: string): boolean {
        if (!color) return false;
        const defaults = ['#FFFFFF', '#F8F8FF', '#FFE4F0', 'TRANSPARENT'];
        return !defaults.includes((color + '').trim().toUpperCase());
    }

    // Obtener el valor para el input color
    getCustomColorValue(): string {
        // Si el color actual es custom, mostrarlo, si no, negro
        return this.isCustomColor(this.channel.background_color) ? this.channel.background_color : '#000000';
    }

    // Al seleccionar un color personalizado
    setCustomColor(event: any) {
        this.channel.background_color = event.target.value;
    }
    channel: Channel = {
        channelID: 0,
        gln: 0,
        provider: '',
        width: 0,
        height: 0,
        extension: '',
        dpi: 0,
        background_color: 'transparent', // Default transparent background
        max_size_kb: 0,
        adaptation_type: '',
        renaming_type: 'standard',
        rename_base: '',
        rename_separator: '',
        rename_start_index: 0,
        folder_structure: 1,
        background: false,
        transparent_background: false,
    };
    isEditMode = false;
    isLoading = false;
    disabledGln = false;
    isAdminUser = false;
    currentUserGln: number | null = null;
    customRenameFile: File | null = null;
    customRenameFileName: string | null = null;

    selectedFolderStructure: number = 1; // Default to "Estructura por GTIN"

    // folderStructures = [
    //     { label: 'Guardar Codigo por Carpeta', value: 1 },
    //     { label: 'Guardar todas las imÃ¡genes en una sola carpeta', value: 2 },
    // ]

    folderStructures: any[] = [];

    constructor(
        private productService: ProductService,
        private folderStructureService: FolderStructureService,
        private route: ActivatedRoute,
        private router: Router,
        private snackBar: MatSnackBar
    ) { }

    ngOnInit(): void {
        this.route.queryParams.subscribe(params => {
            console.log(params)
            if (params && params['channelID']) {
                this.isEditMode = true;
                // Crear una copia del objeto para evitar propiedades read-only
                this.channel = {
                    channelID: parseInt(params['channelID'] || '0'),
                    gln: parseInt(params['gln'] || '0'),
                    provider: params['provider'] || '',
                    width: parseInt(params['width'] || '0'),
                    height: parseInt(params['height'] || '0'),
                    extension: params['extension'] || '',
                    dpi: parseInt(params['dpi'] || '0'),
                    background_color: this.rgbToHex(params['background_color']) || 'transparent', // Default transparent background
                    max_size_kb: parseInt(params['max_size_kb'] || '0'),
                    adaptation_type: params['adaptation_type'] || '',
                    renaming_type: (params['renaming_type'] && params['renaming_type'].toLowerCase() === 'custom') ? 'custom' : 'standard',
                    rename_base: params['rename_base'] || '',
                    rename_separator: params['rename_separator'] || '',
                    rename_start_index: parseInt(params['rename_start_index'] || '0'),
                    folder_structure: parseInt(params['folder_structure'] || '1'),
                    background: params['background'] || false,
                    transparent_background: params['background_color'] == 'transparent' ? true : false,
                };
                //('Modo ediciÃ³n:', this.channel);
            } else {
                this.isEditMode = false;
                //('Modo creaciÃ³n');
            }
        });
        this.getFolderStructures();
        this.initializeUserAccess();
    }

    private initializeUserAccess(): void {
        const storedGln = (localStorage.getItem('gln') || '').trim();
        let roles: string[] = [];

        try {
            const rawRoles = JSON.parse(localStorage.getItem('roles') || '[]');
            roles = Array.isArray(rawRoles) ? rawRoles : [];
        } catch {
            roles = [];
        }

        this.isAdminUser = roles.some(
            (role: any) =>
                typeof role === 'string' &&
                (role.toLowerCase() === 'systemadmin' || role.toLowerCase().includes('admin'))
        );
        this.disabledGln = !this.isAdminUser;

        if (!this.isAdminUser && storedGln) {
            const numericGln = parseInt(storedGln, 10);
            if (!Number.isNaN(numericGln)) {
                this.currentUserGln = numericGln;
                this.channel.gln = numericGln;
            }
        }
    }

    getFolderStructures() {
        this.folderStructureService.getFolderStructureList().subscribe({
          next: (data) => {
            console.log(data)
            this.folderStructures = data;
          },
          error: (error) => {
            console.error('Error fetching folder structures:', error);
          }
        })
    }

    hexToRgb(hex: string): Array<number> {
        if (!hex) {
            return [255, 255, 255];
        }

        const normalized = (hex + '').trim().toLowerCase();
        if (normalized === 'transparent') {
            return [255, 255, 255];
        }

        const value = normalized.startsWith('#') ? normalized.slice(1) : normalized;
        const expandedValue = value.length === 3
            ? value.split('').map(char => char + char).join('')
            : value;

        if (expandedValue.length !== 6 || /[^0-9a-f]/i.test(expandedValue)) {
            return [255, 255, 255];
        }

        const r = parseInt(expandedValue.slice(0, 2), 16);
        const g = parseInt(expandedValue.slice(2, 4), 16);
        const b = parseInt(expandedValue.slice(4, 6), 16);

        return [r, g, b];
    }
    componentToHex(c: number): string {
        const hex = c.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }

    rgbToHex(backgroundColor: string): string {
        if (!backgroundColor) {
            return 'transparent';
        }

        const trimmed = backgroundColor.trim();
        if (trimmed.toLowerCase() === 'transparent') {
            return 'transparent';
        }

        if (trimmed.startsWith('#')) {
            return trimmed;
        }

        const parts = trimmed.split(',').map(part => Number(part.trim()));
        if (parts.length === 3 && parts.every(part => !Number.isNaN(part))) {
            return '#' + this.componentToHex(parts[0]) + this.componentToHex(parts[1]) + this.componentToHex(parts[2]);
        }

        return '#FFFFFF';
    }
    getPreviewStyle(format: any) {
        // this.selectedChannel = format;
        if (!format?.width || !format?.height) return {};

        const maxBoxSize = 200;
        const ratio = format.width / format.height;

        let width: number;
        let height: number;

        if (ratio >= 1) {
            width = maxBoxSize;
            height = Math.round(maxBoxSize / ratio);
        } else {
            height = maxBoxSize;
            width = Math.round(maxBoxSize * ratio);
        }

        return {
            width: `${width}px`,
            height: `${height}px`,
        };
    }

    onSave() {
        if (!this.validateForm()) {
            return;
        }

        // Convertir campos numÃ©ricos a enteros
        const channelData = this.prepareChannelData();
        //('Datos del canal a guardar:', channelData);
        this.isLoading = true;

        if (this.isEditMode) {
            this.updateChannel(channelData);
        } else {
            this.createChannel(channelData);
        }
    }

    private validateForm(): boolean {
        if (!this.channel.provider || !this.channel.extension) {
            this.showMessage('Por favor, complete todos los campos requeridos');
            return false;
        }
        if (this.channel.width <= 0 || this.channel.height <= 0) {
            this.showMessage('Las dimensiones deben ser mayores a 0');
            return false;
        }
        if (this.channel.dpi <= 0) {
            this.showMessage('El DPI debe ser mayor a 0');
            return false;
        }
        if (!this.channel.adaptation_type || !this.channel.renaming_type) {
            this.showMessage('Por favor, seleccione el tipo de adaptacion y renombrado');
            return false;
        }
        if (this.channel.renaming_type === 'custom' && !this.channel.rename_base) {
            this.showMessage('Por favor, ingrese la base del renombrado');
            return false;
        }
        if (this.channel.renaming_type === 'custom' && !this.customRenameFile && !this.isEditMode) {
            this.showMessage('Por favor, carga el archivo de renombrado personalizado');
            return false;
        }
        return true;
    }
    private prepareChannelData(): Channel {
        const renamingType = this.channel.renaming_type === 'custom' ? 'custom' : 'Estandar';
        return {
            ...this.channel,
            gln: parseInt(this.channel.gln?.toString() || '0'),
            width: parseInt(this.channel.width?.toString() || '0'),
            height: parseInt(this.channel.height?.toString() || '0'),
            dpi: parseInt(this.channel.dpi?.toString() || '0'),
            max_size_kb: parseInt(this.channel.max_size_kb?.toString() || '0'),
            rename_start_index: parseInt(this.channel.rename_start_index?.toString() || '0'),
            renaming_type: renamingType,
            background_color: this.normalizeBackgroundColorForPayload(this.channel.background_color),
        };
    }
    private normalizeBackgroundColorForPayload(color: string | null | undefined): string {
        if (!color) {
            return 'transparent';
        }

        const normalized = color.trim().toLowerCase();
        if (normalized === 'transparent') {
            return 'transparent';
        }

        return this.hexToRgb(color).join(',');
    }
    private createChannel(channelData: Channel) {
        this.productService.productCreateChannel(channelData).subscribe({
            next: (result: any) => {
                this.isLoading = false;
                this.showMessage('Canal creado exitosamente');
                this.router.navigate(['/channels/channel']);
            },
            error: (error) => {
                this.isLoading = false;
                this.showMessage('Error al crear el canal');
                console.error('Error:', error);
            }
        });
    }

    private updateChannel(channelData: Channel) {
        //('Datos para actualizar:', channelData);
        this.productService.productUpdateChannel(channelData.channelID, channelData).subscribe({
            next: (result: any) => {
                //('Respuesta del servidor:', result);
                this.isLoading = false;
                this.showMessage('Canal actualizado exitosamente');
                this.router.navigate(['/channels/channel']);
            },
            error: (error) => {
                this.isLoading = false;
                this.showMessage('Error al actualizar el canal');
                console.error('Error:', error);
            }
        });
    }

    onRenamingTypeChange(value: string): void {
        this.channel.renaming_type = value;
        if (value !== 'custom') {
            this.customRenameFile = null;
            this.customRenameFileName = null;
            this.channel.rename_base = '';
            this.channel.rename_separator = '';
            this.channel.rename_start_index = 0;
        }
    }

    onCustomFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement | null;
        const file = input?.files && input.files.length > 0 ? input.files[0] : null;
        this.customRenameFile = file;
        this.customRenameFileName = file ? file.name : null;

        if (file) {
            this.showMessage('Archivo de renombrado personalizado seleccionado correctamente');
        }
    }

    downloadCustomTemplate(): void {
        const headers = ['GTIN', 'IdentificadorPersonalizado'];
        const exampleRows = [
            ['07501234567890', 'SKU001'],
            ['07509876543210', 'SKU002'],
        ];

        const csvContent = [headers.join(','), ...exampleRows.map(row => row.join(','))].join('\r\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);

        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = 'plantilla-renombrado-personalizado.csv';
        anchor.rel = 'noopener';
        anchor.click();

        window.URL.revokeObjectURL(url);
    }

    onCancel() {
        this.router.navigate(['/channels/channel']);
    }

    private showMessage(message: string) {
        this.snackBar.open(message, 'Cerrar', {
            duration: 3000
        });
    }

    onAction(action: string, row: any) {
        //('edito')
    }
}


