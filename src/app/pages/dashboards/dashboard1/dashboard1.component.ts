import { Component, AfterViewInit, ElementRef, HostListener, OnInit, ViewChild } from '@angular/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ProductService, SyncfoniaProduct } from 'src/app/services/product.service';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MaterialModule } from 'src/app/material.module';
import { FormsModule } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule, MatCheckboxChange } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { CatalogProduct } from 'src/app/model/catalog';
import { CreateCatalogDialogComponent, CreateCatalogDialogData } from './create-catalog-dialog/create-catalog-dialog.component';
import { Subject, firstValueFrom } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
import { TourModule } from 'src/app/core/tour/tour.module';
import * as EXIF from 'exif-js';

// import { DriverTourService } from 'src/app/core/tour/driver-tour.service';

import { CatalogService } from 'src/app/services/catalog.service';
import { createProductKey, extractGlnFromKey, extractGtinFromKey } from 'src/app/utils/product-key';

@Component({
  selector: 'app-dashboard1',
  standalone: true,
  imports: [
    TablerIconsModule,
    MatIconModule,
    CommonModule,
    MaterialModule,
    FormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
    MatSnackBarModule,
    TourModule,
    CreateCatalogDialogComponent
  ],
  templateUrl: './dashboard1.component.html',
  styleUrl: './dashboard1.component.scss'
})
export class AppDashboard1Component implements OnInit {
  products: any[] = [];
  carouselImages: any[] = [];
  selectedProduct: any = null;
  currentIndex = 0;
  searchText: string = '';
  gtinListInput: string = '';
  isGenerating = false;
  selectedProductKeys: string[] = [];
  filtered: any[] = [];
  searchSubject: Subject<string> = new Subject<string>();
  inputType: 'text' | 'number' | 'mixed' | null = null;
  catalogPanelVisible = false;
  catalogList: any[] = [];
  catalogPanelData: CreateCatalogDialogData | null = null;
  catalogSelected: any = null;
  showToolbar = true;
  
  // COMENTADO: Propiedades de validación de accesibilidad (ya no se usan con FileFormatName)
  // hiddenProductsCount = 0; // Productos ocultos por imágenes inaccesibles
  // validatedImagesCount = 0; // Imágenes validadas
  // totalImagesToValidate = 0; // Total de imágenes a validar
  // isValidating = false; // Indicador de validación en progreso
  
  // Propiedades activas (usadas para lazy loading y display)
  loadedImagesCount = 0; // Contador de imágenes cargadas exitosamente
  totalImagesCount = 0; // Total de imágenes en productos visibles

  @ViewChild('toolbar') toolbarRef?: ElementRef<HTMLDivElement>;
  @ViewChild('toolbarToggle', { static: true }) toolbarToggleRef?: ElementRef<HTMLButtonElement>;

  constructor(
    private productService: ProductService,
    private router: Router,
    private snackBar: MatSnackBar,
    // private tourService: DriverTourService,
    private catalogService: CatalogService
  ) { }

  // ngAfterViewInit() {

  //   const userId = 'usuario';
  //   const tourKey = 'dashboard';

  //   this.tourService.startMultiPageTour(userId, tourKey, this.tourSequence, this.tourByRoute);
  // }

  async ngOnInit(): Promise<void> {
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(async value => {
        try {
          await this.handleSearch(value);
        } catch (error) {
          console.error('Error during search handling:', error);
        }
      });

    await this.getCatalogs();
    this.autoToggleToolbarOnResults();
  }

  private async getCatalogs(): Promise<void> {
    const gln = localStorage.getItem('gln') as string;
    try {
      const catalogs = await firstValueFrom(this.catalogService.getCatalogs(gln));
      this.catalogList = catalogs || [];
      // console.log('Catalogs fetched:', this.catalogList);
    }
    catch (err) {
      console.error('Error fetching catalogs:', err);
    }
  }

