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
import { MatDialogModule } from '@angular/material/dialog';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { JobConfirmationComponent } from '../../productOne/job-confirmation/job-confirmation.component';
import { fetchUserAttributes, getCurrentUser } from 'aws-amplify/auth';
import { MatOption } from '@angular/material/core';
import { MatSelect } from '@angular/material/select';
import { Channel } from 'src/app/model/channel';
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
        MatAutocompleteModule
    ],
    templateUrl: './productProcessingView.component.html',
    styleUrls: ['./productProcessingView.component.scss']
})
export class productProcessingViewComponent {
    gtin: string | null = null;
    products: any[] = [];
    channels: any[] = [];
    channelStyles: { [key: string]: any } = {};

    selectedFormat = 'Sams';

    selectedTab = 0;

    selectedImage: string = '';
    selectedChannel = {} as Channel;

    isGenerating = false;

    selectedGtin: any[] = [];
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


    constructor(
        private route: ActivatedRoute,
        private productService: ProductService,
        private router: Router,
        private dialog: MatDialog
    ) { }

    ngOnInit(): void {
        this.route.queryParams.subscribe(params => {
            this.selectedGtin = Object.values(params);
            console.log('params', this.selectedGtin);

        });
        this.getPrductByGtin();
        this.getProductChannels();

        setTimeout(() => {
            this.channels.forEach(channel => {
                this.channelStyles[channel.channelID] = this.getPreviewStyle(channel);
            });
        }, 500);
    }

    goToReturn() {
        this.router.navigate(['/dashboards/dashboard1']);
    }

    async getPrductByGtin() {
        const attributes = await fetchUserAttributes();

        this.productService.productGetByGtin(this.selectedGtin).subscribe({
            next: (result) => {
                if (typeof (result) === 'object') {

                    result.data.entities.attributes.map((element: any) => {
                        const obj = {
                            gln: attributes['custom:userOwnershipData'],
                            gtin: element.gtin,
                            producName: element.tradeitemdescriptioninformation.descriptionshort,
                            images: (Array.isArray(element.referencedfileheader)) ? element.referencedfileheader : [],
                            currentIndex: 0
                        }
                        // if (element.referencedfileheader != null) {
                        this.products.push(obj);
                        // }
                    });

                    // if (this.product?.images?.length > 0) {
                    //     this.selectedImage = this.product.images[0].uniformresourceidentifier;
                    // }

                }
            }
        })
    }

    getChannel(event: any) {
        const channel = this.channels.find(channel => channel.provider === event.value);
        channel.background_color = this.rgbToHex(channel.background_color) || '#FFFFFF',
            this.selectedChannel = channel;
        console.log('channel', this.selectedChannel)
    }

    hexToRgb(hex: string): Array<number> {
        // Eliminar el símbolo '#' si está presente
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);

        return [r, g, b];
    }

    componentToHex(c: number): string {
        const hex = c.toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }

    rgbToHex(backgroundColor: string): string {
        const [r, g, b] = backgroundColor.split(',').map(Number);
        return '#' + this.componentToHex(r) + this.componentToHex(g) + this.componentToHex(b);
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
        // this.isGenerating = true;
        // console.log('Processing image with channel:', this.selectedFolderStructure);
        // console.log('Selected channel:', this.getGtins());
        this.selectedChannel.background_color = this.hexToRgb(this.selectedChannel.background_color).join(','), // Convert hex to RGB

        console.log('Selected folder structure:', this.selectedChannel);
        const params = {
            images_url: product,
            channel_params: this.selectedChannel,
            folder_structure: this.selectedFolderStructure,
            is_multiple_processing: true
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

            this.processImgNoBackground(product);
        });

        // this.products.forEach((product) => {
        //     product.images = product.images.slice(0, this.imagesPerGtin);
        //     console.log('process sin fondo', product)

        //     this.processImgNoBackground(product);
        // });
    }

    processImgNoBackground(product: any) {
        this.isGenerating = true;
        const params = {
            images_url: product,
            channel_params: this.selectedChannel,
            no_background: true
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
}
