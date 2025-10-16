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
import { MatDialogModule } from '@angular/material/dialog';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { JobConfirmationComponent } from '../../productOne/job-confirmation/job-confirmation.component';
import { fetchUserAttributes, getCurrentUser } from 'aws-amplify/auth';
import { MatOption } from '@angular/material/core';
import { MatSelect } from '@angular/material/select';
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
        MatFormFieldModule,
        MatInputModule,
        MatOption,
        MatSelect,
        MatAutocompleteModule
    ],
    templateUrl: './productProcessingView.component.html',
    styleUrls: ['./productProcessingView.component.scss']
})
export class productProcessingViewComponent {
    // Utilidad para saber si el color es uno de los default
    isCustomColor(color: string): boolean {
        if (!color) return false;
        const defaults = ['#FFFFFF', '#F8F8FF', '#FFE4F0', 'TRANSPARENT'];
        return !defaults.includes((color + '').trim().toUpperCase());
    }

    // Obtener el valor para el input color
    getCustomColorValue(): string {
        // Si el color actual es custom, mostrarlo, si no, negro
        return this.isCustomColor(this.selectedChannel.background_color) ? this.selectedChannel.background_color : '#000000';
    }

    // Al seleccionar un color personalizado
    setCustomColor(event: any) {
        this.selectedChannel.background_color = event.target.value;
    }

    gtin: string | null = null;
    products: any[] = [];
    channels: any[] = [];
    channelStyles: { [key: string]: any } = {};
    disabledFormChannel = false;
    selectedImage: string = '';
    selectedChannel = {} as Channel;

    isGenerating = false;

    selectedGtin: any[] = [];
    imagesPerGtin: number | string = 1;
    imagesOptions = [
        { value: 1, label: '1' },
        { value: 2, label: '2' },
        { value: 'Todos', label: 'Todos' }
    ];
    // isMultipleProcessing: boolean = false;

    selectedFolderStructure: number = 1; // Default to "Estructura por GTIN"

    folderStructures = [
        { label: 'Guardar Codigo por Carpeta', value: 1 },
        { label: 'Guardar todas las imágenes en una sola carpeta', value: 2 },
    ]

    // Propiedades para IA
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
        this.route.queryParams.subscribe(params => {
            // Si viene de regenerar, cargar la parametrización del canal
            if (params && params['channelID']) {
                // Asignar los parámetros del canal a selectedChannel
                this.selectedChannel = {
                    channelID: Number(params['channelID']) || 0,
                    gln: Number(params['gln']) || 0,
                    provider: params['provider'] || '',
                    width: Number(params['width']) || 0,
                    height: Number(params['height']) || 0,
                    extension: params['extension'] || '',
                    dpi: Number(params['dpi']) || 0,
                    background_color: params['background_color'] || '#FFFFFF',
                    max_size_kb: Number(params['max_size_kb']) || 0,
                    adaptation_type: params['adaptation_type'] || '',
                    renaming_type: params['renaming_type'] || '',
                    rename_base: params['rename_base'] || '',
                    rename_separator: params['rename_separator'] || '',
                    rename_start_index: Number(params['rename_start_index']) || 0,
                    folder_structure: Number(params['folder_structure']) || 1,
                    background: false,
                    transparent_background: false
                };
                this.selectedFolderStructure = Number(params['folder_structure']) || 1;
                this.imagesPerGtin = params['imagesPerGtin'] || 1;
                this.disabledFormChannel = true;
            }
            // Si hay gtin en los params, cargarlo correctamente como array
            if (params['gtin']) {
                if (Array.isArray(params['gtin'])) {
                    this.selectedGtin = params['gtin'];
                } else if (typeof params['gtin'] === 'string') {
                    // Si por error viene como string separado por comas
                    this.selectedGtin = params['gtin'].split(',');
                } else {
                    this.selectedGtin = [params['gtin']];
                }
            }
            console.log('params', params);
        });
        this.getPrductByGtin();
        this.getProductChannels();