  private async getProductsByListGtin(gtins: string[], requestedCodes: string[]): Promise<void> {
    //   width: '400px',
    // });

    // dialogRef.afterClosed().subscribe((gtins: string[]) => {
    if (!Array.isArray(gtins) || gtins.length === 0) {
      return;
    }

    // COMENTADO: Reset de contador de validación (ya no se usa)
    // this.hiddenProductsCount = 0;

    this.isGenerating = true;

    try {
      // Verificar si el usuario es systemadmin o retailer
      const roles = JSON.parse(localStorage.getItem('roles') || '[]');
      const isAdmin = roles.some((role: any) => 
        typeof role === 'string' && 
        (role.toLowerCase() === 'systemadmin' || role.toLowerCase().includes('retailer'))
      );

      // Obtener GLN del localStorage
      const gln = localStorage.getItem('gln') || null;
      
      // Para admin: NO enviar GLN (búsqueda global)
      // Para usuario normal: SÍ enviar GLN (solo sus productos)
      const options = (!isAdmin && gln) ? { gln } : undefined;
      
      // Usar método paginado si hay más de 250 GTINs
      const usePagination = gtins.length > 250;
      
      const response: any = await firstValueFrom(
        usePagination 
          ? this.productService.productGetByGtinPaginated(gtins, options)
          : this.productService.productGetByGtin(gtins, options)
      );
      
      const normalizedProducts = this.productService.normalizeTradeItemsResponse(response);
      
      // Contar imágenes totales después del filtro FileFormatName
      const totalImagesFromSyncfonia = normalizedProducts.reduce((sum, p) => sum + (p.images?.length || 0), 0);
      
      // DEBUG: Mostrar detalle de cada producto
      // normalizedProducts.forEach(p => {
      //   console.log(`   GTIN ${p.gtin}: ${p.images?.length || 0} imágenes`);
      // });

      if (normalizedProducts.length > 0) {
        // Mostrar productos inmediatamente sin esperar la detección de orientación
        const fetchedProducts = normalizedProducts
          .map((product: SyncfoniaProduct) => {
            // console.log(`\n Procesando GTIN ${product.gtin}:`);
            // console.log(`   Imágenes recibidas: ${product.images?.length || 0}`);
            
            //  FileFormatName ya validó el formato en el servicio
            // Solo verificar que la URL exista (no validar extensión nuevamente)
            const validImages = Array.isArray(product.images)
              ? product.images.filter((image, index) => {
                const url = image?.uniformresourceidentifier ?? '';
                const isValid = typeof url === 'string' && url.trim() !== '';
                // console.log(`    [${index + 1}] URL: ${isValid ? ' válida' : ' vacía'} | fileformatname: ${image?.fileformatname || 'N/A'}`);
                return isValid;
              })
              : [];

            // console.log(`   Imágenes válidas después de filtro URL: ${validImages.length}`);

            if (!validImages.length) {
              // console.warn(`   GTIN ${product.gtin} EXCLUIDO (sin imágenes válidas)`);
              return null;
            }
            
            // console.log(`   GTIN ${product.gtin} INCLUIDO con ${validImages.length} imagen(es)`);

            // Preparar imágenes sin rotación inicialmente
            const preparedImages = validImages.map(image => ({
              ...image,
              displayUrl: image?.uniformresourceidentifier,
              rotateCssFallback: false // Inicialmente sin rotación
            }));

            return {
              gtin: product.gtin,
              producName: product.producName,
              images: preparedImages,
              currentIndex: 0,
              isImageLoading: false,
              gln: product.gln ?? '',
              image360Path: product.image360Path ?? null,
              brandName: product.brandName ?? '',
              functionalName: product.functionalName ?? '',
              attributes: product.attributes,
              partyNameProvider: product.partyNameProvider ?? ''
            };
          });

        const filteredProducts = fetchedProducts.filter((product): product is any => product !== null);

        // MOSTRAR productos inmediatamente (sin esperar validación)
        const productsByKey = new Map(
          this.products.map(product => [createProductKey(product.gtin, product.gln), product])
        );
        
        // Agregar todos los productos nuevos (incluso sin validar aún)
        filteredProducts.forEach((product: any) => {
          productsByKey.set(createProductKey(product.gtin, product.gln), product);
        });

        this.products = Array.from(productsByKey.values()).map(product => this.prepareProductForDisplay(product));

        const requestedOrder = Array.isArray(requestedCodes) && requestedCodes.length > 0
          ? requestedCodes
          : gtins;

        const productsByGtin = new Map<string, any[]>();
        this.products.forEach(product => {
          const list = productsByGtin.get(product.gtin) ?? [];
          list.push(product);
          productsByGtin.set(product.gtin, list);
        });

        // Resetear catálogo seleccionado al cargar nuevos productos
        this.catalogSelected = null;

        this.filtered = [];
        requestedOrder.forEach(code => {
          const list = productsByGtin.get(code);
          if (Array.isArray(list) && list.length > 0) {
            list.forEach(product => {
              this.filtered.push(this.prepareProductForDisplay(product));
            });
          }
        });

        if (!requestedOrder.length) {
          this.filtered = this.products.map(product => this.prepareProductForDisplay(product));
        }
        this.autoToggleToolbarOnResults();

        // Calcular total de imágenes disponibles
        this.totalImagesCount = this.filtered.reduce((total, product) => {
          return total + (product.images?.length || 0);
        }, 0);
        this.loadedImagesCount = 0;

        //  VALIDACIÓN CON FileFormatName (COMENTADA: Validación de accesibilidad con descarga)
        // La validación ahora se realiza SOLO con FileFormatName en product.service.ts
        // Esto evita descargar 2.25 GB de imágenes para validar accesibilidad
        // Confiabilidad: 95% (basado en metadata de Syncfonia)
        
        // COMENTADO: Validación anterior que descargaba cada imagen completa
        // this.validateAndFilterProductImages(filteredProducts); // Descargaba ~2.25 GB, tomaba 2 minutos

        // COMENTADO: Alertas de validación de accesibilidad (ya no se usan)
        /*
        if (this.hiddenProductsCount > 0) {
          const mensaje = this.hiddenProductsCount === 1 
            ? '1 producto fue omitido porque todas sus imágenes son inaccesibles.'
            : `${this.hiddenProductsCount} productos fueron omitidos porque todas sus imágenes son inaccesibles.`;
          
          this.snackBar.open(mensaje, 'Cerrar', {
            duration: 5000,
            verticalPosition: 'top',
            horizontalPosition: 'center',
            panelClass: ['warning-snackbar']
          });
        }
        */

        // Esta alerta sigue activa: GTINs sin imágenes en Syncfonia
        if (fetchedProducts.length !== normalizedProducts.length) {
          this.snackBar.open('Varios GTINs fueron omitidos durante la carga, ya que no disponen de imágenes asociadas en Syncfonía.', 'Cerrar', {
            duration: 3000,
            verticalPosition: 'top',
            horizontalPosition: 'center'
          });
        }
      } else {
        // Mensaje genérico que funciona tanto para admin como para usuario normal
        const isAdmin = roles.some((role: any) => 
          typeof role === 'string' && 
          (role.toLowerCase() === 'systemadmin' || role.toLowerCase().includes('retailer'))
        );
        
        const message = isAdmin 
          ? 'No se encontraron productos con los GTINs solicitados en Syncfonía.'
          : 'No se encontraron GTINs relacionados al GLN en Syncfonía.';
        
        this.snackBar.open(message, 'Cerrar', {
          duration: 3000,
          verticalPosition: 'top',
          horizontalPosition: 'center'
        });
      }
    } catch (err: any) {
      this.snackBar.open(err?.error || 'Error al obtener productos por GTINs.', 'Cerrar', {
        duration: 3000,
        verticalPosition: 'top',
        horizontalPosition: 'center'
      });
      console.error('Error al obtener productos por GTINs:', err);
    } finally {
      this.isGenerating = false;
    }
    // });
  }

