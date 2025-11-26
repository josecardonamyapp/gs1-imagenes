import { Component, HostListener } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ProductService, SyncfoniaProduct } from 'src/app/services/product.service';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButton } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ProcessResultComponent } from '../productResult/productResult.component';
import { JobConfirmationComponent } from '../job-confirmation/job-confirmation.component';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDialog } from '@angular/material/dialog';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { Channel } from 'src/app/model/channel';
import { ChannelRequiredDialogComponent } from 'src/app/components/dialogs/channel-required-dialog/channel-required-dialog.component';
import { extractGlnFromKey, extractGtinFromKey } from 'src/app/utils/product-key';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatChipsModule } from '@angular/material/chips';
import * as EXIF from 'exif-js';

@Component({
    selector: 'app-productOne',
    standalone: true,
    imports: [
        MatIconModule,
        CommonModule,
        FormsModule,
        MatTabsModule,
        MatButton,
        MatProgressSpinnerModule,
        MatDialogModule,
        MatSelectModule,
        MatInputModule,
        MatCheckboxModule,
        MatFormFieldModule,
        ProcessResultComponent,
        MatTooltipModule,
        MatAutocompleteModule,
        MatChipsModule
    ],
    templateUrl: './productOne.component.html',
    styleUrls: ['./productOne.component.scss']
})
export class ProductOneComponent {
     // Utilidad para saber si el color es uno de los default
    isCustomColor(color: string): boolean {
        if (!color) return false;
        const defaults = ['#FFFFFF', '#F8F8FF', '#FFE4F0', 'TRANSPARENT'];
        return !defaults.includes((color + '').trim().toUpperCase());
    }

    // Obtener el valor para el input color
    getCustomColorValue(): string {
        // Si el color actual es custom, mostrarlo, si no, negro
        return this.isCustomColor(this.channelForEditing.background_color) ? this.channelForEditing.background_color : '#000000';
    }

    // Al seleccionar un color personalizado
    setCustomColor(event: any) {
        this.channelForEditing.background_color = event.target.value;
    }

    gtin: string | null = null;
    gln: string | null = null;
    product: any = {
        gtin: '',
        producName: '',
        images: '',
        currentIndex: 0,
        gln: ''
    };
    channels: any[] = [];

    selectedFormat = 'Sams';
    imagesPerGtin: number | string = 1;
    imagesOptions = [
        { value: 1, label: '1' },
        { value: 2, label: '2' },
        { value: 'Todos', label: 'Todos' }
    ];

    selectedTab = 0;

    // Multi-channel selection
    selectedChannelIds: number[] = [];
    channelForEditing = {} as Channel;
    activeChannelIdForView: number | null = null; // Canal activo para visualización (sin edición)
    selectedChannelProvider: string | null = null;
    disabledFormChannel = true;
    folderStructures = [
        { label: 'Guardar codigo por carpeta', value: 1 },
        { label: 'Guardar todas las imagenes en una sola carpeta', value: 2 },
    ];

    isGenerating = false;

    // Nuevas propiedades para IA
    useAIBackground = false;
    aiBackgroundPrompt = '';
    showAIMenu = false;
    aiImageDimensions = ['1024x1024', '768x768', '512x512'];
    aiImageDimensionsSelected = '1024x1024'; // Valor por defecto
    errorMessage = '';
    showError = false;

    // Propiedades para control de acceso por rol
    private isAdminUser = false;
    private userGln: string | null = null;

    // Propiedad para renombrado personalizado
    customRenameValue: string = '';

    // Índice de la imagen seleccionada para preview
    selectedImageIndex: number = 0;

    constructor(
        private route: ActivatedRoute,
        private productService: ProductService,
        private router: Router,
        private dialog: MatDialog
    ) { }

    // Helper para obtener el nombre del canal por ID
    getChannelNameById(channelId: number): string {
        const channel = this.channels?.find(ch => ch.channelID === channelId);
        return channel?.provider || `Canal ${channelId}`;
    }

