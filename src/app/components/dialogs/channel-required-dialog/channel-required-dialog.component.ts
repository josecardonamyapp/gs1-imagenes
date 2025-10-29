import { CommonModule } from '@angular/common';
import { Component, Inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';

export interface ChannelRequiredDialogData {
    title?: string;
    message?: string;
    confirmText?: string;
    cancelText?: string;
}

@Component({
    selector: 'app-channel-required-dialog',
    standalone: true,
    templateUrl: './channel-required-dialog.component.html',
    styleUrls: ['./channel-required-dialog.component.scss'],
    imports: [
        CommonModule,
        MatDialogModule,
        MatButtonModule,
        MatIconModule
    ]
})
export class ChannelRequiredDialogComponent {
    constructor(
        private dialogRef: MatDialogRef<ChannelRequiredDialogComponent>,
        @Inject(MAT_DIALOG_DATA) public data: ChannelRequiredDialogData
    ) { }

    onCancel(): void {
        this.dialogRef.close(false);
    }

    onConfirm(): void {
        this.dialogRef.close(true);
    }

    get title(): string {
        return this.data?.title || 'Canal requerido';
    }

    get message(): string {
        return this.data?.message || 'Debes seleccionar un canal antes de continuar.';
    }

    get confirmText(): string {
        return this.data?.confirmText || 'Seleccionar canal';
    }

    get cancelText(): string {
        return this.data?.cancelText || 'Cancelar';
    }
}