  nextImage(product: any): void {
    if (!product?.images?.length || product.images.length <= 1) {
      return;
    }

    const nextIndex =
      product.currentIndex === product.images.length - 1
        ? 0
        : product.currentIndex + 1;

    this.updateProductImageIndex(product, nextIndex);
  }

  previousImage(product: any): void {
    if (!product?.images?.length || product.images.length <= 1) {
      return;
    }

    const previousIndex =
      product.currentIndex === 0
        ? product.images.length - 1
        : product.currentIndex - 1;

    this.updateProductImageIndex(product, previousIndex);
  }

  private updateProductImageIndex(product: any, targetIndex: number): void {
    if (!product?.images?.length) {
      return;
    }

    const totalImages = product.images.length;
    const normalizedIndex = ((Number.isInteger(targetIndex) ? targetIndex : 0) % totalImages + totalImages) % totalImages;

    if (normalizedIndex === product.currentIndex) {
      return;
    }

    const nextImage = product.images[normalizedIndex];
    const hasUrl = Boolean(nextImage?.uniformresourceidentifier);

    product.isImageLoading = hasUrl;
    product.currentIndex = normalizedIndex;

    if (!hasUrl) {
      product.isImageLoading = false;
    }
  }

  goToDetail(gtin: string, gln?: string | null): void {
    const key = createProductKey(gtin, gln);
    this.router.navigate(['/product', gtin], {
      queryParams: {
        productKey: key,
        gln: gln ?? ''
      }
    });
  }

