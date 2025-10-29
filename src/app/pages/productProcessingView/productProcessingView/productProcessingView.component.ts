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
import { ChannelRequiredDialogComponent } from 'src/app/components/dialogs/channel-required-dialog/channel-required-dialog.component';
import { firstValueFrom } from 'rxjs';
import { createProductKey, extractGlnFromKey, extractGtinFromKey } from 'src/app/utils/product-key';
import { MatTooltipModule } from '@angular/material/tooltip';

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
        MatAutocompleteModule,
        MatTooltipModule
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

    selectedGtin: string[] = [];
    selectedProductPairs: Array<{ gtin: string; gln: string | null }> = [];
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

    // Propiedades para control de acceso por rol
    private isAdminUser = false;
    private userGln: string | null = null;

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
            const gtinsFromParams = this.normalizeArrayParam(params['gtin']);
            const glnsFromParams = this.normalizeArrayParam(params['gln']);
            const productKeysFromParams = this.normalizeArrayParam(params['productKey']);

            if (productKeysFromParams.length) {
                const parsedPairs = this.buildSelectedPairsFromKeys(productKeysFromParams);
                if (parsedPairs.length) {
                    this.selectedProductPairs = parsedPairs;
                    this.selectedGtin = parsedPairs.map(pair => pair.gtin);
                }
            }

            if (!this.selectedProductPairs.length && gtinsFromParams.length) {
                this.selectedGtin = gtinsFromParams;
                this.selectedProductPairs = this.buildSelectedProductPairs(gtinsFromParams, glnsFromParams);
            } else if (!this.selectedProductPairs.length) {
                this.selectedGtin = [];
            }

            console.log('params', params);
        });

        this.initializeUserAccess();
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
        this.isGenerating = true;
        const attributes = await fetchUserAttributes();
        const { conflicting, singles } = this.groupGtinsByGln();
        const aggregatedProducts = new Map<string, any>();

        this.products = [];

        for (const [glnValue, gtinSet] of conflicting) {
            const gtinList = Array.from(gtinSet).filter(gtin => typeof gtin === 'string' && gtin.trim() !== '');
            if (!gtinList.length) {
                continue;
            }

            await this.fetchAndAggregateProducts(gtinList, attributes, aggregatedProducts, glnValue);
        }

        if (singles.size) {
            const gtinList = Array.from(singles).filter(gtin => typeof gtin === 'string' && gtin.trim() !== '');
            if (gtinList.length) {
                await this.fetchAndAggregateProducts(gtinList, attributes, aggregatedProducts, null);
            }
        }
        this.products = Array.from(aggregatedProducts.values());
        this.isGenerating = false;
    }

    private async fetchAndAggregateProducts(
        gtinList: string[],
        attributes: Record<string, any>,
        aggregatedProducts: Map<string, any>,
        glnOverride: string | null
    ): Promise<void> {
        try {
            const response = await firstValueFrom(
                this.productService.productGetByGtin(gtinList, glnOverride ? { gln: glnOverride } : undefined)
            );
            const normalizedProducts = this.productService.normalizeTradeItemsResponse(response);

            if (!normalizedProducts.length) {
                return;
            }
            // Procesar productos y preparar imágenes para visualización vertical
            for (const product of normalizedProducts as SyncfoniaProduct[]) {
                const rawImages = Array.isArray(product.images)
                    ? product.images.filter((image: any) => {
                        const url = image?.uniformresourceidentifier ?? '';
                        return typeof url === 'string' && url.trim() !== '' && /\.(jpg|jpeg|png)$/i.test(url);
                    })
                    : [];

                if (!rawImages.length) {
                    continue;
                }

                // Preparar imágenes sin esperar la detección (mostrar de inmediato)
                const preparedImages: any[] = rawImages.map((image: any) => ({
                    ...image,
                    displayUrl: image?.uniformresourceidentifier,
                    rotateCssFallback: false
                }));

                const selectionGln = this.getSelectedGlnForGtin(product.gtin, glnOverride);
                const resolvedGln = selectionGln ?? (product as any).gln ?? attributes['custom:userOwnershipData'];

                const mappedProduct = {
                    gln: resolvedGln,
                    gtin: product.gtin,
                    producName: product.producName,
                    images: preparedImages,
                    currentIndex: 0,
                    image360Path: (product as any).image360Path ?? null,
                    brandName: product.brandName ?? '',
                    functionalName: product.functionalName ?? '',
                    attributes: (product as any).attributes,
                    partyNameProvider: (product as any).partyNameProvider || ''
                };

                const key = createProductKey(mappedProduct.gtin, mappedProduct.gln);
                aggregatedProducts.set(key, mappedProduct);

                // Detectar orientación en segundo plano y actualizar flags
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
        } catch (error) {
            const glnLabel = glnOverride ?? 'default';
            console.error(`Error fetching GTINs ${gtinList.join(', ')} for GLN ${glnLabel}`, error);
        }
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

            // Timeout: si tarda más de 5 segundos, asumir que no necesita rotación
            const timeoutId = setTimeout(() => {
                console.warn(`Timeout checking orientation: ${imageUrl}`);
                resolve(false);
            }, 5000);

            img.onload = () => {
                clearTimeout(timeoutId);
                // Si es horizontal (ancho > alto), necesita rotación CSS
                const isHorizontal = img.width > img.height;
                if (isHorizontal) {
                    console.log(`🔄 Horizontal image detected (${img.width}x${img.height}): ${imageUrl.substring(imageUrl.lastIndexOf('/') + 1)}`);
                }
                resolve(isHorizontal);
            };

            img.onerror = () => {
                clearTimeout(timeoutId);
                console.warn(`Error loading image for orientation check: ${imageUrl}`);
                resolve(false); // Si falla, no rotar
            };

            // NO configurar crossOrigin - solo queremos dimensiones
            // Esto evita errores CORS porque no accedemos a los píxeles
            img.src = imageUrl;
        });
    }

    // FUNCIÓN ANTERIOR COMENTADA - Se usaba Canvas pero causaba errores CORS
    /*
    // Genera una versión para mostrar vertical si la imagen es horizontal.
    // Intenta rotar con canvas (si CORS lo permite). Si no, retorna la URL original y un flag para rotar con CSS.
    private prepareDisplayImage(imageUrl: string): Promise<{ src: string; rotateCssFallback?: boolean }> {
        return new Promise((resolve) => {
            if (!imageUrl || typeof imageUrl !== 'string') {
                resolve({ src: imageUrl });
                return;
            }

            const img = new Image();
            const done = (src: string, rotateCssFallback = false) => resolve({ src, rotateCssFallback });

            // Timeout de seguridad: 8 segundos
            const timeoutId = setTimeout(() => {
                console.warn(`Timeout loading image: ${imageUrl}`);
                done(imageUrl, true);
            }, 8000);

            img.onload = () => {
                clearTimeout(timeoutId);
                const isLandscape = img.width > img.height; // horizontal

                if (!isLandscape) {
                    done(imageUrl);
                    return;
                }

                // Intentar rotar con canvas para entregar una vista vertical directa
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.height;
                    canvas.height = img.width;
                    const ctx = canvas.getContext('2d');

                    if (!ctx) {
                        console.warn('Canvas context not available, using CSS fallback');
                        done(imageUrl, true);
                        return;
                    }

                    ctx.translate(canvas.width / 2, canvas.height / 2);
                    ctx.rotate(Math.PI / 2); // 90 grados
                    ctx.drawImage(img, -img.width / 2, -img.height / 2);

                    // Elegir mime según extensión
                    const lower = imageUrl.toLowerCase();
                    const mime = lower.endsWith('.png') ? 'image/png' : 'image/jpeg';
                    const dataUrl = canvas.toDataURL(mime, 0.92);

                    console.log(`✓ Canvas rotation successful for: ${imageUrl.substring(imageUrl.lastIndexOf('/') + 1)}`);
                    done(dataUrl);
                } catch (e) {
                    // Si canvas falla (p.ej. CORS), usamos la url original y rotamos con CSS en la vista
                    console.warn('Canvas rotation failed, using CSS fallback:', e);
                    done(imageUrl, true);
                }
            };

            img.onerror = (error) => {
                clearTimeout(timeoutId);
                console.error('Error loading image:', imageUrl, error);
                done(imageUrl, true); // usar original con rotación CSS si no carga
            };

            // IMPORTANTE: Configurar crossOrigin ANTES de asignar src
            // Usar 'anonymous' para permitir canvas con imágenes de S3
            img.crossOrigin = 'anonymous';
            img.src = imageUrl;
        });
    }
    */

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

    private buildSelectedPairsFromKeys(keys: string[]): Array<{ gtin: string; gln: string | null }> {
        return (keys || [])
            .map(key => {
                const gtin = extractGtinFromKey(key);
                if (!gtin) {
                    return null;
                }
                const gln = extractGlnFromKey(key) || null;
                return { gtin, gln };
            })
            .filter((pair): pair is { gtin: string; gln: string | null } => Boolean(pair));
    }

    private buildSelectedProductPairs(gtins: string[], glns: string[]): Array<{ gtin: string; gln: string | null }> {
        const pairs: Array<{ gtin: string; gln: string | null }> = [];
        const total = gtins.length;
        for (let i = 0; i < total; i++) {
            const gtin = (gtins[i] ?? '').trim();
            if (!gtin) {
                continue;
            }

            const glnValue = glns[i] ?? null;
            const normalizedGln = glnValue && glnValue.trim() !== '' ? glnValue.trim() : null;
            pairs.push({ gtin, gln: normalizedGln });
        }

        if (!pairs.length) {
            return gtins
                .map(value => (value ?? '').trim())
                .filter(value => value !== '')
                .map(value => ({ gtin: value, gln: null }));
        }

        return pairs;
    }

    private groupGtinsByGln(): { conflicting: Map<string | null, Set<string>>; singles: Set<string> } {
        const pairs = this.selectedProductPairs.length
            ? this.selectedProductPairs
            : this.selectedGtin.map(gtin => ({ gtin, gln: null }));

        const gtinToGlns = new Map<string, Set<string | null>>();

        pairs.forEach(pair => {
            const gtin = typeof pair.gtin === 'string' ? pair.gtin.trim() : '';
            if (!gtin) {
                return;
            }

            const gln = pair.gln && pair.gln.trim() !== '' ? pair.gln.trim() : null;

            if (!gtinToGlns.has(gtin)) {
                gtinToGlns.set(gtin, new Set());
            }

            gtinToGlns.get(gtin)?.add(gln);
        });

        if (!gtinToGlns.size && this.selectedGtin.length) {
            this.selectedGtin
                .map(value => (typeof value === 'string' ? value.trim() : ''))
                .filter(value => value !== '')
                .forEach(gtin => {
                    gtinToGlns.set(gtin, new Set([null]));
                });
        }

        const conflicting = new Map<string | null, Set<string>>();
        const singles = new Set<string>();

        gtinToGlns.forEach((glnSet, gtin) => {
            if (glnSet.size > 1) {
                glnSet.forEach(gln => {
                    if (!conflicting.has(gln)) {
                        conflicting.set(gln, new Set());
                    }
                    conflicting.get(gln)?.add(gtin);
                });
            } else {
                singles.add(gtin);
            }
        });

        return { conflicting, singles };
    }

    private getSelectedGlnForGtin(gtin: string, expectedGln?: string | null): string | null {
        const normalizedGtin = (gtin ?? '').trim();
        if (!normalizedGtin) {
            return null;
        }

        const normalizedExpected = expectedGln && expectedGln.trim() !== '' ? expectedGln.trim() : null;

        if (normalizedExpected) {
            const exactMatch = this.selectedProductPairs.find(pair =>
                pair.gtin === normalizedGtin && (pair.gln ?? null) === normalizedExpected
            );
            if (exactMatch?.gln) {
                return exactMatch.gln;
            }
        }

        const match = this.selectedProductPairs.find(pair => pair.gtin === normalizedGtin && pair.gln);
        return match?.gln ?? normalizedExpected ?? null;
    }

    private normalizeArrayParam(param: unknown): string[] {
        if (Array.isArray(param)) {
            return param.map(item => String(item)).filter(value => value.trim() !== '');
        }

        if (typeof param === 'string') {
            return param
                .split(',')
                .map(value => value.trim())
                .filter(value => value !== '');
        }

        if (param != null) {
            const value = String(param).trim();
            return value ? [value] : [];
        }

        return [];
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
        const glnParam = !this.isAdminUser && this.userGln ? this.userGln : undefined;
        this.productService.productGetChannels(glnParam).subscribe({
            next: (result: any) => {
                if (typeof (result) === 'object') {
                    this.channels = result.channels;
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
        if (!this.ensureChannelSelected('Debe seleccionar un canal antes de procesar.')) {
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
        if (!this.ensureChannelSelected('Debe seleccionar un canal antes de procesar.')) {
            return;
        }

        const storedGln: string | null = localStorage.getItem('gln');
        const glnNumber = storedGln ? Number(storedGln) : null;
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
            no_background: true,
            // transparent_background: false,
            is_multiple_processing: true,
            product_names: productNames,
            gln: glnNumber,
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
        if (!this.ensureChannelSelected('Debe seleccionar un canal antes de procesar.')) {
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
        if (!this.ensureChannelSelected('Debe seleccionar un canal antes de procesar.')) {
            return;
        }
        const storedGln: string | null = localStorage.getItem('gln');
        const glnNumber = storedGln ? Number(storedGln) : null;

        this.isGenerating = true;
        const params = {
            images_url: product,
            channel_params: this.selectedChannel,
            no_background: true,
            not_apply_transformations: true,
            is_multiple_processing: true,
            product_names: product.map((p: any) => p.producName).join(', '),
            gln: glnNumber,
            // folder_structure: this.selectedFolderStructure,
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

        if (!this.ensureChannelSelected('Debe seleccionar un canal antes de procesar con IA')) {
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
        if (!this.ensureChannelSelected('Debe seleccionar un canal antes de procesar con IA')) {
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

    @HostListener('document:click', ['$event'])
    onDocumentClick(event: Event) {
        const target = event.target as HTMLElement;
        // No cerrar el menú si se hace clic en elementos del menú de IA
        if (!target.closest('.ai-button-container') && !target.closest('.ai-dropdown-menu')) {
            this.showAIMenu = false;
        }
    }
}
