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
import * as XLSX from 'xlsx';
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

    // Propiedades para archivo de renombrado personalizado
    customRenameFile: File | null = null;
    customRenameFileName: string | null = null;
    customRenameData: any[] = []; // JSON con los datos del Excel parseado

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
     * Detecta si una imagen necesita rotación basándose en metadatos EXIF.
     * Los valores EXIF Orientation 6 y 8 indican que la imagen necesita rotación.
     * Si no hay datos EXIF, asume que la orientación es correcta.
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

    private componentToHex(c: number): string {
        const hex = c.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
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

        console.log('Selected folder structure:', this.selectedChannel);
        const productNames = product.map((p: any) => p.producName).join(', ');

        // Crear una copia de selectedChannel con el background_color normalizado
        const channelParams = {
            ...this.selectedChannel,
            background_color: this.selectedChannel.background_color !== 'transparent' 
                ? this.normalizeBackgroundColor(this.selectedChannel.background_color)
                : 'transparent'
        };

        const params: any = {
            images_url: product,
            channel_params: channelParams,
            no_background: true,
            // transparent_background: false,
            is_multiple_processing: true,
            product_names: productNames,
            gln: glnNumber,
            transparent_background: this.selectedChannel.background_color == 'transparent' ? true : false
        };

        // Agregar datos de renombrado personalizado si existen
        if (this.selectedChannel.renaming_type === 'custom' && this.customRenameData.length > 0) {
            params.custom_rename_data = this.customRenameData;
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
        const params: any = {
            images_url: product,
            channel_params: this.selectedChannel,
            no_background: true,
            not_apply_transformations: true,
            is_multiple_processing: true,
            product_names: product.map((p: any) => p.producName).join(', '),
            gln: glnNumber,
            // folder_structure: this.selectedFolderStructure,
        };

        // Agregar datos de renombrado personalizado si existen
        if (this.selectedChannel.renaming_type === 'custom' && this.customRenameData.length > 0) {
            params.custom_rename_data = this.customRenameData;
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

        const params: any = {
            images_url: product,
            channel_params: channelParams,
            AI_background_prompt: this.aiBackgroundPrompt.trim()
        };

        // Agregar datos de renombrado personalizado si existen
        if (this.selectedChannel.renaming_type === 'custom' && this.customRenameData.length > 0) {
            params.custom_rename_data = this.customRenameData;
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

    onRenamingTypeChange(): void {
        // Si se cambia a "Estándar", resetear el archivo cargado
        if (this.selectedChannel.renaming_type !== 'custom') {
            this.customRenameFile = null;
            this.customRenameFileName = null;
            this.customRenameData = [];
        }
    }

    // Métodos para plantilla de renombrado personalizado
    onCustomFileSelected(event: Event): void {
        const input = event.target as HTMLInputElement | null;
        const file = input?.files && input.files.length > 0 ? input.files[0] : null;
        
        if (!file) {
            this.customRenameFile = null;
            this.customRenameFileName = null;
            this.customRenameData = [];
            return;
        }

        this.customRenameFile = file;
        this.customRenameFileName = file.name;

        // Leer y parsear el archivo Excel
        this.parseExcelFile(file);
    }

    private parseExcelFile(file: File): void {
        const reader = new FileReader();
        
        reader.onload = (e: any) => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // Leer la primera hoja
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                // Convertir a JSON
                const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet);
                
                // Validar y mapear las columnas esperadas
                this.customRenameData = jsonData.map((row: any) => ({
                    gtin: row['Gtin'] || row['GTIN'] || row['gtin'] || '',
                    renameId: row['ID de Renombre'] || row['ID_de_Renombre'] || row['renameId'] || '',
                    applyToFolder: row['Aplicar Renombre a Carpeta'] || row['Aplicar_Renombre_a_Carpeta'] || row['applyToFolder'] || false
                })).filter(item => item.gtin); // Filtrar filas sin GTIN
                
                console.log('Excel parseado correctamente:', this.customRenameData);
                this.showErrorMessage(`Archivo cargado: ${this.customRenameData.length} registros encontrados`);
            } catch (error) {
                console.error('Error al parsear el archivo Excel:', error);
                this.showErrorMessage('Error al leer el archivo. Verifique que sea un archivo Excel válido.');
                this.customRenameData = [];
            }
        };

        reader.onerror = () => {
            this.showErrorMessage('Error al leer el archivo');
            this.customRenameData = [];
        };

        reader.readAsArrayBuffer(file);
    }

    downloadCustomTemplate(): void {
        const templateUrl = 'https://gs1-images-process-bucket.s3.us-east-1.amazonaws.com/template/Plantilla+Renombrado.xlsx';
        
        const anchor = document.createElement('a');
        anchor.href = templateUrl;
        anchor.download = 'Plantilla Renombrado.xlsx';
        anchor.target = '_blank'; // Abrir en nueva pestaña si la descarga directa falla
        anchor.rel = 'noopener noreferrer';
        anchor.click();
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
