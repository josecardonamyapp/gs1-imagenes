import { Component, AfterViewInit } from '@angular/core';
import { TablerIconsModule } from 'angular-tabler-icons';
import { ProductService } from 'src/app/services/product.service';
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
import { DriverTourService } from 'src/app/core/tour/driver-tour.service';
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
export class AppDashboard1Component {
  products: any[] = [];
  carouselImages: any[] = [];
  selectedProduct: any = null;
  currentIndex = 0;
  searchText: string = '';
  gtinListInput: string = '';
  isGenerating = false;
  selectedGtins: string[] = [];
  filtered: any[] = [];
  searchSubject: Subject<string> = new Subject<string>();
  inputType: 'text' | 'number' | 'mixed' | null = null;
  catalogPanelVisible = false;
  catalogPanelData: CreateCatalogDialogData | null = null;

  tourByRoute: Record<string, any[]> = {
    '/dashboards/dashboard1': [
      {
        element: '#menu-inicio',
        popover: {
          title: 'Inicio',
          description: 'Accede al panel principal para comenzar a gestionar tus productos y actividades.'
        }
      },
      {
        element: '#input-gtin',
        popover: {
          title: 'Buscar productos',
          description: 'Ingresa el nombre del producto o su cÃ³digo GTIN para realizar una bÃºsqueda directa.'
        },
        allowInteraction: true
      },
      {
        element: '#btn-seleccionar-todos',
        popover: {
          title: 'Seleccionar todos los productos',
          description: 'Haz clic aquÃ­ para seleccionar rÃ¡pidamente todos los productos mostrados.'
        }
      },
      {
        element: '#btn-buscar-gtins',
        popover: {
          title: 'BÃºsqueda por lista de GTINs',
          description: 'Importa una lista con mÃºltiples GTINs para realizar una bÃºsqueda masiva.'
        }
      },
      {
        element: '#tarjeta-producto-1',
        popover: {
          title: 'Vista de producto',
          description: 'Cada tarjeta muestra informaciÃ³n clave de un producto individual.'
        }
      },
      {
        element: '#carousel-imagenes',
        popover: {
          title: 'Carrusel de imÃ¡genes',
          description: 'DesplÃ¡zate entre las imÃ¡genes disponibles del producto para visualizar sus distintas vistas.'
        }
      },
      {
        element: '#informacion-tarjeta',
        popover: {
          title: 'Detalles del producto',
          description: 'Consulta aquÃ­ detalles adicionales como imÃ¡genes, descripciones y opciones de procesamiento.'
        }
      }
    ],
    '/channels/channel': [
      {
        element: '#menu-canales-de-venta',
        popover: {
          title: 'GestiÃ³n de Canales de Venta',
          description: 'Administra tus canales de distribuciÃ³n desde esta secciÃ³n.'
        }
      },
      {
        element: '#lista-canales',
        popover: {
          title: 'Listado de canales',
          description: 'Visualiza todos los canales existentes configurados en la plataforma.'
        }
      },
      {
        element: '#crear-canal',
        popover: {
          title: 'Crear un nuevo canal',
          description: 'Haz clic aquÃ­ para configurar un nuevo canal de distribuciÃ³n.'
        }
      },
      {
        element: '#editar-canal',
        popover: {
          title: 'Editar canal existente',
          description: 'Modifica la configuraciÃ³n de un canal ya existente desde esta opciÃ³n.'
        }
      }
    ],
    '/jobs': [
      {
        element: '#menu-mis-procesamientos',
        popover: {
          title: 'Mis Procesamientos',
          description: 'Consulta todas las solicitudes de procesamiento realizadas hasta ahora.'
        }
      },
      {
        element: '#lista-procesamientos',
        popover: {
          title: 'Lista de procesamientos',
          description: 'AquÃ­ se muestra un historial detallado de todos tus trabajos procesados.'
        }
      },
      {
        element: '#actualizar-procesamientos',
        popover: {
          title: 'Actualizar lista',
          description: 'Refresca el listado para ver el estado mÃ¡s reciente de tus procesamientos.'
        }
      },
      {
        element: '#procesar-productos',
        popover: {
          title: 'Nuevo procesamiento',
          description: 'Inicia un nuevo procesamiento a partir de tu lista de productos seleccionados.'
        }
      }
    ]
  };