    ngOnInit(): void {
        this.gtin = this.route.snapshot.paramMap.get('gtin');
        const productKey = this.route.snapshot.queryParamMap.get('productKey');
        const glnParam = this.route.snapshot.queryParamMap.get('gln');

        if (productKey) {
            this.gtin = extractGtinFromKey(productKey) || this.gtin;
            this.gln = extractGlnFromKey(productKey) || null;
        } else if (glnParam) {
            this.gln = glnParam && glnParam.trim() !== '' ? glnParam : null;
        }

        this.initializeUserAccess();
        this.getPrductByGtin();
        this.getProductChannels();

        if (!this.hasSelectedChannel()) {
            this.disabledFormChannel = true;
        }
    }

    goToReturn() {
        this.router.navigate(['/dashboards/dashboard1']);
    }

    async getPrductByGtin() {
        this.isGenerating = true;
        const gtinList = this.gtin ? [this.gtin] : [];
        this.productService.productGetByGtin(gtinList, this.gln ? { gln: this.gln } : undefined).subscribe({
            next: async (response) => {
                this.isGenerating = false;
                const normalizedProducts = this.productService.normalizeTradeItemsResponse(response);

                if (!normalizedProducts.length) {
                    return;
                }

                const firstProduct = normalizedProducts
                    .map((product: SyncfoniaProduct) => {
                        const images = Array.isArray(product.images)
                            ? product.images.filter(image => {
                                const url = image?.uniformresourceidentifier ?? '';
                                return typeof url === 'string' && url.trim() !== '' && /\.(jpg|jpeg|png)$/i.test(url);
                            })
                            : [];

                        if (!images.length) {
                            return null;
                        }

                        return {
                            gtin: product.gtin,
                            producName: product.producName,
                            images,
                            currentIndex: 0,
                            gln: product.gln ?? '',
                            image360Path: product.image360Path ?? null,
                            brandName: product.brandName ?? '',
                            functionalName: product.functionalName ?? '',
                            attributes: product.attributes
                        };
                    })
                    .find((item): item is any => Boolean(item));

                if (firstProduct) {
                    // Mostrar inmediatamente sin esperar detección
                    const preparedImages: any[] = firstProduct.images.map((image: any) => ({
                        ...image,
                        displayUrl: image?.uniformresourceidentifier,
                        rotateCssFallback: false
                    }));
                    firstProduct.images = preparedImages;
                    this.product = firstProduct;

                    // Detectar orientación en segundo plano
                    preparedImages.forEach((img: any) => {
                        this.checkIfImageNeedsRotation(img?.uniformresourceidentifier)
                            .then(needsRotation => {
                                img.rotateCssFallback = needsRotation;
                            })
                            .catch(() => {
                                img.rotateCssFallback = false;
                            });
                    });
                }
            },
            error: (error) => {
                this.isGenerating = false;
                console.error('Error in loading product:', error);
            },
            complete: () => {
                this.isGenerating = false;
            }
        });
    }

    async getProductChannels() {
        const glnParam = !this.isAdminUser && this.userGln ? this.userGln : undefined;
        this.productService.productGetChannels(glnParam).subscribe({
            next: (result: any) => {
                if (typeof (result) === 'object') {
                    this.channels = result.channels;
                    // this.initializeSelectedChannel();
                }
            }
        })
    }

    private initializeUserAccess(): void {
        this.userGln = (localStorage.getItem('gln') || '').trim() || null;
        let roles: any[] = [];

        try {
            const storedRoles = JSON.parse(localStorage.getItem('roles') || '[]');
            roles = Array.isArray(storedRoles) ? storedRoles : [];
        } catch {
            roles = [];
        }

        this.isAdminUser = roles.some(
            (role: any) =>
                typeof role === 'string' &&
                (role.toLowerCase() === 'systemadmin' || role.toLowerCase().includes('admin'))
        );
    }

