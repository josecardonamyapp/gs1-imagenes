// src/app/pages/product-detail/product-detail.component.ts
import { Component } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ProductService } from 'src/app/services/product.service';
import { MatIconModule } from '@angular/material/icon';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButton } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ProcessResultComponent } from '../productResult/productResult.component';
import { MatDialogModule } from '@angular/material/dialog';
import { MatDialog } from '@angular/material/dialog';


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
        ProcessResultComponent
    ],
    templateUrl: './productOne.component.html',
    styleUrls: ['./productOne.component.scss']
})
export class ProductOneComponent {
    gtin: string | null = null;
    product: any = {};
    channels: any[] = [];

    selectedFormat = 'Sams';
    imagesPerGtin = 1;
    regenerar = false;

    selectedTab = 0;

    selectedImage: string = '';
    selectedChannel: {};

    isGenerating = false;


    constructor(
        private route: ActivatedRoute,
        private productService: ProductService,
        private router: Router,
        private dialog: MatDialog
    ) { }

    ngOnInit(): void {
        this.gtin = this.route.snapshot.paramMap.get('gtin');
        this.getPrductByGtin();
        this.getProductChannels();
    }

    goToReturn() {
        this.router.navigate(['/dashboards/dashboard1']);
    }

    async getPrductByGtin() {
        this.productService.productGetByGtin(this.gtin).subscribe({
            next: (result) => {
                if (typeof (result) === 'object') {

                    result.data.entities.attributes.map((element: any) => {
                        const obj = {
                            gtin: element.gtin,
                            producName: element.tradeitemdescriptioninformation.descriptionshort,
                            images: (Array.isArray(element.referencedfileheader)) ? element.referencedfileheader : [],
                            currentIndex: 0
                        }
                        // if (element.referencedfileheader != null) {
                        this.product = obj;
                        // }
                    });

                    if (this.product?.images?.length > 0) {
                        this.selectedImage = this.product.images[0].uniformresourceidentifier;
                    }

                }
            }
        })
    }

    async getProductChannels() {
        this.productService.productGetChannels().subscribe({
            next: (result: any) => {
                if (typeof (result) === 'object') {
                    this.channels = result.channels;
                }
            }
        })
    }

    getPreviewStyle(format: any) {
        this.selectedChannel = format;
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

    processImg() {
        this.isGenerating = true;
        const params = {
            image_url: this.selectedImage,
            channel_params: this.selectedChannel
        }
        this.productService.productProcessImg(params).subscribe({
            next: (result: any) => {
                this.isGenerating = false;
                if (typeof (result) === 'object') {
                    this.dialog.open(ProcessResultComponent, {
                        data: JSON.parse(result.body),
                        width: '400px'
                    });
                }
            },
            error: (error) => {
                this.isGenerating = false;
                console.error('Error in processImg:', error);
            },
            complete: () => {
                this.isGenerating = false;
                console.log('processImg finished.');
            }
        })
    }
}