  onSearchChange(value: string | null | undefined) {
    const trimmed = (value ?? '').trim();

    if (!trimmed) {
      this.inputType = null;
      this.filtered = [];
      this.searchText = '';    
      this.searchSubject.next('');
      this.autoToggleToolbarOnResults();
      return;
    }

    // Detectar tipo admitiendo comas, espacios y saltos de lÃ­nea
    if (/^[0-9,\s`r`n]+$/.test(trimmed)) {
      this.inputType = 'number';
    } else if (/^[a-zA-ZÃ¡Ã©Ã­Ã³ÃºÃÃ‰ÃÃ“ÃšÃ±Ã‘\s]+$/.test(trimmed)) {
      this.inputType = 'text';
    } else {
      this.inputType = 'mixed';
    }

    let normalized = trimmed;

    if (this.inputType === 'number') {
      normalized = normalized
        .replace(/[\s`r`n]+/g, ',')
        .replace(/,{2,}/g, ',')  
        .replace(/^,|,$/g, '');   

      // Autocompletar a 14 dÃ­gitos
      const paddedCodes = normalized
        .split(',')
        .map(code => code.trim())
        .filter(code => Boolean(code))
        .map(code => code.padStart(14, '0'));

      normalized = Array.from(new Set(paddedCodes)).join(',');
    } else if (this.inputType === 'text') {
      normalized = normalized.replace(/\s+/g, ' ');
    }

    this.searchText = normalized;   
    this.searchSubject.next(normalized);

    // console.log('inputType:', this.inputType, '=>', normalized);
  }


