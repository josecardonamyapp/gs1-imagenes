import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Catalog, CatalogProduct, CatalogProductApiEntry, CreateCatalogApiPayload } from 'src/app/model/catalog';
import { createProductKey, extractGlnFromKey, extractGtinFromKey } from 'src/app/utils/product-key';
import { CatalogService } from 'src/app/services/catalog.service';

export interface CreateCatalogDialogData {
  availableProducts: CatalogProduct[];
  preselectedProductKeys: string[];
}

@Component({
  selector: 'app-create-catalog-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  templateUrl: './create-catalog-dialog.component.html',
  styleUrls: ['./create-catalog-dialog.component.scss']
})
export class CreateCatalogDialogComponent implements OnChanges {
  @Input() data: CreateCatalogDialogData | null = null;
  @Input() visible = false;
  @Output() cancel = new EventEmitter<void>();
  @Output() saved = new EventEmitter<{ catalog: unknown; products: CatalogProduct[] }>();
  @Output() selectionChange = new EventEmitter<string[]>();

  form: FormGroup;
  availableProducts: CatalogProduct[] = [];
  selectedProducts: CatalogProduct[] = [];
  saving = false;

  private hasInitializedFromInputs = false;

  constructor(
    private fb: FormBuilder,
    private catalogService: CatalogService,
    private snackBar: MatSnackBar
  ) {
    this.form = this.fb.group({
      name: ['', [Validators.required, Validators.maxLength(80)]],
      description: ['', [Validators.maxLength(200)]]
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    const visibleChange = changes['visible'];
    const dataChange = changes['data'];

    if (visibleChange) {
      const becameVisible = visibleChange.currentValue && !visibleChange.previousValue;
      const becameHidden = !visibleChange.currentValue && visibleChange.previousValue;

      if (becameVisible) {
        this.initializeStateFromData({ resetForm: true });
        this.hasInitializedFromInputs = true;
        return;
      }

      if (becameHidden) {
        this.hasInitializedFromInputs = false;
        this.resetFormState();
        this.availableProducts = [];
        this.selectedProducts = [];
        this.emitSelectionChange();
        return;
      }
    }

    if (dataChange && this.visible) {
      this.initializeStateFromData({ resetForm: !this.hasInitializedFromInputs });
      this.hasInitializedFromInputs = true;
    }
  }

  onCancel(): void {
    this.cancel.emit();
    this.resetFormState();
    this.availableProducts = [];
    this.selectedProducts = [];
    this.hasInitializedFromInputs = false;
    this.emitSelectionChange();
  }

  isProductSelected(gtin: string, gln?: string | null): boolean {
    const key = createProductKey(gtin, gln);
    return this.selectedProducts.some(product => this.getProductKey(product) === key);
  }

  removeSelected(product: CatalogProduct): void {
    const key = this.getProductKey(product);
    if (!key) {
      return;
    }

    this.selectedProducts = this.selectedProducts.filter(item => this.getProductKey(item) !== key);
    this.emitSelectionChange();
  }

  clearSelection(): void {
    this.selectedProducts = [];
    this.emitSelectionChange();
  }

  save(): void {
    if (this.form.invalid || !this.selectedProducts.length) {
      this.form.markAllAsTouched();
      this.snackBar.open('Ingresa un nombre y selecciona al menos un producto.', 'Cerrar', { duration: 3000 });
      return;
    }

    const gln = localStorage.getItem('gln') || '0909090090';
    const payload: CreateCatalogApiPayload = {
      gln,
      name: this.form.value.name.trim(),
      description: this.form.value.description?.trim() || undefined,
      data: this.mapSelectedProductsForApi()
    };

    this.saving = true;
    this.catalogService.createCatalogWithProducts(payload).subscribe({
      next: response => {
        this.snackBar.open('Catalogo creado correctamente.', 'Cerrar', { duration: 3000 });
        this.saved.emit({ catalog: response, products: [...this.selectedProducts] });
        this.saving = false;
        this.resetFormState();
        this.availableProducts = [];
        this.selectedProducts = [];
        this.hasInitializedFromInputs = false;
        this.emitSelectionChange();
      },
      error: () => {
        this.snackBar.open('No se pudo guardar el catalogo.', 'Cerrar', { duration: 4000 });
        this.saving = false;
      }
    });
  }

  private getProductKey(product: CatalogProduct | null | undefined): string {
    if (!product?.gtin) {
      return '';
    }

    if (product.key) {
      return product.key;
    }

    return createProductKey(product.gtin, product.gln);
  }

  private normalizeProduct(product: CatalogProduct | null | undefined): CatalogProduct | null {
    if (!product?.gtin) {
      return null;
    }

    const key = this.getProductKey(product);
    return product.key === key ? product : { ...product, key };
  }

  private ensureProductList(products: CatalogProduct[] | null | undefined): CatalogProduct[] {
    return (products ?? [])
      .map(product => this.normalizeProduct(product))
      .filter((product): product is CatalogProduct => Boolean(product));
  }

  private buildPlaceholderFromKey(key: string): CatalogProduct {
    const gtin = extractGtinFromKey(key);
    const gln = extractGlnFromKey(key);

    return {
      gtin,
      gln: gln || undefined,
      key,
      name: '',
      images: []
    };
  }

  private initializeStateFromData(options: { resetForm: boolean }): void {
    const incomingAvailable = this.ensureProductList(this.data?.availableProducts);
    const preselectedKeys = new Set(this.data?.preselectedProductKeys ?? []);

    const currentSelections = new Map<string, CatalogProduct>();
    this.selectedProducts.forEach(product => {
      const normalized = this.normalizeProduct(product);
      if (!normalized) {
        return;
      }

      const key = this.getProductKey(normalized);
      if (key) {
        currentSelections.set(key, normalized);
      }
    });

    const previousAvailable = new Map<string, CatalogProduct>();
    this.availableProducts.forEach(product => {
      const normalized = this.normalizeProduct(product);
      if (!normalized) {
        return;
      }

      const key = this.getProductKey(normalized);
      if (key && !previousAvailable.has(key)) {
        previousAvailable.set(key, normalized);
      }
    });

    const mergedAvailable: CatalogProduct[] = [];
    const seenKeys = new Set<string>();

    const addIfNew = (product: CatalogProduct | null | undefined) => {
      const normalized = this.normalizeProduct(product);
      if (!normalized) {
        return;
      }

      const key = this.getProductKey(normalized);
      if (!key || seenKeys.has(key)) {
        return;
      }

      seenKeys.add(key);
      mergedAvailable.push(normalized);
    };

    incomingAvailable.forEach(addIfNew);
    previousAvailable.forEach(product => addIfNew(product));

    const nextSelected = new Map<string, CatalogProduct>();

    mergedAvailable.forEach(product => {
      const key = this.getProductKey(product);
      if (!key) {
        return;
      }

      const existing = currentSelections.get(key);
      if (existing) {
        nextSelected.set(key, existing);
      } else if (preselectedKeys.has(key)) {
        nextSelected.set(key, product);
      }
    });

    currentSelections.forEach((product, key) => {
      if (!nextSelected.has(key)) {
        nextSelected.set(key, product);
      }
    });

    preselectedKeys.forEach(key => {
      if (!nextSelected.has(key)) {
        const fallback =
          currentSelections.get(key) ??
          mergedAvailable.find(item => this.getProductKey(item) === key) ??
          null;

        nextSelected.set(key, fallback ?? this.buildPlaceholderFromKey(key));
      }
    });

    this.availableProducts = mergedAvailable;
    this.selectedProducts = Array.from(nextSelected.values());

    if (options.resetForm) {
      this.resetFormState();
    }
  }

  private mapSelectedProductsForApi(): CatalogProductApiEntry[] {
    return this.selectedProducts.map(product => ({
      gtin: product.gtin,
      producName: product.producName || product.name || '',
      images: product.images && product.images.length
        ? product.images
        : product.imageUrl
          ? [{ uniformresourceidentifier: product.imageUrl }]
          : [],
      currentIndex: product.currentIndex ?? 0
    }));
  }

  private emitSelectionChange(): void {
    const keys = this.selectedProducts
      .map(product => this.getProductKey(product))
      .filter(key => Boolean(key));

    this.selectionChange.emit(Array.from(new Set(keys)));
  }

  private resetFormState(options: { resetForm?: boolean } = {}): void {
    const { resetForm = true } = options;

    if (resetForm) {
      this.form.reset({ name: '', description: '' });
    }
  }
}