  tourSequence: string[] = [
    '/dashboards/dashboard1',
    '/channels/channel',
    '/jobs'
  ];

  constructor(
    private productService: ProductService,
    private router: Router,
    private snackBar: MatSnackBar,
    private tourService: DriverTourService
  ) { }

  ngAfterViewInit() {

    const userId = 'usuario';
    const tourKey = 'dashboard';

    this.tourService.startMultiPageTour(userId, tourKey, this.tourSequence, this.tourByRoute);
  }

  ngOnInit(): void {
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(async value => {
        try {
          await this.handleSearch(value);
        } catch (error) {
          console.error('Error during search handling:', error);
        }
      });
  }

  private async getProductsByListGtin(gtins: string[], requestedCodes: string[]): Promise<void> {
    //   width: '400px',
    // });

    // dialogRef.afterClosed().subscribe((gtins: string[]) => {
    if (!Array.isArray(gtins) || gtins.length === 0) {
      return;
    }

    this.isGenerating = true;

    try {
      const result: any = await firstValueFrom(this.productService.productGetByGtin(gtins));

      if (typeof result === 'object' && result.data && result.data.entities?.attributes) {
        const fetchedProducts = result.data.entities.attributes
          .map((element: any) => {
            const files = Array.isArray(element?.referencedfileheader) ? element.referencedfileheader : [];
            const imageUrls = files.filter((file: any) => {
              const url = file?.uniformresourceidentifier ?? '';
              return typeof url === 'string' && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
            });

            if (!imageUrls.length) {
              return null;
            }

            return {
              gtin: element?.gtin ?? '',
              producName: element?.tradeitemdescriptioninformation?.descriptionshort ?? '',
              images: imageUrls,
              currentIndex: 0,
              isImageLoading: false
            };
          })
          .filter((product: any) => product !== null);

        const productsByGtin = new Map(this.products.map(product => [product.gtin, product]));
        fetchedProducts.forEach((product: any) => {
          productsByGtin.set(product.gtin, product);
        });

        this.products = Array.from(productsByGtin.values()).map(product => this.prepareProductForDisplay(product));
        console.log('products', this.products)

        const requestedOrder = Array.isArray(requestedCodes) && requestedCodes.length > 0
          ? requestedCodes
          : gtins;

        const productLookup = new Map(this.products.map(product => [product.gtin, product]));
        this.filtered = requestedOrder
          .map(code => this.prepareProductForDisplay(productLookup.get(code)))
          .filter((product): product is any => Boolean(product));

        if (fetchedProducts.length !== result.data.entities.attributes.length) {
          this.snackBar.open('Varios GTINs fueron omitidos durante la carga, ya que no disponen de imÃ¡genes asociadas en SyncfonÃ­a.', 'Cerrar', {
            duration: 3000,
            verticalPosition: 'top',
            horizontalPosition: 'center'
          });
        }
      } else {
        this.snackBar.open('No se encontraron GTINs relacionados al GLN', 'Cerrar', {
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

  goToDetail(gtin: string): void {
    this.router.navigate(['/product', gtin]);
  }

  onSearchChange(value: string | null | undefined) {
    const trimmed = (value ?? '').trim();

    if (!trimmed) {
      this.inputType = null;
      this.filtered = [];
      this.searchText = '';          // â† refleja en el textarea
      this.searchSubject.next('');
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
        .replace(/[\s`r`n]+/g, ',') // saltos de lÃ­nea/espacios â†’ coma
        .replace(/,{2,}/g, ',')     // evita ,, consecutivas
        .replace(/^,|,$/g, '');     // sin coma al inicio/fin

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

    // ðŸ” Reflejar el valor normalizado en el textarea y continuar flujo
    this.searchText = normalized;       // â† actualiza el textarea
    this.searchSubject.next(normalized);

    console.log('inputType:', this.inputType, '=>', normalized);
  }


  private async handleSearch(value: string) {
    console.log('handlesearch', value);
    if (!value) {
      this.filtered = [];
      this.refreshCatalogPanelData();
      return;
    }

    if (this.inputType == 'text') {
      const localMatches = this.products.filter(p =>
        p.producName?.toLowerCase().includes(value.toLowerCase())
      );

      this.filtered = localMatches.map(product => this.prepareProductForDisplay(product));
    } else if (this.inputType == 'number') {
      const codes = value.split(',').map(code => code.trim()).filter(Boolean);
      console.log('codes', codes);

      const localMatches = this.products.filter(p => codes.includes(p.gtin));
      const missingCodes = codes.filter(code => !localMatches.some(p => p.gtin === code));

      this.filtered = localMatches.map(product => this.prepareProductForDisplay(product));

      if (missingCodes.length > 0) {
        console.log('missingCodes', missingCodes);
        await this.getProductsByListGtin(missingCodes, codes);
      }
    } else {
      this.applyFilter();
    }

    this.refreshCatalogPanelData();
  }

  clearSearch() {
    this.searchText = '';
    this.inputType = null;
    this.filtered = [];
    this.searchSubject.next('');
    this.refreshCatalogPanelData();
  }

  applyFilter() {
    const query = this.searchText.toLowerCase();
    this.filtered = this.products.filter(p =>
      p.producName?.toLowerCase().includes(query) ||
      p.gtin?.toLowerCase().includes(query)
    );

    this.refreshCatalogPanelData();
  }

  trackByGtin(index: number, item: any): string {
    return item.gtin;
  }

  // filteredProducts() {
  //   if (!this.searchText) return this.products;

  //   const query = this.searchText.toLowerCase();

  //   return this.products.filter(p =>
  //     p.producName?.toLowerCase().includes(query) ||
  //     p.gtin?.toLowerCase().includes(query)
  //   );
  // }


  toggleGtinSelection(gtin: string): void {
    const index = this.selectedGtins.indexOf(gtin);

    if (index > -1) {
      this.selectedGtins.splice(index, 1);
    } else {
      this.selectedGtins.push(gtin);
    }

    this.refreshCatalogPanelData();
  }

  onProductSelectionChange(event: MatCheckboxChange, gtin: string): void {
    if (event.checked) {
      if (!this.isGtinSelected(gtin)) {
        this.selectedGtins.push(gtin);
      }
    } else if (this.isGtinSelected(gtin)) {
      this.selectedGtins = this.selectedGtins.filter(selected => selected !== gtin);
    }

    this.refreshCatalogPanelData();
  }

  isGtinSelected(gtin: string): boolean {
    return this.selectedGtins.includes(gtin);
  }

  selectAllGtins(): void {
    this.selectedGtins = this.filtered
      .filter(p => p.images?.length > 0)
      .map(p => p.gtin);

    this.refreshCatalogPanelData();
  }

  clearAllGtins(): void {
    this.selectedGtins = [];
    this.refreshCatalogPanelData();
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
      preselectedGtins: [...this.selectedGtins]
    };
  }

  private buildCatalogProducts(products: any[]): CatalogProduct[] {
    const mapped: CatalogProduct[] = [];
    const seen = new Set<string>();

    (products || []).forEach(product => {
      const gtin = product?.gtin;
      if (!gtin || seen.has(gtin)) {
        return;
      }

      seen.add(gtin);
      mapped.push({
        gtin,
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
  }

  onCatalogPanelCancel(): void {
    this.catalogPanelVisible = false;
    this.catalogPanelData = null;
  }

  onCatalogSelectionChange(gtins: string[]): void {
    this.selectedGtins = [...gtins];
    this.refreshCatalogPanelData();
  }


  onProductImageLoad(product: any): void {
    if (product) {
      product.isImageLoading = false;
    }
  }

  onProductImageError(product: any): void {
    if (product) {
      product.isImageLoading = false;
    }
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

  processSelectedImages() {
    this.router.navigate(['/product-catalog'], {
      queryParams: { gtin: this.selectedGtins }
    });
    console.log('procesar', this.selectedGtins)
  }

}







