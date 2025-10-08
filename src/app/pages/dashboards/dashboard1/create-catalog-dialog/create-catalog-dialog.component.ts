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
import { CatalogService } from 'src/app/services/catalog.service';

export interface CreateCatalogDialogData {
  availableProducts: CatalogProduct[];
  preselectedGtins: string[];
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

  isProductSelected(gtin: string): boolean {
    return this.selectedProducts.some(product => product.gtin === gtin);
  }

  removeSelected(gtin: string): void {
    this.selectedProducts = this.selectedProducts.filter(product => product.gtin !== gtin);
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

  private initializeStateFromData(options: { resetForm: boolean }): void {
    const incomingAvailable = [...(this.data?.availableProducts ?? [])];
    const preselected = new Set(this.data?.preselectedGtins ?? []);
    const currentSelections = new Map(this.selectedProducts.map(product => [product.gtin, product]));
    const previousAvailable = new Map(this.availableProducts.map(product => [product.gtin, product]));

    const mergedAvailable: CatalogProduct[] = [];
    const seenGtins = new Set<string>();

    incomingAvailable.forEach(product => {
      if (!product || !product.gtin || seenGtins.has(product.gtin)) {
        return;
      }
      mergedAvailable.push(product);
      seenGtins.add(product.gtin);
    });

    previousAvailable.forEach(product => {
      if (!product || !product.gtin || seenGtins.has(product.gtin)) {
        return;
      }
      mergedAvailable.push(product);
      seenGtins.add(product.gtin);
    });

    const nextSelected = new Map<string, CatalogProduct>();

    mergedAvailable.forEach(product => {
      if (!product?.gtin) {
        return;
      }

      const existing = currentSelections.get(product.gtin);
      if (existing) {
        nextSelected.set(product.gtin, existing);
      } else if (preselected.has(product.gtin)) {
        nextSelected.set(product.gtin, product);
      }
    });

    currentSelections.forEach((product, gtin) => {
      if (!nextSelected.has(gtin)) {
        nextSelected.set(gtin, product);
      }
    });

    preselected.forEach(gtin => {
      if (!nextSelected.has(gtin)) {
        const fallback = currentSelections.get(gtin) ?? mergedAvailable.find(item => item.gtin === gtin);
        nextSelected.set(gtin, fallback ?? { gtin, name: '', images: [] });
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
    this.selectionChange.emit(this.selectedProducts.map(product => product.gtin));
  }

  private resetFormState(options: { resetForm?: boolean } = {}): void {
    const { resetForm = true } = options;

    if (resetForm) {
      this.form.reset({ name: '', description: '' });
    }
  }
}
