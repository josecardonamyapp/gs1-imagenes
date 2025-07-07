import { Component, Inject } from '@angular/core';
import { MAT_DIALOG_DATA } from '@angular/material/dialog';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { ClipboardModule } from '@angular/cdk/clipboard';
import { NgIf } from '@angular/common';

@Component({
    selector: 'app-productResult',
    standalone: true,
    imports: [
        MatDialogModule,
        MatButtonModule,
        ClipboardModule,
        NgIf
    ],
    templateUrl: './productResult.component.html',
})
export class ProcessResultComponent {
    constructor(
        @Inject(MAT_DIALOG_DATA) public data: any,
        private clipboard: Clipboard
    ) { }

    copyLink() {
        this.clipboard.copy(this.data.processed_image_url);
        alert('Enlace copiado al portapapeles');
    }
}