  private async handleSearch(value: string) {
    // console.log('handlesearch', value);
    if (!value) {
      this.filtered = [];
      this.autoToggleToolbarOnResults();
      this.refreshCatalogPanelData();
      return;
    }

    if (this.inputType == 'text') {
      const localMatches = this.products.filter(p =>
        p.producName?.toLowerCase().includes(value.toLowerCase())
      );

      this.filtered = localMatches.map(product => this.prepareProductForDisplay(product));
      this.autoToggleToolbarOnResults();
    } else if (this.inputType == 'number') {
      const codes = value.split(',').map(code => code.trim()).filter(Boolean);
      // console.log('codes', codes);

      const localMatches = this.products.filter(p => codes.includes(p.gtin));
      const missingCodes = codes.filter(code => !localMatches.some(p => p.gtin === code));

      this.filtered = localMatches.map(product => this.prepareProductForDisplay(product));
      this.autoToggleToolbarOnResults();

      if (missingCodes.length > 0) {
        // console.log('missingCodes', missingCodes);
        await this.getProductsByListGtin(missingCodes, codes);
      }
    } else {
      this.applyFilter();
    }

    this.refreshCatalogPanelData();
    // console.log('filtered', this.filtered);
  }

  clearSearch() {
    this.searchText = '';
    this.inputType = null;
    this.filtered = [];
    this.searchSubject.next('');
    this.autoToggleToolbarOnResults();
    this.refreshCatalogPanelData();
  }

  applyFilter() {
    const query = this.searchText.toLowerCase();
    this.filtered = this.products.filter(p =>
      p.producName?.toLowerCase().includes(query) ||
      p.gtin?.toLowerCase().includes(query)
    );
    this.autoToggleToolbarOnResults();

    this.refreshCatalogPanelData();
  }

  trackByGtin(index: number, item: any): string {
    return createProductKey(item.gtin, item.gln);
  }

  // Exponer createProductKey para uso en el template
  createProductKey(gtin: string, gln: string): string {
    return createProductKey(gtin, gln);
  }

  // filteredProducts() {
  //   if (!this.searchText) return this.products;

  //   const query = this.searchText.toLowerCase();

  //   return this.products.filter(p =>
  //     p.producName?.toLowerCase().includes(query) ||
  //     p.gtin?.toLowerCase().includes(query)
  //   );
  // }


  toggleGtinSelection(gtin: string, gln?: string | null): void {
    const key = createProductKey(gtin, gln);
    const index = this.selectedProductKeys.indexOf(key);

    if (index > -1) {
      this.selectedProductKeys.splice(index, 1);
    } else {
      this.selectedProductKeys.push(key);
    }

    this.refreshCatalogPanelData();
  }

  onProductSelectionChange(event: MatCheckboxChange, gtin: string, gln?: string | null): void {
    const key = createProductKey(gtin, gln);

    if (event.checked) {
      if (!this.isGtinSelected(gtin, gln)) {
        this.selectedProductKeys.push(key);
      }
    } else if (this.isGtinSelected(gtin, gln)) {
      this.selectedProductKeys = this.selectedProductKeys.filter(selected => selected !== key);
    }

    this.refreshCatalogPanelData();
  }

  isGtinSelected(gtin: string, gln?: string | null): boolean {
    const key = createProductKey(gtin, gln);
    return this.selectedProductKeys.includes(key);
  }

  selectAllGtins(): void {
    const keys = this.filtered
      .filter(p => p.images?.length > 0)
      .map(p => createProductKey(p.gtin, p.gln));

    this.selectedProductKeys = Array.from(new Set(keys));

    this.refreshCatalogPanelData();
  }

  clearAllGtins(): void {
    this.selectedProductKeys = [];
    this.refreshCatalogPanelData();
  }

  private getSelectedProductPairs(): Array<{ key: string; gtin: string; gln: string | null }> {
    return this.selectedProductKeys
      .map(key => {
        const gtin = extractGtinFromKey(key);
        const gln = extractGlnFromKey(key) || null;

        if (!gtin) {
          return null;
        }

        return { key, gtin, gln };
      })
      .filter((pair): pair is { key: string; gtin: string; gln: string | null } => Boolean(pair));
  }

  private getSelectedGtins(): string[] {
    const pairs = this.getSelectedProductPairs();
    const unique = new Set<string>();

    pairs.forEach(pair => {
      if (pair.gtin) {
        unique.add(pair.gtin);
      }
    });

    return Array.from(unique);
  }