        setTimeout(() => {
            this.channels.forEach(channel => {
                this.channelStyles[channel.channelID] = this.getPreviewStyle(channel);
            });
        }, 500);

        if (!this.hasSelectedChannel()) {
            this.disabledFormChannel = true;
        }
    }

    goToReturn() {
        this.router.navigate(['/dashboards/dashboard1']);
    }

    async getPrductByGtin() {
        const attributes = await fetchUserAttributes();

        this.productService.productGetByGtin(this.selectedGtin).subscribe({
            next: (result) => {
                if (typeof (result) === 'object') {

                    result.data.entities.attributes.map((element: any) => {
                            const obj = {
                                gln: attributes['custom:userOwnershipData'],
                                gtin: element.gtin,
                                producName: element.tradeitemdescriptioninformation?.descriptionshort ?? '',
                                images: (Array.isArray(element.referencedfileheader)) ? element.referencedfileheader : [],
                                currentIndex: 0
                            }
                        // if (element.referencedfileheader != null) {
                        this.products.push(obj);
                        // }
                    });

                    // if (this.product?.images?.length > 0) {
                    //     this.selectedImage = this.product.images[0].uniformresourceidentifier;
                    // }

                }
            }
        })
    }

    getChannel(event: any) {
        const channel = this.channels.find(channel => channel.provider === event.value);
        channel.background_color = this.rgbToHex(channel.background_color) || '#FFFFFF',
        this.selectedChannel = channel;
        this.disabledFormChannel = true;
        console.log('channel', this.selectedChannel)
    }

    editChannel() {
        this.disabledFormChannel = false;
    }

    cancelChannel() {
        this.disabledFormChannel = true;
    }

    hexToRgb(hex: string): Array<number> {
        // Eliminar el símbolo '#' si está presente
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);

        return [r, g, b];
    }

    componentToHex(c: number): string {
        const hex = c.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }

    rgbToHex(backgroundColor: string): string {
        const [r, g, b] = backgroundColor.split(',').map(Number);
        return '#' + this.componentToHex(r) + this.componentToHex(g) + this.componentToHex(b);
    }

    async getProductChannels() {
        this.productService.productGetChannels().subscribe({
            next: (result: any) => {
                if (typeof (result) === 'object') {
                    this.channels = result.channels;
                }
            }
        })
    }

    getPreviewStyle(format: any) {
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

    sendToProcess() {
        if (!this.hasSelectedChannel()) {
            this.showErrorMessage('Debe seleccionar un canal antes de procesar.');
            return;
        }

        let productList: any[] = JSON.parse(JSON.stringify(this.products));

        productList.forEach(product => {
            let imagesPerGtinNum = Number(this.imagesPerGtin);

            if (this.imagesPerGtin === 'Todos') {
                product.images = [...product.images];
            }
            else if (!isNaN(imagesPerGtinNum) && imagesPerGtinNum > 0) {
                product.images = product.images.slice(0, imagesPerGtinNum);
            }
            else {
                product.images = [];
            }
        });

        console.log(`${productList.length} productos listos para procesar`);
        this.processImg(productList);
    }


    getGtins() {
        return this.products.map(product => product.gtin);
    }

    processImg(product: any) {
        if (!this.hasSelectedChannel()) {
            this.showErrorMessage('Debe seleccionar un canal antes de procesar.');
            return;
        }

        this.isGenerating = true;
        // console.log('Processing image with channel:', this.selectedFolderStructure);
        // console.log('Selected channel:', this.getGtins());
        if(this.selectedChannel.background_color != 'transparent'){
            this.selectedChannel.background_color = this.hexToRgb(this.selectedChannel.background_color).join(',') // Convert hex to RGB
        }

            console.log('Selected folder structure:', this.selectedChannel);
        const productNames = product.map((p: any) => p.producName).join(', ');


        const params = {
            images_url: product,
            channel_params: this.selectedChannel,
            folder_structure: this.selectedFolderStructure,
            is_multiple_processing: true,
            product_names: productNames,
            no_background: this.selectedChannel.background_color == 'transparent' ? true : false,
            transparent_background: this.selectedChannel.background_color == 'transparent' ? true : false
        }

        console.log('Processing image with params:', params);

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

                // Crear modal de confirmación para ir a ver los jobs
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

    sendToProcessNoBackground() {
        if (!this.hasSelectedChannel()) {
            this.showErrorMessage('Debe seleccionar un canal antes de procesar.');
            return;
        }

        let productList: any[] = JSON.parse(JSON.stringify(this.products));

        productList.forEach(product => {
            let imagesPerGtinNum = Number(this.imagesPerGtin);

            if (this.imagesPerGtin === 'Todos') {
                product.images = [...product.images];
            }
            else if (!isNaN(imagesPerGtinNum) && imagesPerGtinNum > 0) {
                product.images = product.images.slice(0, imagesPerGtinNum);
            }
            else {
                product.images = [];
            }
        });
        this.processImgNoBackground(productList);
    }

    processImgNoBackground(product: any) {
        if (!this.hasSelectedChannel()) {
            this.showErrorMessage('Debe seleccionar un canal antes de procesar.');
            return;
        }

        this.isGenerating = true;
        const params = {
            images_url: product,
            channel_params: this.selectedChannel,
            no_background: true
        }

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

                // Crear modal de confirmación para ir a ver los jobs
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

    // Métodos para IA
    sendToProcessWithAI() {
        if (!this.useAIBackground || !this.aiBackgroundPrompt.trim()) {
            this.showErrorMessage('Debe habilitar IA y proporcionar un prompt');
            return;
        }

        if (!this.hasSelectedChannel()) {
            this.showErrorMessage('Debe seleccionar un canal antes de procesar con IA');
            return;
        }

        //let productList: any[] = JSON.parse(JSON.stringify(this.products));
        let productList = this.products;
        this.products.forEach(product => {
            let imagesPerGtinNum = Number(this.imagesPerGtin);

            if (this.imagesPerGtin === 'Todos') {
                product.images = [...product.images];
            }
            else if (!isNaN(imagesPerGtinNum) && imagesPerGtinNum > 0) {
                product.images = product.images.slice(0, imagesPerGtinNum);
            }
            else {
                product.images = [];
            }

            this.processImgWithAI(product);
        });


       //this.processImgWithAI(productList);

    }

    processImgWithAI(product: any) {
        if (!this.hasSelectedChannel()) {
            this.showErrorMessage('Debe seleccionar un canal antes de procesar con IA');
            return;
        }

        this.isGenerating = true;

        // Parsear las dimensiones seleccionadas
        const [aiWidth, aiHeight] = this.aiImageDimensionsSelected.split('x').map(Number);

        // Crear channel_params con las dimensiones de IA
        const channelParams: any = {
            ...this.selectedChannel
        };

        channelParams.width = 1024;
        channelParams.height = 1024;
        channelParams.AI_background_prompt = this.aiBackgroundPrompt.trim();

        const params = {
            images_url: product,
            channel_params: channelParams,
            AI_background_prompt: this.aiBackgroundPrompt.trim()
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

                // Crear modal de confirmación para ir a ver los jobs
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

    showErrorMessage(message: string) {
        this.errorMessage = message;
        this.showError = true;
        // Auto-ocultar después de 5 segundos
        setTimeout(() => {
            this.hideError();
        }, 5000);
    }

    hideError() {
        this.showError = false;
        this.errorMessage = '';
    }

    hasSelectedChannel(): boolean {
        return !!(this.selectedChannel && Object.keys(this.selectedChannel).length > 0 && this.selectedChannel.provider);
    }

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: Event) {
        const target = event.target as HTMLElement;
        // No cerrar el menú si se hace clic en elementos del menú de IA
        if (!target.closest('.ai-button-container') && !target.closest('.ai-dropdown-menu')) {
            this.showAIMenu = false;
        }
    }
}
