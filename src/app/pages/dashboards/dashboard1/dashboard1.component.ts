import { Component } from '@angular/core';
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
    MatSnackBarModule
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

  constructor(
    private productService: ProductService,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) { }

  ngOnInit(): void {
    this.getPrductsAll();
  }

  async getPrductsAll() {
    this.isGenerating = true;
    this.productService.productGetByGln().subscribe({
      next: (result) => {
        if (typeof (result) === 'object' && result.data && result.data.entities?.attributes?.length) {
          this.isGenerating = false;

          result.data.entities.attributes.map((element: any) => {
            const obj = {
              gtin: element.gtin,
              producName: element.tradeitemdescriptioninformation.descriptionshort,
              images: (Array.isArray(element.referencedfileheader)) ? element.referencedfileheader : [],
              currentIndex: 0
            }
            this.products.push(obj);
          });
        } else {
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

  openGtinDialog(): void {
    const dialogRef = this.dialog.open(GtinDialogComponent, {
      width: '400px',
    });

    dialogRef.afterClosed().subscribe((gtins: string[]) => {
      if (Array.isArray(gtins) && gtins.length > 0) {
        console.log('gtins a consultar', gtins)
        this.isGenerating = true;

        this.productService.productGetByGtin(gtins).subscribe({
          next: (result: any) => {
            this.isGenerating = false;

            if (typeof (result) === 'object' && result.data && result.data.entities?.attributes?.length) {
              this.products = result.data.entities.attributes.map((element: any) => ({
                gtin: element.gtin,
                producName: element.tradeitemdescriptioninformation.descriptionshort,
                images: Array.isArray(element.referencedfileheader) ? element.referencedfileheader : [],
                currentIndex: 0,
              }));
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
    });
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

  filteredProducts() {
    if (!this.searchText) return this.products;

    const query = this.searchText.toLowerCase();

    return this.products.filter(p =>
      p.producName?.toLowerCase().includes(query) ||
      p.gtin?.toLowerCase().includes(query)
    );
  }


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

  processSelectedImages() {
    this.router.navigate(['/product-catalog'], {
      queryParams: this.selectedGtins
    });
    console.log('procesar', this.selectedGtins)
  }

}