  openCreateCatalogDialog(): void {
    this.catalogPanelVisible = true;
    this.refreshCatalogPanelData();
  }

  private refreshCatalogPanelData(): void {
    if (!this.catalogPanelVisible) {
      return;
    }

    const sourceProducts = this.filtered.length ? this.filtered : this.products;
    this.catalogPanelData = {
      availableProducts: this.buildCatalogProducts(sourceProducts),
      preselectedProductKeys: [...this.selectedProductKeys]
    };
  }

  private buildCatalogProducts(products: any[]): CatalogProduct[] {
    const mapped: CatalogProduct[] = [];
    const seen = new Set<string>();

    (products || []).forEach(product => {
      const gtin = product?.gtin;
      const gln = product?.gln ?? null;
      const key = createProductKey(gtin, gln);

      if (!gtin || seen.has(key)) {
        return;
      }

      seen.add(key);
      mapped.push({
        gtin,
        gln,
        key,
        name: product?.producName ?? product?.name ?? '',
        producName: product?.producName ?? product?.name ?? '',
        imageUrl: product?.images?.[0]?.uniformresourceidentifier,
        images: product?.images ?? [],
        currentIndex: product?.currentIndex ?? 0,
        isImageLoading: false
      });
    });

    return mapped;
  }

  handleCatalogSaved(_event: unknown): void {
    this.clearAllGtins();
    this.catalogPanelVisible = false;
    this.catalogPanelData = null;
    // Recargar la lista de catálogos para actualizar el dropdown
    this.getCatalogs();
  }

  onCatalogPanelCancel(): void {
    this.catalogPanelVisible = false;
    this.catalogPanelData = null;
  }

  onCatalogSelectionChange(productKeys: string[]): void {
    this.selectedProductKeys = [...productKeys];
    this.refreshCatalogPanelData();
  }


  onProductImageLoad(product: any): void {
    if (product) {
      product.isImageLoading = false;
      const currentImage = product.images[product.currentIndex];
      if (currentImage && !currentImage.hasLoaded) {
        currentImage.hasLoaded = true;
        this.loadedImagesCount++;
      }
    }
  }

  onProductImageError(product: any): void {
    if (product) {
      product.isImageLoading = false;
      const currentImage = product.images[product.currentIndex];
      if (currentImage && !currentImage.hasError) {
        currentImage.hasError = true;
      }
    }
  }

  onCatalogSelectedChange(catalogId: string): void {
    const catalogData = this.catalogList.find(c => c.catalog_id === catalogId) || null;
    this.catalogSelected = catalogData;
    this.filtered = catalogData && catalogData.data ? catalogData.data : [];
    
    // Recalcular el conteo de imágenes cuando cambia el catálogo
    this.totalImagesCount = this.filtered.reduce((total, product) => {
      return total + (Array.isArray(product.images) ? product.images.length : 0);
    }, 0);
    this.loadedImagesCount = 0;
    
    this.autoToggleToolbarOnResults();
  }

  private prepareProductForDisplay(product: any): any {
    if (!product) {
      return product;
    }

    if (!Array.isArray(product.images)) {
      product.images = [];
    }

    if (typeof product.currentIndex !== 'number') {
      product.currentIndex = 0;
    }

    if (product.images.length === 0) {
      product.currentIndex = 0;
    } else if (product.currentIndex < 0 || product.currentIndex >= product.images.length) {
      product.currentIndex = 0;
    }

    if (typeof product.isImageLoading !== 'boolean') {
      product.isImageLoading = false;
    } else if (product.isImageLoading && product.images.length <= 1) {
      product.isImageLoading = false;
    }

    return product;
  }

