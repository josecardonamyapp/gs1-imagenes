import { Component, HostListener } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ProductService } from 'src/app/services/product.service';
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
        ProcessResultComponent
    ],
    templateUrl: './productOne.component.html',
    styleUrls: ['./productOne.component.scss']
})
export class ProductOneComponent {
    gtin: string | null = null;
    product: any = {
        gtin: '',
        producName: '',
        images: '',
        currentIndex: 0
    };
    channels: any[] = [];

    selectedFormat = 'Sams';
    imagesPerGtin = 1;

    selectedTab = 0;

    selectedImage: string | null = null;
    selectedChannel: Channel | null = null;
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

    constructor(
        private route: ActivatedRoute,
        private productService: ProductService,
        private router: Router,
        private dialog: MatDialog
    ) { }

    ngOnInit(): void {
        this.gtin = this.route.snapshot.paramMap.get('gtin');
        this.getPrductByGtin();
        this.getProductChannels();
    }

    goToReturn() {
        this.router.navigate(['/dashboards/dashboard1']);
    }

    async getPrductByGtin() {
        this.productService.productGetByGtin(this.gtin).subscribe({
            next: (result) => {
                if (typeof (result) === 'object') {

                    result.data.entities.attributes.map((element: any) => {

                        const files = Array.isArray(element?.referencedfileheader) ? element.referencedfileheader : [];

                        // Filtrar solo URLs que sean imagenes
                        const imageUrls = files.filter((file: any) => {
                            const url = file?.uniformresourceidentifier ?? '';
                            return typeof url === 'string' && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
                        });

                        const descriptionInfo = element?.tradeitemdescriptioninformation ?? {};
                        const description = typeof descriptionInfo.descriptionshort === 'string'
                            ? descriptionInfo.descriptionshort
                            : typeof descriptionInfo.descriptionShort === 'string'
                                ? descriptionInfo.descriptionShort
                                : '';

                        const obj = {
                            gtin: element?.gtin ?? '',
                            producName: description,
                            images: imageUrls,
                            currentIndex: 0
                        }
                        // if (element.referencedfileheader != null) {
                        this.product = obj;
                        // }
                    });

                    // if (this.product?.images?.length > 0) {
                    //     this.selectedImage = this.product.images[0].uniformresourceidentifier;
                    // }
                    //(this.product);
                }
            }
        })
    }

    async getProductChannels() {
        this.productService.productGetChannels().subscribe({
            next: (result: any) => {
                if (typeof (result) === 'object') {
                    this.channels = result.channels;
                    this.initializeSelectedChannel();
                }
            }
        })
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


    onChannelSelectionChange(provider: string): void {
        this.selectChannelByProvider(provider);
    }

    editChannel(): void {
        if (!this.selectedChannel) {
            return;
        }

        this.disabledFormChannel = false;
    }

    cancelChannel(): void {
        this.disabledFormChannel = true;
    }

    private initializeSelectedChannel(): void {
        const provider = this.selectedChannelProvider ?? this.channels[0]?.provider ?? null;
        this.selectChannelByProvider(provider);
    }

    private selectChannelByProvider(provider: string | null | undefined): void {
        if (!provider) {
            this.selectedChannel = null;
            this.selectedChannelProvider = null;
            return;
        }

        const channel = this.channels.find(item => item?.provider === provider);
        if (!channel) {
            this.selectedChannel = null;
            this.selectedChannelProvider = provider;
            return;
        }

        this.selectedChannelProvider = channel.provider;
        this.selectedChannel = this.prepareChannelForEditing(channel);
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
        if (!this.selectedChannel) {
            return null;
        }

        const payload: any = {
            ...this.selectedChannel,
            width: Number(this.selectedChannel.width) || 0,
            height: Number(this.selectedChannel.height) || 0,
            dpi: Number(this.selectedChannel.dpi) || 0,
            max_size_kb: Number(this.selectedChannel.max_size_kb) || 0,
            rename_start_index: Number(this.selectedChannel.rename_start_index) || 0,
            folder_structure: Number.isNaN(Number(this.selectedChannel.folder_structure))
                ? (this.folderStructures[0]?.value ?? 1)
                : Number(this.selectedChannel.folder_structure)
        };

        payload.background_color = this.normalizeBackgroundColor(this.selectedChannel.background_color);

        return payload;
    }

    private buildProductPayload(): any {
        if (this.selectedImage) {
            const selectedImgObj = this.product.images.find(
                (img: any) => img.uniformresourceidentifier === this.selectedImage
            );

            return {
                ...this.product,
                images: selectedImgObj ? [selectedImgObj] : []
            };
        }

        return {
            ...this.product,
            images: Array.isArray(this.product.images) ? [...this.product.images] : []
        };
    }

    toggleImage(url: string) {
        this.selectedImage = this.selectedImage === url ? null : url;
        console.log('img seleccionada', this.selectedImage)
    }

    processImg() {
        if (!this.selectedChannel) {
            this.showErrorMessage('Debe seleccionar un canal antes de procesar.');
            return;
        }

        this.isGenerating = true;

        const productToSend = this.buildProductPayload();
        const channelParams = this.buildChannelPayload();

        if (!channelParams) {
            this.isGenerating = false;
            this.showErrorMessage('No fue posible preparar los parametros del canal.');
            return;
        }

        const params = {
            images_url: productToSend,
            channel_params: channelParams
        };

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
        if (!this.selectedChannel) {
            this.showErrorMessage('Debe seleccionar un canal antes de procesar.');
            return;
        }

        this.isGenerating = true;

        const productToSend = this.buildProductPayload();
        const channelParams = this.buildChannelPayload();

        if (!channelParams) {
            this.isGenerating = false;
            this.showErrorMessage('No fue posible preparar los parametros del canal.');
            return;
        }

        const params = {
            images_url: productToSend,
            channel_params: channelParams,
            no_background: true
        };

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

        if (!this.selectedChannel) {
            this.showErrorMessage('Debe seleccionar un canal antes de procesar con IA');
            return;
        }

        this.isGenerating = true;
        this.hideError();

        const productToSend = this.buildProductPayload();
        const channelParams: any = this.buildChannelPayload();

        if (!channelParams) {
            this.isGenerating = false;
            this.showErrorMessage('No fue posible preparar los parametros del canal.');
            return;
        }

        channelParams.width = 1024;
        channelParams.height = 1024;
        channelParams.AI_background_prompt = this.aiBackgroundPrompt.trim();

        const params = {
            images_url: productToSend,
            channel_params: channelParams,
            AI_background_prompt: this.aiBackgroundPrompt.trim()
        };

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
}