    getPreviewStyle(format: any, gln: any) {

        if (gln !== undefined && gln !== null) {
            this.product["gln"] = gln;
        }
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


    onChannelSelectionChange(selectedIds: number[]): void {
        this.selectedChannelIds = selectedIds || [];
        this.activeChannelIdForView = null; // Limpiar visualización al cambiar selección
        
        // Si solo hay un canal seleccionado, permitir edición
        if (this.selectedChannelIds.length === 1) {
            const channel = this.channels.find(ch => ch.channelID === this.selectedChannelIds[0]);
            if (channel) {
                this.channelForEditing = this.prepareChannelForEditing(channel);
                this.activeChannelIdForView = this.selectedChannelIds[0];
                this.disabledFormChannel = true;
                
                if (channel?.gln) {
                    this.product['gln'] = channel.gln;
                }
            }
        } else {
            // Si hay múltiples canales, limpiar el canal de edición
            this.channelForEditing = {} as Channel;
            this.disabledFormChannel = true;
        }
    }

    onChipClick(channelId: number): void {
        // Solo permitir vista en modo multi-canal (no habilita edición)
        if (this.selectedChannelIds.length > 1) {
            this.activeChannelIdForView = channelId;
            const channel = this.channels.find(ch => ch.channelID === channelId);
            if (channel) {
                this.channelForEditing = this.prepareChannelForEditing(channel);
                // Asegurar que permanezca deshabilitado
                this.disabledFormChannel = true;
            }
        }
    }

    canEditChannel(): boolean {
        return this.selectedChannelIds.length === 1;
    }

    editChannel(): void {
        if (this.canEditChannel()) {
            this.disabledFormChannel = false;
        }
    }

    cancelChannel(): void {
        // Restaurar los valores originales del canal
        if (this.selectedChannelIds.length === 1) {
            const originalChannel = this.channels.find(ch => ch.channelID === this.selectedChannelIds[0]);
            if (originalChannel) {
                this.channelForEditing = this.prepareChannelForEditing(originalChannel);
            }
        }
        this.disabledFormChannel = true;
    }

    onRenamingTypeChange(): void {
        // Si se cambia a "Estándar", resetear el valor personalizado
        if (this.channelForEditing.renaming_type !== 'custom') {
            this.customRenameValue = '';
        }
    }

    private initializeSelectedChannel(): void {
        const provider = this.selectedChannelProvider ?? this.channels[0]?.provider ?? null;
        this.selectChannelByProvider(provider);
    }

    private selectChannelByProvider(provider: string | null | undefined): void {
        if (!provider) {
            this.channelForEditing = {} as Channel;
            this.selectedChannelProvider = null;
            this.selectedChannelIds = [];
            return;
        }

        const channel = this.channels.find(item => item?.provider === provider);
        if (!channel) {
            this.channelForEditing = {} as Channel;
            this.selectedChannelProvider = provider;
            this.selectedChannelIds = [];
            return;
        }

        this.selectedChannelProvider = channel.provider;
        this.selectedChannelIds = [channel.channelID];
        this.channelForEditing = this.prepareChannelForEditing(channel);
        this.disabledFormChannel = true;

        if (channel?.gln) {
            this.product['gln'] = channel.gln;
        }
    }

    private prepareChannelForEditing(channel: Channel): Channel {
        const copy: Channel = { ...channel };
        copy.background_color = this.ensureHexColor(copy.background_color);

        if (copy.folder_structure === undefined || copy.folder_structure === null) {
            copy.folder_structure = this.folderStructures[0]?.value ?? 1;
        }

        if (copy.rename_start_index === undefined || copy.rename_start_index === null) {
            copy.rename_start_index = 0;
        }

        return copy;
    }

    private ensureHexColor(color?: string | null): string {
        if (!color) {
            return '#FFFFFF';
        }

        return color.startsWith('#') ? color : this.rgbToHex(color);
    }

    private componentToHex(value: number): string {
        const clamped = Math.max(0, Math.min(255, Math.round(value)));
        const hex = clamped.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }

    private hexToRgb(hex: string): number[] {
        if (!hex) {
            return [255, 255, 255];
        }

        const normalized = hex.startsWith('#') ? hex.slice(1) : hex;
        if (normalized.length !== 6) {
            return [255, 255, 255];
        }

        const r = parseInt(normalized.slice(0, 2), 16);
        const g = parseInt(normalized.slice(2, 4), 16);
        const b = parseInt(normalized.slice(4, 6), 16);

        if ([r, g, b].some(value => Number.isNaN(value))) {
            return [255, 255, 255];
        }

        return [r, g, b];
    }

    private rgbToHex(color: string): string {
        if (!color) {
            return '#FFFFFF';
        }

        const parts = color.split(',').map(part => parseInt(part.trim(), 10));
        if (parts.length !== 3 || parts.some(part => Number.isNaN(part))) {
            return '#FFFFFF';
        }

        return '#' + parts.map(part => this.componentToHex(part)).join('');
    }

    private normalizeBackgroundColor(color: string | null | undefined): string {
        if (!color) {
            return '255,255,255';
        }

        if (color.startsWith('#')) {
            return this.hexToRgb(color).join(',');
        }

        const parts = color.split(',').map(part => part.trim());
        if (parts.length === 3 && parts.every(part => part !== '' && !Number.isNaN(Number(part)))) {
            return parts.join(',');
        }

        return color;
    }

    private buildChannelPayload(): any {
        if (!this.channelForEditing || !this.channelForEditing.channelID) {
            return null;
        }

        const payload: any = {
            ...this.channelForEditing,
            width: Number(this.channelForEditing.width) || 0,
            height: Number(this.channelForEditing.height) || 0,
            dpi: Number(this.channelForEditing.dpi) || 0,
            max_size_kb: Number(this.channelForEditing.max_size_kb) || 0,
            rename_start_index: Number(this.channelForEditing.rename_start_index) || 0,
            folder_structure: Number.isNaN(Number(this.channelForEditing.folder_structure))
                ? (this.folderStructures[0]?.value ?? 1)
                : Number(this.channelForEditing.folder_structure)
        };

        if(this.channelForEditing.background_color != 'transparent'){
            payload.background_color = this.normalizeBackgroundColor(this.channelForEditing.background_color);
        }

        return payload;
    }

    private buildChannelsPayload(): any[] {
        return this.selectedChannelIds.map(channelId => {
            const channel = this.channels.find(ch => ch.channelID === channelId);
            if (!channel) return null;
            
            // Si este canal es el que está siendo editado, usar los valores de channelForEditing
            const isBeingEdited = this.channelForEditing && this.channelForEditing.channelID === channelId;
            const sourceChannel = isBeingEdited ? this.channelForEditing : channel;
            
            return {
                ...sourceChannel,
                width: Number(sourceChannel.width) || 0,
                height: Number(sourceChannel.height) || 0,
                dpi: Number(sourceChannel.dpi) || 0,
                max_size_kb: Number(sourceChannel.max_size_kb) || 0,
                rename_start_index: Number(sourceChannel.rename_start_index) || 0,
                folder_structure: Number.isNaN(Number(sourceChannel.folder_structure))
                    ? (this.folderStructures[0]?.value ?? 1)
                    : Number(sourceChannel.folder_structure),
                background_color: sourceChannel.background_color !== 'transparent' 
                    ? this.normalizeBackgroundColor(sourceChannel.background_color)
                    : 'transparent',
                renaming_type: sourceChannel.renaming_type || 'standard'
            };
        }).filter(ch => ch !== null);
    }

    private buildProductPayload(): any {
        // Crear una copia del producto
        const productCopy = {
            ...this.product,
            images: Array.isArray(this.product.images) ? [...this.product.images] : []
        };

        // Aplicar filtro de imágenes por GTIN
        let imagesPerGtinNum = Number(this.imagesPerGtin);

        if (this.imagesPerGtin === 'Todos') {
            // Procesar todas las imágenes
            productCopy.images = productCopy.images;
        }
        else if (!isNaN(imagesPerGtinNum) && imagesPerGtinNum > 0) {
            // Procesar solo las primeras N imágenes
            productCopy.images = productCopy.images.slice(0, imagesPerGtinNum);
        }

        return productCopy;
    }

    hasSelectedChannel(): boolean {
        return this.selectedChannelIds.length > 0;
    }

    private ensureChannelSelected(message: string): boolean {
        if (this.hasSelectedChannel()) {
            return true;
        }

        this.hideError();
        this.openChannelRequiredDialog(message);
        return false;
    }

    private openChannelRequiredDialog(message: string): void {
        const dialogRef = this.dialog.open(ChannelRequiredDialogComponent, {
            width: '420px',
            data: {
                message,
                confirmText: 'Aceptar',
                cancelText: 'Cancelar'
            }
        });

        dialogRef.afterClosed().subscribe(shouldEnable => {
            if (shouldEnable) {
                this.disabledFormChannel = false;
            }
        });
    }

    processImg() {
        if (!this.ensureChannelSelected('Debe seleccionar al menos un canal antes de procesar.')) {
            return;
        }

        const storedGln: string | null = localStorage.getItem('gln');
        const glnNumber = storedGln ? Number(storedGln) : null;
        this.isGenerating = true;

        const productToSend = this.buildProductPayload();
        const channelsParams = this.buildChannelsPayload();

        if (!channelsParams.length) {
            this.isGenerating = false;
            this.showErrorMessage('No fue posible preparar los parametros de los canales.');
            return;
        }

        const params: any = {
            images_url: productToSend,
            channel_params: channelsParams,
            no_background: true,
            transparent_background: channelsParams.some(ch => ch.background_color === 'transparent'),
            gln: glnNumber
        };

        // Agregar valor de renombrado personalizado si existe
        if (this.channelForEditing.renaming_type === 'custom' && this.customRenameValue.trim()) {
            params.custom_rename_value = this.customRenameValue.trim();
        }

        console.log('Processing image with channel:', params);
        this.productService.productProcessImg(params).subscribe({
            next: (result: any) => {
                //(result)
                this.isGenerating = false;

                // Almacenar el job_id en localStorage
                if (result && result.job_id) {
                    const storedJobs = localStorage.getItem('processing_jobs');
                    const jobIds = storedJobs ? JSON.parse(storedJobs) : [];

                    if (!jobIds.includes(result.job_id)) {
                        jobIds.push(result.job_id);
                        localStorage.setItem('processing_jobs', JSON.stringify(jobIds));
                    }
                }

                // Crear modal de confirmacion para ir a ver los jobs
                const dialogRef = this.dialog.open(JobConfirmationComponent, {
                    data: result,
                    width: '500px',
                    disableClose: true
                });

                // Manejar la respuesta del modal
                dialogRef.afterClosed().subscribe(shouldRedirect => {
                    if (shouldRedirect) {
                        this.router.navigate(['/jobs']);
                    }
                });

            },
            error: (error) => {
                this.isGenerating = false;
                console.error('Error in processImg:', error);
            },
            complete: () => {
                this.isGenerating = false;
                //('processImg finished.');
            }
        })

    }

    processImgNoBackground() {
        if (!this.ensureChannelSelected('Debe seleccionar al menos un canal antes de procesar.')) {
            return;
        }

        const storedGln: string | null = localStorage.getItem('gln');
        const glnNumber = storedGln ? Number(storedGln) : null;
        this.isGenerating = true;

        const productToSend = this.buildProductPayload();
        const channelsParams = this.buildChannelsPayload();

        if (!channelsParams.length) {
            this.isGenerating = false;
            this.showErrorMessage('No fue posible preparar los parametros de los canales.');
            return;
        }

        const params: any = {
            images_url: productToSend,
            channel_params: channelsParams,
            no_background: true,
            not_apply_transformations: true,
            gln: glnNumber
        };

        // Agregar valor de renombrado personalizado si existe
        if (this.channelForEditing.renaming_type === 'custom' && this.customRenameValue.trim()) {
            params.custom_rename_value = this.customRenameValue.trim();
        }

        console.log('Processing image with no background:', params);
        this.productService.productProcessImg(params).subscribe({
            next: (result: any) => {
                //(result)
                this.isGenerating = false;

                // Almacenar el job_id en localStorage
                if (result && result.job_id) {
                    const storedJobs = localStorage.getItem('processing_jobs');
                    const jobIds = storedJobs ? JSON.parse(storedJobs) : [];

                    if (!jobIds.includes(result.job_id)) {
                        jobIds.push(result.job_id);
                        localStorage.setItem('processing_jobs', JSON.stringify(jobIds));
                    }
                }

                // Crear modal de confirmacion para ir a ver los jobs
                const dialogRef = this.dialog.open(JobConfirmationComponent, {
                    data: result,
                    width: '500px',
                    disableClose: true
                });

                // Manejar la respuesta del modal
                dialogRef.afterClosed().subscribe(shouldRedirect => {
                    if (shouldRedirect) {
                        this.router.navigate(['/jobs']);
                    }
                });

            },
            error: (error) => {
                this.isGenerating = false;
                console.error('Error in processImgNoBackground:', error);
            },
            complete: () => {
                this.isGenerating = false;
            }
        })

    }

    processImgWithAI() {
        if (!this.useAIBackground || !this.aiBackgroundPrompt.trim()) {
            this.showErrorMessage('Debe habilitar IA y proporcionar un prompt');
            return;
        }

        if (!this.ensureChannelSelected('Debe seleccionar al menos un canal antes de procesar con IA')) {
            return;
        }

        this.isGenerating = true;
        this.hideError();

        const productToSend = this.buildProductPayload();
        const channelsParams = this.buildChannelsPayload().map(ch => ({
            ...ch,
            width: 1024,
            height: 1024,
            AI_background_prompt: this.aiBackgroundPrompt.trim()
        }));

        if (!channelsParams.length) {
            this.isGenerating = false;
            this.showErrorMessage('No fue posible preparar los parametros de los canales.');
            return;
        }

        const params: any = {
            images_url: productToSend,
            channel_params: channelsParams,
            AI_background_prompt: this.aiBackgroundPrompt.trim()
        };

        // Agregar valor de renombrado personalizado si existe
        if (this.channelForEditing.renaming_type === 'custom' && this.customRenameValue.trim()) {
            params.custom_rename_value = this.customRenameValue.trim();
        }

        console.log('Processing image with AI background:', params);
        this.productService.productProcessImg(params).subscribe({
            next: (result: any) => {
                this.isGenerating = false;

                // Almacenar el job_id en localStorage
                if (result && result.job_id) {
                    const storedJobs = localStorage.getItem('processing_jobs');
                    const jobIds = storedJobs ? JSON.parse(storedJobs) : [];

                    if (!jobIds.includes(result.job_id)) {
                        jobIds.push(result.job_id);
                        localStorage.setItem('processing_jobs', JSON.stringify(jobIds));
                    }
                }

                // Crear modal de confirmacion para ir a ver los jobs
                const dialogRef = this.dialog.open(JobConfirmationComponent, {
                    data: result,
                    width: '500px',
                    disableClose: true
                });

                // Manejar la respuesta del modal
                dialogRef.afterClosed().subscribe(shouldRedirect => {
                    if (shouldRedirect) {
                        this.router.navigate(['/jobs']);
                    }
                });

            },
            error: (error) => {
                this.isGenerating = false;
                this.showErrorMessage('Error al procesar la imagen con IA');
                console.error('Error in processImgWithAI:', error);
            },
            complete: () => {
                this.isGenerating = false;
            }
        })
    }

    showErrorMessage(message: string) {
        this.errorMessage = message;
        this.showError = true;
        // Auto-ocultar despues de 5 segundos
        setTimeout(() => {
            this.hideError();
        }, 5000);
    }

    hideError() {
        this.showError = false;
        this.errorMessage = '';
    }

    toggleAIMenu() {
        this.showAIMenu = !this.showAIMenu;
        if (!this.showAIMenu) {
            this.useAIBackground = false;
            this.aiBackgroundPrompt = '';
        }
    }

    onAICheckboxChange() {
        if (!this.useAIBackground) {
            this.aiBackgroundPrompt = '';
        }
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: Event) {
        const target = event.target as HTMLElement;
        // No cerrar el menu si se hace clic en elementos del menu de IA
        if (!target.closest('.ai-button-container') && !target.closest('.ai-dropdown-menu')) {
            this.showAIMenu = false;
        }
    }

    /**
     * Verifica si la imagen seleccionada necesita rotación
     */
    isSelectedImageHorizontal(): boolean {
        if (!this.product?.images || this.product.images.length === 0) {
            return false;
        }
        const img = this.product.images[this.selectedImageIndex];
        return img?.rotateCssFallback === true;
    }

    /**
     * Selecciona una imagen para mostrar en el preview principal
     */
    selectImage(index: number): void {
        if (this.product?.images && index >= 0 && index < this.product.images.length) {
            this.selectedImageIndex = index;
        }
    }

    /**
     * Obtiene la imagen seleccionada actualmente
     */
    getSelectedImage(): any {
        if (!this.product?.images || this.product.images.length === 0) {
            return null;
        }
        return this.product.images[this.selectedImageIndex] || this.product.images[0];
    }

    /**
     * Detecta si una imagen necesita rotación (es horizontal).
     * Solo verifica dimensiones, NO usa Canvas para evitar problemas de CORS.
     * La rotación se aplicará con CSS en el template.
     */
    private checkIfImageNeedsRotation(imageUrl: string): Promise<boolean> {
        return new Promise((resolve) => {
            if (!imageUrl || typeof imageUrl !== 'string') {
                resolve(false);
                return;
            }

            const img = new Image();
            img.crossOrigin = 'anonymous'; // Necesario para leer EXIF

            // Timeout: si tarda más de 5 segundos, asumir que no necesita rotación
            const timeoutId = setTimeout(() => {
                console.warn(`⏱️ Timeout checking EXIF orientation: ${imageUrl}`);
                resolve(false);
            }, 5000);

            img.onload = () => {
                clearTimeout(timeoutId);
                
                try {
                    // Leer datos EXIF
                    EXIF.getData(img as any, function(this: any) {
                        const orientation = EXIF.getTag(this, 'Orientation');
                        
                        // Valores de orientación EXIF:
                        // 1 = Normal (0°)
                        // 3 = Rotada 180°
                        // 6 = Rotada 90° CW (necesita rotación)
                        // 8 = Rotada 90° CCW (necesita rotación)
                        const needsRotation = orientation === 6 || orientation === 8;
                        
                        if (orientation) {
                            console.log(`� EXIF Orientation: ${orientation}, Needs rotation: ${needsRotation} - ${imageUrl.substring(imageUrl.lastIndexOf('/') + 1)}`);
                        } else {
                            console.log(`ℹ️ No EXIF orientation data, assuming correct orientation - ${imageUrl.substring(imageUrl.lastIndexOf('/') + 1)}`);
                        }
                        
                        resolve(needsRotation);
                    });
                } catch (error) {
                    console.warn(`⚠️ Error reading EXIF data: ${imageUrl}`, error);
                    resolve(false); // Si falla la lectura EXIF, no rotar
                }
            };

            img.onerror = () => {
                clearTimeout(timeoutId);
                console.warn(`❌ Error loading image for EXIF check: ${imageUrl}`);
                resolve(false); // Si falla, no rotar
            };

            img.src = imageUrl;
        });
    }
}