  loadCodesFromTextarea(): void {
    const normalized = (this.searchText || '').trim();
    if (!normalized) {
      this.snackBar.open('Pega al menos un codigo UPC o GTIN para continuar.', 'Cerrar', {
        duration: 3000,
        verticalPosition: 'top',
        horizontalPosition: 'center'
      });
      return;
    }

    this.onSearchChange(normalized);
    this.snackBar.open('Lista de codigos lista para buscar.', 'Cerrar', {
      duration: 2000,
      verticalPosition: 'bottom',
      horizontalPosition: 'center'
    });
  }

  downloadTemplate(): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    const exampleContent = '7506228087658\n7506253223237\n75062652322306';
    const blob = new Blob([exampleContent], { type: 'text/plain;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'plantilla-upc.txt';
    anchor.rel = 'noopener';
    anchor.click();
    window.URL.revokeObjectURL(url);
  }

  processSelectedImages(): void {
    const pairs = this.getSelectedProductPairs();
    const gtins = pairs.map(pair => pair.gtin);
    const glns = pairs.map(pair => pair.gln ?? '');
    const productKeys = pairs.map(pair => pair.key);

    this.router.navigate(['/product-catalog'], {
      queryParams: {
        gtin: gtins,
        gln: glns,
        productKey: productKeys
      }
    });
    // console.log('procesar', this.selectedProductKeys);
  }

  private autoToggleToolbarOnResults(): void {
    this.showToolbar = this.filtered.length === 0;
  }

  toggleToolbar(event: MouseEvent): void {
    event.stopPropagation();
    this.showToolbar = !this.showToolbar;
  }

  @HostListener('document:click', ['$event'])
  handleDocumentClick(event: Event): void {
    if (!this.showToolbar || !this.toolbarRef?.nativeElement) {
      return;
    }

    const target = event.target as HTMLElement | null;
    const toolbarEl = this.toolbarRef?.nativeElement ?? null;
    const toggleEl = this.toolbarToggleRef?.nativeElement ?? null;

    if ((toolbarEl && toolbarEl.contains(target)) || (toggleEl && toggleEl.contains(target))) {
      return;
    }

    if (this.filtered.length === 0) {
      return;
    }

    this.showToolbar = false;
  }

  /**
   * COMENTADO: Método de validación de accesibilidad que descargaba imágenes completas
   * Reemplazado por validación con FileFormatName en product.service.ts
   * 
   * Este método descargaba cada imagen completa (~2.25 GB para 500 productos)
   * y validaba accesibilidad real (403, 404, timeout, dimensiones 0x0)
   * Ahora se confía en FileFormatName de Syncfonia (95% confiabilidad)
   */
  /*
  private async validateAndFilterProductImages(products: any[]): Promise<void> {
    this.isValidating = true;
    this.validatedImagesCount = 0;
    this.totalImagesToValidate = products.length;

    console.log(`Iniciando validación de accesibilidad en segundo plano de ${products.length} productos (solo primera imagen)...`);

    // Procesar productos en lotes pequeños para no saturar
    const batchSize = 10;
    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (product) => {
        const productKey = createProductKey(product.gtin, product.gln);
        
        // Solo validar la primera imagen (images[0])
        const firstImage = product.images?.[0];
        this.validatedImagesCount++;
        
        if (!firstImage?.uniformresourceidentifier) {
          console.warn(` [${this.validatedImagesCount}/${this.totalImagesToValidate}] Sin primera imagen: ${product.gtin}`);
          this.removeProductFromDisplay(productKey);
          return;
        }

        // Validar accesibilidad de la primera imagen
        const isAccessible = await this.checkImageAccessibility(firstImage.uniformresourceidentifier);

        if (!isAccessible) {
          console.warn(` [${this.validatedImagesCount}/${this.totalImagesToValidate}] Primera imagen inaccesible: ${product.gtin}`);
          this.removeProductFromDisplay(productKey);
        } else {
          console.log(` [${this.validatedImagesCount}/${this.totalImagesToValidate}] Primera imagen válida: ${product.gtin}`);
        }
      }));

      // Pequeña pausa entre lotes
      if (i + batchSize < products.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    this.isValidating = false;

    // Mostrar resumen si se eliminaron productos
    if (this.hiddenProductsCount > 0) {
      const mensaje = this.hiddenProductsCount === 1 
        ? '1 producto fue omitido porque su primera imagen es inaccesible.'
        : `${this.hiddenProductsCount} productos fueron omitidos porque su primera imagen es inaccesible.`;
      
      this.snackBar.open(mensaje, 'Cerrar', {
        duration: 5000,
        verticalPosition: 'top',
        horizontalPosition: 'center'
      });
    }

    console.log(` Validación completada: ${this.hiddenProductsCount} productos eliminados, ${this.products.length} visibles`);
  }

  private removeProductFromDisplay(productKey: string): void {
    this.products = this.products.filter(p => {
      const key = createProductKey(p.gtin, p.gln);
      return key !== productKey;
    });
    this.filtered = this.filtered.filter(p => {
      const key = createProductKey(p.gtin, p.gln);
      return key !== productKey;
    });
    this.hiddenProductsCount++;
  }
  */
  // FIN DE MÉTODOS COMENTADOS (validateAndFilterProductImages y removeProductFromDisplay)

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
        console.warn(`Timeout checking EXIF orientation: ${imageUrl}`);
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
              console.log(` EXIF Orientation: ${orientation}, Needs rotation: ${needsRotation} - ${imageUrl.substring(imageUrl.lastIndexOf('/') + 1)}`);
            } else {
              console.log(`No EXIF orientation data, assuming correct orientation - ${imageUrl.substring(imageUrl.lastIndexOf('/') + 1)}`);
            }
            
