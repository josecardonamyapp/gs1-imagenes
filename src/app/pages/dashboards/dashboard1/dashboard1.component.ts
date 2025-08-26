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
import { MatDialog } from '@angular/material/dialog';
import { GtinDialogComponent } from './dashboard1Filter/dashboard1Filter.component'; // Asegúrate de ajustar la ruta correcta
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Subject } from 'rxjs';
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
    TourModule
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
          description: 'Ingresa el nombre del producto o su código GTIN para realizar una búsqueda directa.'
        },
        allowInteraction: true
      },
      {
        element: '#btn-seleccionar-todos',
        popover: {
          title: 'Seleccionar todos los productos',
          description: 'Haz clic aquí para seleccionar rápidamente todos los productos mostrados.'
        }
      },
      {
        element: '#btn-buscar-gtins',
        popover: {
          title: 'Búsqueda por lista de GTINs',
          description: 'Importa una lista con múltiples GTINs para realizar una búsqueda masiva.'
        }
      },
      {
        element: '#tarjeta-producto-1',
        popover: {
          title: 'Vista de producto',
          description: 'Cada tarjeta muestra información clave de un producto individual.'
        }
      },
      {
        element: '#carousel-imagenes',
        popover: {
          title: 'Carrusel de imágenes',
          description: 'Desplázate entre las imágenes disponibles del producto para visualizar sus distintas vistas.'
        }
      },
      {
        element: '#informacion-tarjeta',
        popover: {
          title: 'Detalles del producto',
          description: 'Consulta aquí detalles adicionales como imágenes, descripciones y opciones de procesamiento.'
        }
      }
    ],
    '/channels/channel': [
      {
        element: '#menu-canales',
        popover: {
          title: 'Gestión de canales',
          description: 'Administra tus canales de distribución desde esta sección.'
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
          description: 'Haz clic aquí para configurar un nuevo canal de distribución.'
        }
      },
      {
        element: '#editar-canal',
        popover: {
          title: 'Editar canal existente',
          description: 'Modifica la configuración de un canal ya existente desde esta opción.'
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
          description: 'Aquí se muestra un historial detallado de todos tus trabajos procesados.'
        }
      },
      {
        element: '#actualizar-procesamientos',
        popover: {
          title: 'Actualizar lista',
          description: 'Refresca el listado para ver el estado más reciente de tus procesamientos.'
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
    private dialog: MatDialog,
    private snackBar: MatSnackBar,
    private tourService: DriverTourService
  ) { }

  ngAfterViewInit() {

    const userId = 'usuario';
    const tourKey = 'dashboard';

    this.tourService.startMultiPageTour(userId, tourKey, this.tourSequence, this.tourByRoute);
  }

  ngOnInit(): void {
    this.getPrductsAll();

    // this.searchSubject
    //   .pipe(debounceTime(300), distinctUntilChanged())
    //   .subscribe(searchTerm => {
    //     this.filtered = this.products.filter(product =>
    //       (product.producName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    //       (product.gtin || '').toLowerCase().includes(searchTerm.toLowerCase())
    //     );
    //   });
    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged())
      .subscribe(value => {
        this.handleSearch(value);
      });
  }

  async getPrductsAll() {
    this.isGenerating = true;
    this.productService.productGetByGln().subscribe({
      next: (result) => {
        if (typeof (result) === 'object' && result.data && result.data.entities?.attributes?.length) {
          this.isGenerating = false;

          result.data.entities.attributes.map((element: any) => {

            const files = Array.isArray(element?.referencedfileheader) ? element.referencedfileheader : [];

            // Filtrar solo URLs que sean imágenes
            const imageUrls = files.filter((file: any) => {
              const url = file?.uniformresourceidentifier ?? '';
              return typeof url === 'string' && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
            });

            const obj = {
              gtin: element?.gtin ?? '',
              producName: element?.tradeitemdescriptioninformation?.descriptionshort ?? '',
              images: imageUrls,
              currentIndex: 0
            }
            if (obj.images.length) {
              this.products.push(obj);
            }
          });
          this.filtered = [...this.products];
          if (this.filtered.length != result.data.entities.attributes.length) {
            this.snackBar.open('Varios GTINs fueron omitidos durante la carga, ya que no disponen de imágenes asociadas en Syncfonía.', 'Cerrar', {
              duration: 3000,
              verticalPosition: 'top',
              horizontalPosition: 'center'
            });
          }
        } else {
          this.isGenerating = false;
          this.snackBar.open('No se encontraron productos relacionados al GLN', 'Cerrar', {
            duration: 3000,
            verticalPosition: 'top',
            horizontalPosition: 'center'
          });
        }
      },
      error: (error) => {
        this.isGenerating = false;
        console.error('Error load products:', error);
      },
      complete: () => {
        this.isGenerating = false;
        console.log('loading finished.');
      }
    })
  }

  getProductsByListGtin(gtins: any): void {
    // const dialogRef = this.dialog.open(GtinDialogComponent, {
    //   width: '400px',
    // });

    // dialogRef.afterClosed().subscribe((gtins: string[]) => {
    if (Array.isArray(gtins) && gtins.length > 0) {
      this.isGenerating = true;

      this.productService.productGetByGtin(gtins).subscribe({
        next: (result: any) => {
          this.isGenerating = false;

          if (typeof (result) === 'object' && result.data && result.data.entities?.attributes?.length) {
            this.products = result.data.entities.attributes.map((element: any) => {

              const files = Array.isArray(element?.referencedfileheader) ? element.referencedfileheader : [];

              // Filtrar solo URLs que sean imágenes
              const imageUrls = files.filter((file: any) => {
                const url = file?.uniformresourceidentifier ?? '';
                return typeof url === 'string' && /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
              });

              if (!imageUrls.length) return null;

              return {
                gtin: element?.gtin ?? '',
                producName: element?.tradeitemdescriptioninformation?.descriptionshort ?? '',
                images: Array.isArray(element?.referencedfileheader) ? element.referencedfileheader : [],
                currentIndex: 0,
              }
            })
              .filter((product: any) => product !== null);
            this.filtered = [...this.products];

            if (this.filtered.length != result.data.entities.attributes.length) {
              this.snackBar.open('Varios GTINs fueron omitidos durante la carga, ya que no disponen de imágenes asociadas en Syncfonía.', 'Cerrar', {
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
        },
        error: err => {
          this.isGenerating = false;
          this.snackBar.open(err.error, 'Cerrar', {
            duration: 3000,
            verticalPosition: 'top',
            horizontalPosition: 'center'
          });
          console.error('Error al obtener productos por GTINs:', err);
        }
      });
    }
    // });
  }

  nextImage(product: any) {
    product.currentIndex =
      product.currentIndex === product.images.length - 1
        ? 0
        : product.currentIndex + 1;
  }

  previousImage(product: any) {
    product.currentIndex =
      product.currentIndex === 0
        ? product.images.length - 1
        : product.currentIndex - 1;
  }

  goToDetail(gtin: string): void {
    this.router.navigate(['/product', gtin]);
  }

  onSearchChange(value: string | null | undefined) {
    const trimmed = (value ?? '').trim();

    if (!trimmed) {
      this.inputType = null;
      this.filtered = [];
      this.searchText = '';          // ← refleja en el textarea
      this.searchSubject.next('');
      return;
    }

    // Detectar tipo admitiendo comas, espacios y saltos de línea
    if (/^[0-9,\s\r\n]+$/.test(trimmed)) {
      this.inputType = 'number';
    } else if (/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(trimmed)) {
      this.inputType = 'text';
    } else {
      this.inputType = 'mixed';
    }

    let normalized = trimmed;

    if (this.inputType === 'number') {
      normalized = normalized
        .replace(/[\s\r\n]+/g, ',') // saltos de línea/espacios → coma
        .replace(/,{2,}/g, ',')     // evita ,, consecutivas
        .replace(/^,|,$/g, '');     // sin coma al inicio/fin

      // Autocompletar a 14 dígitos
      normalized = normalized
        .split(',')
        .map(n => n.trim().padStart(14, '0'))
        .join(',');
    } else if (this.inputType === 'text') {
      normalized = normalized.replace(/\s+/g, ' ');
    }

    // 🔁 Reflejar el valor normalizado en el textarea y continuar flujo
    this.searchText = normalized;       // ← actualiza el textarea
    this.searchSubject.next(normalized);

    console.log('inputType:', this.inputType, '=>', normalized);
  }


  private handleSearch(value: string) {
    console.log('handlesearch', value)
    if (!value) {
      this.filtered = [];
      return;
    }

    if (this.inputType == 'text') {
      // Buscar local por nombre
      const localMatches = this.products.filter(p =>
        p.producName?.toLowerCase().includes(value.toLowerCase())
      );

      this.filtered = localMatches;

    } else if (this.inputType == 'number') {
      // Para números, soportando múltiples códigos separados por coma
      const codes = value.split(',');
      console.log('codes', codes)

      const localMatches = this.products.filter(p => codes.includes(p.gtin));

      // Determinar códigos que no están localmente
      const missingCodes = codes.filter(code => !localMatches.some(p => p.gtin === code));

      if (missingCodes.length > 0) {
        console.log('missingCodes', missingCodes)
        this.getProductsByListGtin(missingCodes);
      } else {
        this.filtered = localMatches;
      }
    }
  }

  clearSearch() {
    this.searchText = '';
    this.applyFilter();
  }

  applyFilter() {
    const query = this.searchText.toLowerCase();
    this.filtered = this.products.filter(p =>
      p.producName?.toLowerCase().includes(query) ||
      p.gtin?.toLowerCase().includes(query)
    );
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
  }

  isGtinSelected(gtin: string): boolean {
    return this.selectedGtins.includes(gtin);
  }

  selectAllGtins(): void {
    this.selectedGtins = this.filtered
      .filter(p => p.images?.length > 0)
      .map(p => p.gtin);
  }

  clearAllGtins(): void {
    this.selectedGtins = [];
  }

  processSelectedImages() {
    this.router.navigate(['/product-catalog'], {
      queryParams: this.selectedGtins
    });
    console.log('procesar', this.selectedGtins)
  }

}