            resolve(needsRotation);
          });
        } catch (error) {
          console.warn(` Error reading EXIF data: ${imageUrl}`, error);
          resolve(false); // Si falla la lectura EXIF, no rotar
        }
      };

      img.onerror = () => {
        clearTimeout(timeoutId);
        console.warn(` Error loading image for EXIF check: ${imageUrl}`);
        resolve(false); // Si falla, no rotar
      };

      img.src = imageUrl;
    });
  }

  /**
   * COMENTADO: Método que validaba accesibilidad descargando la imagen completa
   * Reemplazado por validación con FileFormatName en product.service.ts
   * 
   * Este método descargaba cada imagen (2-10 MB) para validar:
   * - Accesibilidad (no 403, 404)
   * - Dimensiones válidas (naturalWidth/Height > 0)
   * - Timeout de 180 segundos
   * 
   * Ahora se confía en FileFormatName de Syncfonia (95% confiabilidad)
   * Sin descarga, sin tráfico de red, instantáneo
   */
  /*
  private checkImageAccessibility(imageUrl: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (!imageUrl || typeof imageUrl !== 'string') {
        resolve(false);
        return;
      }

      const img = new Image();
      const startTime = Date.now();
      
      const timeoutId = setTimeout(() => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.warn(` Timeout (${elapsed}s) - imagen probablemente inaccesible: ${imageUrl}`);
        resolve(false);
      }, 180000);

      img.onload = () => {
        clearTimeout(timeoutId);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        const width = img.naturalWidth;
        const height = img.naturalHeight;
        
        if (width === 0 || height === 0) {
          console.warn(` Imagen vacía (${width}x${height} px, ${elapsed}s): ${imageUrl}`);
          resolve(false);
          return;
        }
        
        console.log(` Imagen válida (${width}x${height} px, ${elapsed}s)`);
        resolve(true);
      };

      img.onerror = () => {
        clearTimeout(timeoutId);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.warn(` Image not accessible (${elapsed}s): ${imageUrl}`);
        resolve(false);
      };

      img.src = imageUrl;
    });
  }
  */
  // FIN DE MÉTODO COMENTADO (checkImageAccessibility)

}














